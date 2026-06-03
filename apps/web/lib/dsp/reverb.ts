/**
 * Reverb processors.
 *
 * All reverbs produce finite, stable output with rendered tails.
 * Comb/allpass networks, modulated delays, and short convolution.
 * Damping, stereo spread, and tail rendering included.
 */

import { normalizePeak } from "./transforms";
import { checkAborted } from "./deadline";

// ── Dark room reverb ─────────────────────────────────────────────────

/**
 * Small-to-medium room reverb with heavy damping (dark).
 * Uses a 4-comb + 2-allpass FDN-style network.
 */
export function darkRoom(
  channels: Float32Array[],
  sampleRate: number,
  options: {
    decay?: number;
    damping?: number;
    mix?: number;
  } = {},
): Float32Array[] {
  const { decay = 0.5, damping = 0.7, mix = 0.5 } = options;

  const safeDecay = Math.max(0.1, Math.min(0.95, decay));
  const safeMix = Math.max(0, Math.min(1, mix));

  // Comb delay lengths (prime-ish numbers for density)
  const combDelays = [1553, 1617, 1789, 1913]; // ~32-40ms at 48kHz
  const allpassDelays = [223, 293]; // ~4.6-6.1ms at 48kHz

  return channels.map((ch) => {
    const len = ch.length + Math.floor(sampleRate * 1.5); // 1.5s tail room
    const out = new Float32Array(len);

    // Comb buffers
    const combBufs = combDelays.map((d) => new Float32Array(d));
    const combIdxs = combDelays.map(() => 0);

    // Allpass buffers
    const apBufs = allpassDelays.map((d) => new Float32Array(d));
    const apIdxs = allpassDelays.map(() => 0);

    // Damping filter state (per comb)
    const combLpfY = combDelays.map(() => 0);
    const lpfAlpha = 1 - damping;

    for (let i = 0; i < len; i++) {
      if ((i & 0xFFF) === 0) checkAborted();
      const dry = i < ch.length ? ch[i] : 0;

      // Comb section
      let combSum = 0;
      for (let c = 0; c < combDelays.length; c++) {
        const combOut = combBufs[c][combIdxs[c]];
        // Apply damping (lowpass in feedback)
        combLpfY[c] = combLpfY[c] + lpfAlpha * (combOut - combLpfY[c]);
        const damped = combLpfY[c];

        // Write input + feedback
        const fb = 0.015 * safeDecay; // scale to keep stable
        combBufs[c][combIdxs[c]] = dry + damped * safeDecay * (1 - fb);
        combIdxs[c] = (combIdxs[c] + 1) % combDelays[c];

        combSum += damped;
      }
      combSum *= 0.25; // distribute across combs

      // Allpass section
      let apOut = combSum;
      for (let a = 0; a < allpassDelays.length; a++) {
        const apRead = apBufs[a][apIdxs[a]];
        const apFeed = apOut + apRead * 0.5;
        apBufs[a][apIdxs[a]] = apOut - apRead * 0.5;
        apIdxs[a] = (apIdxs[a] + 1) % allpassDelays[a];
        apOut = apFeed;
      }

      out[i] = dry * (1 - safeMix) + apOut * safeMix;
    }

    return normalizePeak([out], 0.95)[0];
  });
}

// ── Modulated hall / cloud reverb ────────────────────────────────────

/**
 * Larger hall reverb with modulation applied to delay read positions.
 * Creates a "cloud" or "bloom" reverb effect with subtle pitch drift.
 */
export function modulatedHall(
  channels: Float32Array[],
  sampleRate: number,
  options: {
    decay?: number;
    damping?: number;
    modulationDepth?: number;
    modulationRate?: number;
    mix?: number;
    size?: number; // 0–1, room size multiplier
  } = {},
): Float32Array[] {
  const {
    decay = 0.6,
    damping = 0.5,
    modulationDepth = 0.003,
    modulationRate = 0.15,
    mix = 0.5,
    size = 0.7,
  } = options;

  const safeDecay = Math.max(0.1, Math.min(0.95, decay));
  const safeDamping = Math.max(0.05, Math.min(0.98, damping));
  const safeModDepth = Math.max(0, Math.min(0.01, modulationDepth));
  const safeMix = Math.max(0, Math.min(1, mix));
  const sizeMult = 0.3 + size * 1.5;

  // Larger delay lengths for hall
  const combDelays = [
    Math.floor(1687 * sizeMult),
    Math.floor(1861 * sizeMult),
    Math.floor(2053 * sizeMult),
    Math.floor(2251 * sizeMult),
  ];
  const allpassDelays = [
    Math.floor(337 * sizeMult),
    Math.floor(487 * sizeMult),
  ];

  return channels.map((ch) => {
    const tailS = 2 + decay * 4;
    const len = ch.length + Math.floor(sampleRate * tailS);
    const out = new Float32Array(len);

    // Pre-damping lowpass
    const lpfAlpha = 1 - safeDamping;

    const combBufs = combDelays.map((d) => new Float32Array(d));
    const combIdxs = combDelays.map(() => 0);
    const combLpfY = combDelays.map(() => 0);

    const apBufs = allpassDelays.map((d) => new Float32Array(d));
    const apIdxs = allpassDelays.map(() => 0);

    for (let i = 0; i < len; i++) {
      const dry = i < ch.length ? ch[i] : 0;

      // Modulation (sinusoidal delay read offset)
      const t = i / sampleRate;
      const modOffset =
        Math.sin(2 * Math.PI * modulationRate * t) * safeModDepth;

      let combSum = 0;
      for (let c = 0; c < combDelays.length; c++) {
        // Modulated read position
        const baseIdx = combIdxs[c];
        const moddedIdx = baseIdx + Math.floor(modOffset * combDelays[c]);
        const readIdx =
          ((moddedIdx % combDelays[c]) + combDelays[c]) % combDelays[c];

        const combOut = combBufs[c][readIdx];
        combLpfY[c] = combLpfY[c] + lpfAlpha * (combOut - combLpfY[c]);
        const damped = combLpfY[c];

        combBufs[c][combIdxs[c]] = dry + damped * safeDecay * 0.85;
        combIdxs[c] = (combIdxs[c] + 1) % combDelays[c];

        combSum += damped;
      }
      combSum *= 0.25;

      // Allpass
      let apOut = combSum;
      for (let a = 0; a < allpassDelays.length; a++) {
        const apRead = apBufs[a][apIdxs[a]];
        const apFeed = apOut + apRead * 0.55;
        apBufs[a][apIdxs[a]] = apOut - apRead * 0.55;
        apIdxs[a] = (apIdxs[a] + 1) % allpassDelays[a];
        apOut = apFeed;
      }

      out[i] = dry * (1 - safeMix) + apOut * safeMix;
    }

    return normalizePeak([out], 0.95)[0];
  });
}

// ── Dirty metallic smear ─────────────────────────────────────────────

/**
 * Aggressive, slightly metallic reverb for industrial/degraded textures.
 * Uses shorter comb delays and higher feedback for ringy character.
 */
export function dirtyMetallic(
  channels: Float32Array[],
  sampleRate: number,
  options: {
    decay?: number;
    color?: number; // 0 = dark, 1 = bright/metallic
    mix?: number;
  } = {},
): Float32Array[] {
  const { decay = 0.5, color = 0.6, mix = 0.5 } = options;
  const safeDecay = Math.max(0.1, Math.min(0.9, decay));
  const safeColor = Math.max(0, Math.min(1, color));
  const safeMix = Math.max(0, Math.min(1, mix));

  // Shorter, more metallic comb delays
  const combDelays = [479, 521, 587, 643, 709, 773]; // ~10-16ms
  const allpassDelays = [97, 113]; // ~2ms

  return channels.map((ch) => {
    const tailS = 1 + decay * 3;
    const len = ch.length + Math.floor(sampleRate * tailS);
    const out = new Float32Array(len);

    const combBufs = combDelays.map((d) => new Float32Array(d));
    const combIdxs = combDelays.map(() => 0);

    // Damping filter: dark = heavy LPF, bright = less
    const damping = 1 - safeColor * 0.7;
    const lpfAlpha = 1 - damping;
    const combLpfY = combDelays.map(() => 0);

    const apBufs = allpassDelays.map((d) => new Float32Array(d));
    const apIdxs = allpassDelays.map(() => 0);

    for (let i = 0; i < len; i++) {
      const dry = i < ch.length ? ch[i] : 0;

      let combSum = 0;
      for (let c = 0; c < combDelays.length; c++) {
        const combOut = combBufs[c][combIdxs[c]];
        combLpfY[c] = combLpfY[c] + lpfAlpha * (combOut - combLpfY[c]);
        const damped = combLpfY[c];

        combBufs[c][combIdxs[c]] = dry + damped * safeDecay * 0.8;
        combIdxs[c] = (combIdxs[c] + 1) % combDelays[c];

        combSum += damped;
      }
      combSum /= combDelays.length;

      // Allpass with higher gain for metallic sheen
      let apOut = combSum;
      for (let a = 0; a < allpassDelays.length; a++) {
        const apRead = apBufs[a][apIdxs[a]];
        const apFeed = apOut + apRead * 0.65;
        apBufs[a][apIdxs[a]] = apOut - apRead * 0.65;
        apIdxs[a] = (apIdxs[a] + 1) % allpassDelays[a];
        apOut = apFeed;
      }

      out[i] = dry * (1 - safeMix) + apOut * safeMix;
    }

    return normalizePeak([out], 0.95)[0];
  });
}

// ── Reverse bloom reverb ─────────────────────────────────────────────

/**
 * Reverse reverb: reversed input → reverb → reverse back.
 * Creates a swelling, blooming tail before the sound.
 */
export function reverseBloom(
  channels: Float32Array[],
  sampleRate: number,
  options: {
    decay?: number;
    damping?: number;
    mix?: number;
  } = {},
): Float32Array[] {
  const { decay = 0.6, damping = 0.6, mix = 0.7 } = options;

  const safeDecay = Math.max(0.1, Math.min(0.95, decay));
  const safeDamping = Math.max(0.1, Math.min(0.99, damping));
  const safeMix = Math.max(0, Math.min(1, mix));

  // Comb delays
  const combDelays = [1423, 1617, 1789, 1999];
  const allpassDelays = [251, 337];

  return channels.map((ch) => {
    const tailS = 2 + decay * 3;
    const len = ch.length + Math.floor(sampleRate * tailS);
    const out = new Float32Array(len);

    // Reverse the input for the reverb
    const reversed = new Float32Array(ch.length);
    for (let i = 0; i < ch.length; i++) {
      reversed[i] = ch[ch.length - 1 - i];
    }

    const combBufs = combDelays.map((d) => new Float32Array(d));
    const combIdxs = combDelays.map(() => 0);

    const apBufs = allpassDelays.map((d) => new Float32Array(d));
    const apIdxs = allpassDelays.map(() => 0);

    const lpfAlpha = 1 - safeDamping;
    const combLpfY = combDelays.map(() => 0);

    // Process reversed signal through reverb
    const reverbOut = new Float32Array(len);
    for (let i = 0; i < len; i++) {
      if ((i & 0xFFF) === 0) checkAborted();
      const dry = i < reversed.length ? reversed[i] : 0;

      let combSum = 0;
      for (let c = 0; c < combDelays.length; c++) {
        const combOut = combBufs[c][combIdxs[c]];
        combLpfY[c] = combLpfY[c] + lpfAlpha * (combOut - combLpfY[c]);
        const damped = combLpfY[c];

        combBufs[c][combIdxs[c]] = dry + damped * safeDecay * 0.85;
        combIdxs[c] = (combIdxs[c] + 1) % combDelays[c];

        combSum += damped;
      }
      combSum *= 0.25;

      let apOut = combSum;
      for (let a = 0; a < allpassDelays.length; a++) {
        const apRead = apBufs[a][apIdxs[a]];
        const apFeed = apOut + apRead * 0.5;
        apBufs[a][apIdxs[a]] = apOut - apRead * 0.5;
        apIdxs[a] = (apIdxs[a] + 1) % allpassDelays[a];
        apOut = apFeed;
      }

      reverbOut[i] = apOut;
    }

    // Reverse the reverb output back
    for (let i = 0; i < len; i++) {
      const revIdx = len - 1 - i;
      out[i] =
        (i < ch.length ? ch[i] : 0) * (1 - safeMix) +
        reverbOut[revIdx] * safeMix;
    }

    return normalizePeak([out], 0.95)[0];
  });
}

// ── Synthetic convolution smear ──────────────────────────────────────

/**
 * Short convolution reverb using an exponential-decay noise impulse response.
 * O(n·k) complexity — use short kernels only.
 */
export function convolutionSmear(
  channels: Float32Array[],
  sampleRate: number,
  options: {
    decayTimeS?: number;
    mix?: number;
    dampingHz?: number;
  } = {},
): Float32Array[] {
  const { decayTimeS = 1.5, mix = 0.5, dampingHz = 6000 } = options;

  const safeDecay = Math.max(0.1, Math.min(4, decayTimeS));
  const safeMix = Math.max(0, Math.min(1, mix));

  // Generate exponential-decay noise IR
  const irLen = Math.floor(sampleRate * safeDecay);
  const ir = new Float32Array(irLen);
  for (let i = 0; i < irLen; i++) {
    ir[i] = (Math.random() * 2 - 1) * Math.exp(-(i / irLen) * 4);
  }

  // Normalize IR
  let irMax = 0;
  for (let i = 0; i < irLen; i++) {
    if (Math.abs(ir[i]) > irMax) irMax = Math.abs(ir[i]);
  }
  if (irMax > 1e-12) {
    const irScale = 0.3 / irMax;
    for (let i = 0; i < irLen; i++) ir[i] *= irScale;
  }

  // Apply lowpass damping to IR (reduces HF ringing)
  if (dampingHz > 0 && dampingHz < sampleRate / 2) {
    const RC = 1 / (2 * Math.PI * dampingHz);
    const dt = 1 / sampleRate;
    const alpha = dt / (RC + dt);
    let y = 0;
    for (let i = 0; i < irLen; i++) {
      y = y + alpha * (ir[i] - y);
      ir[i] = y;
    }
  }

  return channels.map((ch) => {
    const outLen = ch.length + irLen;
    const conv = new Float32Array(outLen);

    // Convolve
    for (let i = 0; i < ch.length; i++) {
      if ((i & 0x3FF) === 0) checkAborted();
      const x = ch[i];
      for (let j = 0; j < irLen; j++) {
        conv[i + j] += x * ir[j];
      }
    }

    // Wet/dry
    const out = new Float32Array(outLen);
    for (let i = 0; i < outLen; i++) {
      out[i] = (i < ch.length ? ch[i] : 0) * (1 - safeMix) + conv[i] * safeMix;
    }

    return normalizePeak([out], 0.95)[0];
  });
}
