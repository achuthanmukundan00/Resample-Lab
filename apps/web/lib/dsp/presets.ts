/**
 * Preset recipe implementations for browser-local processing.
 *
 * Architecture per preset:
 *   source → mutation → tape/tone → delay/reverb → finish rack → output
 *
 * Chaos is mapped into lanes per preset (mutation, degradation, space,
 * modulation, instability, finish, stereo, tail).
 *
 * Every output passes through finishSample() for DC block, fades,
 * normalization, and optional limiting.
 */

import type { AudioBufferData, GeneratedSample, SampleCategory } from "./types";
import * as T from "./transforms";
import { DSP } from "./constants";
import {
  finishSample,
  mapChaosToLanes,
  type ChaosLane,
  LengthMode,
  getLengthLimits,
} from "./finish";
import { applyTape, TapeProfile } from "./tape";
import { pingPongDelay, diffusionDelay, reverseDelay } from "./delay";
import {
  darkRoom,
  modulatedHall,
  dirtyMetallic,
  reverseBloom,
  convolutionSmear,
} from "./reverb";
import {
  granularCloud,
  frozenTexture,
  grainReverbBloom,
  granularDelaySwarm,
} from "./granular";

// ── RNG and helpers ──────────────────────────────────────────────────

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

function hashCode(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++)
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  return h;
}

// ── Shared output builder ────────────────────────────────────────────

function makeSample(
  name: string,
  channels: Float32Array[],
  sampleRate: number,
  category: SampleCategory,
  description: string,
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

// ── Chaos lane mappings per preset ───────────────────────────────────

const CHAOS_MAPS: Record<string, Partial<Record<ChaosLane, number>>> = {
  ambient_stretch: {
    mutation: 0.6,
    degradation: 0.2,
    space: 1.2,
    modulation: 0.8,
    instability: 0.3,
    finish: 0.3,
    stereo: 0.7,
    tail: 1.0,
  },
  ghost_reverse: {
    mutation: 0.7,
    degradation: 0.3,
    space: 0.9,
    modulation: 0.5,
    instability: 0.4,
    finish: 0.2,
    stereo: 0.5,
    tail: 0.8,
  },
  granular_shards: {
    mutation: 0.8,
    degradation: 0.4,
    space: 0.6,
    modulation: 0.7,
    instability: 0.6,
    finish: 0.2,
    stereo: 0.8,
    tail: 0.4,
  },
  bitrot_dirt: {
    mutation: 0.5,
    degradation: 1.3,
    space: 0.3,
    modulation: 0.8,
    instability: 1.0,
    finish: 0.1,
    stereo: 0.3,
    tail: 0.2,
  },
  pitch_wreckage: {
    mutation: 1.0,
    degradation: 0.6,
    space: 0.4,
    modulation: 0.9,
    instability: 1.0,
    finish: 0.15,
    stereo: 0.5,
    tail: 0.3,
  },
  loop_extractor: {
    mutation: 0.3,
    degradation: 0.6,
    space: 0.4,
    modulation: 0.3,
    instability: 0.2,
    finish: 0.3,
    stereo: 0.3,
    tail: 0.2,
  },
  impact_riser: {
    mutation: 0.7,
    degradation: 0.3,
    space: 1.0,
    modulation: 0.6,
    instability: 0.5,
    finish: 0.3,
    stereo: 0.8,
    tail: 1.0,
  },
  chaos_pack: {
    mutation: 0.7,
    degradation: 0.7,
    space: 0.7,
    modulation: 0.7,
    instability: 0.7,
    finish: 0.3,
    stereo: 0.7,
    tail: 0.6,
  },
};

// ── Length mode per preset ───────────────────────────────────────────

const LENGTH_MODES: Record<string, LengthMode> = {
  ambient_stretch: "absurd",
  ghost_reverse: "long",
  granular_shards: "medium",
  bitrot_dirt: "medium",
  pitch_wreckage: "medium",
  loop_extractor: "medium",
  impact_riser: "long",
  chaos_pack: "long",
};

// ── Ambient Stretch Lab ──────────────────────────────────────────────

function ambientStretchLab(
  files: AudioBufferData[],
  chaos: number,
  onProgress?: (v: number, msg: string) => void,
  lengthMode?: LengthMode,
): GeneratedSample[] {
  const outputs: (GeneratedSample | null)[] = [];
  const lanes = mapChaosToLanes(chaos, CHAOS_MAPS.ambient_stretch);
  const limits = getLengthLimits(
    lengthMode ?? LENGTH_MODES.ambient_stretch,
    chaos,
  );
  const tapeProfile: TapeProfile = chaos > 0.6 ? "degraded" : "cinematic_dark";

  for (const src of files) {
    const stem = src.name.replace(/\.[^.]+$/, "");
    const sr = src.sampleRate;
    let stereo = ensureStereo(src.channels);

    // Cap source for performance
    const maxSourceS = 60;
    const sourceSamples = Math.floor(sr * maxSourceS);
    if (stereo[0].length > sourceSamples) {
      stereo = [
        stereo[0].slice(0, sourceSamples),
        stereo[1].slice(0, sourceSamples),
      ];
    }

    // 1. Cathedral bed — long stretch + tape warmth + hall reverb + finishing
    onProgress?.(0.06, "Stretching cathedral bed…");
    const stretch = 8 + lanes.mutation * 12;
    let cathedral = T.wsolaStretch(stereo, sr, 1 / stretch);
    cathedral = T.capDuration(cathedral, sr, limits.maxOutputS);
    cathedral = applyTape(cathedral, {
      profile: tapeProfile,
      sampleRate: sr,
      chaos: lanes.degradation,
    });
    cathedral = modulatedHall(cathedral, sr, {
      decay: 0.3 + lanes.space * 0.5,
      modulationDepth: 0.001 + lanes.modulation * 0.004,
      damping: 0.25 + lanes.degradation * 0.4,
      mix: 0.3 + lanes.space * 0.4,
      size: 0.6 + lanes.space * 0.3,
    });
    cathedral = finishSample(cathedral, sr, {
      profile: "warm",
      stereoWidth: lanes.stereo * 0.5,
      tailExtendS: limits.tailExtendS,
      fadeInMs: 200,
      fadeOutMs: 500,
    });
    outputs.push(
      makeSample(
        `${stem}__cathedral_bed.wav`,
        cathedral,
        sr,
        "ambience",
        `${Math.round(cathedral[0].length / sr)}s cathedral bed (${stretch.toFixed(0)}x stretch)`,
      ),
    );

    // 2. Toxic air — reverse smear + diffusion delay + dark room
    onProgress?.(0.15, "Toxic air…");
    let toxic = T.resampleChannels(stereo, 4 + lanes.mutation * 4);
    toxic = T.reverse(toxic);
    toxic = T.capDuration(toxic, sr, limits.maxOutputS);
    toxic = diffusionDelay(toxic, sr, {
      delayMs: 100 + lanes.modulation * 200,
      feedback: 0.3 + lanes.space * 0.4,
      mix: 0.5,
      diffusion: 0.5 + lanes.space * 0.4,
    });
    toxic = darkRoom(toxic, sr, {
      decay: 0.3 + lanes.space * 0.5,
      damping: 0.6,
      mix: 0.4,
    });
    toxic = applyTape(toxic, {
      profile: "warm",
      sampleRate: sr,
      chaos: lanes.degradation,
    });
    toxic = finishSample(toxic, sr, {
      profile: "gentle",
      stereoWidth: lanes.stereo * 0.6,
      fadeInMs: 300,
      fadeOutMs: 800,
    });
    outputs.push(
      makeSample(
        `${stem}__toxic_air.wav`,
        toxic,
        sr,
        "ambience",
        `${Math.round(toxic[0].length / sr)}s reverse smear with diffusion delay`,
      ),
    );

    // 3. Doom choir drift — ghost pad + heavy tape + convolution smear
    onProgress?.(0.24, "Doom choir drift…");
    let doom = T.lowpass(stereo, sr, 400 - lanes.degradation * 300);
    doom = applyTape(doom, {
      profile: "cinematic_dark",
      sampleRate: sr,
      chaos: lanes.degradation,
    });
    doom = convolutionSmear(doom, sr, {
      decayTimeS: 1 + lanes.space * 2,
      mix: 0.5,
    });
    doom = finishSample(doom, sr, {
      profile: "warm",
      stereoWidth: lanes.stereo * 0.7,
      softClipDrive: 0.2,
      fadeInMs: 200,
      fadeOutMs: 400,
    });
    outputs.push(
      makeSample(
        `${stem}__doom_choir_drift.wav`,
        doom,
        sr,
        "ambience",
        `${Math.round(doom[0].length / sr)}s doom choir drift with convolution smear`,
      ),
    );

    // 4. Submerged pad — deep lowpass + hall + sub-heavy tape
    onProgress?.(0.33, "Submerged pad…");
    let sub = T.lowpass(stereo, sr, 800 - lanes.degradation * 600);
    sub = applyTape(sub, {
      profile: "sub_heavy",
      sampleRate: sr,
      chaos: lanes.degradation,
    });
    sub = modulatedHall(sub, sr, {
      decay: 0.4 + lanes.space * 0.5,
      modulationDepth: 0.002,
      damping: 0.4,
      mix: 0.4 + lanes.space * 0.3,
      size: 0.8,
    });
    sub = finishSample(sub, sr, {
      profile: "gentle",
      stereoWidth: lanes.stereo * 0.4,
      fadeInMs: 150,
      fadeOutMs: 300,
    });
    outputs.push(
      makeSample(
        `${stem}__submerged_pad.wav`,
        sub,
        sr,
        "ambience",
        `${Math.round(sub[0].length / sr)}s submerged pad with sub-heavy tape`,
      ),
    );

    // 5. Reverse bloom long — reverse + bloom reverb + tape warmth
    onProgress?.(0.42, "Reverse bloom…");
    let bloom = T.reverse(stereo);
    bloom = reverseBloom(bloom, sr, {
      decay: 0.4 + lanes.space * 0.5,
      damping: 0.5,
      mix: 0.6 + lanes.space * 0.3,
    });
    bloom = T.capDuration(bloom, sr, limits.maxOutputS);
    bloom = applyTape(bloom, {
      profile: "warm",
      sampleRate: sr,
      chaos: lanes.degradation * 0.5,
    });
    bloom = finishSample(bloom, sr, {
      profile: "gentle",
      stereoWidth: lanes.stereo * 0.5,
      fadeInMs: 500,
      fadeOutMs: 1000,
      tailExtendS: limits.tailExtendS,
    });
    outputs.push(
      makeSample(
        `${stem}__reverse_bloom_long.wav`,
        bloom,
        sr,
        "ambience",
        `${Math.round(bloom[0].length / sr)}s reverse bloom with warm tape`,
      ),
    );
  }
  return outputs.filter((s): s is GeneratedSample => s !== null);
}

// ── Ghost Reverse Lab ────────────────────────────────────────────────

function ghostReverseLab(
  files: AudioBufferData[],
  chaos: number,
  onProgress?: (v: number, msg: string) => void,
  lengthMode?: LengthMode,
): GeneratedSample[] {
  const outputs: (GeneratedSample | null)[] = [];
  const lanes = mapChaosToLanes(chaos, CHAOS_MAPS.ghost_reverse);
  const limits = getLengthLimits(
    lengthMode ?? LENGTH_MODES.ghost_reverse,
    chaos,
  );

  for (const src of files) {
    const stem = src.name.replace(/\.[^.]+$/, "");
    const sr = src.sampleRate;
    const stereo = ensureStereo(src.channels);

    // 1. Pre-impact suck — reverse + reverse delay + dark room
    let preSuck = T.reverse(stereo);
    preSuck = reverseDelay(preSuck, sr, {
      delayMs: 80 + lanes.mutation * 200,
      feedback: 0.3 + lanes.space * 0.4,
      mix: 0.5,
    });
    preSuck = darkRoom(preSuck, sr, {
      decay: 0.2 + lanes.space * 0.4,
      damping: 0.7,
    });
    preSuck = applyTape(preSuck, {
      profile: "warm",
      sampleRate: sr,
      chaos: lanes.degradation,
    });
    preSuck = finishSample(preSuck, sr, {
      profile: "gentle",
      fadeInMs: 100,
      fadeOutMs: 200,
      stereoWidth: lanes.stereo * 0.3,
    });
    outputs.push(
      makeSample(
        `${stem}__pre_impact_suck.wav`,
        preSuck,
        sr,
        "one-shot",
        `${Math.round((preSuck[0].length / sr) * 1000)}ms pre-impact with reverse delay`,
      ),
    );

    // 2. Ghost swell long — reverse + stretch + dark room + fade swell
    let swell = T.resampleChannels(stereo, 2 + lanes.mutation * 3);
    swell = T.reverse(swell);
    swell = T.capDuration(swell, sr, limits.maxOutputS);
    swell = darkRoom(swell, sr, {
      decay: 0.4 + lanes.space * 0.5,
      damping: 0.5,
      mix: 0.5,
    });
    swell = applyTape(swell, {
      profile: "warm",
      sampleRate: sr,
      chaos: lanes.degradation * 0.5,
    });
    swell = finishSample(swell, sr, {
      profile: "gentle",
      fadeInMs: 400 + lanes.tail * 800,
      fadeOutMs: 300,
      stereoWidth: lanes.stereo * 0.5,
      tailExtendS: lanes.tail * 1.0,
    });
    outputs.push(
      makeSample(
        `${stem}__ghost_swell_long.wav`,
        swell,
        sr,
        "ambience",
        `${Math.round(swell[0].length / sr)}s ghost swell with long fade`,
      ),
    );

    // 3. Reverse delay cloud — reverse + diffusion + convolution
    let cloud = T.reverse(stereo);
    cloud = diffusionDelay(cloud, sr, {
      delayMs: 80 + lanes.modulation * 150,
      feedback: 0.25 + lanes.space * 0.4,
      mix: 0.6,
      diffusion: 0.7,
    });
    cloud = convolutionSmear(cloud, sr, {
      decayTimeS: 1 + lanes.space * 1.5,
      mix: 0.4,
    });
    cloud = applyTape(cloud, {
      profile: "subtle",
      sampleRate: sr,
      chaos: lanes.degradation * 0.3,
    });
    cloud = finishSample(cloud, sr, {
      profile: "gentle",
      fadeInMs: 200,
      fadeOutMs: 400,
      stereoWidth: lanes.stereo * 0.6,
    });
    outputs.push(
      makeSample(
        `${stem}__reverse_delay_cloud.wav`,
        cloud,
        sr,
        "ambience",
        `${Math.round(cloud[0].length / sr)}s reverse delay diffusion cloud`,
      ),
    );

    // 4. Haunted room tail — reverse + dirty metallic + tape degradation
    let haunted = T.reverse(stereo);
    haunted = dirtyMetallic(haunted, sr, {
      decay: 0.3 + lanes.degradation * 0.4,
      color: 0.3 + lanes.instability * 0.5,
      mix: 0.5,
    });
    haunted = applyTape(haunted, {
      profile: "degraded",
      sampleRate: sr,
      chaos: lanes.degradation,
    });
    haunted = finishSample(haunted, sr, {
      profile: "gentle",
      softClipDrive: 0.15,
      fadeInMs: 150,
      fadeOutMs: 300,
      stereoWidth: lanes.stereo * 0.4,
    });
    outputs.push(
      makeSample(
        `${stem}__haunted_room_tail.wav`,
        haunted,
        sr,
        "oddity",
        `${Math.round(haunted[0].length / sr)}s haunted metallic reverse tail`,
      ),
    );
  }
  return outputs.filter((s): s is GeneratedSample => s !== null);
}

// ── Granular Shards ──────────────────────────────────────────────────

function granularShards(
  files: AudioBufferData[],
  chaos: number,
  _onProgress?: (v: number, msg: string) => void,
  _lengthMode?: LengthMode,
): GeneratedSample[] {
  const outputs: (GeneratedSample | null)[] = [];
  const lanes = mapChaosToLanes(chaos, CHAOS_MAPS.granular_shards);

  for (const src of files) {
    const stem = src.name.replace(/\.[^.]+$/, "");
    const sr = src.sampleRate;
    const stereo = ensureStereo(src.channels);
    const rng = seededRng(hashCode(stem) + Math.floor(chaos * 1000));

    // ── Shard mode (existing) ──
    const winSizes = [40, 80, 120, 200];
    const allGrains: Float32Array[][] = [];
    for (const winMs of winSizes) {
      const grains = T.sliceAudio(stereo, sr, winMs);
      allGrains.push(...grains);
    }

    function buildGrainSequence(
      count: number,
      processGrain: (g: Float32Array[], i: number) => Float32Array[],
    ): Float32Array[] {
      if (allGrains.length === 0)
        return [new Float32Array(1), new Float32Array(1)];
      // Shuffle
      for (let i = allGrains.length - 1; i > 0; i--) {
        const j = Math.floor(rng.next() * (i + 1));
        [allGrains[i], allGrains[j]] = [allGrains[j], allGrains[i]];
      }
      const selected = allGrains.slice(0, Math.min(count, allGrains.length));
      const processed = selected.map((g, i) => processGrain(g, i));
      const totalLen = processed.reduce((s, g) => s + g[0].length, 0);
      const result: Float32Array[] = [
        new Float32Array(Math.max(1, totalLen)),
        new Float32Array(Math.max(1, totalLen)),
      ];
      let offset = 0;
      for (const p of processed) {
        for (let ch = 0; ch < 2; ch++) {
          for (let i = 0; i < p[ch].length; i++)
            result[ch][offset + i] = p[ch][i];
        }
        offset += p[0].length;
      }
      return T.normalizePeak(result);
    }

    if (allGrains.length > 0) {
      // 1. Stereo shrapnel loop — micro-chop + stereo widening + tape
      const shrapnel = buildGrainSequence(
        16 + Math.floor(lanes.mutation * 24),
        (g) => T.fadeIn(T.fadeOut(g, sr, 3), sr, 3),
      );
      const shrapnelFinal = finishSample(
        applyTape(shrapnel, {
          profile: "subtle",
          sampleRate: sr,
          chaos: lanes.degradation * 0.3,
        }),
        sr,
        { profile: "gentle", stereoWidth: lanes.stereo * 0.8 },
      );
      outputs.push(
        makeSample(
          `${stem}__stereo_shrapnel_loop.wav`,
          shrapnelFinal,
          sr,
          "granular",
          `Stereo micro-shrapnel (${(shrapnelFinal[0].length / sr) | 0}s)`,
        ),
      );

      // 2. Bitcrushed shards (preserve legacy style)
      const crushed = buildGrainSequence(
        12 + Math.floor(lanes.degradation * 20),
        (g) => {
          const out = T.bitcrush(g, 2 + Math.floor(rng.next() * 6));
          return T.fadeIn(T.fadeOut(out, sr, 2), sr, 2);
        },
      );
      const crushedFinal = finishSample(crushed, sr, { profile: "gentle" });
      outputs.push(
        makeSample(
          `${stem}__crushed_shards.wav`,
          crushedFinal,
          sr,
          "granular",
          "Bitcrushed micro-grains",
        ),
      );

      // 3. Glitch bits
      const glitch = buildGrainSequence(
        10 + Math.floor(lanes.instability * 20),
        (g) => {
          const out = T.softClip(g, 0.3 + rng.next() * 0.6);
          return T.fadeIn(T.fadeOut(out, sr, 2), sr, 2);
        },
      );
      const glitchFinal = finishSample(glitch, sr, {
        profile: "gentle",
        softClipDrive: 0.2,
      });
      outputs.push(
        makeSample(
          `${stem}__glitch_bits.wav`,
          glitchFinal,
          sr,
          "granular",
          "Saturated glitch grain bits",
        ),
      );
    }

    // ── Cloud mode (new) ──
    const cloudSeed = hashCode(stem) + 777 + Math.floor(chaos * 500);

    // 4. Particle cloud — overlapping grains with pitch spread
    const particle = granularCloud(stereo, sr, {
      grainMs: 60 + lanes.mutation * 60,
      density: 8 + lanes.mutation * 10,
      pitchRange: lanes.mutation * 12,
      panSpread: lanes.stereo,
      reverseProbability: lanes.instability * 0.3,
      jitter: lanes.instability * 0.4,
      durationS: 4 + lanes.tail * 4,
      overlap: 2 + Math.floor(lanes.mutation * 2),
      seed: cloudSeed,
    });
    const particleFinal = finishSample(particle, sr, {
      profile: "gentle",
      stereoWidth: lanes.stereo * 0.5,
      fadeInMs: 20,
      fadeOutMs: 100,
    });
    outputs.push(
      makeSample(
        `${stem}__particle_cloud.wav`,
        particleFinal,
        sr,
        "granular",
        `${Math.round(particleFinal[0].length / sr)}s particle cloud with pitch spread`,
      ),
    );

    // 5. Frozen texture
    const frozen = frozenTexture(stereo, sr, {
      freezeStartS: rng.next() * 0.3 * (stereo[0].length / sr),
      freezeDurationS: 0.3 + lanes.instability * 0.7,
      outputDurationS: 3 + lanes.tail * 5,
      grainMs: 50 + lanes.mutation * 50,
      overlap: 3,
      jitter: 0.2 + lanes.instability * 0.4,
      seed: cloudSeed + 1,
    });
    const frozenFinal = finishSample(frozen, sr, {
      profile: "gentle",
      fadeInMs: 100,
      fadeOutMs: 200,
    });
    outputs.push(
      makeSample(
        `${stem}__frozen_texture.wav`,
        frozenFinal,
        sr,
        "granular",
        `${Math.round(frozenFinal[0].length / sr)}s frozen texture drone`,
      ),
    );

    // 6. Granular delay swarm
    const swarm = granularDelaySwarm(stereo, sr, {
      grainMs: 40 + lanes.mutation * 40,
      density: 8 + lanes.mutation * 8,
      durationS: 4 + lanes.tail * 4,
      feedbackAmount: 0.3 + lanes.space * 0.5,
      delayTimeMs: 100 + lanes.modulation * 200,
      pitchRange: lanes.mutation * 8,
      seed: cloudSeed + 2,
    });
    const swarmFinal = finishSample(swarm, sr, {
      profile: "gentle",
      stereoWidth: lanes.stereo * 0.7,
      fadeInMs: 10,
      fadeOutMs: 80,
    });
    outputs.push(
      makeSample(
        `${stem}__granular_delay_swarm.wav`,
        swarmFinal,
        sr,
        "granular",
        `${Math.round(swarmFinal[0].length / sr)}s delay feedback swarm`,
      ),
    );

    // 7. Grain reverb bloom
    const bloom = grainReverbBloom(stereo, sr, {
      grainMs: 80 + lanes.mutation * 40,
      density: 6 + lanes.mutation * 6,
      decayS: 1 + lanes.space * 3,
      durationS: 4 + lanes.tail * 6,
      pitchRange: lanes.mutation * 4,
      panSpread: lanes.stereo * 0.8,
      seed: cloudSeed + 3,
    });
    const bloomFinal = finishSample(bloom, sr, {
      profile: "warm",
      fadeInMs: 50,
      fadeOutMs: 300,
      tailExtendS: lanes.tail * 0.5,
    });
    outputs.push(
      makeSample(
        `${stem}__grain_reverb_bloom.wav`,
        bloomFinal,
        sr,
        "granular",
        `${Math.round(bloomFinal[0].length / sr)}s reverb bloom cloud`,
      ),
    );

    // 8-10. Legacy-friendly: pitch cloud, verb throws, stutter
    if (allGrains.length > 0) {
      const pitchCloud = buildGrainSequence(
        8 + Math.floor(lanes.mutation * 16),
        (g) => {
          const semitones =
            rng.next() * (4 + lanes.mutation * 20) * 2 -
            (4 + lanes.mutation * 20);
          const out = T.pitchShiftGrainChannels(g, semitones);
          return T.fadeIn(T.fadeOut(out, sr, 5), sr, 5);
        },
      );
      outputs.push(
        makeSample(
          `${stem}__pitch_cloud.wav`,
          finishSample(pitchCloud, sr, { profile: "gentle" }),
          sr,
          "granular",
          `Pitch-shifted grain cloud`,
        ),
      );

      const verbThrows = buildGrainSequence(
        8 + Math.floor(lanes.space * 12),
        (g) => {
          let out = T.capDuration(g, sr, 1);
          out = darkRoom(out, sr, {
            decay: 0.3 + lanes.space * 0.5,
            damping: 0.5,
            mix: 0.5,
          });
          return T.fadeIn(T.fadeOut(out, sr, 5), sr, 5);
        },
      );
      outputs.push(
        makeSample(
          `${stem}__verb_throws.wav`,
          finishSample(verbThrows, sr, { profile: "gentle" }),
          sr,
          "granular",
          "Reverb-throw grain fragments",
        ),
      );

      // Stutter
      const loopMs = 30 + Math.floor(rng.next() * 100);
      const loopSamples = Math.floor((sr * loopMs) / 1000);
      if (loopSamples > 0 && loopSamples < stereo[0].length) {
        const maxRepeats = 3 + Math.floor(lanes.instability * 20);
        const chunks: Float32Array[][] = [];
        for (
          let pos = 0;
          pos + loopSamples <= stereo[0].length;
          pos += loopSamples
        ) {
          chunks.push(stereo.map((ch) => ch.slice(pos, pos + loopSamples)));
        }
        const stutterParts: Float32Array[][] = [];
        for (const chk of chunks) {
          const repeats = 1 + Math.floor(rng.next() * maxRepeats);
          for (let r = 0; r < repeats; r++) {
            stutterParts.push(T.fadeIn(T.fadeOut(chk, sr, 2), sr, 2));
          }
        }
        if (stutterParts.length > 0) {
          const totalStutter = stutterParts.reduce(
            (s, p) => s + p[0].length,
            0,
          );
          const stutterResult: Float32Array[] = [
            new Float32Array(Math.max(1, totalStutter)),
            new Float32Array(Math.max(1, totalStutter)),
          ];
          let soff = 0;
          for (const p of stutterParts) {
            for (let ch = 0; ch < 2; ch++) {
              for (let i = 0; i < p[ch].length; i++)
                stutterResult[ch][soff + i] = p[ch][i];
            }
            soff += p[0].length;
          }
          const stutterFinal = finishSample(
            applyTape(stutterResult, {
              profile: "subtle",
              sampleRate: sr,
              chaos: lanes.degradation * 0.3,
            }),
            sr,
            { profile: "gentle", stereoWidth: lanes.stereo * 0.4 },
          );
          outputs.push(
            makeSample(
              `${stem}__stutter_bits.wav`,
              stutterFinal,
              sr,
              "granular",
              "Stutter repeat grains",
            ),
          );
        }
      }
    }
  }
  return outputs.filter((s): s is GeneratedSample => s !== null);
}

// ── Bitrot Dirt ──────────────────────────────────────────────────────

function bitrotDirt(
  files: AudioBufferData[],
  chaos: number,
  _onProgress?: (v: number, msg: string) => void,
  _lengthMode?: LengthMode,
): GeneratedSample[] {
  const outputs: (GeneratedSample | null)[] = [];
  const lanes = mapChaosToLanes(chaos, CHAOS_MAPS.bitrot_dirt);

  for (const src of files) {
    const stem = src.name.replace(/\.[^.]+$/, "");
    const sr = src.sampleRate;
    const stereo = ensureStereo(src.channels);

    // 1. Rotted room loop — downsample + bitcrush + tape + room
    const bits = Math.max(2, 8 - Math.floor(lanes.degradation * 6));
    const factor = 4 + Math.floor(lanes.degradation * 12);
    let rotted = T.downsample(stereo, sr, factor);
    rotted = T.bitcrush(rotted, bits);
    rotted = applyTape(rotted, {
      profile: "degraded",
      sampleRate: sr,
      chaos: lanes.degradation,
    });
    rotted = darkRoom(rotted, sr, {
      decay: 0.2 + lanes.space * 0.3,
      damping: 0.7,
      mix: 0.3,
    });
    rotted = finishSample(rotted, sr, {
      profile: "degraded",
      softClipDrive: 0.3,
      stereoWidth: lanes.stereo * 0.3,
    });
    outputs.push(
      makeSample(
        `${stem}__rotted_room_loop.wav`,
        rotted,
        sr,
        "oddity",
        `Rotted room loop (${factor}x down, ${bits}-bit, ${(rotted[0].length / sr) | 0}s)`,
      ),
    );

    // 2. Cassette collapse — heavy tape degradation + flutter
    let cassette = T.downsample(
      stereo,
      sr,
      2 + Math.floor(lanes.degradation * 6),
    );
    cassette = applyTape(cassette, {
      profile: "destroyed",
      sampleRate: sr,
      chaos: lanes.degradation,
    });
    cassette = dirtyMetallic(cassette, sr, {
      decay: 0.2,
      color: 0.4,
      mix: 0.4,
    });
    cassette = finishSample(cassette, sr, {
      profile: "degraded",
      softClipDrive: 0.4,
    });
    outputs.push(
      makeSample(
        `${stem}__cassette_collapse.wav`,
        cassette,
        sr,
        "oddity",
        `Cassette collapse with heavy tape wear (${(cassette[0].length / sr) | 0}s)`,
      ),
    );

    // 3. Speaker cone tear — saturated noise artifact + metallic reverb
    let speaker = T.softClip(stereo, 0.5 + lanes.degradation * 0.5);
    speaker = T.bandpass(
      speaker,
      sr,
      200 + lanes.instability * 300,
      2000 + lanes.degradation * 4000,
    );
    speaker = T.addNoise(speaker, 0.02 + lanes.degradation * 0.08);
    speaker = T.dcBlock(speaker, sr);
    speaker = dirtyMetallic(speaker, sr, {
      decay: 0.3 + lanes.degradation * 0.3,
      color: 0.5,
      mix: 0.4,
    });
    speaker = finishSample(speaker, sr, {
      profile: "degraded",
      softClipDrive: 0.5,
      limit: true,
      fadeInMs: 5,
      fadeOutMs: 30,
    });
    outputs.push(
      makeSample(
        `${stem}__speaker_cone_tear.wav`,
        speaker,
        sr,
        "oddity",
        `Speaker cone tear artifact (${(speaker[0].length / sr).toFixed(1)}s)`,
      ),
    );

    // 4. Bitcrushed tail — aggressive crush + convolution smear
    let tail = T.bitcrush(stereo, 2 + Math.floor(lanes.degradation * 5));
    tail = T.downsample(tail, sr, 3 + Math.floor(lanes.degradation * 8));
    tail = convolutionSmear(tail, sr, {
      decayTimeS: 0.8 + lanes.space * 1.5,
      mix: 0.5,
      dampingHz: 4000,
    });
    tail = applyTape(tail, {
      profile: "degraded",
      sampleRate: sr,
      chaos: lanes.degradation,
    });
    tail = finishSample(tail, sr, {
      profile: "degraded",
      softClipDrive: 0.2,
    });
    outputs.push(
      makeSample(
        `${stem}__bitcrushed_tail.wav`,
        tail,
        sr,
        "oddity",
        `Bitcrushed tail with convolution smear (${(tail[0].length / sr).toFixed(1)}s)`,
      ),
    );
  }
  return outputs.filter((s): s is GeneratedSample => s !== null);
}

// ── Pitch Wreckage ──────────────────────────────────────────────────

function pitchWreckage(
  files: AudioBufferData[],
  chaos: number,
  onProgress?: (v: number, msg: string) => void,
  _lengthMode?: LengthMode,
): GeneratedSample[] {
  const outputs: (GeneratedSample | null)[] = [];
  const lanes = mapChaosToLanes(chaos, CHAOS_MAPS.pitch_wreckage);

  for (const src of files) {
    const stem = src.name.replace(/\.[^.]+$/, "");
    const sr = src.sampleRate;
    const stereo = ensureStereo(src.channels);

    // 1. Sub beast layer — octave down + sub-heavy tape + convolution
    const sd = -12 - Math.floor(lanes.mutation * 12);
    onProgress?.(0.08, "Pitch-shifting sub beast layer…");
    let beast = T.resampleChannels(
      stereo,
      2 ** (sd / 12),
      stereo[0].length,
    );
    beast = applyTape(beast, {
      profile: "sub_heavy",
      sampleRate: sr,
      chaos: lanes.degradation,
    });
    beast = convolutionSmear(beast, sr, {
      decayTimeS: 0.5 + lanes.space,
      mix: 0.3,
    });
    beast = finishSample(beast, sr, {
      profile: "gentle",
      softClipDrive: 0.3,
      limit: true,
    });
    outputs.push(
      makeSample(
        `${stem}__sub_beast_layer.wav`,
        beast,
        sr,
        "oddity",
        `Sub beast layer (${sd} st) with sub-heavy processing`,
      ),
    );

    // 2. Glass octave tail — octave up + bandpass + dark room
    onProgress?.(0.25, "Glassing octave up…");
    const su = 12 + Math.floor(lanes.mutation * 12);
    let glass = T.resampleChannels(
      stereo,
      2 ** (su / 12),
      stereo[0].length,
    );
    glass = T.bandpass(glass, sr, 500, 10000);
    glass = darkRoom(glass, sr, {
      decay: 0.3 + lanes.space * 0.4,
      damping: 0.4,
      mix: 0.5,
    });
    glass = finishSample(glass, sr, {
      profile: "bright",
      stereoWidth: lanes.stereo * 0.5,
      fadeInMs: 20,
      fadeOutMs: 100,
    });
    outputs.push(
      makeSample(
        `${stem}__glass_octave_tail.wav`,
        glass,
        sr,
        "oddity",
        `Glass octave tail (${su} st) with dark room`,
      ),
    );

    // 3. Detuned metal pair — dual layer + metallic reverb
    onProgress?.(0.35, "Detuning metal pair…");
    const detune1 = T.resampleChannels(
      stereo,
      2 ** (-18 / 12),
      stereo[0].length,
    );
    const detune2 = T.resampleChannels(
      stereo,
      2 ** ((18 + lanes.instability * 6) / 12),
      stereo[0].length,
    );
    const dual = detune1.map((ch, ci) => {
      const out = new Float32Array(ch.length);
      for (let i = 0; i < ch.length; i++)
        out[i] = ch[i] * 0.5 + detune2[ci][i] * 0.5;
      return out;
    });
    let metal = dirtyMetallic(dual, sr, {
      decay: 0.3 + lanes.instability * 0.4,
      color: 0.5 + lanes.instability * 0.4,
      mix: 0.5,
    });
    metal = applyTape(metal, {
      profile: "degraded",
      sampleRate: sr,
      chaos: lanes.degradation * 0.5,
    });
    metal = finishSample(metal, sr, {
      profile: "gentle",
      softClipDrive: 0.2,
      stereoWidth: lanes.stereo * 0.5,
    });
    outputs.push(
      makeSample(
        `${stem}__detuned_metal_pair.wav`,
        metal,
        sr,
        "oddity",
        "Detuned stereo pitch pair with metallic reverb",
      ),
    );

    // 4. Falling pitch smear — pitch drift + convolution
    onProgress?.(0.48, "Smearing falling pitch…");
    let fall = T.resampleChannels(
      stereo,
      2 ** ((-lanes.mutation * 8) / 12),
      stereo[0].length,
    );
    fall = applyTape(fall, {
      profile: "cinematic_dark",
      sampleRate: sr,
      chaos: lanes.degradation,
    });
    fall = convolutionSmear(fall, sr, {
      decayTimeS: 1 + lanes.space * 2,
      mix: 0.5,
    });
    fall = finishSample(fall, sr, {
      profile: "warm",
      fadeInMs: 30,
      fadeOutMs: 200,
      tailExtendS: lanes.tail * 0.5,
    });
    outputs.push(
      makeSample(
        `${stem}__falling_pitch_smear.wav`,
        fall,
        sr,
        "oddity",
        "Falling pitch smear with convolution wash",
      ),
    );
  }
  return outputs.filter((s): s is GeneratedSample => s !== null);
}

// ── Loop Extractor ──────────────────────────────────────────────────

function loopExtractor(
  files: AudioBufferData[],
  chaos: number,
  _onProgress?: (v: number, msg: string) => void,
  _lengthMode?: LengthMode,
): GeneratedSample[] {
  const outputs: (GeneratedSample | null)[] = [];
  const lanes = mapChaosToLanes(chaos, CHAOS_MAPS.loop_extractor);

  for (const src of files) {
    const stem = src.name.replace(/\.[^.]+$/, "");
    const sr = src.sampleRate;
    const stereo = ensureStereo(src.channels);

    const candidates = T.findLoopCandidates(stereo, sr, {
      minDur: 1,
      maxDur: Math.min(8, stereo[0].length / sr / 2),
      maxCandidates: 3,
    });
    if (candidates.length === 0) continue;

    const best = candidates[0];
    const targetDur = 4 + Math.floor(lanes.mutation * 4);
    const targetSamples = Math.floor(sr * targetDur);

    // 1. Clean loop
    let clean = T.extractLoopWithCrossfade(
      stereo,
      best.start,
      best.length,
      sr,
      20,
    );
    clean = T.repeatToDuration(clean, Math.max(targetSamples, clean[0].length));
    clean = finishSample(clean, sr, {
      profile: "gentle",
      fadeInMs: 10,
      fadeOutMs: 20,
      stereoWidth: lanes.stereo * 0.2,
    });
    outputs.push(
      makeSample(
        `${stem}__clean_loop.wav`,
        clean,
        sr,
        "loop",
        `${(clean[0].length / sr).toFixed(1)}s crossfaded clean loop`,
      ),
    );

    // 2. Dirty room loop — room reverb + tape
    let dirty = T.extractLoopWithCrossfade(
      stereo,
      best.start,
      best.length,
      sr,
      20,
    );
    dirty = T.repeatToDuration(dirty, targetSamples);
    dirty = applyTape(dirty, {
      profile: "subtle",
      sampleRate: sr,
      chaos: lanes.degradation * 0.3,
    });
    dirty = darkRoom(dirty, sr, {
      decay: 0.2 + lanes.space * 0.3,
      damping: 0.6,
      mix: 0.35,
    });
    dirty = finishSample(dirty, sr, {
      profile: "warm",
      fadeInMs: 10,
      fadeOutMs: 30,
    });
    outputs.push(
      makeSample(
        `${stem}__dirty_room_loop.wav`,
        dirty,
        sr,
        "loop",
        `${(dirty[0].length / sr).toFixed(1)}s dirty room loop`,
      ),
    );

    // 3. Delayed loop — ping-pong delay
    let delayedLp = T.extractLoopWithCrossfade(
      stereo,
      best.start,
      best.length,
      sr,
      20,
    );
    delayedLp = T.repeatToDuration(delayedLp, targetSamples);
    delayedLp = pingPongDelay(delayedLp, sr, {
      timeMs: 60 + lanes.modulation * 150,
      feedback: 0.2 + lanes.space * 0.4,
      mix: 0.4,
      feedbackFilterHz: 3000 - lanes.degradation * 2000,
    });
    delayedLp = finishSample(delayedLp, sr, {
      profile: "gentle",
      stereoWidth: lanes.stereo * 0.5,
      fadeInMs: 10,
      fadeOutMs: 30,
    });
    outputs.push(
      makeSample(
        `${stem}__delayed_loop.wav`,
        delayedLp,
        sr,
        "loop",
        `${(delayedLp[0].length / sr).toFixed(1)}s delayed loop`,
      ),
    );

    // 4. Ambient loop — heavy reverb + filter
    let ambLp = T.extractLoopWithCrossfade(
      stereo,
      best.start,
      best.length,
      sr,
      20,
    );
    ambLp = T.repeatToDuration(ambLp, targetSamples);
    ambLp = modulatedHall(ambLp, sr, {
      decay: 0.4 + lanes.space * 0.5,
      modulationDepth: 0.002,
      damping: 0.3,
      mix: 0.5,
    });
    ambLp = applyTape(ambLp, {
      profile: "warm",
      sampleRate: sr,
      chaos: lanes.degradation * 0.3,
    });
    ambLp = finishSample(ambLp, sr, {
      profile: "warm",
      stereoWidth: lanes.stereo * 0.6,
      fadeInMs: 20,
      fadeOutMs: 100,
    });
    outputs.push(
      makeSample(
        `${stem}__ambient_loop.wav`,
        ambLp,
        sr,
        "loop",
        `${(ambLp[0].length / sr).toFixed(1)}s ambient loop with hall reverb`,
      ),
    );

    // 5. One-shot from loop — extract + short tail
    if (best.length > sr * 0.5) {
      let oneshot = T.extractLoopWithCrossfade(
        stereo,
        best.start,
        best.length,
        sr,
        10,
      );
      oneshot = applyTape(oneshot, {
        profile: "subtle",
        sampleRate: sr,
        chaos: lanes.degradation * 0.2,
      });
      oneshot = convolutionSmear(oneshot, sr, { decayTimeS: 0.5, mix: 0.2 });
      oneshot = finishSample(oneshot, sr, {
        profile: "gentle",
        fadeInMs: 5,
        fadeOutMs: 50,
        tailExtendS: lanes.tail * 0.3,
      });
      outputs.push(
        makeSample(
          `${stem}__one_shot_from_loop.wav`,
          oneshot,
          sr,
          "one-shot",
          `${(oneshot[0].length / sr).toFixed(1)}s one-shot extracted from loop`,
        ),
      );
    }
  }
  return outputs.filter((s): s is GeneratedSample => s !== null);
}

// ── Impact / Riser Mutator ───────────────────────────────────────────

function impactRiserMutator(
  files: AudioBufferData[],
  chaos: number,
  onProgress?: (v: number, msg: string) => void,
  _lengthMode?: LengthMode,
): GeneratedSample[] {
  const outputs: (GeneratedSample | null)[] = [];
  const lanes = mapChaosToLanes(chaos, CHAOS_MAPS.impact_riser);

  for (const src of files) {
    const stem = src.name.replace(/\.[^.]+$/, "");
    const sr = src.sampleRate;
    const stereo = ensureStereo(src.channels);

    // 1. Doom riser — reverse + filter sweep + hall + cinematic tape
    onProgress?.(0.1, "Building doom riser…");
    const riserDur = Math.min(4 + lanes.tail * 8, stereo[0].length / sr);
    const riserSamples = Math.floor(sr * riserDur);
    let doomRiser = T.reverse(stereo.map((ch) => ch.slice(0, riserSamples)));
    doomRiser = T.filterSweep(doomRiser, sr, 80, 4000 + lanes.mutation * 6000);
    doomRiser = applyTape(doomRiser, {
      profile: "cinematic_dark",
      sampleRate: sr,
      chaos: lanes.degradation * 0.3,
    });
    doomRiser = modulatedHall(doomRiser, sr, {
      decay: 0.3 + lanes.space * 0.5,
      modulationDepth: 0.002,
      damping: 0.3,
      mix: 0.3,
      size: 0.8,
    });
    doomRiser = finishSample(doomRiser, sr, {
      profile: "warm",
      stereoWidth: lanes.stereo * 0.6,
      fadeInMs: 500 + lanes.tail * 1000,
      fadeOutMs: 200,
      tailExtendS: lanes.tail * 1.0,
    });
    outputs.push(
      makeSample(
        `${stem}__doom_riser.wav`,
        doomRiser,
        sr,
        "ambience",
        `${(doomRiser[0].length / sr).toFixed(1)}s doom riser with cinematic tape`,
      ),
    );

    // 2. Pressure drop — pitch-dropped impact + convolution
    onProgress?.(0.25, "Pressure drop…");
    const si = -24 - Math.floor(lanes.mutation * 12);
    let pressure = T.resampleChannels(
      stereo,
      2 ** (si / 12),
      stereo[0].length,
    );
    pressure = applyTape(pressure, {
      profile: "sub_heavy",
      sampleRate: sr,
      chaos: lanes.degradation,
    });
    pressure = convolutionSmear(pressure, sr, {
      decayTimeS: 0.5 + lanes.space,
      mix: 0.4,
    });
    pressure = finishSample(pressure, sr, {
      profile: "gentle",
      softClipDrive: 0.3,
      limit: true,
      fadeInMs: 5,
      fadeOutMs: 100,
    });
    outputs.push(
      makeSample(
        `${stem}__pressure_drop.wav`,
        pressure,
        sr,
        "one-shot",
        `Pressure drop impact (${si} st) with convolution tail`,
      ),
    );

    // 3. Metal impact — reverse + metallic reverb + tape
    onProgress?.(0.4, "Metal impact…");
    const metalIn = T.capDuration(stereo, sr, 4);
    let metalImpact = T.reverse(metalIn);
    metalImpact = dirtyMetallic(metalImpact, sr, {
      decay: 0.3 + lanes.degradation * 0.4,
      color: 0.4 + lanes.instability * 0.5,
      mix: 0.5,
    });
    metalImpact = applyTape(metalImpact, {
      profile: "degraded",
      sampleRate: sr,
      chaos: lanes.degradation * 0.5,
    });
    metalImpact = finishSample(metalImpact, sr, {
      profile: "gentle",
      softClipDrive: 0.4,
      fadeInMs: 10,
      fadeOutMs: 80,
    });
    outputs.push(
      makeSample(
        `${stem}__metal_impact.wav`,
        metalImpact,
        sr,
        "one-shot",
        `Metal impact with metallic reverb (${(metalImpact[0].length / sr).toFixed(1)}s)`,
      ),
    );

    // 4. Reverse slam — heavy transient + reverse bloom
    onProgress?.(0.55, "Reverse slam…");
    let slam = T.capDuration(stereo, sr, 3);
    slam = T.softClip(slam, 0.3 + lanes.degradation * 0.5);
    slam = reverseBloom(slam, sr, {
      decay: 0.4 + lanes.space * 0.5,
      damping: 0.4,
      mix: 0.6,
    });
    slam = finishSample(slam, sr, {
      profile: "gentle",
      softClipDrive: 0.3,
      limit: true,
      stereoWidth: lanes.stereo * 0.3,
    });
    outputs.push(
      makeSample(
        `${stem}__reverse_slam.wav`,
        slam,
        sr,
        "one-shot",
        `Reverse slam with bloom reverb`,
      ),
    );

    // 5. Sub collapse — low-end only impact with deep tape
    onProgress?.(0.7, "Sub collapse…");
    let subCollapse = T.resampleChannels(
      stereo,
      2 ** (-30 / 12),
      stereo[0].length,
    );
    subCollapse = applyTape(subCollapse, {
      profile: "sub_heavy",
      sampleRate: sr,
      chaos: lanes.degradation,
    });
    subCollapse = convolutionSmear(subCollapse, sr, {
      decayTimeS: 1 + lanes.space * 2,
      mix: 0.5,
      dampingHz: 3000,
    });
    subCollapse = finishSample(subCollapse, sr, {
      profile: "warm",
      softClipDrive: 0.4,
      limit: true,
      fadeInMs: 5,
      fadeOutMs: 200,
      tailExtendS: lanes.tail * 1.0,
    });
    outputs.push(
      makeSample(
        `${stem}__sub_collapse.wav`,
        subCollapse,
        sr,
        "one-shot",
        `Sub collapse (-30 st) with deep convolution tail`,
      ),
    );
  }
  return outputs.filter((s): s is GeneratedSample => s !== null);
}

// ── Chaos Pack ───────────────────────────────────────────────────────

function chaosPack(
  files: AudioBufferData[],
  chaos: number,
  onProgress?: (v: number, msg: string) => void,
  lengthMode?: LengthMode,
): GeneratedSample[] {
  const outputs: (GeneratedSample | null)[] = [];
  for (const src of files) {
    // 1. Ambience — cathedral bed variant
    onProgress?.(0.08, "Generating ambience…");
    const ambResults = ambientStretchLab([src], chaos * 0.7, undefined, lengthMode);
    const bedSample = ambResults.find((s) =>
      s?.filename?.includes("cathedral_bed"),
    );
    if (bedSample) outputs.push(bedSample);

    // 2. Ghost reverse oddity
    onProgress?.(0.18, "Generating ghost reverse…");
    const ghostResults = ghostReverseLab([src], chaos * 0.8, undefined, lengthMode);
    const haunted = ghostResults.find((s) =>
      s?.filename?.includes("haunted_room"),
    );
    if (haunted) outputs.push(haunted);

    // 3-4. Granular cloud + shards
    onProgress?.(0.28, "Scattering granular…");
    const granResults = granularShards([src], chaos, undefined, lengthMode);
    const particle = granResults.find((s) =>
      s?.filename?.includes("particle_cloud"),
    );
    const swarm = granResults.find((s) =>
      s?.filename?.includes("granular_delay_swarm"),
    );
    if (particle) outputs.push(particle);
    if (swarm) outputs.push(swarm);

    // 5. Degraded loop
    onProgress?.(0.4, "Finding loops…");
    const loopResults = loopExtractor([src], chaos * 0.8, undefined, lengthMode);
    const dirtyLoop = loopResults.find((s) =>
      s?.filename?.includes("dirty_room"),
    );
    if (dirtyLoop) outputs.push(dirtyLoop);

    // 6. Impact/riser
    onProgress?.(0.5, "Building risers…");
    const riserResults = impactRiserMutator([src], chaos * 0.8, undefined, lengthMode);
    const doomRiser = riserResults.find((s) =>
      s?.filename?.includes("doom_riser"),
    );
    if (doomRiser) outputs.push(doomRiser);

    // 7. Pitch wreckage oddity
    onProgress?.(0.55, "Wrecking pitch…");
    const pitchResults = pitchWreckage([src], chaos * 0.9, undefined, lengthMode);
    const subBeast = pitchResults.find((s) =>
      s?.filename?.includes("sub_beast"),
    );
    if (subBeast) outputs.push(subBeast);
  }
  return outputs.filter((s): s is GeneratedSample => s !== null);
}

// ── Registry ─────────────────────────────────────────────────────────

type PresetFn = (
  files: AudioBufferData[],
  chaos: number,
  onProgress?: (v: number, msg: string) => void,
  lengthMode?: LengthMode,
) => GeneratedSample[];

const RECIPE_REGISTRY: Record<
  string,
  { fn: PresetFn; outputCount: number; categories: SampleCategory[] }
> = {
  ambient_stretch: {
    fn: ambientStretchLab,
    outputCount: 5,
    categories: ["ambience", "ambience", "ambience", "ambience", "ambience"],
  },
  ghost_reverse: {
    fn: ghostReverseLab,
    outputCount: 4,
    categories: ["ambience", "ambience", "oddity", "ambience"],
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
    categories: ["oddity", "oddity", "oddity", "oddity"],
  },
  pitch_wreckage: {
    fn: pitchWreckage,
    outputCount: 4,
    categories: ["oddity", "oddity", "oddity", "oddity"],
  },
  loop_extractor: {
    fn: loopExtractor,
    outputCount: 5,
    categories: ["loop", "loop", "loop", "loop", "one-shot"],
  },
  impact_riser: {
    fn: impactRiserMutator,
    outputCount: 5,
    categories: ["ambience", "one-shot", "one-shot", "one-shot", "one-shot"],
  },
  chaos_pack: {
    fn: chaosPack,
    outputCount: 7,
    categories: [
      "ambience",
      "oddity",
      "granular",
      "granular",
      "loop",
      "ambience",
      "oddity",
    ],
  },
};

export function generatePack(
  files: AudioBufferData[],
  preset: string,
  chaos: number,
  onProgress: (value: number, message: string) => void,
  lengthMode?: string,
): { samples: GeneratedSample[]; manifestSamples: PackManifestSample[] } {
  const recipe = RECIPE_REGISTRY[preset];
  if (!recipe) throw new Error(`Unknown preset: ${preset}`);

  onProgress(0.05, "Processing audio…");
  const lm = lengthMode as LengthMode | undefined;
  const samples = recipe.fn(files, chaos, onProgress, lm);

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
