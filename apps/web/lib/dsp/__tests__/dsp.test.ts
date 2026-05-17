/**
 * DSP test suite for Resample-Lab.
 *
 * Run:  npx tsx apps/web/lib/dsp/__tests__/dsp.test.ts
 *
 * Tests verify: finite output, peak safety, deterministic seeded output,
 * stereo/mono compatibility, tail extension, DC blocker, tape loss,
 * granular cloud stability, delay feedback stability, reverb decay stability.
 */

// ── Test runner ──────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
let errors: string[] = [];

function assert(condition: boolean, msg: string) {
  if (condition) {
    passed++;
  } else {
    failed++;
    errors.push(`FAIL: ${msg}`);
    console.error(`  ✗ ${msg}`);
  }
}

function approx(a: number, b: number, epsilon: number = 0.001): boolean {
  return Math.abs(a - b) < epsilon;
}

function isFiniteArray(arr: Float32Array): boolean {
  for (let i = 0; i < arr.length; i++) {
    if (!isFinite(arr[i])) return false;
  }
  return true;
}

function peakAbs(arr: Float32Array): number {
  let m = 0;
  for (let i = 0; i < arr.length; i++) {
    const a = Math.abs(arr[i]);
    if (a > m) m = a;
  }
  return m;
}

function rms(arr: Float32Array): number {
  let sumSq = 0;
  for (let i = 0; i < arr.length; i++) sumSq += arr[i] * arr[i];
  return Math.sqrt(sumSq / arr.length);
}

function generateSine(
  freq: number,
  sampleRate: number,
  durationS: number,
): Float32Array {
  const len = Math.floor(sampleRate * durationS);
  const out = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    out[i] = Math.sin((2 * Math.PI * freq * i) / sampleRate);
  }
  return out;
}

function generateDCOffset(length: number, offset: number): Float32Array {
  const out = new Float32Array(length);
  for (let i = 0; i < length; i++) out[i] = offset;
  return out;
}

function generateNoise(length: number): Float32Array {
  const out = new Float32Array(length);
  for (let i = 0; i < length; i++) out[i] = Math.random() * 2 - 1;
  return out;
}

// ── Imports ──────────────────────────────────────────────────────────

import * as T from "../transforms";
import {
  finishSample,
  trimSilence,
  extendTail,
  applyLimiter,
  mapChaosToLanes,
} from "../finish";
import { applyTape, applyTapeLoss, applyHeadBump, applyTilt } from "../tape";
import {
  monoDelay,
  pingPongDelay,
  diffusionDelay,
  reverseDelay,
  multiTapDelay,
} from "../delay";
import {
  darkRoom,
  modulatedHall,
  dirtyMetallic,
  reverseBloom,
  convolutionSmear,
} from "../reverb";
import {
  granularCloud,
  frozenTexture,
  grainReverbBloom,
  granularDelaySwarm,
} from "../granular";
import { analyzeChannels, warningFlags, hasWarning } from "../analysis";

const SR = 48000;

// ══════════════════════════════════════════════════════════════════════
// TRANSFORMS
// ══════════════════════════════════════════════════════════════════════

console.log("\n── Transforms ──");

// DC block
{
  // Long enough signal for DC blocker to settle
  const dc = generateDCOffset(5000, 0.5);
  const blocked = T.dcBlock([dc], SR, 20)[0];
  assert(isFiniteArray(blocked), "dcBlock: finite output");
  // After 5000 samples (~104ms), the DC blocker settles well below 0.1
  const tailMean = blocked.slice(-1000).reduce((s, v) => s + v, 0) / 1000;
  assert(
    Math.abs(tailMean) < 0.01,
    `dcBlock: removes DC offset in tail (tailMean=${tailMean.toFixed(4)})`,
  );
}

// Normalize peak
{
  const ch = generateSine(440, SR, 0.01);
  const normalized = T.normalizePeak([ch], 0.5)[0];
  const pk = peakAbs(normalized);
  assert(
    approx(pk, 0.5, 0.01),
    `normalizePeak: peak at target (${pk.toFixed(4)})`,
  );
  assert(isFiniteArray(normalized), "normalizePeak: finite output");
}

// Fades
{
  const ch = generateSine(1000, SR, 0.1);
  const fadedIn = T.fadeIn([ch], SR, 10)[0];
  assert(approx(fadedIn[0], 0, 0.01), "fadeIn: starts at zero");
  assert(isFiniteArray(fadedIn), "fadeIn: finite output");

  const fadedOut = T.fadeOut([ch], SR, 10)[0];
  assert(
    approx(fadedOut[fadedOut.length - 1], 0, 0.01),
    "fadeOut: ends at zero",
  );
  assert(isFiniteArray(fadedOut), "fadeOut: finite output");
}

// Soft clip
{
  const hot = new Float32Array([2.0, -2.0, 0.5, -0.5, 0, 1.5, -1.5]);
  const clipped = T.softClip([hot], 0.5)[0];
  assert(isFiniteArray(clipped), "softClip: finite output");
  assert(peakAbs(clipped) <= 1.0, "softClip: peak <= 1.0");
}

// Bitcrush
{
  const ch = generateSine(440, SR, 0.01);
  const crushed = T.bitcrush([ch], 4)[0];
  assert(isFiniteArray(crushed), "bitcrush: finite output");
}

// Delay echo
{
  const ch = generateSine(440, SR, 0.5);
  const delayed = T.delayEcho([ch], SR, 100, 0.5, 0.5)[0];
  assert(isFiniteArray(delayed), "delayEcho: finite output");
  assert(delayed.length === ch.length, "delayEcho: length preserved");
}

// Reverb
{
  const ch = generateSine(440, SR, 0.5);
  const verb = T.simpleReverb([ch], SR, 0.5, 0.5)[0];
  assert(isFiniteArray(verb), "simpleReverb: finite output");
}

// Tape wow
{
  const ch = generateSine(440, SR, 0.5);
  const wowed = T.tapeWow([ch], SR, 0.003, 2)[0];
  assert(isFiniteArray(wowed), "tapeWow: finite output");
}

// Ensure sanitary
{
  const bad = new Float32Array([NaN, Infinity, -Infinity, 1.5, -2.0, 0.3]);
  const clean = T.ensureSanitary([bad])[0];
  assert(isFiniteArray(clean), "ensureSanitary: no NaN/Infinity after cleanup");
  assert(peakAbs(clean) <= 1.0, "ensureSanitary: peak clamped <= 1.0");
}

// Validate output
{
  const valid = T.validateOutput([generateSine(440, SR, 0.1)]);
  assert(valid.valid, "validateOutput: valid sine passes");

  const silent = T.validateOutput([new Float32Array(10)]);
  assert(!silent.valid, "validateOutput: too-short buffer fails");
}

// ══════════════════════════════════════════════════════════════════════
// FINISHING RACK
// ══════════════════════════════════════════════════════════════════════

console.log("\n── Finishing rack ──");

// Trim silence
{
  // Large signal with obvious silence at both ends
  const totalLen = 10000;
  const ch = new Float32Array(totalLen);
  // Fill middle 60% with loud sine
  for (let i = 2000; i < 8000; i++)
    ch[i] = Math.sin((2 * Math.PI * 440 * i) / SR) * 0.8;
  const trimmed = trimSilence([ch], 0.01)[0];
  assert(
    trimmed.length < totalLen,
    `trimSilence: reduces length (${totalLen} → ${trimmed.length})`,
  );
  assert(trimmed.length > 3000, "trimSilence: keeps signal content");
  assert(isFiniteArray(trimmed), "trimSilence: finite output");
}

// Extend tail
{
  const ch = generateSine(440, SR, 0.1);
  const extended = extendTail([ch], SR, 0.05)[0];
  assert(extended.length > ch.length, "extendTail: extends length");
  assert(isFiniteArray(extended), "extendTail: finite output");
  // Tail should be silent
  const tailRms = rms(extended.slice(ch.length));
  assert(
    tailRms < 0.001,
    `extendTail: tail is silent (rms=${tailRms.toExponential(1)})`,
  );
}

// Limiter
{
  const hot = new Float32Array(1000);
  for (let i = 0; i < 1000; i++) hot[i] = Math.sin(i * 0.1) * 2.0;
  const limited = applyLimiter([hot], 0.89)[0];
  assert(
    peakAbs(limited) <= 0.95,
    `applyLimiter: peak within ceiling (${peakAbs(limited).toFixed(4)})`,
  );
  assert(isFiniteArray(limited), "applyLimiter: finite output");
}

// Finish sample (integration)
{
  const ch = generateSine(440, SR, 0.5);
  const finished = finishSample([ch], SR, {
    profile: "warm",
    fadeInMs: 10,
    fadeOutMs: 20,
    dcBlockHz: 20,
    stereoWidth: 0.3,
  });
  assert(isFiniteArray(finished[0]), "finishSample: finite output");
  assert(peakAbs(finished[0]) <= 0.95, "finishSample: peak safe");
}

// Chaos lane mapping
{
  const lanes = mapChaosToLanes(0.5, { mutation: 0.5, space: 1.0 });
  assert(
    approx(lanes.mutation, 0.25, 0.01),
    "mapChaosToLanes: mutation scaled by weight",
  );
  assert(
    approx(lanes.space, 0.5, 0.01),
    "mapChaosToLanes: space scaled by weight",
  );
  assert(
    approx(lanes.degradation, 0.5, 0.01),
    "mapChaosToLanes: degradation uses default",
  );
}

// ══════════════════════════════════════════════════════════════════════
// TAPE MODULE
// ══════════════════════════════════════════════════════════════════════

console.log("\n── Tape module ──");

// DC blocker (via tape)
{
  // Long signal for DC blocker to settle
  const dc = generateDCOffset(5000, 0.5);
  const result = applyTape([dc], {
    profile: "subtle",
    sampleRate: SR,
    chaos: 0,
  });
  assert(isFiniteArray(result[0]), "tape/dcBlock: finite output");
  // Check tail (last 1000 samples) after DC blocker has settled
  const tailMean = result[0].slice(-1000).reduce((s, v) => s + v, 0) / 1000;
  assert(
    Math.abs(tailMean) < 0.01,
    `tape/dcBlock: DC removed in tail (tailMean=${tailMean.toFixed(4)})`,
  );
}

// Tape loss: reduces HF energy
{
  const whiteNoise = generateNoise(10000);
  const beforeRms = rms(whiteNoise);
  const lost = applyTapeLoss([whiteNoise], SR, 0.3, 0.5)[0];
  assert(isFiniteArray(lost), "tapeLoss: finite output");
  const afterRms = rms(lost);
  // HF loss should reduce RMS on white noise
  assert(
    afterRms < beforeRms,
    `tapeLoss: reduces HF energy (${beforeRms.toFixed(3)} → ${afterRms.toFixed(3)})`,
  );
}

// Head bump: increases low region energy
{
  const ch = generateSine(60, SR, 0.2);
  const beforeRms = rms(ch);
  const bumped = applyHeadBump([ch], SR, 60, 3, 0.5)[0];
  assert(isFiniteArray(bumped), "headBump: finite output");
  const afterRms = rms(bumped);
  // 3dB gain at 60Hz should increase energy
  assert(
    afterRms > beforeRms * 1.2,
    `headBump: increases LF energy (${beforeRms.toFixed(3)} → ${afterRms.toFixed(3)})`,
  );
}

// Tilt profiles
{
  const ch = generateSine(1000, SR, 0.1);
  for (const curve of ["dark", "neutral", "bright", "sub_heavy"] as const) {
    const tilted = applyTilt([ch], SR, curve)[0];
    assert(isFiniteArray(tilted), `applyTilt/${curve}: finite output`);
  }
}

// Full tape profiles
{
  const ch = generateSine(440, SR, 0.3);
  for (const profile of [
    "subtle",
    "warm",
    "degraded",
    "destroyed",
    "cinematic_dark",
    "sub_heavy",
  ] as const) {
    const result = applyTape([ch], { profile, sampleRate: SR, chaos: 0.3 });
    assert(isFiniteArray(result[0]), `tape/${profile}: finite output`);
    assert(peakAbs(result[0]) <= 1.5, `tape/${profile}: peak bounded`);
  }
}

// ══════════════════════════════════════════════════════════════════════
// DELAYS
// ══════════════════════════════════════════════════════════════════════

console.log("\n── Delays ──");

const delaySrc = [generateSine(440, SR, 0.5)];

// Mono delay
{
  const out = monoDelay(delaySrc, SR, { timeMs: 100, feedback: 0.4, mix: 0.5 });
  assert(isFiniteArray(out[0]), "monoDelay: finite output");
  assert(out[0].length === delaySrc[0].length, "monoDelay: length preserved");
}

// Ping-pong delay
{
  const stereo = [generateSine(440, SR, 0.5), generateSine(550, SR, 0.5)];
  const out = pingPongDelay(stereo, SR, {
    timeMs: 100,
    feedback: 0.3,
    mix: 0.4,
  });
  assert(isFiniteArray(out[0]), "pingPongDelay/L: finite output");
  assert(isFiniteArray(out[1]), "pingPongDelay/R: finite output");
}

// Diffusion delay
{
  const out = diffusionDelay(delaySrc, SR, {
    delayMs: 80,
    feedback: 0.4,
    mix: 0.5,
    diffusion: 0.7,
  });
  assert(isFiniteArray(out[0]), "diffusionDelay: finite output");
}

// Reverse delay
{
  const out = reverseDelay(delaySrc, SR, {
    delayMs: 150,
    feedback: 0.3,
    mix: 0.5,
  });
  assert(isFiniteArray(out[0]), "reverseDelay: finite output");
}

// Multi-tap delay
{
  const out = multiTapDelay(delaySrc, SR, [
    { timeMs: 50, gain: 0.5 },
    { timeMs: 100, gain: 0.3 },
    { timeMs: 200, gain: 0.15 },
  ]);
  assert(isFiniteArray(out[0]), "multiTapDelay: finite output");
  assert(out[0].length > delaySrc[0].length, "multiTapDelay: extends length");
}

// Feedback stability: high feedback should not explode
{
  const out = monoDelay(delaySrc, SR, {
    timeMs: 100,
    feedback: 0.95,
    mix: 0.5,
  });
  assert(
    peakAbs(out[0]) <= 1.0,
    `monoDelay/highFB: peak bounded (${peakAbs(out[0]).toFixed(3)})`,
  );
}

// ══════════════════════════════════════════════════════════════════════
// REVERBS
// ══════════════════════════════════════════════════════════════════════

console.log("\n── Reverbs ──");

const verbSrc = [generateSine(440, SR, 0.5)];

// Dark room
{
  const out = darkRoom(verbSrc, SR, { decay: 0.4, damping: 0.6, mix: 0.5 });
  assert(isFiniteArray(out[0]), "darkRoom: finite output");
  assert(
    out[0].length >= verbSrc[0].length,
    "darkRoom: tail rendered (length >= input)",
  );
}

// Modulated hall
{
  const out = modulatedHall(verbSrc, SR, {
    decay: 0.5,
    modulationDepth: 0.003,
    mix: 0.5,
  });
  assert(isFiniteArray(out[0]), "modulatedHall: finite output");
}

// Dirty metallic
{
  const out = dirtyMetallic(verbSrc, SR, { decay: 0.4, color: 0.5, mix: 0.5 });
  assert(isFiniteArray(out[0]), "dirtyMetallic: finite output");
}

// Reverse bloom
{
  const out = reverseBloom(verbSrc, SR, { decay: 0.5, damping: 0.5, mix: 0.6 });
  assert(isFiniteArray(out[0]), "reverseBloom: finite output");
}

// Convolution smear
{
  const out = convolutionSmear(verbSrc, SR, { decayTimeS: 0.5, mix: 0.5 });
  assert(isFiniteArray(out[0]), "convolutionSmear: finite output");
  assert(
    out[0].length > verbSrc[0].length,
    "convolutionSmear: extends with tail",
  );
}

// Decay stability: high decay should not explode
{
  const out = darkRoom(verbSrc, SR, { decay: 0.95, damping: 0.5, mix: 0.5 });
  assert(
    peakAbs(out[0]) <= 1.0,
    `darkRoom/highDecay: peak bounded (${peakAbs(out[0]).toFixed(3)})`,
  );
  assert(isFiniteArray(out[0]), "darkRoom/highDecay: finite output");
}

// ══════════════════════════════════════════════════════════════════════
// GRANULAR ENGINE
// ══════════════════════════════════════════════════════════════════════

console.log("\n── Granular engine ──");

const granSrc = [generateSine(440, SR, 2.0), generateSine(550, SR, 2.0)];

// Granular cloud
{
  const out = granularCloud(granSrc, SR, {
    grainMs: 80,
    density: 10,
    durationS: 3,
    pitchRange: 3,
    panSpread: 0.5,
    reverseProbability: 0.2,
    seed: 42,
  });
  assert(isFiniteArray(out[0]), "granularCloud: finite output");
  assert(out[0].length > 1000, "granularCloud: produces reasonable length");

  // Determinism: same seed = same output
  const out2 = granularCloud(granSrc, SR, {
    grainMs: 80,
    density: 10,
    durationS: 3,
    pitchRange: 3,
    panSpread: 0.5,
    reverseProbability: 0.2,
    seed: 42,
  });
  let identical = true;
  for (let i = 0; i < Math.min(out[0].length, out2[0].length); i++) {
    if (out[0][i] !== out2[0][i]) {
      identical = false;
      break;
    }
  }
  assert(identical, "granularCloud: deterministic with same seed");
}

// Frozen texture
{
  const out = frozenTexture(granSrc, SR, {
    freezeStartS: 0.3,
    freezeDurationS: 0.3,
    outputDurationS: 2,
    grainMs: 60,
    seed: 100,
  });
  assert(isFiniteArray(out[0]), "frozenTexture: finite output");
  assert(out[0].length > 1000, "frozenTexture: produces reasonable length");
}

// Grain reverb bloom
{
  const out = grainReverbBloom(granSrc, SR, {
    grainMs: 80,
    decayS: 1,
    durationS: 3,
    pitchRange: 2,
    seed: 200,
  });
  assert(isFiniteArray(out[0]), "grainReverbBloom: finite output");
}

// Granular delay swarm
{
  const out = granularDelaySwarm(granSrc, SR, {
    grainMs: 50,
    durationS: 3,
    feedbackAmount: 0.5,
    delayTimeMs: 150,
    pitchRange: 4,
    seed: 300,
  });
  assert(isFiniteArray(out[0]), "granularDelaySwarm: finite output");
}

// ══════════════════════════════════════════════════════════════════════
// STEREO/MONO COMPATIBILITY
// ══════════════════════════════════════════════════════════════════════

console.log("\n── Stereo/Mono compatibility ──");

const mono = [generateSine(440, SR, 0.3)];
const stereo = [generateSine(440, SR, 0.3), generateSine(550, SR, 0.3)];

// All processors should accept mono and produce valid output
const processors: [string, (src: Float32Array[]) => Float32Array[]][] = [
  ["finishSample/mono", (c) => finishSample(c, SR)],
  ["tape/mono", (c) => applyTape(c, { profile: "warm", sampleRate: SR })],
  ["monoDelay/mono", (c) => monoDelay(c, SR, { timeMs: 100 })],
  ["darkRoom/mono", (c) => darkRoom(c, SR, {})],
  [
    "granularCloud/mono",
    (c) => granularCloud(c, SR, { durationS: 1, seed: 99 }),
  ],
];

for (const [name, fn] of processors) {
  const result = fn(mono);
  assert(result.length > 0, `${name}: produces output channels`);
  assert(isFiniteArray(result[0]), `${name}: finite output`);
}

// Stereo processors
const stereoProcessors: [string, (src: Float32Array[]) => Float32Array[]][] = [
  ["pingPongDelay/stereo", (c) => pingPongDelay(c, SR, { timeMs: 100 })],
];

for (const [name, fn] of stereoProcessors) {
  const result = fn(stereo);
  assert(result.length >= 2, `${name}: produces stereo output`);
  assert(isFiniteArray(result[0]), `${name}/L: finite`);
  assert(isFiniteArray(result[1]), `${name}/R: finite`);
}

// ══════════════════════════════════════════════════════════════════════
// AUDIO ANALYSIS
// ══════════════════════════════════════════════════════════════════════

console.log("\n── Audio analysis ──");

// Report shape
{
  const ch = [generateSine(440, SR, 0.1)];
  const a = analyzeChannels(ch, SR);
  assert(typeof a.durationSeconds === "number", "analysis: durationSeconds is number");
  assert(a.peak > 0, "analysis: peak > 0 for sine");
  assert(a.rms > 0, "analysis: rms > 0 for sine");
  assert(!a.hasNaN, "analysis: no NaN for clean sine");
  assert(!a.isSilent, "analysis: sine is not silent");
}

// Silence detection
{
  const silent = [new Float32Array(48000)];
  const a = analyzeChannels(silent, SR);
  assert(a.isSilent, "analysis/silence: all-zero is silent");
  assert(a.peak === 0, "analysis/silence: peak is 0");
  assert(a.rms === 0, "analysis/silence: rms is 0");
  assert(hasWarning(a), "analysis/silence: hasWarning is true");
  assert(
    warningFlags(a).includes("silent"),
    "analysis/silence: warningFlags includes silent",
  );
}

// Clipping detection
{
  const clipping = [new Float32Array([0.5, 1.0, -1.0, 0.999, 0.3])];
  const a = analyzeChannels(clipping, SR);
  assert(a.isClipping, "analysis/clipping: detects clipping at 1.0");
  assert(a.clippingSampleCount >= 2, "analysis/clipping: counts clipped samples");
  assert(hasWarning(a), "analysis/clipping: hasWarning is true");
}

// RMS calculation
{
  const len = 1000;
  const constVal = 0.5;
  const ch = [new Float32Array(len)];
  for (let i = 0; i < len; i++) ch[0][i] = constVal;
  const a = analyzeChannels(ch, SR);
  const expectedRms = Math.sqrt(constVal * constVal);
  assert(
    Math.abs(a.rms - expectedRms) < 0.001,
    `analysis/rms: constant signal (${a.rms.toFixed(4)} ≈ ${expectedRms.toFixed(4)})`,
  );
}

// NaN detection
{
  const nanChannel = [new Float32Array([0.5, NaN, 0.3])];
  const a = analyzeChannels(nanChannel, SR);
  assert(a.hasNaN, "analysis/NaN: detects NaN samples");
  assert(hasWarning(a), "analysis/NaN: hasWarning is true");
}

// Empty channels
{
  const empty: Float32Array[] = [];
  const a = analyzeChannels(empty, SR);
  assert(a.isSilent, "analysis/empty: empty channels are silent");
  assert(a.durationSeconds === 0, "analysis/empty: duration is 0");
}

// Stereo analysis
{
  const stereo = [
    generateSine(440, SR, 0.1),
    generateSine(550, SR, 0.1),
  ];
  const a = analyzeChannels(stereo, SR);
  assert(a.channelCount === 2, "analysis/stereo: channel count is 2");
  assert(a.peak > 0, "analysis/stereo: peak > 0");
  assert(a.rms > 0, "analysis/stereo: rms > 0");
  assert(!a.hasNaN, "analysis/stereo: no NaN");
}

// ══════════════════════════════════════════════════════════════════════
// RESULTS
// ══════════════════════════════════════════════════════════════════════

console.log(`\n${"═".repeat(60)}`);
console.log(`  Passed: ${passed}  |  Failed: ${failed}`);
console.log(`${"═".repeat(60)}\n`);

if (failed > 0) {
  console.error("FAILURES:");
  for (const e of errors) console.error(`  ${e}`);
  process.exit(1);
}

console.log("✓ All DSP tests passed.\n");
