/**
 * Audio analysis utilities for render-audit validation.
 * Pure functions — no I/O, no platform dependencies.
 */

export interface AudioAnalysis {
  durationSeconds: number;
  sampleRate: number;
  channelCount: number;
  peak: number;
  rms: number;
  hasNaN: boolean;
  hasInfinity: boolean;
  isSilent: boolean;
  isClipping: boolean;
  clippingSampleCount: number;
}

/**
 * Analyze decoded audio channels for quality metrics.
 */
export function analyzeChannels(
  channels: Float32Array[],
  sampleRate: number,
): AudioAnalysis {
  if (channels.length === 0 || channels[0].length === 0) {
    return {
      durationSeconds: 0,
      sampleRate,
      channelCount: channels.length,
      peak: 0,
      rms: 0,
      hasNaN: false,
      hasInfinity: false,
      isSilent: true,
      isClipping: false,
      clippingSampleCount: 0,
    };
  }

  const len = channels[0].length;
  const durationSeconds = len / sampleRate;

  let peak = 0;
  let sumSq = 0;
  let sampleCount = 0;
  let hasNaN = false;
  let hasInfinity = false;
  let clippingCount = 0;

  for (const ch of channels) {
    for (let i = 0; i < ch.length; i++) {
      const s = ch[i];

      if (Number.isNaN(s)) {
        hasNaN = true;
        continue;
      }
      if (!Number.isFinite(s)) {
        hasInfinity = true;
        continue;
      }

      const a = Math.abs(s);
      if (a > peak) peak = a;
      sumSq += s * s;
      sampleCount++;

      if (a >= 0.999) clippingCount++;
    }
  }

  const rms = sampleCount > 0 ? Math.sqrt(sumSq / sampleCount) : 0;
  const isSilent = rms < 1e-7 || peak < 1e-7;
  const isClipping = clippingCount > 0;

  return {
    durationSeconds,
    sampleRate,
    channelCount: channels.length,
    peak,
    rms,
    hasNaN,
    hasInfinity,
    isSilent,
    isClipping,
    clippingSampleCount: clippingCount,
  };
}

/** Check whether analysis flags warrant a warning. */
export function hasWarning(analysis: AudioAnalysis): boolean {
  return (
    analysis.isSilent ||
    analysis.isClipping ||
    analysis.hasNaN ||
    analysis.hasInfinity ||
    analysis.durationSeconds < 0.01
  );
}

/** Human-readable warning flags string. */
export function warningFlags(analysis: AudioAnalysis): string[] {
  const flags: string[] = [];
  if (analysis.isSilent) flags.push("silent");
  if (analysis.isClipping) flags.push("clipping");
  if (analysis.hasNaN) flags.push("NaN");
  if (analysis.hasInfinity) flags.push("Infinity");
  if (analysis.durationSeconds < 0.01) flags.push("too-short");
  return flags;
}
