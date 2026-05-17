/**
 * Tape-style tone, filtering, and loss module.
 *
 * Implements from first principles (no GPL code):
 * - DC blocker (standard single-pole IIR)
 * - Input highpass / lowpass
 * - Tape loss: high-frequency rolloff simulating tape speed/age
 * - Head bump: subtle low-mid resonance around 45–120 Hz
 * - Tone/tilt: dark, neutral, bright, sub-heavy profiles
 * - Optional wow/flutter (delegates to existing tapeWow in transforms)
 * - Optional soft saturation
 *
 * All operations process Float32Array channels in-place or with
 * minimal copies.  Deterministic and browser-safe.
 */

import { dcBlock, highpass, lowpass, tapeWow, softClip } from "./transforms";

// ── Profile types ────────────────────────────────────────────────────

export type TapeProfile =
  | "subtle"
  | "warm"
  | "degraded"
  | "destroyed"
  | "cinematic_dark"
  | "sub_heavy";

export interface TapeOptions {
  /** Profile preset */
  profile?: TapeProfile;
  /** Sample rate (required) */
  sampleRate: number;
  /** Chaos amount (0-1), drives degradation depth */
  chaos?: number;
  /** Override: tape speed factor (0 = very slow/dark, 1 = normal). */
  speedFactor?: number;
  /** Override: tape age (0 = new, 1 = very old). */
  age?: number;
}

// ── Internal profile definitions ─────────────────────────────────────

interface ProfileParams {
  dcBlockHz: number;
  highpassHz: number;
  lowpassHz: number;
  headBumpGain: number;
  headBumpFreq: number;
  headBumpQ: number;
  wowDepth: number;
  wowRate: number;
  drive: number;
}

const PROFILES: Record<TapeProfile, ProfileParams> = {
  subtle: {
    dcBlockHz: 20,
    highpassHz: 20,
    lowpassHz: 18000,
    headBumpGain: 0.5,
    headBumpFreq: 60,
    headBumpQ: 0.6,
    wowDepth: 0.0005,
    wowRate: 0.5,
    drive: 0.1,
  },
  warm: {
    dcBlockHz: 20,
    highpassHz: 30,
    lowpassHz: 14000,
    headBumpGain: 1.5,
    headBumpFreq: 55,
    headBumpQ: 0.55,
    wowDepth: 0.001,
    wowRate: 0.7,
    drive: 0.2,
  },
  degraded: {
    dcBlockHz: 30,
    highpassHz: 40,
    lowpassHz: 8000,
    headBumpGain: 2.5,
    headBumpFreq: 70,
    headBumpQ: 0.5,
    wowDepth: 0.003,
    wowRate: 1.5,
    drive: 0.35,
  },
  destroyed: {
    dcBlockHz: 40,
    highpassHz: 80,
    lowpassHz: 4000,
    headBumpGain: 3.5,
    headBumpFreq: 90,
    headBumpQ: 0.4,
    wowDepth: 0.006,
    wowRate: 3.0,
    drive: 0.6,
  },
  cinematic_dark: {
    dcBlockHz: 15,
    highpassHz: 25,
    lowpassHz: 10000,
    headBumpGain: 2.0,
    headBumpFreq: 50,
    headBumpQ: 0.5,
    wowDepth: 0.0015,
    wowRate: 0.4,
    drive: 0.25,
  },
  sub_heavy: {
    dcBlockHz: 10,
    highpassHz: 15,
    lowpassHz: 16000,
    headBumpGain: 3.0,
    headBumpFreq: 48,
    headBumpQ: 0.45,
    wowDepth: 0.0008,
    wowRate: 0.3,
    drive: 0.3,
  },
};

// ── Tape loss: high-frequency rolloff ────────────────────────────────

/**
 * Applies high-frequency loss simulating tape speed and age.
 * Lower speed = darker (more HF rolloff).
 * Older age = more HF loss.
 * Uses a first-order lowpass filter (simple, stable, predictable).
 */
export function applyTapeLoss(
  channels: Float32Array[],
  sampleRate: number,
  speedFactor: number = 1.0,
  age: number = 0,
): Float32Array[] {
  // Effective cutoff: speed reduces cutoff, age adds further rolloff
  // Normal speed (~1.0) = cutoff around 16-18kHz
  // Slow speed (~0.5) = cutoff around 8-10kHz
  // Very slow + old = cutoff around 3-5kHz
  const baseCutoff = 18000;
  const speedCutoff = baseCutoff * Math.max(0.1, speedFactor);
  const ageReducer = 1 - age * 0.7; // age 1.0 reduces cutoff by 70%
  const cutoff = Math.max(1000, speedCutoff * ageReducer);

  const RC = 1 / (2 * Math.PI * cutoff);
  const dt = 1 / sampleRate;
  const alpha = dt / (RC + dt);

  return channels.map((ch) => {
    const out = new Float32Array(ch.length);
    let y = 0;
    for (let i = 0; i < ch.length; i++) {
      y = y + alpha * (ch[i] - y);
      out[i] = y;
    }
    return out;
  });
}

// ── Head bump: low-mid resonance ─────────────────────────────────────

/**
 * Applies a subtle resonant bump in the 45-120 Hz region
 * to simulate tape head resonance.
 *
 * Implemented as a second-order peaking/bell EQ using biquad topology.
 */
export function applyHeadBump(
  channels: Float32Array[],
  sampleRate: number,
  freq: number = 60,
  gainDB: number = 2,
  Q: number = 0.5,
): Float32Array[] {
  if (gainDB === 0) return channels;

  const w0 =
    (2 * Math.PI * Math.max(20, Math.min(freq, sampleRate / 3))) / sampleRate;
  const alpha = Math.sin(w0) / (2 * Q);
  const A = Math.pow(10, gainDB / 40);

  const b0 = 1 + alpha * A;
  const b1 = -2 * Math.cos(w0);
  const b2 = 1 - alpha * A;
  const a0 = 1 + alpha / A;
  const a1 = -2 * Math.cos(w0);
  const a2 = 1 - alpha / A;

  const B0 = b0 / a0;
  const B1 = b1 / a0;
  const B2 = b2 / a0;
  const A1 = a1 / a0;
  const A2 = a2 / a0;

  return channels.map((ch) => {
    const out = new Float32Array(ch.length);
    let x1 = 0;
    let x2 = 0;
    let y1 = 0;
    let y2 = 0;

    for (let i = 0; i < ch.length; i++) {
      const x = ch[i];
      const y = B0 * x + B1 * x1 + B2 * x2 - A1 * y1 - A2 * y2;
      x2 = x1;
      x1 = x;
      y2 = y1;
      y1 = y;
      out[i] = y;
    }
    return out;
  });
}

// ── Tone tilt (dark / neutral / bright) ──────────────────────────────

export type TiltCurve = "dark" | "neutral" | "bright" | "sub_heavy";

/**
 * Applies a tilt EQ (gradual spectral slope).
 * Dark: progressively rolls off highs.
 * Bright: subtle high shelf lift.
 * Sub-heavy: cuts mids slightly, preserves lows and highs.
 */
export function applyTilt(
  channels: Float32Array[],
  sampleRate: number,
  curve: TiltCurve = "neutral",
): Float32Array[] {
  switch (curve) {
    case "dark":
      // Gentle lowpass starting around 8kHz
      return applyTapeLoss(channels, sampleRate, 0.6, 0.2);
    case "bright":
      // Subtle high shelf
      return applyHighShelf(channels, sampleRate, 6000, 3);
    case "sub_heavy":
      // Boost lows, dip mids slightly
      return applyHeadBump(
        applyTapeLoss(channels, sampleRate, 0.9, 0),
        sampleRate,
        50,
        4,
        0.5,
      );
    case "neutral":
    default:
      return channels;
  }
}

/**
 * Simple high-shelf boost using a first-order shelving approach.
 */
function applyHighShelf(
  channels: Float32Array[],
  sampleRate: number,
  freq: number,
  gainDB: number,
): Float32Array[] {
  if (gainDB === 0) return channels;

  const w0 =
    (2 * Math.PI * Math.max(100, Math.min(freq, sampleRate / 3))) / sampleRate;
  const S = 1; // shelf slope
  const A = Math.pow(10, gainDB / 40);
  const alpha = (Math.sin(w0) / 2) * Math.sqrt((A + 1 / A) * (1 / S - 1) + 2);

  const cosw0 = Math.cos(w0);
  const b0 = A * (A + 1 + (A - 1) * cosw0 + 2 * Math.sqrt(A) * alpha);
  const b1 = -2 * A * (A - 1 + (A + 1) * cosw0);
  const b2 = A * (A + 1 + (A - 1) * cosw0 - 2 * Math.sqrt(A) * alpha);
  const a0 = A + 1 - (A - 1) * cosw0 + 2 * Math.sqrt(A) * alpha;
  const a1 = 2 * (A - 1 - (A + 1) * cosw0);
  const a2 = A + 1 - (A - 1) * cosw0 - 2 * Math.sqrt(A) * alpha;

  const B0 = b0 / a0;
  const B1 = b1 / a0;
  const B2 = b2 / a0;
  const A1 = a1 / a0;
  const A2 = a2 / a0;

  return channels.map((ch) => {
    const out = new Float32Array(ch.length);
    let x1 = 0;
    let x2 = 0;
    let y1 = 0;
    let y2 = 0;
    for (let i = 0; i < ch.length; i++) {
      const x = ch[i];
      const y = B0 * x + B1 * x1 + B2 * x2 - A1 * y1 - A2 * y2;
      x2 = x1;
      x1 = x;
      y2 = y1;
      y1 = y;
      out[i] = y;
    }
    return out;
  });
}

// ── Master tape processor ────────────────────────────────────────────

/**
 * Applies a complete tape-style processing chain.
 * Order: DC block → Highpass → Lowpass → Head bump → Tilt →
 *        Tape loss → Wow/flutter → Soft saturation
 */
export function applyTape(
  channels: Float32Array[],
  options: TapeOptions,
): Float32Array[] {
  const {
    profile = "subtle",
    sampleRate,
    chaos = 0,
    speedFactor,
    age,
  } = options;

  const params = PROFILES[profile];

  // Chaos pushes parameters toward more degradation
  const effectiveAge = age ?? Math.min(1, chaos * 0.8);
  const effectiveSpeed = speedFactor ?? Math.max(0.15, 1 - chaos * 0.7);
  const effectiveWowDepth = params.wowDepth + chaos * 0.004;
  const effectiveWowRate = params.wowRate + chaos * 2;
  const effectiveDrive = params.drive + chaos * 0.3;

  let out = channels;

  // 1. DC block
  out = dcBlock(out, sampleRate, params.dcBlockHz);

  // 2. Input highpass (rumble removal)
  if (params.highpassHz > 10) {
    out = highpass(out, sampleRate, params.highpassHz);
  }

  // 3. Input lowpass (anti-aliasing / band limiting)
  if (params.lowpassHz < sampleRate / 2) {
    out = lowpass(out, sampleRate, params.lowpassHz);
  }

  // 4. Head bump
  if (params.headBumpGain > 0.1) {
    out = applyHeadBump(
      out,
      sampleRate,
      params.headBumpFreq,
      params.headBumpGain,
      params.headBumpQ,
    );
  }

  // 5. Tape loss (speed + age dependent HF rolloff)
  out = applyTapeLoss(out, sampleRate, effectiveSpeed, effectiveAge);

  // 6. Wow/flutter
  if (effectiveWowDepth > 0) {
    out = tapeWow(out, sampleRate, effectiveWowDepth, effectiveWowRate);
  }

  // 7. Soft saturation
  if (effectiveDrive > 0.01) {
    out = softClip(out, effectiveDrive);
  }

  return out;
}
