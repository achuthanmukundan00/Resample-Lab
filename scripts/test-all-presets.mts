/**
 * Comprehensive preset test harness for Resample-Lab.
 *
 * Tests every preset against a real audio file at all chaos levels
 * (Clean → Weird → Broken → Illegal Texture) to verify:
 *   1. No preset freezes for 90+ seconds
 *   2. No preset produces errors (NaN, Infinity, silent output, etc.)
 *
 * Usage:
 *   npx tsx scripts/test-all-presets.mts <path-to-wav>
 *
 * Example:
 *   npx tsx scripts/test-all-presets.mts /path/to/audio.wav
 */

import * as fs from "node:fs";
import * as path from "node:path";

// ── WAV parser ───────────────────────────────────────────────────────

interface WavData {
  sampleRate: number;
  numChannels: number;
  channels: Float32Array[];
  durationS: number;
}

function parseWav(filePath: string): WavData {
  const buf = fs.readFileSync(filePath);
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);

  // RIFF header
  const riff = String.fromCharCode(
    dv.getUint8(0),
    dv.getUint8(1),
    dv.getUint8(2),
    dv.getUint8(3),
  );
  if (riff !== "RIFF") throw new Error("Not a valid WAV file (missing RIFF)");

  // WAVE format
  const wave = String.fromCharCode(
    dv.getUint8(8),
    dv.getUint8(9),
    dv.getUint8(10),
    dv.getUint8(11),
  );
  if (wave !== "WAVE") throw new Error("Not a valid WAV file (missing WAVE)");

  // Parse chunks
  let offset = 12;
  let sampleRate = 44100;
  let numChannels = 1;
  let bitsPerSample = 16;
  let dataOffset = 0;
  let dataSize = 0;

  while (offset < buf.length - 8) {
    const chunkId = String.fromCharCode(
      dv.getUint8(offset),
      dv.getUint8(offset + 1),
      dv.getUint8(offset + 2),
      dv.getUint8(offset + 3),
    );
    const chunkSize = dv.getUint32(offset + 4, true);

    if (chunkId === "fmt ") {
      const audioFormat = dv.getUint16(offset + 8, true);
      numChannels = dv.getUint16(offset + 10, true);
      sampleRate = dv.getUint32(offset + 12, true);
      bitsPerSample = dv.getUint16(offset + 22, true);

      if (audioFormat !== 1) {
        // Try to find PCM data even in non-PCM files (e.g., WAVE_FORMAT_EXTENSIBLE)
        // …but for now, just warn
        console.warn(
          `  [warn] Audio format = ${audioFormat}, expected 1 (PCM). May not decode correctly.`,
        );
      }
    } else if (chunkId === "data") {
      dataOffset = offset + 8;
      dataSize = chunkSize;
    }

    offset += 8 + chunkSize;
    // Chunks are word-aligned
    if (chunkSize % 2 !== 0) offset += 1;
  }

  if (dataSize === 0) throw new Error("WAV file has no data chunk");

  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = numChannels * bytesPerSample;
  const numFrames = Math.floor(dataSize / blockAlign);

  // Extract channels
  const channels: Float32Array[] = Array.from({ length: numChannels }, () =>
    new Float32Array(numFrames),
  );

  const dataBuf = buf.subarray(dataOffset, dataOffset + dataSize);

  if (bitsPerSample === 16) {
    for (let i = 0; i < numFrames; i++) {
      for (let ch = 0; ch < numChannels; ch++) {
        const idx = i * blockAlign + ch * bytesPerSample;
        const sample = dataBuf.readInt16LE(idx);
        channels[ch][i] = sample / 32768;
      }
    }
  } else if (bitsPerSample === 24) {
    for (let i = 0; i < numFrames; i++) {
      for (let ch = 0; ch < numChannels; ch++) {
        const idx = i * blockAlign + ch * bytesPerSample;
        // 24-bit signed little-endian
        const b0 = dataBuf[idx];
        const b1 = dataBuf[idx + 1];
        const b2 = dataBuf[idx + 2];
        let sample = b0 | (b1 << 8) | (b2 << 16);
        if (sample & 0x800000) sample -= 0x1000000; // sign-extend
        channels[ch][i] = sample / 8388608;
      }
    }
  } else if (bitsPerSample === 32) {
    // 32-bit float or 32-bit int
    for (let i = 0; i < numFrames; i++) {
      for (let ch = 0; ch < numChannels; ch++) {
        const idx = i * blockAlign + ch * bytesPerSample;
        // Try as float first, then as int
        const floatVal = dataBuf.readFloatLE(idx);
        if (Math.abs(floatVal) <= 10) {
          channels[ch][i] = floatVal;
        } else {
          const intVal = dataBuf.readInt32LE(idx);
          channels[ch][i] = intVal / 2147483648;
        }
      }
    }
  } else if (bitsPerSample === 8) {
    for (let i = 0; i < numFrames; i++) {
      for (let ch = 0; ch < numChannels; ch++) {
        const idx = i * blockAlign + ch * bytesPerSample;
        channels[ch][i] = (dataBuf[idx] - 128) / 128;
      }
    }
  } else {
    throw new Error(`Unsupported bit depth: ${bitsPerSample}`);
  }

  return {
    sampleRate,
    numChannels,
    channels,
    durationS: numFrames / sampleRate,
  };
}

// ── Imports from the DSP pipeline ────────────────────────────────────

import type { AudioBufferData, GeneratedSample } from "../apps/web/lib/dsp/types";
import {
  generatePack,
  PRESET_OUTPUT_COUNTS,
} from "../apps/web/lib/dsp/presets";
import { setDeadline } from "../apps/web/lib/dsp/deadline";

// ── Preset definitions ───────────────────────────────────────────────

const PRESETS = [
  "ambient_stretch",
  "ghost_reverse",
  "granular_shards",
  "bitrot_dirt",
  "pitch_wreckage",
  "loop_extractor",
  "impact_riser",
  "chaos_pack",
] as const;

const PRESET_NAMES: Record<string, string> = {
  ambient_stretch: "Ambient Stretch Lab",
  ghost_reverse: "Ghost Reverse Lab",
  granular_shards: "Granular Shards",
  bitrot_dirt: "Bitrot Dirt",
  pitch_wreckage: "Pitch Wreckage",
  loop_extractor: "Loop Extractor",
  impact_riser: "Impact / Riser Mutator",
  chaos_pack: "Chaos Pack",
};

const CHAOS_LEVELS = [
  { value: 0.0, label: "Clean" },
  { value: 0.33, label: "Weird" },
  { value: 0.66, label: "Broken" },
  { value: 1.0, label: "Illegal Texture" },
];

const DEFAULT_LENGTH_MODES: Record<string, string> = {
  ambient_stretch: "absurd",
  ghost_reverse: "long",
  granular_shards: "medium",
  bitrot_dirt: "medium",
  pitch_wreckage: "medium",
  loop_extractor: "medium",
  impact_riser: "long",
  chaos_pack: "long",
};

const FREEZE_THRESHOLD_MS = 90_000; // 90 seconds
const WORKER_TIMEOUT_MS = 120_000; // Same as packWorker timeout

// ── Test result types ────────────────────────────────────────────────

interface SingleTestResult {
  preset: string;
  chaos: number;
  chaosLabel: string;
  lengthMode: string;
  elapsedMs: number;
  success: boolean;
  error?: string;
  sampleCount: number;
  totalDurationS: number;
  warnings: string[];
}

interface TestSummary {
  totalTests: number;
  passed: number;
  failed: number;
  frozen: number; // > 90s
  errors: number;
  results: SingleTestResult[];
}

// ── Main test runner ─────────────────────────────────────────────────

async function main() {
  const wavPath = process.argv[2];
  if (!wavPath) {
    console.error("Usage: npx tsx scripts/test-all-presets.mts <path-to-wav>");
    process.exit(1);
  }

  if (!fs.existsSync(wavPath)) {
    console.error(`File not found: ${wavPath}`);
    process.exit(1);
  }

  const wavName = path.basename(wavPath);
  console.log(`\n═══════════════════════════════════════════════════════`);
  console.log(`  Resample-Lab — Comprehensive Preset Test`);
  console.log(`═══════════════════════════════════════════════════════`);
  console.log(`\n  Audio file: ${wavName}`);

  // Parse WAV
  console.log(`  Parsing WAV…`);
  const wav = parseWav(wavPath);
  console.log(
    `  → ${wav.sampleRate} Hz, ${wav.numChannels} ch, ${wav.durationS.toFixed(1)}s`,
  );

  // Cap source to 60s for performance (most presets already do this internally)
  const MAX_SOURCE_S = 60;
  let sourceChannels = wav.channels;
  if (wav.durationS > MAX_SOURCE_S) {
    const maxSamples = Math.floor(wav.sampleRate * MAX_SOURCE_S);
    sourceChannels = wav.channels.map((ch) => ch.slice(0, maxSamples));
    console.log(
      `  → Capped source to ${MAX_SOURCE_S}s (${maxSamples} samples) for testing`,
    );
  }

  // Ensure stereo
  let testChannels = sourceChannels;
  if (testChannels.length === 1) {
    testChannels = [testChannels[0], new Float32Array(testChannels[0])];
  } else if (testChannels.length > 2) {
    testChannels = [testChannels[0], testChannels[1]];
  }

  const audioData: AudioBufferData = {
    name: wavName,
    sampleRate: wav.sampleRate,
    channels: testChannels,
  };

  console.log(`\n  Testing ${PRESETS.length} presets × ${CHAOS_LEVELS.length} chaos levels`);
  console.log(`  Freeze threshold: ${FREEZE_THRESHOLD_MS / 1000}s`);
  console.log(`  Total timeout:    ${WORKER_TIMEOUT_MS / 1000}s\n`);

  // ── Run all tests ─────────────────────────────────────────────────

  const allResults: SingleTestResult[] = [];
  let testIndex = 0;
  const totalTests = PRESETS.length * CHAOS_LEVELS.length;

  for (const presetId of PRESETS) {
    const presetName = PRESET_NAMES[presetId];
    const defaultLengthMode = DEFAULT_LENGTH_MODES[presetId];

    console.log(`\n═══ ${presetName} (${presetId}) ═══`);
    console.log(`    Default length: ${defaultLengthMode}, outputs: ${PRESET_OUTPUT_COUNTS[presetId]}`);

    for (const chaosLevel of CHAOS_LEVELS) {
      testIndex++;
      const progress = `[${testIndex}/${totalTests}]`;
      const label = `${presetId} @ chaos=${chaosLevel.value} (${chaosLevel.label}) ${defaultLengthMode}`;

      const startTime = Date.now();
      let success = false;
      let error: string | undefined;
      let sampleCount = 0;
      let totalDurationS = 0;
      const warnings: string[] = [];

      try {
        const result = await runPresetWithTimeout(
          audioData,
          presetId,
          chaosLevel.value,
          defaultLengthMode,
          WORKER_TIMEOUT_MS,
        );

        const elapsed = Date.now() - startTime;
        success = result.success;
        error = result.error;
        sampleCount = result.sampleCount;
        totalDurationS = result.totalDurationS;
        warnings.push(...result.warnings);

        if (elapsed >= FREEZE_THRESHOLD_MS) {
          warnings.push(`FREEZE: took ${(elapsed / 1000).toFixed(1)}s (≥ ${FREEZE_THRESHOLD_MS / 1000}s)`);
        }

        const elapsedStr =
          elapsed >= FREEZE_THRESHOLD_MS
            ? `⚠ ${(elapsed / 1000).toFixed(1)}s FREEZE`
            : `${(elapsed / 1000).toFixed(1)}s`;

        if (success) {
          console.log(
            `  ${progress} ✓ ${label} → ${sampleCount} samples, ${totalDurationS.toFixed(1)}s audio, ${elapsedStr}`,
          );
        } else {
          console.log(
            `  ${progress} ✗ ${label} → ${elapsedStr} → ${error}`,
          );
        }

        if (warnings.length > 0) {
          for (const w of warnings) {
            console.log(`         ⚠ ${w}`);
          }
        }

        allResults.push({
          preset: presetId,
          chaos: chaosLevel.value,
          chaosLabel: chaosLevel.label,
          lengthMode: defaultLengthMode,
          elapsedMs: elapsed,
          success,
          error,
          sampleCount,
          totalDurationS,
          warnings,
        });
      } catch (err) {
        const elapsed = Date.now() - startTime;
        const errMsg = err instanceof Error ? err.message : String(err);

        console.log(
          `  ${progress} ✗ ${label} → ${(elapsed / 1000).toFixed(1)}s → CRASH: ${errMsg}`,
        );

        allResults.push({
          preset: presetId,
          chaos: chaosLevel.value,
          chaosLabel: chaosLevel.label,
          lengthMode: defaultLengthMode,
          elapsedMs: elapsed,
          success: false,
          error: errMsg,
          sampleCount: 0,
          totalDurationS: 0,
          warnings: [],
        });
      }
    }
  }

  // ── Summary ────────────────────────────────────────────────────────

  const passed = allResults.filter((r) => r.success).length;
  const failed = allResults.filter((r) => !r.success).length;
  const frozen = allResults.filter(
    (r) => r.elapsedMs >= FREEZE_THRESHOLD_MS,
  ).length;
  const withErrors = allResults.filter((r) => r.error).length;

  console.log(`\n`);
  console.log(`═══════════════════════════════════════════════════════`);
  console.log(`  TEST SUMMARY`);
  console.log(`═══════════════════════════════════════════════════════`);
  console.log(`  Total:     ${allResults.length}`);
  console.log(`  Passed:    ${passed}`);
  console.log(`  Failed:    ${failed}`);
  console.log(`  Frozen:    ${frozen} (≥ ${FREEZE_THRESHOLD_MS / 1000}s)`);
  console.log(`  Errors:    ${withErrors}`);
  console.log(`═══════════════════════════════════════════════════════`);

  // Per-preset summary
  console.log(`\n  Per-Preset Breakdown:`);
  for (const presetId of PRESETS) {
    const presetResults = allResults.filter((r) => r.preset === presetId);
    const presetPassed = presetResults.filter((r) => r.success).length;
    const presetFailed = presetResults.filter((r) => !r.success).length;
    const presetFrozen = presetResults.filter(
      (r) => r.elapsedMs >= FREEZE_THRESHOLD_MS,
    ).length;
    const maxElapsed = Math.max(...presetResults.map((r) => r.elapsedMs));
    const avgElapsed =
      presetResults.reduce((s, r) => s + r.elapsedMs, 0) / presetResults.length;

    const status =
      presetFailed > 0 ? "✗ FAIL" : presetFrozen > 0 ? "⚠ FREEZE" : "✓ OK";

    console.log(
      `    ${status.padEnd(10)} ${PRESET_NAMES[presetId].padEnd(24)} ` +
        `avg=${(avgElapsed / 1000).toFixed(1)}s  max=${(maxElapsed / 1000).toFixed(1)}s  ` +
        `(${presetPassed}/${presetResults.length} passed)`,
    );
  }

  // Print failures detail
  const failures = allResults.filter((r) => !r.success);
  if (failures.length > 0) {
    console.log(`\n  ❌ FAILURES:`);
    for (const f of failures) {
      console.log(
        `    - ${f.preset} @ chaos=${f.chaos} (${f.chaosLabel}) ` +
          `${f.lengthMode}: ${f.error}`,
      );
    }
  }

  // Print freezes detail
  const freezes = allResults.filter(
    (r) => r.success && r.elapsedMs >= FREEZE_THRESHOLD_MS,
  );
  if (freezes.length > 0) {
    console.log(`\n  ⚠ FREEZES (${FREEZE_THRESHOLD_MS / 1000}s+):`);
    for (const f of freezes) {
      console.log(
        `    - ${f.preset} @ chaos=${f.chaos} (${f.chaosLabel}) ` +
          `${f.lengthMode}: ${(f.elapsedMs / 1000).toFixed(1)}s`,
      );
    }
  }

  if (frozen > 0) {
    console.log(
      `\n  ⚠ WARNING: ${frozen} test(s) exceeded the ${FREEZE_THRESHOLD_MS / 1000}s freeze threshold!`,
    );
  }

  console.log(`\n  Test complete.\n`);

  // Exit with error code if any failures
  process.exit(failed > 0 ? 1 : 0);
}

// ── Preset runner with timeout ───────────────────────────────────────

interface PresetRunResult {
  success: boolean;
  error?: string;
  sampleCount: number;
  totalDurationS: number;
  warnings: string[];
}

function runPresetWithTimeout(
  audioData: AudioBufferData,
  presetId: string,
  chaos: number,
  lengthMode: string,
  timeoutMs: number,
): Promise<PresetRunResult> {
  return new Promise((resolve) => {
    // Set worker deadline
    setDeadline(Date.now() + timeoutMs);

    let progressMessages: string[] = [];

    try {
      const result = generatePack(
        [audioData],
        presetId,
        chaos,
        (_value: number, message: string) => {
          progressMessages.push(message);
        },
        lengthMode,
      );

      const { samples } = result;

      // Analyze samples for quality
      const warnings: string[] = [];
      let totalDurationS = 0;

      for (const sample of samples) {
        const dur = sample.channels[0].length / sample.sampleRate;
        totalDurationS += dur;

        // Check for NaN/Infinity
        let hasNaN = false;
        let hasInf = false;
        let hasSilent = true;
        for (const ch of sample.channels) {
          for (let i = 0; i < ch.length; i++) {
            const s = ch[i];
            if (Number.isNaN(s)) hasNaN = true;
            if (!Number.isFinite(s)) hasInf = true;
            if (Math.abs(s) > 1e-7) hasSilent = false;
          }
        }

        if (hasNaN) {
          warnings.push(`${sample.filename}: contains NaN`);
        }
        if (hasInf) {
          warnings.push(`${sample.filename}: contains Infinity`);
        }
        if (hasSilent) {
          warnings.push(`${sample.filename}: is silent`);
        }
      }

      resolve({
        success: samples.length > 0 && warnings.length === 0,
        error:
          samples.length === 0
            ? "No samples generated"
            : warnings.length > 0
              ? warnings.join("; ")
              : undefined,
        sampleCount: samples.length,
        totalDurationS,
        warnings,
      });
    } catch (err) {
      resolve({
        success: false,
        error: err instanceof Error ? err.message : String(err),
        sampleCount: 0,
        totalDurationS: 0,
        warnings: [],
      });
    }
  });
}

// ── Run ──────────────────────────────────────────────────────────────

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
