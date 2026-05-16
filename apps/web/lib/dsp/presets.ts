/**
 * Preset recipe implementations for browser-local processing.
 * All operations use Float32Array channels.
 */

import type { AudioBufferData, GeneratedSample, SampleCategory } from "./types";
import * as T from "./transforms";
import { DSP } from "./constants";

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

function normalizeChannels(channels: Float32Array[]): Float32Array[] {
  if (channels.length === 1) {
    return [channels[0], channels[0].slice()];
  }
  return channels;
}

function ensureStereo(channels: Float32Array[]): Float32Array[] {
  const c = normalizeChannels(channels);
  if (c.length > 2) return [c[0], c[1]];
  return c;
}

function makeSample(
  name: string,
  channels: Float32Array[],
  sampleRate: number,
  category: SampleCategory,
  description: string
): GeneratedSample | null {
  const stereo = ensureStereo(channels);

  const validation = T.validateOutput(stereo);
  if (!validation.valid) {
    console.warn(`[presets] Skipping ${name}: ${validation.reason}`);
    return null;
  }

  const clean = T.ensureSanitary(stereo, DSP.NORMALIZE_PEAK);

  return {
    filename: name,
    sampleRate,
    channels: clean,
    category,
    description,
  };
}

// ---------- Ambient Stretch Lab ----------

function ambientStretchLab(files: AudioBufferData[], chaos: number): GeneratedSample[] {
  const outputs: (GeneratedSample | null)[] = [];
  for (const src of files) {
    const stem = src.name.replace(/\.[^.]+$/, "");
    const sr = src.sampleRate;
    const stereo = ensureStereo(src.channels);

    // 1. Long stretched bed — WSOLA + reverb + tape wow + lowpass (+ reverse layer)
    const stretch = 8 + chaos * 12;
    let bed = T.wsolaStretch(stereo, sr, 1 / stretch);
    bed = T.capDuration(bed, sr, DSP.MAX_OUTPUT_DURATION_S);
    bed = T.simpleReverb(bed, sr, 0.4 + chaos * 0.5, 3);
    bed = T.tapeWow(bed, sr, 0.002 + chaos * 0.004, 3);
    bed = T.lowpass(bed, sr, Math.max(60, 3000 - chaos * 2000));
    bed = T.normalizePeak(bed, 0.95);
    outputs.push(
      makeSample(
        `${stem}__stretched_bed.wav`,
        bed,
        sr,
        "ambience",
        `${Math.round(bed[0].length / sr)}s stretched reverb wash (${stretch.toFixed(0)}x)`
      )
    );

    // 2. Reverse smear — resample slow + reverse + delay + reverb
    let smear = T.resampleChannels(stereo, 4 + chaos * 4);
    smear = T.reverse(smear);
    smear = T.capDuration(smear, sr, DSP.MAX_OUTPUT_DURATION_S);
    smear = T.delayEcho(smear, sr, 150 + chaos * 200, 0.3 + chaos * 0.3, 0.4);
    smear = T.simpleReverb(smear, sr, 0.3 + chaos * 0.4, 2);
    smear = T.lowpass(smear, sr, 2000 - chaos * 1200);
    smear = T.fadeIn(smear, sr, 500);
    smear = T.normalizePeak(smear, 0.95);
    outputs.push(
      makeSample(
        `${stem}__reverse_smear.wav`,
        smear,
        sr,
        "ambience",
        `${Math.round(smear[0].length / sr)}s reverse delay smear with lowpass`
      )
    );

    // 3. Ghost pad — lowpass + reverb + saturation + stereo widen
    let pad = T.lowpass(stereo, sr, 500 - chaos * 400);
    pad = T.simpleReverb(pad, sr, 0.5 + chaos * 0.4, 2);
    pad = T.softClip(pad, 0.2 + chaos * 0.3);
    pad = T.tapeWow(pad, sr, 0.003, 3 + chaos * 2);
    pad = T.stereoWiden(pad, 0.3 + chaos * 0.5);
    pad = T.fadeIn(pad, sr, 300);
    pad = T.fadeOut(pad, sr, 500);
    pad = T.normalizePeak(pad, 0.95);
    outputs.push(
      makeSample(
        `${stem}__ghost_pad.wav`,
        pad,
        sr,
        "ambience",
        `${Math.round(pad[0].length / sr)}s saturated ghost pad with stereo widen`
      )
    );

    // 4. Stretched texture with drive + delay — longer, grittier
    let tex = T.wsolaStretch(stereo, sr, 1 / (6 + chaos * 10));
    tex = T.capDuration(tex, sr, DSP.MAX_OUTPUT_DURATION_S);
    tex = T.delayEcho(tex, sr, 200, 0.25 + chaos * 0.3, 0.35);
    tex = T.softClip(tex, 0.3 + chaos * 0.5);
    tex = T.lowpass(tex, sr, 2500 - chaos * 1500);
    tex = T.stereoWiden(tex, 0.3);
    tex = T.tapeWow(tex, sr, 0.004, 2);
    tex = T.fadeIn(tex, sr, 200);
    tex = T.fadeOut(tex, sr, 300);
    tex = T.normalizePeak(tex, 0.95);
    outputs.push(
      makeSample(
        `${stem}__driven_texture.wav`,
        tex,
        sr,
        "ambience",
        `${Math.round(tex[0].length / sr)}s driven stretched texture with delay`
      )
    );

    // 5. Reverse reverb wash — heavy reverb on reversed signal
    let wash = T.reverse(stereo);
    wash = T.simpleReverb(wash, sr, 0.6 + chaos * 0.3, 3);
    wash = T.reverse(wash);
    wash = T.capDuration(wash, sr, DSP.MAX_OUTPUT_DURATION_S);
    wash = T.lowpass(wash, sr, 1500 - chaos * 800);
    wash = T.fadeIn(wash, sr, 1000);
    wash = T.fadeOut(wash, sr, 1000);
    wash = T.normalizePeak(wash, 0.95);
    outputs.push(
      makeSample(
        `${stem}__reverb_wash.wav`,
        wash,
        sr,
        "ambience",
        `${Math.round(wash[0].length / sr)}s reverse reverb wash`
      )
    );
  }
  return outputs.filter((s): s is GeneratedSample => s !== null);
}

// ---------- Ghost Reverse Lab ----------

function ghostReverseLab(files: AudioBufferData[], chaos: number): GeneratedSample[] {
  const outputs: (GeneratedSample | null)[] = [];
  for (const src of files) {
    const stem = src.name.replace(/\.[^.]+$/, "");
    const sr = src.sampleRate;
    const stereo = ensureStereo(src.channels);

    // 1. Classic reverse tail — reverse + delay echo + fade in
    let revTail = T.reverse(stereo);
    revTail = T.delayEcho(revTail, sr, 80 + chaos * 200, 0.3 + chaos * 0.5, 0.5);
    revTail = T.simpleReverb(revTail, sr, 0.2 + chaos * 0.3, 1.5);
    revTail = T.fadeIn(revTail, sr, 200 + chaos * 300);
    revTail = T.normalizePeak(revTail, 0.95);
    outputs.push(
      makeSample(
        `${stem}__reverse_tail.wav`,
        revTail,
        sr,
        "ambience",
        `${Math.round(revTail[0].length / sr)}s reverse tail with echo decay`
      )
    );

    // 2. Ghost hit — stretch + reverse + bandpass + reverb + saturation
    let ghost = T.resampleChannels(stereo, 2 + chaos * 2);
    ghost = T.reverse(ghost);
    ghost = T.capDuration(ghost, sr, DSP.MAX_OUTPUT_DURATION_S);
    const center = 600 + chaos * 1400;
    const q = 1 + chaos * 4;
    const low = center / (Math.SQRT2 * q);
    const high = center * Math.SQRT2 * q;
    ghost = T.bandpass(ghost, sr, Math.max(20, low), Math.min(sr / 2 - 1, high));
    ghost = T.simpleReverb(ghost, sr, 0.3 + chaos * 0.4, 2);
    ghost = T.softClip(ghost, 0.2 + chaos * 0.3);
    ghost = T.fadeIn(ghost, sr, 300);
    ghost = T.normalizePeak(ghost, 0.95);
    outputs.push(
      makeSample(
        `${stem}__ghost_hit.wav`,
        ghost,
        sr,
        "oddity",
        `${Math.round(ghost[0].length / sr)}s bandpassed ghost hit with reverb`
      )
    );

    // 3. Filtered pre-echo — reverse + highpass + reverb + pitch drop
    let pre = T.reverse(stereo);
    pre = T.highpass(pre, sr, 800 + chaos * 2000);
    pre = T.simpleReverb(pre, sr, 0.4 + chaos * 0.4, 2);
    pre = T.tapeWow(pre, sr, 0.003 + chaos * 0.005, 2);
    pre = T.fadeIn(pre, sr, 400);
    pre = T.normalizePeak(pre, 0.95);
    outputs.push(
      makeSample(
        `${stem}__filtered_pre.wav`,
        pre,
        sr,
        "oddity",
        `${Math.round(pre[0].length / sr)}s filtered pre-echo with reverb`
      )
    );

    // 4. Distorted pre-impact — reverse + drive + space + normalize
    let imp = T.reverse(stereo);
    imp = T.softClip(imp, 0.3 + chaos * 0.5);
    imp = T.delayEcho(imp, sr, 60, 0.3, 0.5);
    imp = T.simpleReverb(imp, sr, 0.2 + chaos * 0.3, 1);
    imp = T.lowpass(imp, sr, 3000 - chaos * 1500);
    imp = T.fadeIn(imp, sr, 100);
    imp = T.normalizePeak(imp, 0.95);
    outputs.push(
      makeSample(
        `${stem}__distorted_pre.wav`,
        imp,
        sr,
        "one-shot",
        `${Math.round(imp[0].length / sr)}s distorted pre-impact`
      )
    );
  }
  return outputs.filter((s): s is GeneratedSample => s !== null);
}

// ---------- Granular Shards ----------

function granularShards(files: AudioBufferData[], chaos: number): GeneratedSample[] {
  const outputs: (GeneratedSample | null)[] = [];
  for (const src of files) {
    const stem = src.name.replace(/\.[^.]+$/, "");
    const sr = src.sampleRate;
    const stereo = ensureStereo(src.channels);
    const rng = seededRng(hashCode(stem) + Math.floor(chaos * 1000));

    // Collect grain regions from multiple window sizes for diversity
    const winSizes = [40, 80, 120, 200];
    const allGrains: Float32Array[][] = [];
    for (const winMs of winSizes) {
      const grains = T.sliceAudio(stereo, sr, winMs);
      allGrains.push(...grains);
    }

    if (allGrains.length === 0) continue;

    // Shuffle global grain pool
    for (let i = allGrains.length - 1; i > 0; i--) {
      const j = Math.floor(rng.next() * (i + 1));
      [allGrains[i], allGrains[j]] = [allGrains[j], allGrains[i]];
    }

    // Helper to build a grain sequence with processing
    function buildGrainSequence(
      count: number,
      processGrain: (g: Float32Array[], i: number) => Float32Array[]
    ): Float32Array[] {
      const selected = allGrains.slice(0, Math.min(count, allGrains.length));
      const processed = selected.map((g, i) => processGrain(g, i));
      const totalLen = processed.reduce((s, g) => s + g[0].length, 0);
      const result: Float32Array[] = [new Float32Array(totalLen), new Float32Array(totalLen)];
      let offset = 0;
      for (const p of processed) {
        for (let ch = 0; ch < 2; ch++) {
          for (let i = 0; i < p[ch].length; i++) result[ch][offset + i] = p[ch][i];
        }
        offset += p[0].length;
      }
      return T.normalizePeak(result);
    }

    // 1. Clean micro-chop
    const cleanSeq = buildGrainSequence(16 + Math.floor(chaos * 24), (g) =>
      T.fadeIn(T.fadeOut(g, sr, 3), sr, 3)
    );
    outputs.push(
      makeSample(
        `${stem}__micro_chop.wav`,
        cleanSeq,
        sr,
        "granular",
        `Clean shuffled micro-grain sequence (${cleanSeq[0].length / sr | 0}s)`
      )
    );

    // 2. Bitcrushed shards
    const crushedSeq = buildGrainSequence(12 + Math.floor(chaos * 20), (g) => {
      const bits = 2 + Math.floor(rng.next() * 6);
      let out = T.bitcrush(g, bits);
      out = T.fadeIn(T.fadeOut(out, sr, 2), sr, 2);
      return out;
    });
    outputs.push(
      makeSample(`${stem}__crushed_shards.wav`, crushedSeq, sr, "granular", "Bitcrushed micro-grains")
    );

    // 3. Pitch-shifted cloud
    const pitchRange = 4 + chaos * 20;
    const cloudSeq = buildGrainSequence(8 + Math.floor(chaos * 16), (g) => {
      const semitones = rng.next() * pitchRange * 2 - pitchRange;
      let out = T.pitchShiftGrainChannels(g, semitones);
      out = T.fadeIn(T.fadeOut(out, sr, 5), sr, 5);
      return out;
    });
    outputs.push(
      makeSample(
        `${stem}__pitch_cloud.wav`,
        cloudSeq,
        sr,
        "granular",
        `Pitch-shifted grain cloud (±${pitchRange.toFixed(0)} st)`
      )
    );

    // 4. Reverb throw grains
    const verbSeq = buildGrainSequence(8 + Math.floor(chaos * 12), (g, i) => {
      let out = T.capDuration(g, sr, 1);
      out = T.simpleReverb(out, sr, 0.3 + rng.next() * 0.5, 1);
      out = T.fadeIn(T.fadeOut(out, sr, 5), sr, 5);
      return out;
    });
    outputs.push(
      makeSample(`${stem}__verb_throws.wav`, verbSeq, sr, "granular", "Reverb-throw grain fragments")
    );

    // 5. Saturated glitch bits
    const glitchSeq = buildGrainSequence(10 + Math.floor(chaos * 20), (g) => {
      let out = T.softClip(g, 0.3 + rng.next() * 0.6);
      out = T.fadeIn(T.fadeOut(out, sr, 2), sr, 2);
      return out;
    });
    outputs.push(
      makeSample(`${stem}__glitch_bits.wav`, glitchSeq, sr, "granular", "Saturated glitch grain bits")
    );

    // 6. Stutter repeat
    const loopMs = 30 + Math.floor(rng.next() * 100);
    const loopSamples = Math.floor((sr * loopMs) / 1000);
    if (loopSamples > 0 && loopSamples < stereo[0].length) {
      const maxRepeats = 3 + Math.floor(chaos * 20);
      const chunks: Float32Array[][] = [];
      for (let pos = 0; pos + loopSamples <= stereo[0].length; pos += loopSamples) {
        chunks.push(stereo.map((ch) => ch.slice(pos, pos + loopSamples)));
      }
      const stutterParts: Float32Array[][] = [];
      for (const chk of chunks) {
        const repeats = 1 + Math.floor(rng.next() * maxRepeats);
        for (let r = 0; r < repeats; r++) {
          const faded = T.fadeIn(T.fadeOut(chk, sr, 2), sr, 2);
          stutterParts.push(faded);
        }
      }
      if (stutterParts.length > 0) {
        const totalStutter = stutterParts.reduce((s, p) => s + p[0].length, 0);
        const stutterResult: Float32Array[] = [
          new Float32Array(totalStutter),
          new Float32Array(totalStutter),
        ];
        let soff = 0;
        for (const p of stutterParts) {
          for (let ch = 0; ch < 2; ch++) {
            for (let i = 0; i < p[ch].length; i++) stutterResult[ch][soff + i] = p[ch][i];
          }
          soff += p[0].length;
        }
        let stutterFinal = T.tapeWow(stutterResult, sr, 0.003 + chaos * 0.006, 5);
        stutterFinal = T.normalizePeak(stutterFinal);
        outputs.push(
          makeSample(
            `${stem}__stutter_bits.wav`,
            stutterFinal,
            sr,
            "granular",
            "Stutter repeat grain bits"
          )
        );
      }
    }

    // 7-8. Noise-layered grains (two variations)
    for (let v = 0; v < 2; v++) {
      const noisySeq = buildGrainSequence(6 + Math.floor(chaos * 10), (g) => {
        let out = T.addNoise(g, 0.05 + rng.next() * 0.15);
        if (v === 1) out = T.lowpass(out, sr, 2000 + rng.next() * 3000);
        out = T.fadeIn(T.fadeOut(out, sr, 3), sr, 3);
        return out;
      });
      outputs.push(
        makeSample(
          `${stem}__noisy_shards_${v + 1}.wav`,
          noisySeq,
          sr,
          "granular",
          v === 0 ? "Noise-layered grain shards" : "Filtered noisy grain shards"
        )
      );
    }

    // 9-10. Speed variant cloud (fast + slow)
    for (let v = 0; v < 2; v++) {
      const speedRatio = v === 0 ? 0.3 + rng.next() * 0.3 : 2 + rng.next() * 2;
      const speedSeq = buildGrainSequence(6 + Math.floor(chaos * 8), (g) => {
        let out = T.resampleChannels(g, speedRatio);
        if (v === 1) out = T.bitcrush(out, 4 + Math.floor(rng.next() * 4));
        out = T.fadeIn(T.fadeOut(out, sr, 3), sr, 3);
        return out;
      });
      outputs.push(
        makeSample(
          `${stem}__speed_${v === 0 ? "fast" : "slow"}_grains.wav`,
          speedSeq,
          sr,
          "granular",
          v === 0 ? "Fast speed-shifted grain fragments" : "Slow degraded grain fragments"
        )
      );
    }
  }
  return outputs.filter((s): s is GeneratedSample => s !== null);
}

// ---------- Bitrot Dirt ----------

function bitrotDirt(files: AudioBufferData[], chaos: number): GeneratedSample[] {
  const outputs: (GeneratedSample | null)[] = [];
  for (const src of files) {
    const stem = src.name.replace(/\.[^.]+$/, "");
    const sr = src.sampleRate;
    const stereo = ensureStereo(src.channels);

    // 1. Heavily crushed — downsample + bitcrush + noise + filter
    const bits = Math.max(2, 8 - Math.floor(chaos * 6));
    const factor = 4 + Math.floor(chaos * 12);
    let crushed = T.downsample(stereo, sr, factor);
    crushed = T.bitcrush(crushed, bits);
    crushed = T.addNoise(crushed, 0.01 + chaos * 0.03);
    crushed = T.bandpass(crushed, sr, 100, 4000 + chaos * 4000);
    crushed = T.softClip(crushed, 0.2 + chaos * 0.4);
    crushed = T.normalizePeak(crushed, 0.95);
    outputs.push(
      makeSample(
        `${stem}__crushed.wav`,
        crushed,
        sr,
        "oddity",
        `Heavily crushed (${factor}x downsample, ${bits}-bit)`
      )
    );

    // 2. Degraded wow — downsample + tape wow + saturation + lowpass
    let wow = T.downsample(stereo, sr, 2 + Math.floor(chaos * 8));
    wow = T.tapeWow(wow, sr, 0.004 + chaos * 0.008, 3 + chaos * 3);
    wow = T.softClip(wow, 0.2 + chaos * 0.5);
    wow = T.lowpass(wow, sr, 5000 - chaos * 3000);
    wow = T.addNoise(wow, chaos * 0.015);
    wow = T.normalizePeak(wow, 0.95);
    outputs.push(
      makeSample(
        `${stem}__degraded_wow.wav`,
        wow,
        sr,
        "oddity",
        `Degraded wow/flutter texture with saturation (${wow[0].length / sr | 0}s)`
      )
    );

    // 3. Broken loop — short candidate + degrade chain
    const candidates = T.findLoopCandidates(stereo, sr, { maxCandidates: 1, maxDur: 4 });
    if (candidates.length > 0) {
      const best = candidates[0];
      let loop = T.extractLoopWithCrossfade(stereo, best.start, best.length, sr, 20);
      const targetLen = Math.min(Math.floor(sr * 8), Math.floor(loop[0].length * 4));
      loop = T.repeatToDuration(loop, targetLen);
      loop = T.downsample(loop, sr, 2 + Math.floor(chaos * 6));
      loop = T.bitcrush(loop, 4 + Math.floor(chaos * 4));
      loop = T.addNoise(loop, chaos * 0.02);
      loop = T.tapeWow(loop, sr, 0.003 + chaos * 0.006, 4);
      loop = T.softClip(loop, 0.3 + chaos * 0.5);
      loop = T.lowpass(loop, sr, 3000 - chaos * 2000);
      loop = T.fadeIn(loop, sr, 50);
      loop = T.fadeOut(loop, sr, 100);
      loop = T.normalizePeak(loop, 0.95);
      outputs.push(
        makeSample(
          `${stem}__broken_loop.wav`,
          loop,
          sr,
          "loop",
          `Degraded broken loop (${(loop[0].length / sr).toFixed(1)}s)`
        )
      );
    }

    // 4. Saturated noise artifact — drive + filter + hard clip
    let artifact = T.softClip(stereo, 0.5 + chaos * 0.5);
    artifact = T.bandpass(artifact, sr, 200 + chaos * 300, 3000 + chaos * 5000);
    artifact = T.addNoise(artifact, 0.05 + chaos * 0.1);
    artifact = T.dcBlock(artifact, sr);
    artifact = T.tapeWow(artifact, sr, 0.005 + chaos * 0.008, 6);
    artifact = T.capDuration(artifact, sr, 30);
    for (let ch = 0; ch < artifact.length; ch++) {
      for (let i = 0; i < artifact[ch].length; i++) {
        artifact[ch][i] = Math.max(-0.85, Math.min(0.85, artifact[ch][i]));
      }
    }
    artifact = T.normalizePeak(artifact, 0.95);
    outputs.push(
      makeSample(
        `${stem}__noise_artifact.wav`,
        artifact,
        sr,
        "oddity",
        `Saturated noise artifact (${(artifact[0].length / sr).toFixed(1)}s)`
      )
    );
  }
  return outputs.filter((s): s is GeneratedSample => s !== null);
}

// ---------- Pitch Wreckage ----------

function pitchWreckage(files: AudioBufferData[], chaos: number): GeneratedSample[] {
  const outputs: (GeneratedSample | null)[] = [];
  for (const src of files) {
    const stem = src.name.replace(/\.[^.]+$/, "");
    const sr = src.sampleRate;
    const stereo = ensureStereo(src.channels);

    // 1. Octave down — resample + saturation + lowpass
    const sd = -12 - Math.floor(chaos * 12);
    const downRatio = 2 ** (sd / 12);
    let down = T.resampleChannels(stereo, 1 / downRatio, stereo[0].length);
    down = T.softClip(down, 0.2 + chaos * 0.5);
    down = T.lowpass(down, sr, 2000 - chaos * 1000);
    down = T.normalizePeak(down, 0.95);
    outputs.push(
      makeSample(
        `${stem}__octave_down.wav`,
        down,
        sr,
        "oddity",
        `Saturated octave down (${sd} st)`
      )
    );

    // 2. Octave up — resample + bandpass + reverb tail
    const su = 12 + Math.floor(chaos * 12);
    const upRatio = 2 ** (su / 12);
    let up = T.resampleChannels(stereo, 1 / upRatio, stereo[0].length);
    up = T.bandpass(up, sr, 500, 8000);
    up = T.simpleReverb(up, sr, 0.2 + chaos * 0.3, 1);
    up = T.normalizePeak(up, 0.95);
    outputs.push(
      makeSample(
        `${stem}__octave_up.wav`,
        up,
        sr,
        "oddity",
        `Bandpassed octave up (${su} st) with reverb`
      )
    );

    // 3. Unstable pitch drift — time-varying resample + reverb + wow
    const driftRange = 3 + chaos * 10;
    const n = stereo[0].length;
    const modRate = 0.1 + chaos * 0.4;
    const driftCh = stereo.map((ch) => {
      const out = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        const pitchEnv =
          Math.sin(2 * Math.PI * modRate * t) +
          0.3 * Math.sin(2 * Math.PI * modRate * 3.7 * t) +
          0.1 * (Math.random() * 2 - 1);
        const scaled = driftRange * (pitchEnv / 1.4);
        const speed = 2 ** (scaled / 12);
        const phase = i / speed;
        const idx = Math.floor(phase);
        const frac = phase - idx;
        if (idx + 1 < n) out[i] = ch[idx] * (1 - frac) + ch[idx + 1] * frac;
        else if (idx < n) out[i] = ch[idx];
      }
      return out;
    });
    let drift = T.simpleReverb(driftCh, sr, 0.2 + chaos * 0.3, 2);
    drift = T.fadeIn(drift, sr, 50);
    drift = T.fadeOut(drift, sr, 100);
    drift = T.normalizePeak(drift, 0.95);
    outputs.push(
      makeSample(
        `${stem}__pitch_drift.wav`,
        drift,
        sr,
        "oddity",
        `Unstable pitch drift (±${driftRange.toFixed(0)} st) with reverb`
      )
    );

    // 4. Dual-layer (up + down mixed) with distortion
    const mixDown = T.resampleChannels(stereo, 1 / 2 ** (-18 / 12), stereo[0].length);
    const mixUp = T.resampleChannels(stereo, 1 / 2 ** (18 / 12), stereo[0].length);
    const dual = mixDown.map((ch, ci) => {
      const out = new Float32Array(ch.length);
      for (let i = 0; i < ch.length; i++) out[i] = ch[i] * 0.5 + mixUp[ci][i] * 0.5;
      return out;
    });
    let dualFinal = T.softClip(dual, 0.3 + chaos * 0.4);
    dualFinal = T.delayEcho(dualFinal, sr, 120 + chaos * 100, 0.2, 0.3);
    dualFinal = T.fadeIn(dualFinal, sr, 30);
    dualFinal = T.normalizePeak(dualFinal, 0.95);
    outputs.push(
      makeSample(
        `${stem}__dual_pitch.wav`,
        dualFinal,
        sr,
        "oddity",
        `Dual-layer (±18 st mix) with distortion`
      )
    );
  }
  return outputs.filter((s): s is GeneratedSample => s !== null);
}

// ---------- Loop Extractor (rewritten with heuristic candidate finder) ----------

function loopExtractor(files: AudioBufferData[], chaos: number): GeneratedSample[] {
  const outputs: (GeneratedSample | null)[] = [];
  for (const src of files) {
    const stem = src.name.replace(/\.[^.]+$/, "");
    const sr = src.sampleRate;
    const stereo = ensureStereo(src.channels);

    // Find the best loop candidates using energy analysis
    const candidates = T.findLoopCandidates(stereo, sr, {
      minDur: 1,
      maxDur: Math.min(8, stereo[0].length / sr / 2),
      maxCandidates: 3,
    });

    if (candidates.length === 0) continue;

    // Pick the single best candidate
    const best = candidates[0];
    const targetDur = 4 + Math.floor(chaos * 4); // 4-8 second loops
    const targetSamples = Math.floor(sr * targetDur);

    // 1. Clean loop
    let cleanLoop = T.extractLoopWithCrossfade(stereo, best.start, best.length, sr, 20);
    cleanLoop = T.repeatToDuration(cleanLoop, Math.max(targetSamples, cleanLoop[0].length));
    cleanLoop = T.fadeIn(cleanLoop, sr, 10);
    cleanLoop = T.fadeOut(cleanLoop, sr, 20);
    cleanLoop = T.normalizePeak(cleanLoop, 0.95);
    outputs.push(
      makeSample(
        `${stem}__clean_loop.wav`,
        cleanLoop,
        sr,
        "loop",
        `${(cleanLoop[0].length / sr).toFixed(1)}s crossfaded clean loop`
      )
    );

    // 2. Degraded loop — bitcrush + downsample + noise + wow
    let degradedLoop = T.extractLoopWithCrossfade(stereo, best.start, best.length, sr, 20);
    degradedLoop = T.repeatToDuration(degradedLoop, targetSamples);
    degradedLoop = T.downsample(degradedLoop, sr, 2 + Math.floor(chaos * 6));
    degradedLoop = T.bitcrush(degradedLoop, 4 + Math.floor(chaos * 6));
    degradedLoop = T.addNoise(degradedLoop, 0.01 + chaos * 0.03);
    degradedLoop = T.tapeWow(degradedLoop, sr, 0.003 + chaos * 0.006, 4);
    degradedLoop = T.lowpass(degradedLoop, sr, 4000 - chaos * 2500);
    degradedLoop = T.softClip(degradedLoop, 0.2 + chaos * 0.4);
    degradedLoop = T.fadeIn(degradedLoop, sr, 10);
    degradedLoop = T.fadeOut(degradedLoop, sr, 20);
    degradedLoop = T.normalizePeak(degradedLoop, 0.95);
    outputs.push(
      makeSample(
        `${stem}__degraded_loop.wav`,
        degradedLoop,
        sr,
        "loop",
        `${(degradedLoop[0].length / sr).toFixed(1)}s degraded loop with bitcrush and wow`
      )
    );

    // 3. Ghost loop — reverb + lowpass + stereo widen
    let ghostLoop = T.extractLoopWithCrossfade(stereo, best.start, best.length, sr, 20);
    ghostLoop = T.repeatToDuration(ghostLoop, targetSamples);
    ghostLoop = T.simpleReverb(ghostLoop, sr, 0.4 + chaos * 0.4, 2);
    ghostLoop = T.lowpass(ghostLoop, sr, 1500 - chaos * 1000);
    ghostLoop = T.stereoWiden(ghostLoop, 0.3 + chaos * 0.5);
    ghostLoop = T.fadeIn(ghostLoop, sr, 50);
    ghostLoop = T.fadeOut(ghostLoop, sr, 100);
    ghostLoop = T.normalizePeak(ghostLoop, 0.95);
    outputs.push(
      makeSample(
        `${stem}__ghost_loop.wav`,
        ghostLoop,
        sr,
        "loop",
        `${(ghostLoop[0].length / sr).toFixed(1)}s ghost loop with reverb and stereo widen`
      )
    );

    // 4. Driven loop — saturation + delay + filter
    let drivenLoop = T.extractLoopWithCrossfade(stereo, best.start, best.length, sr, 20);
    drivenLoop = T.repeatToDuration(drivenLoop, targetSamples);
    drivenLoop = T.softClip(drivenLoop, 0.3 + chaos * 0.5);
    drivenLoop = T.delayEcho(drivenLoop, sr, 60 + chaos * 100, 0.2 + chaos * 0.3, 0.35);
    drivenLoop = T.bandpass(drivenLoop, sr, 80, 4000 + chaos * 4000);
    drivenLoop = T.dcBlock(drivenLoop, sr);
    drivenLoop = T.fadeIn(drivenLoop, sr, 10);
    drivenLoop = T.fadeOut(drivenLoop, sr, 20);
    drivenLoop = T.normalizePeak(drivenLoop, 0.95);
    outputs.push(
      makeSample(
        `${stem}__driven_loop.wav`,
        drivenLoop,
        sr,
        "loop",
        `${(drivenLoop[0].length / sr).toFixed(1)}s driven loop with saturation and delay`
      )
    );
  }
  return outputs.filter((s): s is GeneratedSample => s !== null);
}

// ---------- Impact / Riser Mutator ----------

function impactRiserMutator(files: AudioBufferData[], chaos: number): GeneratedSample[] {
  const outputs: (GeneratedSample | null)[] = [];
  for (const src of files) {
    const stem = src.name.replace(/\.[^.]+$/, "");
    const sr = src.sampleRate;
    const stereo = ensureStereo(src.channels);

    // 1. Reversed riser — reverse + fade-in + saturation + reverb
    const riserDur = Math.min(4 + chaos * 8, Math.floor(stereo[0].length / sr));
    const riserSamples = Math.floor(sr * riserDur);
    let riser = T.reverse(stereo.map((ch) => ch.slice(0, riserSamples)));
    riser = T.fadeIn(riser, sr, 500 + chaos * 1500);
    riser = T.softClip(riser, chaos * 0.4);
    riser = T.simpleReverb(riser, sr, 0.2 + chaos * 0.3, 1.5);
    riser = T.filterSweep(riser, sr, 200, 3000 + chaos * 5000);
    riser = T.normalizePeak(riser, 0.95);
    outputs.push(
      makeSample(
        `${stem}__riser.wav`,
        riser,
        sr,
        "ambience",
        `${(riser[0].length / sr).toFixed(1)}s reversed riser with filter sweep`
      )
    );

    // 2. Pitch-dropped impact — resample + drive + highpass + reverb tail
    const si = -24 - Math.floor(chaos * 12);
    let impact = T.resampleChannels(stereo, 1 / 2 ** (si / 12), stereo[0].length);
    impact = T.softClip(impact, 0.3 + chaos * 0.5);
    impact = T.highpass(impact, sr, 40);
    impact = T.simpleReverb(impact, sr, 0.2 + chaos * 0.3, 1.5);
    impact = T.fadeOut(impact, sr, 200);
    impact = T.normalizePeak(impact, 0.95);
    outputs.push(
      makeSample(
        `${stem}__impact.wav`,
        impact,
        sr,
        "one-shot",
        `Pitch-dropped impact (${si} st) with reverb tail`
      )
    );

    // 3. Transient smear — reverb convolution wash
    const smearInput = T.capDuration(stereo, sr, DSP.MAX_OUTPUT_DURATION_S);
    const reverbTime = 0.5 + chaos * 2.5;
    const irLen = Math.min(Math.floor(sr * reverbTime), smearInput[0].length);
    const ir = new Float32Array(irLen);
    for (let i = 0; i < irLen; i++) ir[i] = (Math.random() * 2 - 1) * Math.exp(-(i / irLen) * 5);
    let irMax = 0;
    for (let i = 0; i < irLen; i++) if (Math.abs(ir[i]) > irMax) irMax = Math.abs(ir[i]);
    if (irMax > 1e-12) for (let i = 0; i < irLen; i++) ir[i] = (ir[i] / irMax) * 0.3;

    const smearCh = smearInput.map((ch) => {
      const conv = new Float32Array(ch.length);
      for (let i = 0; i < ch.length; i++) {
        let sum = 0;
        for (let j = 0; j < irLen && j <= i; j++) sum += ch[i - j] * ir[j];
        conv[i] = sum;
      }
      return conv;
    });
    const wet = 0.3 + chaos * 0.5;
    const smeared = smearInput.map((ch, ci) => {
      const out = new Float32Array(ch.length);
      for (let i = 0; i < ch.length; i++) out[i] = ch[i] * (1 - wet) + smearCh[ci][i] * wet;
      return out;
    });
    let smear = T.normalizePeak(smeared);
    smear = T.fadeOut(smear, sr, 100);
    outputs.push(
      makeSample(
        `${stem}__smear.wav`,
        smear,
        sr,
        "one-shot",
        `${(smear[0].length / sr).toFixed(1)}s transient smear (${reverbTime.toFixed(1)}s reverb)`
      )
    );

    // 4. Filter sweep riser + impact — longer build with distortion
    const riseLen = Math.min(Math.floor(sr * (3 + chaos * 6)), stereo[0].length);
    let sweepRiser = T.reverse(stereo.map((ch) => ch.slice(0, riseLen)));
    sweepRiser = T.filterSweep(sweepRiser, sr, 50, 4000 + chaos * 8000);
    sweepRiser = T.softClip(sweepRiser, 0.2 + chaos * 0.5);
    sweepRiser = T.delayEcho(sweepRiser, sr, 50 + chaos * 80, 0.2, 0.3);
    sweepRiser = T.fadeIn(sweepRiser, sr, 1000 + chaos * 2000);
    sweepRiser = T.lowpass(sweepRiser, sr, 6000 - chaos * 3000);
    sweepRiser = T.normalizePeak(sweepRiser, 0.95);
    outputs.push(
      makeSample(
        `${stem}__filter_riser.wav`,
        sweepRiser,
        sr,
        "ambience",
        `${(sweepRiser[0].length / sr).toFixed(1)}s filter sweep riser with echo`
      )
    );
  }
  return outputs.filter((s): s is GeneratedSample => s !== null);
}

// ---------- Chaos Pack ----------

function chaosPack(files: AudioBufferData[], chaos: number): GeneratedSample[] {
  const outputs: (GeneratedSample | null)[] = [];
  for (const src of files) {
    const stem = src.name.replace(/\.[^.]+$/, "");
    const rng = seededRng(hashCode(stem) + 9999 + Math.floor(chaos * 1000));

    // Curated chaos levels per sub-recipe
    const cAmbient = Math.min(1, chaos * 0.6 + rng.next() * 0.3);
    const cGhost = Math.min(1, chaos * 0.7 + rng.next() * 0.3);
    const cGranular = Math.min(1, chaos * 0.8 + rng.next() * 0.2);
    const cDegrade = Math.min(1, chaos * 0.7 + rng.next() * 0.3);
    const cLoop = Math.min(1, chaos * 0.6 + rng.next() * 0.4);
    const cPitch = Math.min(1, chaos * 0.8 + rng.next() * 0.2);
    const cRiser = Math.min(1, chaos * 0.7 + rng.next() * 0.3);

    // 1. Ambience (from ambient_stretch, pick ghost pad variant)
    const ambResults = ambientStretchLab([src], cAmbient);
    const padSample = ambResults.find((s) => s?.filename?.includes("ghost_pad"));
    if (padSample) outputs.push(padSample);

    // 2. Ghost reverse oddity
    const ghostResults = ghostReverseLab([src], cGhost);
    const ghostSample = ghostResults.find((s) => s?.filename?.includes("ghost_hit"));
    if (ghostSample) outputs.push(ghostSample);

    // 3-4. Two granular shards (different types)
    const granResults = granularShards([src], cGranular);
    const microChop = granResults.find((s) => s?.filename?.includes("micro_chop"));
    const pitchCloud = granResults.find((s) => s?.filename?.includes("pitch_cloud"));
    if (microChop) outputs.push(microChop);
    if (pitchCloud) outputs.push(pitchCloud);

    // 5. Degraded loop
    const loopResults = loopExtractor([src], cDegrade);
    const degradedLoop = loopResults.find((s) => s?.filename?.includes("degraded_loop"));
    if (degradedLoop) outputs.push(degradedLoop);

    // 6. Impact/riser
    const riserResults = impactRiserMutator([src], cRiser);
    const riser = riserResults.find((s) => s?.filename?.includes("riser"));
    if (riser) outputs.push(riser);

    // 7. Pitch-wrecked oddity
    const pitchResults = pitchWreckage([src], cPitch);
    const oddity = pitchResults.find((s) => s?.filename?.includes("octave_down"));
    if (oddity) outputs.push(oddity);
  }
  return outputs.filter((s): s is GeneratedSample => s !== null);
}

function hashCode(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  return h;
}

// ---------- Registry ----------

type PresetFn = (files: AudioBufferData[], chaos: number) => GeneratedSample[];

const RECIPE_REGISTRY: Record<string, { fn: PresetFn; outputCount: number; categories: SampleCategory[] }> = {
  ambient_stretch: {
    fn: ambientStretchLab,
    outputCount: 5,
    categories: ["ambience", "ambience", "ambience", "ambience", "ambience"],
  },
  ghost_reverse: {
    fn: ghostReverseLab,
    outputCount: 4,
    categories: ["ambience", "oddity", "oddity", "one-shot"],
  },
  granular_shards: {
    fn: granularShards,
    outputCount: 10,
    categories: [
      "granular",
      "granular",
      "granular",
      "granular",
      "granular",
      "granular",
      "granular",
      "granular",
      "granular",
      "granular",
    ],
  },
  bitrot_dirt: {
    fn: bitrotDirt,
    outputCount: 4,
    categories: ["oddity", "oddity", "loop", "oddity"],
  },
  pitch_wreckage: {
    fn: pitchWreckage,
    outputCount: 4,
    categories: ["oddity", "oddity", "oddity", "oddity"],
  },
  loop_extractor: {
    fn: loopExtractor,
    outputCount: 4,
    categories: ["loop", "loop", "loop", "loop"],
  },
  impact_riser: {
    fn: impactRiserMutator,
    outputCount: 4,
    categories: ["ambience", "one-shot", "one-shot", "ambience"],
  },
  chaos_pack: {
    fn: chaosPack,
    outputCount: 7,
    categories: ["ambience", "oddity", "granular", "granular", "loop", "ambience", "oddity"],
  },
};

export function generatePack(
  files: AudioBufferData[],
  preset: string,
  chaos: number,
  onProgress: (value: number, message: string) => void
): { samples: GeneratedSample[]; manifestSamples: PackManifestSample[] } {
  const recipe = RECIPE_REGISTRY[preset];
  if (!recipe) throw new Error(`Unknown preset: ${preset}`);

  onProgress(0.05, "Processing audio…");
  const samples = recipe.fn(files, chaos);

  const manifestSamples: PackManifestSample[] = samples.map((s) => ({
    filename: s.filename,
    category: s.category,
    description: s.description,
    duration_seconds: s.channels[0].length / s.sampleRate,
    sample_rate: s.sampleRate,
    channels: s.channels.length,
  }));

  onProgress(0.6, "Encoding WAV files…");
  return { samples, manifestSamples };
}

export type PackManifestSample = {
  filename: string;
  category: SampleCategory;
  description: string;
  duration_seconds: number;
  sample_rate: number;
  channels: number;
};

export const PRESET_OUTPUT_COUNTS: Record<string, number> = {};
export const PRESET_CATEGORIES: Record<string, SampleCategory[]> = {};
for (const [id, info] of Object.entries(RECIPE_REGISTRY)) {
  PRESET_OUTPUT_COUNTS[id] = info.outputCount;
  PRESET_CATEGORIES[id] = info.categories;
}
