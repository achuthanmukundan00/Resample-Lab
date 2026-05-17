/**
 * Finishing rack — shared post-processing applied to every preset output.
 * All operations are deterministic, browser-safe, and produce finite output.
 */

import {
  dcBlock,
  fadeIn,
  fadeOut,
  normalizePeak,
  softClip,
  stereoWiden,
  lowpass,
  highpass,
} from "./transforms";
import { DSP } from "./constants";

// ── Configuration ────────────────────────────────────────────────────

export type FinishProfile = "gentle" | "warm" | "bright" | "degraded" | "none";

export interface FinishOptions {
  /** Target peak level (0-1). Defaults to DSP.NORMALIZE_PEAK (0.89 = -1dBFS). */
  targetPeak?: number;
  /** Fade in duration in ms. Default 5ms to prevent clicks. */
  fadeInMs?: number;
  /** Fade out duration in ms. Default 20ms to prevent clicks. */
  fadeOutMs?: number;
  /** DC blocking cutoff Hz. Default 20. Set to 0 to skip. */
  dcBlockHz?: number;
  /** Soft clip drive (0-1). Default 0 (off). */
  softClipDrive?: number;
  /** Safe limiting: if true, applies a lookahead peak limiter. Default false. */
  limit?: boolean;
  /** Stereo width amount (0 = none, 1 = wide). Default 0. Preserves mono. */
  stereoWidth?: number;
  /** Finish EQ profile. Default "gentle". */
  profile?: FinishProfile;
  /** Trim silence below this RMS threshold. 0 to skip. Default 0.001. */
  silenceThreshold?: number;
  /** Extend tail with zero-padding in seconds. 0 to skip. Default 0. */
  tailExtendS?: number;
}

const DEFAULTS: Required<FinishOptions> = {
  targetPeak: DSP.NORMALIZE_PEAK,
  fadeInMs: 5,
  fadeOutMs: 20,
  dcBlockHz: 20,
  softClipDrive: 0,
  limit: false,
  stereoWidth: 0,
  profile: "gentle",
  silenceThreshold: 0.001,
  tailExtendS: 0,
};

// ── Trim silence ─────────────────────────────────────────────────────

/**
 * Trims leading and trailing near-silence from audio.
 * Uses a simple RMS window approach.
 */
export function trimSilence(
  channels: Float32Array[],
  threshold: number = 0.001,
): Float32Array[] {
  if (threshold <= 0 || channels.length === 0) return channels;

  const len = channels[0].length;
  const windowSize = 256;

  // Find start (first window with RMS > threshold)
  let start = 0;
  for (let pos = 0; pos + windowSize <= len; pos += windowSize / 2) {
    let sumSq = 0;
    for (const ch of channels) {
      for (let i = pos; i < pos + windowSize && i < len; i++) {
        sumSq += ch[i] * ch[i];
      }
    }
    const rms = Math.sqrt(sumSq / (windowSize * channels.length));
    if (rms > threshold) {
      start = pos;
      break;
    }
  }

  // Find end (last window with RMS > threshold)
  let end = len;
  for (let pos = len - windowSize; pos >= 0; pos -= windowSize / 2) {
    let sumSq = 0;
    for (const ch of channels) {
      for (let i = pos; i < pos + windowSize && i < len; i++) {
        sumSq += ch[i] * ch[i];
      }
    }
    const rms = Math.sqrt(sumSq / (windowSize * channels.length));
    if (rms > threshold) {
      end = Math.min(len, pos + windowSize);
      break;
    }
  }

  if (end - start < 64) return channels; // too short to trim

  return channels.map((ch) => ch.slice(start, end));
}

// ── Extend tail ──────────────────────────────────────────────────────

/**
 * Extends the audio with silent tail padding.
 */
export function extendTail(
  channels: Float32Array[],
  sampleRate: number,
  tailSeconds: number,
): Float32Array[] {
  if (tailSeconds <= 0) return channels;
  const tailSamples = Math.floor(sampleRate * tailSeconds);
  return channels.map((ch) => {
    const out = new Float32Array(ch.length + tailSamples);
    out.set(ch);
    return out;
  });
}

// ── Lookahead peak limiter ───────────────────────────────────────────

/**
 * Simple zero-latency soft-knee limiter using tanh saturation.
 * For safety only — prevents hard clipping without heavy compression artifacts.
 */
export function applyLimiter(
  channels: Float32Array[],
  ceiling: number = 0.95,
): Float32Array[] {
  // First normalize to 1.0 to find the peak
  let maxAbs = 0;
  for (const ch of channels) {
    for (let i = 0; i < ch.length; i++) {
      const a = Math.abs(ch[i]);
      if (a > maxAbs) maxAbs = a;
    }
  }

  if (maxAbs <= ceiling) return channels;

  // Soft knee limiting: tanh-based above threshold
  const threshold = ceiling * 0.85;
  const knee = ceiling - threshold;

  return channels.map((ch) => {
    const out = new Float32Array(ch.length);
    for (let i = 0; i < ch.length; i++) {
      const x = ch[i];
      const absX = Math.abs(x);
      if (absX <= threshold) {
        out[i] = x;
      } else {
        const over = (absX - threshold) / knee;
        const gain = threshold + knee * Math.tanh(over);
        out[i] = (x / absX) * gain;
      }
    }
    return out;
  });
}

// ── EQ profiles ──────────────────────────────────────────────────────

/**
 * Applies a gentle finishing EQ profile.
 * Implemented with simple biquad filtering.
 */
export function applyFinalEQProfile(
  channels: Float32Array[],
  sampleRate: number,
  profile: FinishProfile,
): Float32Array[] {
  let out = channels;

  switch (profile) {
    case "gentle":
      // Subtle high-shelf rolloff for digital harshness
      out = lowpass(out, sampleRate, 16000);
      break;
    case "warm":
      // Roll off highs, slight low boost via cutting less lows
      out = highpass(out, sampleRate, 30);
      out = lowpass(out, sampleRate, 12000);
      break;
    case "bright":
      // Preserve highs, cut sub rumble
      out = highpass(out, sampleRate, 40);
      break;
    case "degraded":
      // Band-limited lo-fi character
      out = highpass(out, sampleRate, 60);
      out = lowpass(out, sampleRate, 6000);
      break;
    case "none":
      break;
  }

  return out;
}

// ── Stereo width (safe) ──────────────────────────────────────────────

/**
 * Stereo widen that preserves phase safety by keeping width moderate.
 * Wraps the existing stereoWiden with safety bounds.
 */
export function applyStereoWidthSafe(
  channels: Float32Array[],
  amount: number,
): Float32Array[] {
  if (channels.length < 2 || amount <= 0) return channels;
  // Clamp to avoid phase cancellation issues
  const safeAmount = Math.min(amount, 1.2);
  return stereoWiden(channels, safeAmount);
}

// ── Master finishing rack ────────────────────────────────────────────

/**
 * Master finishing rack applied to all preset outputs.
 * Order: trim → DC block → EQ → stereo width → soft clip → limit →
 *        normalize → fades → tail extend
 */
export function finishSample(
  channels: Float32Array[],
  sampleRate: number,
  options: FinishOptions = {},
): Float32Array[] {
  const opts = { ...DEFAULTS, ...options };

  let out = channels;

  // 1. Trim silence
  if (opts.silenceThreshold > 0) {
    out = trimSilence(out, opts.silenceThreshold);
  }

  // 2. DC block
  if (opts.dcBlockHz > 0) {
    out = dcBlock(out, sampleRate, opts.dcBlockHz);
  }

  // 3. EQ profile
  out = applyFinalEQProfile(out, sampleRate, opts.profile);

  // 4. Stereo width
  if (opts.stereoWidth > 0) {
    out = applyStereoWidthSafe(out, opts.stereoWidth);
  }

  // 5. Soft clip (musical saturation)
  if (opts.softClipDrive > 0) {
    out = softClip(out, opts.softClipDrive);
  }

  // 6. Limiter (safety)
  if (opts.limit) {
    out = applyLimiter(out, opts.targetPeak * 0.98);
  }

  // 7. Normalize peak
  out = normalizePeak(out, opts.targetPeak);

  // 8. Fades
  out = fadeIn(out, sampleRate, opts.fadeInMs);
  out = fadeOut(out, sampleRate, opts.fadeOutMs);

  // 9. Extend tail
  if (opts.tailExtendS > 0) {
    out = extendTail(out, sampleRate, opts.tailExtendS);
  }

  return out;
}

// ── Preset-specific finish profiles ──────────────────────────────────

export type ChaosLane =
  | "mutation"
  | "degradation"
  | "space"
  | "modulation"
  | "instability"
  | "finish"
  | "stereo"
  | "tail";

export interface ChaosLanes {
  mutation: number;
  degradation: number;
  space: number;
  modulation: number;
  instability: number;
  finish: number;
  stereo: number;
  tail: number;
}

/**
 * Maps a global chaos value (0-1) into per-lane amounts.
 * Each preset can define its own mapping curve.
 */
export function mapChaosToLanes(
  chaos: number,
  mapping: Partial<Record<ChaosLane, number>>,
): ChaosLanes {
  const defaults: Record<ChaosLane, number> = {
    mutation: 1.0,
    degradation: 1.0,
    space: 1.0,
    modulation: 1.0,
    instability: 1.0,
    finish: 0.2,
    stereo: 0.3,
    tail: 0.3,
  };

  const lanes: ChaosLanes = { ...defaults } as ChaosLanes;
  for (const [key, weight] of Object.entries(mapping)) {
    lanes[key as ChaosLane] = weight;
  }

  // Apply chaos with per-lane weighting
  return {
    mutation: chaos * lanes.mutation,
    degradation: chaos * lanes.degradation,
    space: chaos * lanes.space,
    modulation: chaos * lanes.modulation,
    instability: chaos * lanes.instability,
    finish: Math.min(1, chaos * lanes.finish),
    stereo: Math.min(1, chaos * lanes.stereo),
    tail: Math.min(1, chaos * lanes.tail),
  };
}

// ── Length modes ─────────────────────────────────────────────────────

export type LengthMode = "short" | "medium" | "long" | "absurd";

export interface LengthLimits {
  maxOutputS: number;
  tailExtendS: number;
}

const LENGTH_LIMITS: Record<LengthMode, LengthLimits> = {
  short: { maxOutputS: 15, tailExtendS: 0 },
  medium: { maxOutputS: 45, tailExtendS: 0.3 },
  long: { maxOutputS: 90, tailExtendS: 0.5 },
  absurd: { maxOutputS: 120, tailExtendS: 1.0 },
};

/**
 * Get length limits for a preset, adjusted by chaos.
 */
export function getLengthLimits(mode: LengthMode, chaos: number): LengthLimits {
  const base = LENGTH_LIMITS[mode];
  // Higher chaos slightly extends tails
  return {
    maxOutputS: base.maxOutputS,
    tailExtendS: base.tailExtendS + chaos * 0.5,
  };
}
