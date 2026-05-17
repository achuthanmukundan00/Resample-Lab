#!/usr/bin/env npx tsx
/**
 * Render-Audit Corpus Tool
 *
 * Reads WAV files from an input directory, renders every selected preset
 * against every file at multiple chaos × length mode combinations, and
 * produces a structured .render-audit/ tree with analysis reports.
 *
 * Usage:
 *   npx tsx scripts/render-dsp-corpus.ts --input ./my-samples
 *   npx tsx scripts/render-dsp-corpus.ts --input ./my-samples --quick
 *   npx tsx scripts/render-dsp-corpus.ts --input ./my-samples --chaos 0.0,0.5,1.0
 *   npx tsx scripts/render-dsp-corpus.ts --input ./my-samples --preset ambient_stretch,loop_extractor
 *   npx tsx scripts/render-dsp-corpus.ts --help
 *
 * Options:
 *   --input, -i     Directory containing source WAV files (required)
 *   --output, -o    Output directory (default: .render-audit)
 *   --chaos, -c     Comma-separated chaos values (default: 0.2,0.6,1.0)
 *   --length, -l    Comma-separated length modes (default: short,medium,long,absurd)
 *   --preset, -p    Comma-separated preset IDs (default: all 8 presets)
 *   --limit, -n     Max files to process (default: all)
 *   --quick, -q     Fast mode: chaos 0.6 only, medium length only, all presets
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { generatePack } from "../apps/web/lib/dsp/presets";
import type { AudioBufferData } from "../apps/web/lib/dsp/types";
import { analyzeChannels, warningFlags } from "../apps/web/lib/dsp/analysis";

// ── Types ────────────────────────────────────────────────────────

interface RenderResult {
  inputFile: string;
  preset: string;
  outputFilename: string;
  chaos: number;
  lengthMode: string;
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
  fileSizeBytes: number;
  warnings: string[];
  /** True when the sample was filtered out by validation (e.g. RMS too low). */
  isSkipped?: boolean;
  /** Reason given by validateOutput for the skip. */
  skipReason?: string;
}

interface ReportData {
  generatedAt: string;
  inputFiles: string[];
  presets: string[];
  chaosValues: number[];
  lengthModes: string[];
  totalPresetJobs: number;
  totalRenders: number;
  results: RenderResult[];
  summary: {
    wavFilesWritten: number;
    skippedOutputs: number;
    failedRenders: number;
    silentFiles: number;
    clippingWarnings: number;
    nanInfinityCount: number;
  };
}

const ALL_PRESETS = [
  "ambient_stretch",
  "ghost_reverse",
  "granular_shards",
  "bitrot_dirt",
  "pitch_wreckage",
  "loop_extractor",
  "impact_riser",
  "chaos_pack",
];

const ALL_LENGTH_MODES = ["short", "medium", "long", "absurd"];

// ── WAV parsing ──────────────────────────────────────────────────

function readWavFile(filePath: string): AudioBufferData {
  const buf = fs.readFileSync(filePath);
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);

  const riff = String.fromCharCode(
    view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3),
  );
  if (riff !== "RIFF") throw new Error(`Not a RIFF file: ${filePath}`);

  const wave = String.fromCharCode(
    view.getUint8(8), view.getUint8(9), view.getUint8(10), view.getUint8(11),
  );
  if (wave !== "WAVE") throw new Error(`Not a WAVE file: ${filePath}`);

  let offset = 12;
  let audioFormat = 0, numChannels = 0, sampleRate = 0, bitsPerSample = 0;
  let dataOffset = 0, dataSize = 0;

  while (offset + 8 <= buf.length) {
    const chunkId = String.fromCharCode(
      view.getUint8(offset), view.getUint8(offset + 1),
      view.getUint8(offset + 2), view.getUint8(offset + 3),
    );
    const chunkSize = view.getUint32(offset + 4, true);

    if (chunkId === "fmt ") {
      audioFormat = view.getUint16(offset + 8, true);
      numChannels = view.getUint16(offset + 10, true);
      sampleRate = view.getUint32(offset + 12, true);
      bitsPerSample = view.getUint16(offset + 22, true);
    } else if (chunkId === "data") {
      dataOffset = offset + 8;
      dataSize = chunkSize;
    }

    offset += 8 + chunkSize;
    if (offset % 2 !== 0) offset++;
  }

  if (numChannels === 0 || sampleRate === 0)
    throw new Error(`Invalid WAV header: ${filePath}`);

  const bytesPerSample = bitsPerSample / 8;
  const totalSamples = Math.floor(dataSize / bytesPerSample);
  const samplesPerChannel = Math.floor(totalSamples / numChannels);

  const channels: Float32Array[] = [];
  for (let ch = 0; ch < numChannels; ch++)
    channels.push(new Float32Array(samplesPerChannel));

  if (audioFormat === 1) {
    for (let i = 0; i < totalSamples; i++) {
      const ch = i % numChannels;
      const sampleIdx = Math.floor(i / numChannels);
      if (sampleIdx >= samplesPerChannel) break;
      const byteOff = dataOffset + i * bytesPerSample;
      let sample: number;
      if (bitsPerSample === 16) {
        sample = view.getInt16(byteOff, true) / 32768;
      } else if (bitsPerSample === 24) {
        let val = view.getUint8(byteOff) | (view.getUint8(byteOff + 1) << 8) | (view.getUint8(byteOff + 2) << 16);
        if (val & 0x800000) val |= ~0xffffff;
        sample = val / 8388608;
      } else if (bitsPerSample === 32) {
        sample = view.getInt32(byteOff, true) / 2147483648;
      } else {
        throw new Error(`Unsupported bits per sample: ${bitsPerSample}`);
      }
      channels[ch][sampleIdx] = sample;
    }
  } else if (audioFormat === 3) {
    for (let i = 0; i < totalSamples; i++) {
      const ch = i % numChannels;
      const sampleIdx = Math.floor(i / numChannels);
      if (sampleIdx >= samplesPerChannel) break;
      channels[ch][sampleIdx] = view.getFloat32(dataOffset + i * 4, true);
    }
  } else {
    throw new Error(`Unsupported audio format: ${audioFormat}`);
  }

  return { name: path.basename(filePath), sampleRate, channels };
}

// ── WAV writing ──────────────────────────────────────────────────

function writeWav(filePath: string, channels: Float32Array[], sampleRate: number): void {
  const numChannels = channels.length;
  const numSamples = channels[0].length;
  const bitDepth = 16;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = numSamples * blockAlign;
  const buf = new ArrayBuffer(44 + dataSize);
  const v = new DataView(buf);

  function writeString(off: number, str: string) {
    for (let i = 0; i < str.length; i++) v.setUint8(off + i, str.charCodeAt(i));
  }

  writeString(0, "RIFF");
  v.setUint32(4, 36 + dataSize, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, numChannels, true);
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * blockAlign, true);
  v.setUint16(32, blockAlign, true);
  v.setUint16(34, bitDepth, true);
  writeString(36, "data");
  v.setUint32(40, dataSize, true);

  const off = 44;
  for (let i = 0; i < numSamples; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const s = Math.max(-1, Math.min(1, channels[ch][i]));
      v.setInt16(off + (i * blockAlign) + ch * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
  }

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, new Uint8Array(buf));
}

// ── Report helpers ───────────────────────────────────────────────

function generateMarkdownReport(report: ReportData, _outputDir: string): string {
  const lines: string[] = [];

  lines.push("# Render-Audit Report");
  lines.push("");
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push("");

  // ── Quick listening guide ──
  lines.push("## How to use this report");
  lines.push("");
  lines.push("1. Browse the `.render-audit/<input>/<preset>/` folders and **listen** to the WAV files.");
  lines.push("2. Check the tables below for technical warnings (silence, clipping, NaN).");
  lines.push("3. Pay special attention to presets with many warnings — those may need parameter tuning for your source material.");
  lines.push("4. The **Per-Preset Listening Notes** section describes what each preset should sound like at different chaos levels.");
  lines.push("");

  // ── Summary ──
  lines.push("## Summary");
  lines.push("");
  lines.push(`- **Input files**: ${report.inputFiles.length}`);
  lines.push(`- **Presets**: ${report.presets.join(", ")}`);
  lines.push(`- **Chaos values**: ${report.chaosValues.join(", ")}`);
  lines.push(`- **Length modes**: ${report.lengthModes.join(", ")}`);
  lines.push(`- **Preset jobs attempted**: ${report.totalPresetJobs}`);
  lines.push(`- **WAV files written**: ${report.summary.wavFilesWritten}`);
  lines.push(`- **Skipped (unusable)**: ${report.summary.skippedOutputs}`);
  lines.push(`- **Failed renders**: ${report.summary.failedRenders}`);
  lines.push(`- **Silent/near-silent files**: ${report.summary.silentFiles}`);
  lines.push(`- **Clipping warnings**: ${report.summary.clippingWarnings}`);
  lines.push(`- **NaN/Infinity detections**: ${report.summary.nanInfinityCount}`);
  lines.push("");

  // ── Per-preset listening notes ──
  const PRESET_NOTES: Record<string, string> = {
    ambient_stretch: "Long, evolving pads. At low chaos: smooth cathedral beds. Mid: textured drones with tape wobble. High: unstable, warped ambience with heavy modulation.",
    ghost_reverse: "Reversed tails and pre-impact sucks. Low chaos: subtle reverse blooms. Mid: prominent swells with diffusion. High: chaotic metallic reverses with room rumble.",
    granular_shards: "Sliced grains shuffled and pitch-shifted. Low: clean particle clouds. Mid: bitcrushed fragments and stutters. High: unstable grain swarms with extreme pitch scatter.",
    bitrot_dirt: "Lo-fi degradation and bitcrushing. Low: subtle speaker-cone texture. Mid: heavy cassette wear and downsample. High: destroyed 2-bit artifacts with metallic ring.",
    pitch_wreckage: "Pitch mutation via resampling. Low: octave layers and detuned pairs. Mid: glassy highs and sub-heavy tails. High: extreme pitch smears with unstable filter sweeps.",
    loop_extractor: "Heuristic loop finding. Low: clean crossfaded loops. Mid: dirty room loops with subtle tape. High: heavily processed ambient loops with long decays.",
    impact_riser: "Cinematic impact design. Low: short reverse slams. Mid: filter-swept risers with hall reverb. High: sub-dropping 30-st collapse with convolution tail.",
    chaos_pack: "Curated multi-preset sampler. Low: cathedral bed + subtle ghost. Mid: granular cloud + dirty loop. High: particle swarm + sub beast + doom riser.",
  };

  lines.push("## Per-Preset Listening Notes");
  lines.push("");
  for (const pid of report.presets) {
    const note = PRESET_NOTES[pid] || "No listening notes for this preset.";
    lines.push(`- **${pid}**: ${note}`);
  }
  lines.push("");

  // ── Warning counts ──
  const presetWarnings: Record<string, number> = {};
  for (const r of report.results) {
    if (r.isSkipped) continue;
    if (r.warnings.length > 0) {
      presetWarnings[r.preset] = (presetWarnings[r.preset] || 0) + 1;
    }
  }
  if (Object.keys(presetWarnings).length > 0) {
    lines.push("## Per-Preset Warning Counts");
    lines.push("");
    lines.push("| Preset | Warnings |");
    lines.push("|--------|----------|");
    for (const [preset, count] of Object.entries(presetWarnings)) {
      lines.push(`| ${preset} | ${count} |`);
    }
    lines.push("");
  }

  // ── Skipped / unusable outputs ──
  const skippedResults = report.results.filter((r) => r.isSkipped);
  if (skippedResults.length > 0) {
    lines.push("## Skipped / Unusable Outputs");
    lines.push("These samples were rejected by the validation stage (e.g. RMS too low, too short, NaN). They produce no WAV file.");
    lines.push("");
    for (const r of skippedResults) {
      lines.push(`- ${r.inputFile} / **${r.preset}** / chaos=${r.chaos} / ${r.lengthMode} → \`${r.outputFilename}\` — ${r.skipReason}`);
    }
    lines.push("");
  }

  // ── Problematic outputs ──
  const silentResults = report.results.filter((r) => r.isSilent && !r.isSkipped);
  if (silentResults.length > 0) {
    lines.push("## Silent / Near-Silent Outputs");
    lines.push("These outputs may need attention — very low RMS suggests the processing chain removed too much signal.");
    lines.push("");
    for (const r of silentResults) {
      lines.push(`- ${r.inputFile} / **${r.preset}** / chaos=${r.chaos} / ${r.lengthMode} → \`${r.outputFilename}\` (RMS=${r.rms.toExponential(2)})`);
    }
    lines.push("");
  }

  const clippingResults = report.results.filter((r) => r.isClipping);
  if (clippingResults.length > 0) {
    lines.push("## Clipping Warnings");
    lines.push("Some samples at or near full scale. Mild clipping can be musical; heavy clipping may distort.");
    lines.push("");
    for (const r of clippingResults) {
      lines.push(`- ${r.inputFile} / **${r.preset}** / chaos=${r.chaos} / ${r.lengthMode} → \`${r.outputFilename}\` (${r.clippingSampleCount} clips, peak=${r.peak.toFixed(3)})`);
    }
    lines.push("");
  }

  // ── Top duration / size ──
  const sortedByDuration = [...report.results].sort((a, b) => b.durationSeconds - a.durationSeconds);
  lines.push("## Longest Files (Top 10)");
  lines.push("");
  lines.push("| File | Duration | Preset | Chaos | Mode |");
  lines.push("|------|----------|--------|-------|------|");
  for (const r of sortedByDuration.slice(0, 10)) {
    lines.push(`| \`${r.outputFilename}\` | ${r.durationSeconds.toFixed(1)}s | ${r.preset} | ${r.chaos} | ${r.lengthMode} |`);
  }
  lines.push("");

  const sortedBySize = [...report.results].sort((a, b) => b.fileSizeBytes - a.fileSizeBytes);
  lines.push("## Largest Files (Top 10)");
  lines.push("");
  lines.push("| File | Size | Preset | Chaos | Mode |");
  lines.push("|------|------|--------|-------|------|");
  for (const r of sortedBySize.slice(0, 10)) {
    lines.push(`| \`${r.outputFilename}\` | ${(r.fileSizeBytes / 1024 / 1024).toFixed(1)} MB | ${r.preset} | ${r.chaos} | ${r.lengthMode} |`);
  }
  lines.push("");

  const shortThreshold = 0.5;
  const shortFiles = report.results.filter((r) => r.durationSeconds < shortThreshold && r.durationSeconds > 0.001 && !r.warnings.includes("render-error"));
  if (shortFiles.length > 0) {
    lines.push(`## Suspiciously Short Files (< ${shortThreshold}s)`);
    lines.push(""); // Using empty description as deliberate — the table is self-explanatory
    for (const r of shortFiles) {
      lines.push(`- ${r.inputFile} / **${r.preset}** / chaos=${r.chaos} / ${r.lengthMode} → \`${r.outputFilename}\` (${r.durationSeconds.toFixed(3)}s)`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

// ── Argument parsing ─────────────────────────────────────────────

const ALL_PRESETS_FLAT = ALL_PRESETS.join(", ");

function printHelp(): void {
  console.log(`
Resample-Lab Render-Audit Corpus Tool
======================================

Reads WAV files from an input directory, renders presets at multiple
chaos × length-mode combinations, and writes analysis reports.

Usage:
  npx tsx scripts/render-dsp-corpus.ts --input <dir>
  npx tsx scripts/render-dsp-corpus.ts --input <dir> --quick
  npx tsx scripts/render-dsp-corpus.ts --input <dir> --preset ambient_stretch --chaos 0.6
  npx tsx scripts/render-dsp-corpus.ts --help

Options:
  --input, -i   <dir>    Directory containing source WAV files (required)
  --output, -o  <dir>    Output directory (default: .render-audit)
  --chaos, -c   <vals>   Comma-separated chaos values (default: 0.2,0.6,1.0)
  --length, -l  <vals>   Comma-separated length modes (default: short,medium,long,absurd)
                         Valid values: short, medium, long, absurd
  --preset, -p  <ids>    Comma-separated preset IDs (default: all ${ALL_PRESETS.length})
                         Available: ${ALL_PRESETS_FLAT}
  --limit, -n   <N>      Only process the first N WAV files (default: all)
  --quick, -q            Quick mode: chaos 0.6, medium length, all presets
  --help, -h             Show this help message

Examples:
  # Full matrix (3 chaos × 4 lengths × 8 presets per input file)
  npx tsx scripts/render-dsp-corpus.ts --input ./samples

  # Quick spot-check
  npx tsx scripts/render-dsp-corpus.ts --input ./samples --quick

  # Targeted test
  npx tsx scripts/render-dsp-corpus.ts --input ./samples --preset ambient_stretch --chaos 0.0,1.0

  # First 2 files only
  npx tsx scripts/render-dsp-corpus.ts --input ./samples --limit 2
`);
}

interface CliArgs {
  help: boolean;
  inputDir: string;
  outputDir: string;
  chaosValues: number[];
  lengthModes: string[];
  presets: string[];
  limit: number;
  quick: boolean;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    printHelp();
    process.exit(args.length === 0 ? 1 : 0);
  }

  let inputDir = "";
  let outputDir = ".render-audit";
  let chaosValues: number[] = [];
  let lengthModes: string[] = [];
  let presets: string[] = [];
  let limit = Infinity;
  let quick = false;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--input": case "-i": inputDir = args[++i] || ""; break;
      case "--output": case "-o": outputDir = args[++i] || ".render-audit"; break;
      case "--chaos": case "-c":
        chaosValues = (args[++i] || "").split(",").map(Number).filter((n) => !isNaN(n));
        break;
      case "--length": case "-l":
        lengthModes = (args[++i] || "").split(",").map((s) => s.trim().toLowerCase());
        break;
      case "--preset": case "-p":
        presets = (args[++i] || "").split(",").map((s) => s.trim().toLowerCase());
        break;
      case "--limit": case "-n":
        limit = parseInt(args[++i] || "0", 10) || Infinity;
        break;
      case "--quick": case "-q": quick = true; break;
      default:
        if (args[i].startsWith("-")) {
          console.error(`Unknown option: ${args[i]}`);
          console.error("Run with --help to see available options.");
          process.exit(1);
        }
    }
  }

  if (!inputDir) {
    console.error("Error: --input <dir> is required");
    console.error("Run with --help to see usage.");
    process.exit(1);
  }

  // Apply defaults after potential --quick override
  if (quick) {
    if (chaosValues.length === 0) chaosValues = [0.6];
    if (lengthModes.length === 0) lengthModes = ["medium"];
    if (presets.length === 0) presets = [...ALL_PRESETS];
  } else {
    if (chaosValues.length === 0) chaosValues = [0.2, 0.6, 1.0];
    if (lengthModes.length === 0) lengthModes = [...ALL_LENGTH_MODES];
    if (presets.length === 0) presets = [...ALL_PRESETS];
  }

  // Validate length modes
  const validLengths = new Set(ALL_LENGTH_MODES);
  for (const lm of lengthModes) {
    if (!validLengths.has(lm)) {
      console.error(`Error: invalid length mode "${lm}". Valid: ${ALL_LENGTH_MODES.join(", ")}`);
      process.exit(1);
    }
  }

  // Validate presets
  const validPresets = new Set(ALL_PRESETS);
  for (const p of presets) {
    if (!validPresets.has(p)) {
      console.error(`Error: unknown preset "${p}". Available: ${ALL_PRESETS_FLAT}`);
      process.exit(1);
    }
  }

  return { help: false, inputDir, outputDir, chaosValues, lengthModes, presets, limit, quick };
}

// ── Main ─────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs();

  const inputDir = path.resolve(args.inputDir);
  const outputDir = path.resolve(args.outputDir);

  if (!fs.existsSync(inputDir)) {
    console.error(`Error: input directory not found: ${inputDir}`);
    process.exit(1);
  }

  const allFiles = fs.readdirSync(inputDir).filter((f) => f.toLowerCase().endsWith(".wav"));
  const wavFiles = args.limit < Infinity ? allFiles.slice(0, args.limit) : allFiles;

  if (wavFiles.length === 0) {
    console.error(`Error: no WAV files found in ${inputDir}`);
    process.exit(1);
  }

  const totalCombos = wavFiles.length * args.presets.length * args.chaosValues.length * args.lengthModes.length;
  console.log(`\nRender-Audit: ${wavFiles.length} files × ${args.presets.length} presets × ${args.chaosValues.length} chaos × ${args.lengthModes.length} lengths = ${totalCombos} preset jobs`);
  if (args.quick) console.log("  Quick mode: single chaos/length per preset for fast spot-checking");
  console.log(`  Presets: ${args.presets.join(", ")}`);
  console.log(`  Chaos:   ${args.chaosValues.join(", ")}`);
  console.log(`  Lengths: ${args.lengthModes.join(", ")}`);
  console.log(`  Note: each preset job may produce multiple WAV outputs (4–10 per job).`);

  const results: RenderResult[] = [];
  fs.mkdirSync(outputDir, { recursive: true });

  let rendersDone = 0;

  for (const wavFile of wavFiles) {
    const inputPath = path.join(inputDir, wavFile);
    let audioData: AudioBufferData;
    try {
      audioData = readWavFile(inputPath);
    } catch (err) {
      console.error(`\n  ✗ ${wavFile}: error reading WAV (${err})`);
      continue;
    }

    const dur = (audioData.channels[0].length / audioData.sampleRate).toFixed(1);
    console.log(`\n── ${wavFile} (${audioData.channels.length}ch, ${audioData.sampleRate}Hz, ${dur}s) ──`);
    const inputStem = wavFile.replace(/\.[^.]+$/, "");

    for (const presetId of args.presets) {
      for (const chaos of args.chaosValues) {
        for (const lengthMode of args.lengthModes) {
          const capturedSkips: { filename: string; reason: string }[] = [];
          const origWarn = console.warn;
          console.warn = (...warnArgs: unknown[]) => {
            const msg = warnArgs.join(" ");
            if (msg.startsWith("[presets] Skipping")) {
              const rest = msg.replace(/^\[presets\] Skipping /, "");
              const colonIdx = rest.indexOf(": ");
              capturedSkips.push({
                filename: colonIdx >= 0 ? rest.slice(0, colonIdx) : rest,
                reason: colonIdx >= 0 ? rest.slice(colonIdx + 2) : "unknown",
              });
            }
            origWarn.apply(console, warnArgs);
          };

          try {
            const { samples } = generatePack([audioData], presetId, chaos, () => {}, lengthMode);
            const outDir = path.join(outputDir, inputStem, presetId, `chaos-${chaos.toFixed(1)}`, `length-${lengthMode}`);

            for (const sample of samples) {
              const analysis = analyzeChannels(sample.channels, sample.sampleRate);
              const outputPath = path.join(outDir, sample.filename);
              writeWav(outputPath, sample.channels, sample.sampleRate);
              const fileSize = fs.statSync(outputPath).size;
              const warnings = warningFlags(analysis);

              results.push({
                inputFile: wavFile,
                preset: presetId,
                outputFilename: sample.filename,
                chaos,
                lengthMode,
                durationSeconds: analysis.durationSeconds,
                sampleRate: analysis.sampleRate,
                channelCount: analysis.channelCount,
                peak: analysis.peak,
                rms: analysis.rms,
                hasNaN: analysis.hasNaN,
                hasInfinity: analysis.hasInfinity,
                isSilent: analysis.isSilent,
                isClipping: analysis.isClipping,
                clippingSampleCount: analysis.clippingSampleCount,
                fileSizeBytes: fileSize,
                warnings,
              });
            }

            // Record skipped outputs captured from console.warn during generatePack
            for (const skip of capturedSkips) {
              results.push({
                inputFile: wavFile,
                preset: presetId,
                outputFilename: skip.filename,
                chaos,
                lengthMode,
                durationSeconds: 0,
                sampleRate: 0,
                channelCount: 0,
                peak: 0,
                rms: 0,
                hasNaN: false,
                hasInfinity: false,
                isSilent: true,
                isClipping: false,
                clippingSampleCount: 0,
                fileSizeBytes: 0,
                warnings: [],
                isSkipped: true,
                skipReason: skip.reason,
              });
            }
          } catch (err) {
            console.error(`  ✗ ${presetId} chaos=${chaos} ${lengthMode}: ${err}`);
            results.push({
              inputFile: wavFile,
              preset: presetId,
              outputFilename: "ERROR",
              chaos,
              lengthMode,
              durationSeconds: 0, sampleRate: 0, channelCount: 0,
              peak: 0, rms: 0,
              hasNaN: false, hasInfinity: false,
              isSilent: true, isClipping: false, clippingSampleCount: 0,
              fileSizeBytes: 0,
              warnings: ["render-error"],
            });
          }

          console.warn = origWarn;

          rendersDone++;
          if (rendersDone % 10 === 0 || rendersDone === totalCombos) {
            const pct = Math.round((rendersDone / totalCombos) * 100);
            process.stdout.write(`\r  Progress: ${rendersDone}/${totalCombos} (${pct}%)`);
          }
        }
      }
    }
    process.stdout.write(`\n  ✓ ${wavFile} done\n`);
  }

  process.stdout.write("\n");

  // ── Build report ──
  const wavFilesWritten = results.filter((r) => !r.isSkipped && !r.warnings.includes("render-error")).length;
  const skippedOutputs = results.filter((r) => r.isSkipped).length;
  const failedRenders = results.filter((r) => r.warnings.includes("render-error")).length;
  const silentFiles = results.filter((r) => r.isSilent && !r.isSkipped && !r.warnings.includes("render-error")).length;
  const clippingWarnings = results.filter((r) => r.isClipping).length;
  const nanInfinityCount = results.filter((r) => r.hasNaN || r.hasInfinity).length;

  const report: ReportData = {
    generatedAt: new Date().toISOString(),
    inputFiles: wavFiles,
    presets: args.presets,
    chaosValues: args.chaosValues,
    lengthModes: args.lengthModes,
    totalPresetJobs: totalCombos,
    totalRenders: results.length,
    results,
    summary: { wavFilesWritten, skippedOutputs, failedRenders, silentFiles, clippingWarnings, nanInfinityCount },
  };

  const reportJsonPath = path.join(outputDir, "report.json");
  fs.writeFileSync(reportJsonPath, JSON.stringify(report, null, 2));
  console.log(`Report JSON → ${reportJsonPath}`);

  const reportMd = generateMarkdownReport(report, outputDir);
  const reportMdPath = path.join(outputDir, "report.md");
  fs.writeFileSync(reportMdPath, reportMd);
  console.log(`Report MD  → ${reportMdPath}`);

  console.log(`\n${"=".repeat(50)}`);
  console.log(`Preset jobs:   ${totalCombos}`);
  console.log(`WAV outputs:   ${wavFilesWritten}`);
  console.log(`Skipped:       ${skippedOutputs}`);
  console.log(`Failed:        ${failedRenders}`);
  console.log(`Silent:        ${silentFiles}`);
  console.log(`Clipping:      ${clippingWarnings}`);
  console.log(`NaN/Infinity:  ${nanInfinityCount}`);
  console.log(`${"=".repeat(50)}`);
  console.log("Done. Browse the output directory and listen to the WAV files.");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
