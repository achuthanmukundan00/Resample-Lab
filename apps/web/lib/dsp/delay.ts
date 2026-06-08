/**
 * Delay / echo processors.
 *
 * All delays produce finite, stable output.
 * Tails are fully rendered (not chopped).
 * Feedback is bounded to prevent runaway amplitude.
 */

import { normalizePeak } from "./transforms";

// ── Mono delay ───────────────────────────────────────────────────────

export interface DelayOptions {
  /** Delay time in milliseconds */
  timeMs: number;
  /** Feedback amount (0–0.95). Clamped to prevent instability. */
  feedback?: number;
  /** Wet/dry mix (0–1). 0 = dry only, 1 = wet only. */
  mix?: number;
  /** Lowpass cutoff Hz for filtered feedback. 0 = no filter. */
  feedbackFilterHz?: number;
  /** Highpass cutoff Hz for feedback. 0 = no filter. */
  feedbackHighpassHz?: number;
}

export function monoDelay(
  channels: Float32Array[],
  sampleRate: number,
  options: DelayOptions,
): Float32Array[] {
  const {
    timeMs,
    feedback = 0.3,
    mix = 0.5,
    feedbackFilterHz = 0,
    feedbackHighpassHz = 0,
  } = options;

  const delaySamples = Math.max(
    1,
    Math.min(Math.floor((sampleRate * timeMs) / 1000), channels[0].length),
  );
  const safeFeedback = Math.max(0, Math.min(0.95, feedback));

  return channels.map((ch) => {
    const out = new Float32Array(ch.length);
    const delayLine = new Float32Array(delaySamples);
    let dIdx = 0;
    let lpfY = 0;
    let hpfY = 0;
    let hpfX1 = 0;

    // RC filter coefficients
    let lpfAlpha = 0;
    let hpfAlpha = 0;
    if (feedbackFilterHz > 0) {
      const RC = 1 / (2 * Math.PI * feedbackFilterHz);
      const dt = 1 / sampleRate;
      lpfAlpha = dt / (RC + dt);
    }
    if (feedbackHighpassHz > 0) {
      // DC-blocking style highpass for feedback
      hpfAlpha = 1 - (2 * Math.PI * feedbackHighpassHz) / sampleRate;
    }

    for (let i = 0; i < ch.length; i++) {
      // Read delayed sample
      const delayed = delayLine[dIdx];

      // Apply feedback filtering
      let filteredDelay = delayed;
      if (feedbackFilterHz > 0) {
        lpfY = lpfY + lpfAlpha * (delayed - lpfY);
        filteredDelay = lpfY;
      }
      if (feedbackHighpassHz > 0) {
        hpfY = filteredDelay - hpfX1 + hpfAlpha * hpfY;
        hpfX1 = filteredDelay;
        filteredDelay = hpfY;
      }

      // Write to delay line (dry + filtered feedback)
      delayLine[dIdx] = ch[i] + safeFeedback * filteredDelay;
      dIdx = (dIdx + 1) % delaySamples;

      // Mix output
      out[i] = ch[i] * (1 - mix) + filteredDelay * mix;
    }

    return normalizePeak([out], 0.95)[0];
  });
}

// ── Stereo ping-pong delay ───────────────────────────────────────────

export function pingPongDelay(
  channels: Float32Array[],
  sampleRate: number,
  options: DelayOptions,
): Float32Array[] {
  const stereo =
    channels.length >= 2 ? channels : [channels[0], channels[0].slice()];
  const { timeMs, feedback = 0.3, mix = 0.5, feedbackFilterHz = 0 } = options;

  const delaySamples = Math.max(
    1,
    Math.min(Math.floor((sampleRate * timeMs) / 1000), stereo[0].length),
  );
  const safeFeedback = Math.max(0, Math.min(0.9, feedback));
  const halfDelay = Math.max(1, Math.floor(delaySamples / 2));

  return stereo.map((ch, chIdx) => {
    const otherCh = stereo[1 - chIdx];
    const out = new Float32Array(ch.length);
    const dLen = delaySamples + halfDelay;
    const delayLine = new Float32Array(dLen);
    let dIdx = 0;
    let lpfY = 0;
    let lpfAlpha = 0;

    if (feedbackFilterHz > 0) {
      const RC = 1 / (2 * Math.PI * feedbackFilterHz);
      const dt = 1 / sampleRate;
      lpfAlpha = dt / (RC + dt);
    }

    for (let i = 0; i < ch.length; i++) {
      // Read from delay line with half-delay offset (cross-channel)
      const readIdx = (dIdx + halfDelay) % dLen;
      const delayed = delayLine[readIdx];

      let filteredDelay = delayed;
      if (feedbackFilterHz > 0) {
        lpfY = lpfY + lpfAlpha * (delayed - lpfY);
        filteredDelay = lpfY;
      }

      // Write to delay line using the OTHER channel as feedback source
      // This creates the ping-pong effect
      const feedSource =
        i < halfDelay ? ch[i] : otherCh[Math.min(i, otherCh.length - 1)];
      delayLine[dIdx] = feedSource + safeFeedback * filteredDelay;
      dIdx = (dIdx + 1) % dLen;

      out[i] = ch[i] * (1 - mix) + filteredDelay * mix;
    }

    return normalizePeak([out], 0.95)[0];
  });
}

// ── Diffusion / allpass smear delay ──────────────────────────────────

/**
 * Diffusion delay that smears transients into a wash.
 * Uses cascaded allpass filters in the feedback path.
 */
export function diffusionDelay(
  channels: Float32Array[],
  sampleRate: number,
  options: {
    delayMs?: number;
    feedback?: number;
    mix?: number;
    diffusion?: number; // 0–1, amount of allpass smearing
    stages?: number; // allpass stages (2–6)
  } = {},
): Float32Array[] {
  const {
    delayMs = 100,
    feedback = 0.4,
    mix = 0.6,
    diffusion = 0.7,
    stages = 4,
  } = options;

  const delaySamples = Math.max(
    1,
    Math.min(Math.floor((sampleRate * delayMs) / 1000), channels[0].length),
  );
  const diffGain = Math.max(0.1, Math.min(0.95, diffusion));
  const allpassStages = Math.max(2, Math.min(6, Math.floor(stages)));

  // Stability guard: the cascaded feedforward-comb-like stages can produce
  // a peak gain of (1 + diffGain)^allpassStages.  We must keep the total
  // loop gain (safeFeedback × cascadePeakGain) below 1 to prevent runaway
  // amplitude that produces NaN/Infinity.
  const cascadePeakGain = Math.pow(1 + diffGain, allpassStages);
  const maxStableFeedback = 0.93 / cascadePeakGain;
  const safeFeedback = Math.max(
    0,
    Math.min(Math.min(0.85, feedback), maxStableFeedback),
  );

  // Allpass delay lengths for each stage
  const apDelays: number[] = [];
  for (let s = 0; s < allpassStages; s++) {
    apDelays.push(Math.max(1, Math.floor(delaySamples * (0.2 + s * 0.15))));
  }

  return channels.map((ch) => {
    const out = new Float32Array(ch.length);

    // Allpass delay lines for feedback path
    const apBufs: Float32Array[] = apDelays.map((d) => new Float32Array(d));
    const apIdxs: number[] = apDelays.map(() => 0);

    // Main delay line
    const delayBuf = new Float32Array(delaySamples);
    let dIdx = 0;

    for (let i = 0; i < ch.length; i++) {
      // Read from main delay
      const delayed = delayBuf[dIdx];

      // Apply cascaded allpass smearing in feedback path
      let smeared = delayed;
      for (let s = 0; s < allpassStages; s++) {
        const apRead = apBufs[s][apIdxs[s]];
        const apOut = smeared + diffGain * apRead;
        apBufs[s][apIdxs[s]] = smeared - diffGain * apRead;
        apIdxs[s] = (apIdxs[s] + 1) % apDelays[s];
        smeared = apOut;
      }

      // Write to delay line
      delayBuf[dIdx] = ch[i] + safeFeedback * smeared;
      dIdx = (dIdx + 1) % delaySamples;

      // Output
      out[i] = ch[i] * (1 - mix) + smeared * mix;
    }

    return normalizePeak([out], 0.95)[0];
  });
}

// ── Reverse delay ────────────────────────────────────────────────────

/**
 * Reverse delay: reads the delay buffer in reverse,
 * creating pre-echo and reverse-tail effects.
 */
export function reverseDelay(
  channels: Float32Array[],
  sampleRate: number,
  options: {
    delayMs?: number;
    feedback?: number;
    mix?: number;
  } = {},
): Float32Array[] {
  const { delayMs = 200, feedback = 0.3, mix = 0.5 } = options;

  const delaySamples = Math.max(
    1,
    Math.min(Math.floor((sampleRate * delayMs) / 1000), channels[0].length),
  );
  const safeFeedback = Math.max(0, Math.min(0.8, feedback));

  return channels.map((ch) => {
    const out = new Float32Array(ch.length);
    const delayBuf = new Float32Array(delaySamples);
    let dIdx = 0;

    for (let i = 0; i < ch.length; i++) {
      // Read in REVERSE order
      const revIdx = delaySamples - 1 - (dIdx % delaySamples);
      const delayed = delayBuf[revIdx];

      delayBuf[dIdx] = ch[i] + safeFeedback * delayed;
      dIdx = (dIdx + 1) % delaySamples;

      out[i] = ch[i] * (1 - mix) + delayed * mix;
    }

    return normalizePeak([out], 0.95)[0];
  });
}

// ── Multi-tap delay ──────────────────────────────────────────────────

export interface TapSpec {
  timeMs: number;
  gain: number;
  pan?: number; // -1 left, 1 right, 0 center (for stereo only)
}

export function multiTapDelay(
  channels: Float32Array[],
  sampleRate: number,
  taps: TapSpec[],
): Float32Array[] {
  if (taps.length === 0) return channels;

  const isStereo = channels.length >= 2;
  const srcLen = channels[0].length;

  // Calculate output length (source + longest tap delay)
  const maxTapMs = Math.max(...taps.map((t) => t.timeMs));
  const maxTapSamples = Math.floor((sampleRate * maxTapMs) / 1000);
  const outLen = srcLen + maxTapSamples;

  if (isStereo) {
    const left = new Float32Array(outLen);
    const right = new Float32Array(outLen);

    // Copy dry signal
    for (let i = 0; i < srcLen; i++) {
      left[i] += channels[0][i];
      right[i] += channels[1][i];
    }

    // Add taps
    for (const tap of taps) {
      const delaySamples = Math.floor((sampleRate * tap.timeMs) / 1000);
      const pan = tap.pan ?? 0;
      const leftGain = tap.gain * (1 - Math.max(0, pan)) * 0.7;
      const rightGain = tap.gain * (1 + Math.min(0, pan)) * 0.7;

      for (let i = 0; i < srcLen; i++) {
        const outIdx = i + delaySamples;
        if (outIdx < outLen) {
          left[outIdx] += channels[0][i] * leftGain;
          right[outIdx] += channels[1][i] * rightGain;
        }
      }
    }

    return normalizePeak([left, right], 0.95);
  } else {
    const mono = new Float32Array(outLen);
    for (let i = 0; i < srcLen; i++) {
      mono[i] += channels[0][i];
    }
    for (const tap of taps) {
      const delaySamples = Math.floor((sampleRate * tap.timeMs) / 1000);
      for (let i = 0; i < srcLen; i++) {
        const outIdx = i + delaySamples;
        if (outIdx < outLen) {
          mono[outIdx] += channels[0][i] * tap.gain * 0.7;
        }
      }
    }
    return normalizePeak([mono], 0.95);
  }
}
