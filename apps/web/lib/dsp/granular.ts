/**
 * Granular synthesis engine.
 *
 * Two modes:
 * 1. Shard mode (existing): concatenative slice/shuffle/reassemble
 *    via sliceAudio + buildGrainSequence.
 * 2. Cloud mode (new): overlap-add grains with Hann/Tukey envelopes,
 *    random pan, pitch distribution, reverse probability, density/jitter.
 *
 * All operations produce deterministic output for the same seed.
 * Finite, bounded output — no NaN/Infinity.
 */

import { normalizePeak, pitchShiftGrainChannels } from "./transforms";

// ── RNG ──────────────────────────────────────────────────────────────

type Rng = { next: () => number };

function seededRng(seed: number): Rng {
  let s = seed;
  return {
    next: () => {
      s = (s * 1664525 + 1013904223) & 0xffffffff;
      return (s >>> 0) / 0x100000000;
    },
  };
}

// ── Window functions ─────────────────────────────────────────────────

function hannWindow(length: number): Float32Array {
  const w = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    w[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (length - 1)));
  }
  return w;
}

function tukeyWindow(length: number, alpha: number = 0.5): Float32Array {
  // Tukey window: Hann on edges, flat middle
  const w = new Float32Array(length);
  const taperLen = Math.floor((alpha * length) / 2);
  for (let i = 0; i < length; i++) {
    if (i < taperLen) {
      w[i] = 0.5 * (1 - Math.cos((Math.PI * i) / taperLen));
    } else if (i >= length - taperLen) {
      w[i] = 0.5 * (1 - Math.cos((Math.PI * (length - 1 - i)) / taperLen));
    } else {
      w[i] = 1;
    }
  }
  return w;
}

// ── Cloud mode configuration ─────────────────────────────────────────

export interface CloudOptions {
  /** Grain duration in ms */
  grainMs?: number;
  /** Grains per second (density) */
  density?: number;
  /** Fraction of grains reversed (0-1) */
  reverseProbability?: number;
  /** Pitch range in semitones (±) */
  pitchRange?: number;
  /** Pan randomization amount (0-1) */
  panSpread?: number;
  /** Position jitter as fraction of grain length */
  jitter?: number;
  /** Total output duration in seconds (0 = calculate from density) */
  durationS?: number;
  /** Window type: "hann" or "tukey" */
  windowType?: "hann" | "tukey";
  /** Overlap factor (1 = no overlap, 2 = 50% overlap, 4 = 75% overlap) */
  overlap?: number;
  /** Seed for deterministic PRNG */
  seed?: number;
}

const CLOUD_DEFAULTS: Required<Omit<CloudOptions, "durationS">> & {
  durationS: number;
} = {
  grainMs: 100,
  density: 10,
  reverseProbability: 0,
  pitchRange: 0,
  panSpread: 0,
  jitter: 0,
  durationS: 0,
  windowType: "hann",
  overlap: 2,
  seed: 42,
};

// ── Cloud generator ──────────────────────────────────────────────────

/**
 * Generates a granular cloud using overlap-add.
 * Produces long, evolving textures with smooth grain boundaries.
 */
export function granularCloud(
  channels: Float32Array[],
  sampleRate: number,
  options: CloudOptions = {},
): Float32Array[] {
  const opts = { ...CLOUD_DEFAULTS, ...options };
  const rng = seededRng(opts.seed);

  const isStereo = channels.length >= 2;
  const ch0 = channels[0];
  const ch1 = isStereo ? channels[1] : channels[0];

  // Grain parameters
  const grainSamples = Math.max(
    16,
    Math.min(Math.floor((sampleRate * opts.grainMs) / 1000), ch0.length),
  );
  const window =
    opts.windowType === "tukey"
      ? tukeyWindow(grainSamples, 0.4)
      : hannWindow(grainSamples);

  // Calculate output length
  const hopSize = Math.max(1, Math.floor(grainSamples / opts.overlap));
  const numGrains =
    opts.durationS > 0
      ? Math.floor((opts.durationS * sampleRate) / hopSize)
      : Math.max(16, Math.floor(opts.density * 10));
  const outLen = numGrains * hopSize + grainSamples;

  // Output buffers
  const outLeft = new Float32Array(outLen);
  const outRight = isStereo ? new Float32Array(outLen) : outLeft;
  const normLeft = new Float32Array(outLen);
  const normRight = isStereo ? new Float32Array(outLen) : normLeft;

  for (let g = 0; g < numGrains; g++) {
    // Position: random within source with jitter
    const maxPos = Math.max(0, ch0.length - grainSamples);
    const jitterAmount = Math.floor(
      opts.jitter * grainSamples * (rng.next() - 0.5),
    );
    const pos = Math.max(
      0,
      Math.min(maxPos, Math.floor(rng.next() * maxPos) + jitterAmount),
    );

    // Pitch shift
    const semitones =
      opts.pitchRange > 0 ? (rng.next() * 2 - 1) * opts.pitchRange : 0;

    // Extract grain
    let grainLeft: Float32Array = new Float32Array(
      ch0.slice(pos, Math.min(pos + grainSamples, ch0.length)),
    );
    let grainRight: Float32Array = isStereo
      ? new Float32Array(
          ch1.slice(pos, Math.min(pos + grainSamples, ch1.length)),
        )
      : grainLeft;

    // Pitch shift grain if needed
    if (Math.abs(semitones) > 0.1) {
      grainLeft = pitchShiftGrainChannels([grainLeft], semitones)[0];
      if (isStereo) {
        grainRight = pitchShiftGrainChannels([grainRight], semitones)[0];
      }
    }

    // Reverse
    if (rng.next() < opts.reverseProbability) {
      const rev = new Float32Array(grainLeft.length);
      for (let i = 0; i < grainLeft.length; i++)
        rev[i] = grainLeft[grainLeft.length - 1 - i];
      grainLeft = rev;
      if (isStereo) {
        const revR = new Float32Array(grainRight.length);
        for (let i = 0; i < grainRight.length; i++)
          revR[i] = grainRight[grainRight.length - 1 - i];
        grainRight = revR;
      }
    }

    // Pan (for stereo)
    const pan = isStereo ? (rng.next() * 2 - 1) * opts.panSpread : 0;
    const leftGain = isStereo ? Math.cos(((pan + 1) * Math.PI) / 4) : 1;
    const rightGain = isStereo ? Math.sin(((pan + 1) * Math.PI) / 4) : 1;

    // Overlap-add with window
    const outPos = g * hopSize;
    for (let i = 0; i < grainSamples && i < grainLeft.length; i++) {
      const w = window[i] || 0;
      const outIdx = outPos + i;
      if (outIdx < outLen) {
        outLeft[outIdx] += grainLeft[i] * w * leftGain;
        normLeft[outIdx] += w * Math.abs(leftGain);
        if (isStereo) {
          outRight[outIdx] += (grainRight[i] || grainLeft[i]) * w * rightGain;
          normRight[outIdx] += w * Math.abs(rightGain);
        }
      }
    }
  }

  // Normalize by overlap count
  for (let i = 0; i < outLen; i++) {
    if (normLeft[i] > 1e-10) outLeft[i] /= normLeft[i];
    if (isStereo && normRight[i] > 1e-10) outRight[i] /= normRight[i];
  }

  const result = isStereo ? [outLeft, outRight] : [outLeft];
  return normalizePeak(result, 0.89);
}

// ── Frozen texture ───────────────────────────────────────────────────

/**
 * "Freezes" a short section of audio by repeating overlapping grains.
 * Creates a sustained, static-ish drone from a short slice.
 */
export function frozenTexture(
  channels: Float32Array[],
  sampleRate: number,
  options: {
    freezeStartS?: number;
    freezeDurationS?: number;
    outputDurationS?: number;
    grainMs?: number;
    overlap?: number;
    jitter?: number;
    seed?: number;
  } = {},
): Float32Array[] {
  const {
    freezeStartS = 0,
    freezeDurationS = 0.5,
    outputDurationS = 5,
    grainMs = 80,
    overlap = 3,
    jitter = 0.3,
    seed = 99,
  } = options;

  const ch0 = channels[0];
  const sampleRateSafe = sampleRate;
  const srcLen = ch0.length;

  // Extract freeze region
  const freezeStart = Math.floor(freezeStartS * sampleRateSafe);
  const freezeLen = Math.min(
    Math.floor(freezeDurationS * sampleRateSafe),
    srcLen - freezeStart,
  );

  // If freeze region is too small or source is too short, use the whole thing
  const region =
    freezeLen >= 64
      ? channels.map((ch) => ch.slice(freezeStart, freezeStart + freezeLen))
      : channels;

  // Generate cloud from this small region
  return granularCloud(region, sampleRateSafe, {
    grainMs,
    density: 15,
    jitter,
    durationS: outputDurationS,
    overlap,
    seed,
    pitchRange: 0.5, // subtle pitch variation for movement
  });
}

// ── Grain reverb bloom ───────────────────────────────────────────────

/**
 * Grains with reverb-like tails — each grain decays into a wash.
 * Uses accumulated overlapping grains with exponential decay envelopes.
 */
export function grainReverbBloom(
  channels: Float32Array[],
  sampleRate: number,
  options: {
    grainMs?: number;
    density?: number;
    decayS?: number;
    durationS?: number;
    pitchRange?: number;
    panSpread?: number;
    seed?: number;
  } = {},
): Float32Array[] {
  const {
    grainMs = 120,
    decayS = 2,
    durationS = 8,
    pitchRange = 3,
    panSpread = 0.8,
    seed = 77,
  } = options;

  const rng = seededRng(seed);
  const isStereo = channels.length >= 2;
  const ch0 = channels[0];
  const ch1 = isStereo ? channels[1] : ch0;

  const grainSamples = Math.max(32, Math.floor((sampleRate * grainMs) / 1000));
  const decaySamples = Math.floor(sampleRate * decayS);
  const outLen = Math.floor(sampleRate * durationS);

  const outLeft = new Float32Array(outLen + decaySamples);
  const outRight = isStereo ? new Float32Array(outLen + decaySamples) : outLeft;

  const hopSize = Math.max(1, Math.floor(grainSamples / 2));
  const numGrains = Math.floor(outLen / hopSize);

  const window = hannWindow(grainSamples);

  for (let g = 0; g < numGrains; g++) {
    const maxPos = Math.max(0, ch0.length - grainSamples);
    const pos = Math.floor(rng.next() * maxPos);

    const semitones = (rng.next() * 2 - 1) * pitchRange;

    let gLeft: Float32Array = new Float32Array(
      ch0.slice(pos, Math.min(pos + grainSamples, ch0.length)),
    );
    let gRight: Float32Array = isStereo
      ? new Float32Array(
          ch1.slice(pos, Math.min(pos + grainSamples, ch1.length)),
        )
      : gLeft;

    if (Math.abs(semitones) > 0.1) {
      gLeft = pitchShiftGrainChannels([gLeft], semitones)[0];
      if (isStereo) gRight = pitchShiftGrainChannels([gRight], semitones)[0];
    }

    const pan = isStereo ? (rng.next() * 2 - 1) * panSpread : 0;
    const leftGain = isStereo ? Math.cos(((pan + 1) * Math.PI) / 4) : 1;
    const rightGain = isStereo ? Math.sin(((pan + 1) * Math.PI) / 4) : 1;

    const outPos = g * hopSize;
    for (let i = 0; i < grainSamples && i < gLeft.length; i++) {
      // Exponential decay envelope from grain onset
      const decayEnv = Math.exp(-i / decaySamples);
      const w = (window[i] || 0) * decayEnv;
      const idx = outPos + i;
      if (idx < outLen + decaySamples) {
        outLeft[idx] += gLeft[i] * w * leftGain;
        if (isStereo) {
          outRight[idx] += (gRight[i] || gLeft[i]) * w * rightGain;
        }
      }
    }
  }

  const result = isStereo ? [outLeft, outRight] : [outLeft];
  return normalizePeak(result, 0.89);
}

// ── Granular delay swarm ─────────────────────────────────────────────

/**
 * Grains with feedback-delay-like diffusion.
 * Grain output is fed back into a delay line network,
 * creating cascading swarms of delayed grains.
 */
export function granularDelaySwarm(
  channels: Float32Array[],
  sampleRate: number,
  options: {
    grainMs?: number;
    density?: number;
    durationS?: number;
    feedbackAmount?: number;
    delayTimeMs?: number;
    pitchRange?: number;
    seed?: number;
  } = {},
): Float32Array[] {
  const {
    grainMs = 60,
    durationS = 6,
    feedbackAmount = 0.6,
    delayTimeMs = 200,
    pitchRange = 5,
    seed = 123,
  } = options;

  const rng = seededRng(seed);
  const isStereo = channels.length >= 2;
  const ch0 = channels[0];
  const ch1 = isStereo ? channels[1] : ch0;

  const grainSamples = Math.max(16, Math.floor((sampleRate * grainMs) / 1000));
  const delaySamples = Math.max(
    1,
    Math.floor((sampleRate * delayTimeMs) / 1000),
  );
  const outLen = Math.floor(sampleRate * durationS);

  const outLeft = new Float32Array(outLen);
  const outRight = isStereo ? new Float32Array(outLen) : outLeft;
  const normLeft = new Float32Array(outLen);
  const normRight = isStereo ? new Float32Array(outLen) : normLeft;

  // Delay lines for feedback
  const delayLeft = new Float32Array(delaySamples);
  const delayRight = isStereo ? new Float32Array(delaySamples) : delayLeft;
  let dIdx = 0;

  const hopSize = Math.max(1, Math.floor(grainSamples / 2.5));
  const numGrains = Math.floor(outLen / hopSize);
  const window = hannWindow(grainSamples);

  for (let g = 0; g < numGrains; g++) {
    const maxPos = Math.max(0, ch0.length - grainSamples);
    const pos = Math.floor(rng.next() * maxPos);

    const semitones = (rng.next() * 2 - 1) * pitchRange;

    let gLeft: Float32Array = new Float32Array(
      ch0.slice(pos, Math.min(pos + grainSamples, ch0.length)),
    );
    let gRight: Float32Array = isStereo
      ? new Float32Array(
          ch1.slice(pos, Math.min(pos + grainSamples, ch1.length)),
        )
      : gLeft;

    if (Math.abs(semitones) > 0.1) {
      gLeft = pitchShiftGrainChannels([gLeft], semitones)[0];
      if (isStereo) gRight = pitchShiftGrainChannels([gRight], semitones)[0];
    }

    // Read from delay line (feedback)
    const fbLeft = delayLeft[dIdx] * feedbackAmount;
    const fbRight = isStereo ? delayRight[dIdx] * feedbackAmount : fbLeft;

    const outPos = g * hopSize;
    for (let i = 0; i < grainSamples && i < gLeft.length; i++) {
      const w = window[i] || 0;
      const idx = outPos + i;
      if (idx < outLen) {
        outLeft[idx] += (gLeft[i] + fbLeft) * w;
        normLeft[idx] += w;
        if (isStereo) {
          outRight[idx] += ((gRight[i] || gLeft[i]) + fbRight) * w;
          normRight[idx] += w;
        }
      }
    }

    // Write to delay line
    delayLeft[dIdx] = gLeft[Math.floor(grainSamples / 2)] || 0;
    if (isStereo) {
      delayRight[dIdx] =
        gRight[Math.floor(grainSamples / 2)] ||
        gLeft[Math.floor(grainSamples / 2)] ||
        0;
    }
    dIdx = (dIdx + 1) % delaySamples;
  }

  // Normalize
  for (let i = 0; i < outLen; i++) {
    if (normLeft[i] > 1e-10) outLeft[i] /= normLeft[i];
    if (isStereo && normRight[i] > 1e-10) outRight[i] /= normRight[i];
  }

  const result = isStereo ? [outLeft, outRight] : [outLeft];
  return normalizePeak(result, 0.89);
}
