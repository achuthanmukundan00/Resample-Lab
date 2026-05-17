/**
 * Browser-local audio transforms matching backend patterns.
 * All operations use Float32Array channels - no float64 allocations for audio data.
 * Each transform returns new channel arrays (minimal copies).
 */

import type { AudioBufferData } from "./types";

// ---------- Biquad filters ----------

abstract class BiquadFilter {
  protected x1 = 0;
  protected x2 = 0;
  protected y1 = 0;
  protected y2 = 0;
  protected abstract b0: number;
  protected abstract b1: number;
  protected abstract b2: number;
  protected abstract a1: number;
  protected abstract a2: number;

  process(input: Float32Array): Float32Array {
    const out = new Float32Array(input.length);
    const { b0, b1, b2, a1, a2 } = this;
    for (let i = 0; i < input.length; i++) {
      const x = input[i];
      const y =
        b0 * x + b1 * this.x1 + b2 * this.x2 - a1 * this.y1 - a2 * this.y2;
      this.x2 = this.x1;
      this.x1 = x;
      this.y2 = this.y1;
      this.y1 = y;
      out[i] = y;
    }
    return out;
  }
}

class LowpassFilter extends BiquadFilter {
  protected b0: number;
  protected b1: number;
  protected b2: number;
  protected a1: number;
  protected a2: number;

  constructor(sr: number, cutoff: number) {
    super();
    const w0 = (2 * Math.PI * Math.max(20, Math.min(cutoff, sr / 2 - 1))) / sr;
    const cosw0 = Math.cos(w0);
    const sinw0 = Math.sin(w0);
    const alpha = sinw0 / (2 * 0.7071);
    const a0 = 1 + alpha;
    this.b0 = (1 - cosw0) / 2 / a0;
    this.b1 = (1 - cosw0) / a0;
    this.b2 = (1 - cosw0) / 2 / a0;
    this.a1 = (-2 * cosw0) / a0;
    this.a2 = (1 - alpha) / a0;
  }
}

class HighpassFilter extends BiquadFilter {
  protected b0: number;
  protected b1: number;
  protected b2: number;
  protected a1: number;
  protected a2: number;

  constructor(sr: number, cutoff: number) {
    super();
    const w0 = (2 * Math.PI * Math.max(20, Math.min(cutoff, sr / 2 - 1))) / sr;
    const cosw0 = Math.cos(w0);
    const sinw0 = Math.sin(w0);
    const alpha = sinw0 / (2 * 0.7071);
    const a0 = 1 + alpha;
    this.b0 = (1 + cosw0) / 2 / a0;
    this.b1 = -(1 + cosw0) / a0;
    this.b2 = (1 + cosw0) / 2 / a0;
    this.a1 = (-2 * cosw0) / a0;
    this.a2 = (1 - alpha) / a0;
  }
}

class BandpassFilter extends BiquadFilter {
  protected b0: number;
  protected b1: number;
  protected b2: number;
  protected a1: number;
  protected a2: number;

  constructor(sr: number, low: number, high: number) {
    super();
    const cf = Math.sqrt(low * high);
    const bw = Math.log2(high / low);
    const w0 = (2 * Math.PI * Math.max(20, Math.min(cf, sr / 2 - 1))) / sr;
    const cosw0 = Math.cos(w0);
    const sinw0 = Math.sin(w0);
    const Q = Math.sqrt(2) / (Math.pow(2, bw) - 1 / Math.pow(2, bw));
    const alpha = sinw0 / (2 * Q);
    const a0 = 1 + alpha;
    this.b0 = sinw0 / 2 / a0;
    this.b1 = 0 / a0;
    this.b2 = -sinw0 / 2 / a0;
    this.a1 = (-2 * cosw0) / a0;
    this.a2 = (1 - alpha) / a0;
  }
}

// ---------- Per-channel filter helpers ----------

function applyFilter(
  channels: Float32Array[],
  filterFactory: () => BiquadFilter,
): Float32Array[] {
  return channels.map((ch) => filterFactory().process(ch));
}

// ---------- Public transforms ----------

export function reverse(channels: Float32Array[]): Float32Array[] {
  return channels.map((ch) => {
    const out = new Float32Array(ch.length);
    for (let i = 0; i < ch.length; i++) out[i] = ch[ch.length - 1 - i];
    return out;
  });
}

export function lowpass(
  channels: Float32Array[],
  sr: number,
  cutoff: number,
): Float32Array[] {
  return applyFilter(channels, () => new LowpassFilter(sr, cutoff));
}

export function highpass(
  channels: Float32Array[],
  sr: number,
  cutoff: number,
): Float32Array[] {
  return applyFilter(channels, () => new HighpassFilter(sr, cutoff));
}

export function bandpass(
  channels: Float32Array[],
  sr: number,
  low: number,
  high: number,
): Float32Array[] {
  return applyFilter(
    channels,
    () => new BandpassFilter(sr, Math.max(20, low), Math.min(sr / 2 - 1, high)),
  );
}

export function softClip(
  channels: Float32Array[],
  drive: number,
): Float32Array[] {
  if (drive <= 0) return channels.map((ch) => ch.slice());
  const gain = 1 + drive * 9;
  return channels.map((ch) => {
    const out = new Float32Array(ch.length);
    for (let i = 0; i < ch.length; i++) {
      const scaled = ch[i] * gain;
      out[i] = Math.abs(scaled) < 1 / gain ? scaled : Math.tanh(scaled);
    }
    return normalizePeak([out])[0];
  });
}

export function bitcrush(
  channels: Float32Array[],
  bits: number,
): Float32Array[] {
  const b = Math.max(1, Math.min(16, Math.round(bits)));
  if (b >= 16) return channels.map((ch) => ch.slice());
  const levels = 1 << (b - 1);
  return channels.map((ch) => {
    const out = new Float32Array(ch.length);
    for (let i = 0; i < ch.length; i++)
      out[i] = Math.round(ch[i] * levels) / levels;
    return out;
  });
}

export function addNoise(
  channels: Float32Array[],
  amount: number,
): Float32Array[] {
  return channels.map((ch) => {
    const peak = maxAbs(ch);
    const noiseScale = peak > 1e-12 ? peak * amount : 0;
    const out = new Float32Array(ch.length);
    for (let i = 0; i < ch.length; i++)
      out[i] = ch[i] + (Math.random() * 2 - 1) * noiseScale;
    return out;
  });
}

function maxAbs(ch: Float32Array): number {
  let m = 0;
  for (let i = 0; i < ch.length; i++) {
    const a = Math.abs(ch[i]);
    if (a > m) m = a;
  }
  return m;
}

export function normalizePeak(
  channels: Float32Array[],
  peak: number = 0.95,
): Float32Array[] {
  let maxAll = 0;
  for (const ch of channels) {
    const m = maxAbs(ch);
    if (m > maxAll) maxAll = m;
  }
  if (maxAll < 1e-12) return channels.map((ch) => ch.slice());
  const scale = peak / maxAll;
  return channels.map((ch) => {
    const out = new Float32Array(ch.length);
    for (let i = 0; i < ch.length; i++) out[i] = ch[i] * scale;
    return out;
  });
}

export function fadeIn(
  channels: Float32Array[],
  sr: number,
  ms: number,
): Float32Array[] {
  const samples = Math.min(Math.floor((sr * ms) / 1000), channels[0].length);
  if (samples <= 0) return channels.map((ch) => ch.slice());
  return channels.map((ch) => {
    const out = new Float32Array(ch);
    for (let i = 0; i < samples; i++) out[i] *= i / samples;
    return out;
  });
}

export function fadeOut(
  channels: Float32Array[],
  sr: number,
  ms: number,
): Float32Array[] {
  const len = channels[0].length;
  const samples = Math.min(Math.floor((sr * ms) / 1000), len);
  if (samples <= 0) return channels.map((ch) => ch.slice());
  return channels.map((ch) => {
    const out = new Float32Array(ch);
    for (let i = 0; i < samples; i++) out[len - 1 - i] *= i / samples;
    return out;
  });
}

export function applyFades(
  channels: Float32Array[],
  sr: number,
  ms: number,
): Float32Array[] {
  return fadeOut(fadeIn(channels, sr, ms), sr, ms);
}

// ---------- Delay / Echo ----------

export function delayEcho(
  channels: Float32Array[],
  sr: number,
  delayMs: number,
  feedback: number,
  mix: number,
): Float32Array[] {
  const delaySamples = Math.floor((sr * delayMs) / 1000);
  if (delaySamples <= 0 || delaySamples >= channels[0].length)
    return channels.map((ch) => ch.slice());

  return channels.map((ch) => {
    const wet = new Float32Array(ch.length);
    for (let i = delaySamples; i < ch.length; i++) {
      wet[i] = ch[i - delaySamples] + feedback * wet[i - delaySamples];
    }
    const out = new Float32Array(ch.length);
    for (let i = 0; i < ch.length; i++)
      out[i] = ch[i] * (1 - mix) + wet[i] * mix;
    return normalizePeak([out], 0.95)[0];
  });
}

// ---------- Simple reverb ----------

export function simpleReverb(
  channels: Float32Array[],
  sr: number,
  decay: number,
  tailS: number,
): Float32Array[] {
  const delayMs = [31, 37, 43, 53];
  const feedback = decay * 0.7;
  const maxLen = Math.min(channels[0].length, Math.floor(sr * tailS * 4));

  return channels.map((ch) => {
    let result = ch.slice(0, maxLen);

    for (const d of delayMs) {
      const delay = Math.floor((sr * d) / 1000);
      const comb = new Float32Array(maxLen);
      for (let i = delay; i < maxLen; i++) {
        comb[i] = result[i] + feedback * comb[i - delay];
      }
      for (let i = 0; i < maxLen; i++) result[i] += comb[i] * 0.25;
    }

    // All-pass
    const apDelay = Math.floor((sr * 5) / 1000);
    const apGain = 0.7;
    for (let i = apDelay; i < maxLen; i++) {
      result[i] = result[i] + apGain * result[i - apDelay];
    }

    return normalizePeak([result], 1.0)[0];
  });
}

// ---------- Tape wow ----------

export function tapeWow(
  channels: Float32Array[],
  sr: number,
  depth: number,
  rate: number,
): Float32Array[] {
  if (depth <= 0) return channels.map((ch) => ch.slice());

  const n = channels[0].length;
  const t = sr > 0 ? 1 / sr : 0;
  return channels.map((ch) => {
    const out = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const mod = 1 + depth * Math.sin(2 * Math.PI * rate * i * t);
      const phase = i / mod;
      const idx = Math.floor(phase);
      const frac = phase - idx;
      if (idx + 1 < n) {
        out[i] = ch[idx] * (1 - frac) + ch[idx + 1] * frac;
      } else if (idx < n) {
        out[i] = ch[idx];
      }
    }
    return out;
  });
}

// ---------- Downsample ----------

export function downsample(
  channels: Float32Array[],
  sr: number,
  factor: number,
): Float32Array[] {
  const f = Math.max(2, Math.round(factor));
  const lpCutoff = sr / (2 * f);
  let filtered = bandpass(channels, sr, 20, lpCutoff);

  const n = channels[0].length;
  return filtered.map((ch) => {
    const out = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const idx = Math.floor(i / f) * f;
      out[i] = ch[Math.min(idx, n - 1)];
    }
    return out;
  });
}

// ---------- Resample (linear interpolation, changes pitch) ----------

export function resample(channel: Float32Array, ratio: number): Float32Array {
  const outLen = Math.max(1, Math.floor(channel.length / ratio));
  const out = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const pos = i * ratio;
    const idx = Math.floor(pos);
    const frac = pos - idx;
    if (idx + 1 < channel.length) {
      out[i] = channel[idx] * (1 - frac) + channel[idx + 1] * frac;
    } else if (idx < channel.length) {
      out[i] = channel[idx];
    }
  }
  return out;
}

export function resampleChannels(
  channels: Float32Array[],
  ratio: number,
  targetLen?: number,
): Float32Array[] {
  return channels.map((ch) => {
    const r = resample(ch, ratio);
    if (targetLen && r.length !== targetLen) {
      if (r.length > targetLen) return r.slice(0, targetLen);
      const padded = new Float32Array(targetLen);
      padded.set(r);
      return padded;
    }
    return r;
  });
}

// ---------- Pitch shift grain (resample + trim/pad) ----------

export function pitchShiftGrain(
  channel: Float32Array,
  semitones: number,
): Float32Array {
  const ratio = 2 ** (semitones / 12);
  const shifted = resample(channel, ratio);
  if (shifted.length < channel.length) {
    const padded = new Float32Array(channel.length);
    padded.set(shifted);
    return padded;
  }
  return shifted.slice(0, channel.length);
}

export function pitchShiftGrainChannels(
  channels: Float32Array[],
  semitones: number,
): Float32Array[] {
  return channels.map((ch) => pitchShiftGrain(ch, semitones));
}

// ---------- Slice audio into grains ----------

export function sliceAudio(
  channels: Float32Array[],
  sr: number,
  grainMs: number,
): Float32Array[][] {
  const grainSamples = Math.floor((sr * grainMs) / 1000);
  if (grainSamples <= 0) return [channels.map((ch) => ch.slice())];

  const n = channels[0].length;
  const grains: Float32Array[][] = [];
  for (let pos = 0; pos + grainSamples <= n; pos += grainSamples) {
    grains.push(channels.map((ch) => ch.slice(pos, pos + grainSamples)));
  }
  return grains;
}

// ---------- WSOLA time stretch ----------

export function wsolaStretch(
  channels: Float32Array[],
  sr: number,
  ratio: number,
): Float32Array[] {
  // Fall back to resample for extreme ratios or mono
  const n = channels[0].length;
  const outLen = Math.floor(n / ratio);

  // Simple OLA-based stretch
  const windowSize = Math.min(Math.floor(0.03 * sr), n); // 30ms or full signal
  const hopIn = Math.max(1, Math.floor(windowSize * 0.25));
  const hopOut = Math.max(1, Math.floor(hopIn * ratio));

  if (hopIn >= n || hopOut >= outLen) {
    return resampleChannels(channels, ratio, outLen);
  }

  // Hann window
  const win = new Float32Array(windowSize);
  for (let i = 0; i < windowSize; i++) {
    win[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (windowSize - 1)));
  }

  return channels.map((ch) => {
    const out = new Float32Array(outLen);
    const norm = new Float32Array(outLen);
    let inPos = 0;
    let outPos = 0;

    while (inPos + windowSize <= n && outPos + windowSize <= outLen) {
      for (let i = 0; i < windowSize; i++) {
        out[outPos + i] += ch[inPos + i] * win[i];
        norm[outPos + i] += win[i];
      }
      inPos += hopIn;
      outPos += hopOut;
    }

    // Normalize
    for (let i = 0; i < outLen; i++) {
      if (norm[i] > 1e-10) out[i] /= norm[i];
    }

    return out;
  });
}

// ---------- Interleave channels for WAV encoding ----------

export function interleave(channels: Float32Array[]): Float32Array {
  const numCh = channels.length;
  const len = channels[0].length;
  const out = new Float32Array(len * numCh);
  for (let ch = 0; ch < numCh; ch++) {
    const src = channels[ch];
    for (let i = 0; i < len; i++) out[i * numCh + ch] = src[i];
  }
  return out;
}

// ---------- Cap duration ----------

export function capDuration(
  channels: Float32Array[],
  sr: number,
  maxS: number,
): Float32Array[] {
  const maxSamples = Math.floor(sr * maxS);
  if (channels[0].length <= maxSamples) return channels;
  return channels.map((ch) => ch.slice(0, maxSamples));
}

// ---------- Crossfade / loop ----------

export function crossfadeLoop(
  channels: Float32Array[],
  sr: number,
  crossfadeMs: number,
): Float32Array[] {
  const len = channels[0].length;
  const fadeLen = Math.min(Math.floor((sr * crossfadeMs) / 1000), len / 2);
  if (fadeLen <= 0) return channels.map((ch) => ch.slice());

  return channels.map((ch) => {
    const out = new Float32Array(ch);
    for (let i = 0; i < fadeLen; i++) {
      const t = i / fadeLen;
      out[i] *= 1 - t;
      out[len - 1 - i] *= t;
    }
    return out;
  });
}

// ---------- DC Blocking Filter ----------

export function dcBlock(
  channels: Float32Array[],
  sr: number = 48000,
  cutoff: number = 30,
): Float32Array[] {
  const R = 1 - (2 * Math.PI * cutoff) / sr;
  return channels.map((ch) => {
    const out = new Float32Array(ch.length);
    let y = 0;
    let x1 = 0;
    for (let i = 0; i < ch.length; i++) {
      y = ch[i] - x1 + R * y;
      x1 = ch[i];
      out[i] = y;
    }
    return out;
  });
}

// ---------- Stereo Widen (mid/side) ----------

export function stereoWiden(
  channels: Float32Array[],
  amount: number,
): Float32Array[] {
  if (channels.length < 2 || amount <= 0) return channels.map((c) => c.slice());
  const n = channels[0].length;
  const left = new Float32Array(n);
  const right = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const m = (channels[0][i] + channels[1][i]) * 0.5;
    const s = (channels[0][i] - channels[1][i]) * 0.5 * (1 + amount);
    left[i] = m + s;
    right[i] = m - s;
  }
  return [left, right];
}

// ---------- Tremolo (amplitude modulation) ----------

export function tremolo(
  channels: Float32Array[],
  sr: number,
  depth: number,
  rate: number,
): Float32Array[] {
  if (depth <= 0) return channels.map((c) => c.slice());
  return channels.map((ch) => {
    const out = new Float32Array(ch.length);
    for (let i = 0; i < ch.length; i++) {
      const mod =
        1 - depth * (0.5 + 0.5 * Math.sin((2 * Math.PI * rate * i) / sr));
      out[i] = ch[i] * mod;
    }
    return out;
  });
}

// ---------- Simple Single-Pole Filter Sweep ----------

export function filterSweep(
  channels: Float32Array[],
  sr: number,
  startHz: number,
  endHz: number,
): Float32Array[] {
  return channels.map((ch) => {
    const out = new Float32Array(ch.length);
    let y = 0;
    for (let i = 0; i < ch.length; i++) {
      const t = i / ch.length;
      const cutoff = startHz + (endHz - startHz) * t;
      const RC = 1 / (2 * Math.PI * Math.max(10, cutoff));
      const dt = 1 / sr;
      const alpha = dt / (RC + dt);
      y = y + alpha * (ch[i] - y);
      out[i] = y;
    }
    return out;
  });
}

// ---------- Sanitize output (clamp, remove NaN/Infinity, normalize) ----------

export function ensureSanitary(
  channels: Float32Array[],
  peakTarget: number = 0.89,
): Float32Array[] {
  return channels.map((ch) => {
    const out = new Float32Array(ch.length);
    let maxAbs = 0;
    for (let i = 0; i < ch.length; i++) {
      let s = ch[i];
      if (!isFinite(s)) s = 0;
      s = Math.max(-1, Math.min(1, s));
      out[i] = s;
      const a = Math.abs(s);
      if (a > maxAbs) maxAbs = a;
    }
    if (maxAbs > 1e-12) {
      const scale = peakTarget / maxAbs;
      for (let i = 0; i < out.length; i++) out[i] *= scale;
    }
    return out;
  });
}

// ---------- Validate output (reject silent / degenerate) ----------

export function validateOutput(channels: Float32Array[]): {
  valid: boolean;
  reason?: string;
} {
  if (channels.length === 0) return { valid: false, reason: "no channels" };
  const len = channels[0].length;
  if (len < 20) return { valid: false, reason: "too short" };

  let rms = 0;
  let hasNaN = false;
  let sampleCount = 0;
  for (const ch of channels) {
    for (let i = 0; i < ch.length; i++) {
      if (!isFinite(ch[i])) hasNaN = true;
      rms += ch[i] * ch[i];
      sampleCount++;
    }
  }
  rms = Math.sqrt(rms / sampleCount);

  if (hasNaN) return { valid: false, reason: "NaN or Infinity detected" };
  if (rms < 1e-7)
    return { valid: false, reason: `RMS too low: ${rms.toExponential(1)}` };

  return { valid: true };
}

// ---------- Window analysis for loop candidate scoring ----------

export type WindowAnalysis = {
  rms: number;
  peakRmsRatio: number;
  frontLoadedEnergy: number;
  tailEnergy: number;
  boundarySimilarity: number;
};

export function analyzeWindow(
  channels: Float32Array[],
  start: number,
  len: number,
): WindowAnalysis {
  const n = channels[0].length;
  const end = Math.min(start + len, n);
  const actualLen = end - start;
  const ch = channels[0]; // analyze first channel for speed

  let sumSq = 0;
  let peak = 0;
  for (let i = start; i < end; i++) {
    const s = ch[i];
    sumSq += s * s;
    const a = Math.abs(s);
    if (a > peak) peak = a;
  }
  const rms = Math.sqrt(sumSq / actualLen);

  // Front-loaded energy: first 10 % of window
  const frontEnd = start + Math.floor(actualLen * 0.1);
  let frontSumSq = 0;
  for (let i = start; i < frontEnd; i++) frontSumSq += ch[i] * ch[i];
  const frontLoadedEnergy = sumSq > 1e-12 ? frontSumSq / sumSq : 0;

  // Tail energy: last 10 % of window
  const tailStart = end - Math.floor(actualLen * 0.1);
  let tailSumSq = 0;
  for (let i = tailStart; i < end; i++) tailSumSq += ch[i] * ch[i];
  const tailEnergy = sumSq > 1e-12 ? tailSumSq / sumSq : 0;

  // Boundary similarity: correlation between start and end edges
  const cfLen = Math.min(Math.floor(actualLen * 0.02), 200);
  let sim = 0;
  if (cfLen > 0) {
    let dot = 0;
    let sNorm = 0;
    let eNorm = 0;
    for (let i = 0; i < cfLen; i++) {
      const a = ch[start + i];
      const b = ch[end - cfLen + i];
      dot += a * b;
      sNorm += a * a;
      eNorm += b * b;
    }
    sNorm = Math.sqrt(sNorm);
    eNorm = Math.sqrt(eNorm);
    if (sNorm > 1e-12 && eNorm > 1e-12) sim = dot / (sNorm * eNorm);
  }

  return {
    rms,
    peakRmsRatio: rms > 1e-12 ? peak / rms : 0,
    frontLoadedEnergy,
    tailEnergy,
    boundarySimilarity: sim,
  };
}

// ---------- Score a loop candidate ----------

export function scoreLoopCandidate(analysis: WindowAnalysis): number {
  const {
    rms,
    peakRmsRatio,
    frontLoadedEnergy,
    tailEnergy,
    boundarySimilarity,
  } = analysis;

  const rmsScore = Math.min(1, rms * 5);
  const tailScore = Math.min(1, tailEnergy * 4);
  const boundaryScore = Math.max(0, Math.min(1, (boundarySimilarity + 1) / 2));
  const drScore = 1 - Math.max(0, Math.min(1, (peakRmsRatio - 3) / 15));
  const frontPenalty = Math.max(
    0,
    Math.min(1, (frontLoadedEnergy - 0.3) / 0.6),
  );
  const transientPenalty = Math.max(0, Math.min(1, (peakRmsRatio - 5) / 20));

  const score =
    rmsScore * 0.25 +
    tailScore * 0.2 +
    boundaryScore * 0.2 +
    drScore * 0.15 -
    frontPenalty * 0.3 -
    transientPenalty * 0.2;

  return Math.max(-1, Math.min(1, score));
}

// ---------- Find loop candidates in audio ----------

export function findLoopCandidates(
  channels: Float32Array[],
  sr: number,
  opts?: { minDur?: number; maxDur?: number; maxCandidates?: number },
): { start: number; length: number; score: number }[] {
  const { minDur = 1, maxDur = 8, maxCandidates = 5 } = opts ?? {};
  const n = channels[0].length;
  const sourceDur = n / sr;

  const minSamples = Math.floor(sr * minDur);
  const maxSamples = Math.min(Math.floor(sr * maxDur), n);

  // Adaptive step size
  const stepSamples =
    sourceDur <= 30
      ? Math.floor(sr * 0.25)
      : sourceDur <= 120
        ? Math.floor(sr * 0.5)
        : Math.floor(sr * 1.0);

  // Candidate durations to try
  const durs = [1, 2, 3, 4, 6, 8].filter((d) => d >= minDur && d <= maxDur);

  const candidates: { start: number; length: number; score: number }[] = [];

  for (const durSec of durs) {
    const durSamples = Math.floor(sr * durSec);
    if (durSamples > maxSamples) continue;
    for (let start = 0; start + durSamples <= n; start += stepSamples) {
      const analysis = analyzeWindow(channels, start, durSamples);
      const score = scoreLoopCandidate(analysis);
      candidates.push({ start, length: durSamples, score });
    }
  }

  // Sort descending by score
  candidates.sort((a, b) => b.score - a.score);

  // Pick top N with diversity (non-overlapping)
  const selected: { start: number; length: number; score: number }[] = [];
  for (const c of candidates) {
    if (selected.length >= maxCandidates) break;
    const overlaps = selected.some(
      (s) => c.start < s.start + s.length && c.start + c.length > s.start,
    );
    if (!overlaps || c.score > 0.8) {
      if (!overlaps) selected.push(c);
    }
  }

  // Fallback: pick middle section
  if (selected.length === 0) {
    const fallbackLen = Math.min(Math.floor(sr * 2), Math.floor(n * 0.5));
    const fallbackStart = Math.floor((n - fallbackLen) / 2);
    selected.push({ start: fallbackStart, length: fallbackLen, score: 0 });
  }

  return selected;
}

// ---------- Crossfade loop boundaries (equal-power) ----------

export function loopCrossfade(
  channels: Float32Array[],
  crossfadeSamples: number,
): Float32Array[] {
  const len = channels[0].length;
  const fadeLen = Math.min(crossfadeSamples, Math.floor(len / 2));
  if (fadeLen <= 0) return channels.map((ch) => ch.slice());

  return channels.map((ch) => {
    const out = new Float32Array(ch);
    for (let i = 0; i < fadeLen; i++) {
      const t = i / fadeLen;
      out[i] *= t; // fade in at start
      out[len - 1 - i] *= t; // fade out at end
    }
    return out;
  });
}

// ---------- Extract a window with crossfade smoothing ----------

export function extractLoopWithCrossfade(
  channels: Float32Array[],
  start: number,
  windowSamples: number,
  sr: number,
  crossfadeMs: number = 10,
): Float32Array[] {
  const n = channels[0].length;
  const end = Math.min(start + windowSamples, n);
  const actualLen = end - start;
  const fadeLen = Math.min(
    Math.floor((sr * crossfadeMs) / 1000),
    Math.floor(actualLen / 2),
  );

  const extracted = channels.map((ch) => ch.slice(start, end));
  return loopCrossfade(extracted, fadeLen);
}

// ---------- Repeat a buffer to fill a target duration ----------

export function repeatToDuration(
  channels: Float32Array[],
  targetSamples: number,
): Float32Array[] {
  const loopLen = channels[0].length;
  if (loopLen === 0) return channels;

  return channels.map((ch) => {
    const out = new Float32Array(targetSamples);
    for (let i = 0; i < targetSamples; i++) out[i] = ch[i % loopLen];
    return out;
  });
}

// ---------- Make AudioBufferData ----------

export function makeAudioData(
  data: AudioBufferData,
  newChannels: Float32Array[],
): AudioBufferData {
  return {
    name: data.name,
    sampleRate: data.sampleRate,
    channels: newChannels,
  };
}

// ---------- Haas effect (randomized per-channel delay for stereo widening) ----------

export function haasEffect(
  channels: Float32Array[],
  sr: number,
  maxDelayMs: number = 12,
): Float32Array[] {
  if (channels.length < 2) return channels.map((c) => c.slice());
  const maxDelaySamples = Math.max(1, Math.floor((sr * maxDelayMs) / 1000));
  if (maxDelaySamples <= 1) return channels.map((c) => c.slice());

  // Each channel gets a random delay between 1..maxDelayMs ms
  const delays = channels.map(
    () => 1 + Math.floor(Math.random() * (maxDelaySamples - 1)),
  );

  return channels.map((ch, ci) => {
    const d = delays[ci];
    const out = new Float32Array(ch.length);
    for (let i = d; i < ch.length; i++) out[i] = ch[i - d];
    return out;
  });
}

// ---------- Warm character chain (highpass + lowpass + soft clip) ----------

export function finalWarm(
  channels: Float32Array[],
  sr: number,
  opts: {
    highpassHz?: number;
    lowpassHz?: number;
    softClipDrive?: number;
  } = {},
): Float32Array[] {
  const hp = opts.highpassHz ?? 20;
  const lp = opts.lowpassHz ?? 60;
  const drive = opts.softClipDrive ?? 0.3;

  let out = channels;
  if (hp > 10 && hp < sr / 2) out = highpass(out, sr, hp);
  if (lp > 10 && lp < sr / 2) out = lowpass(out, sr, lp);
  if (drive > 0) out = softClip(out, drive);
  out = normalizePeak(out, 0.95);
  return out;
}
