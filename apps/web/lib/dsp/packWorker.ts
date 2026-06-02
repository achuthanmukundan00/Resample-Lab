/**
 * Web Worker: receives decoded audio, runs a preset, builds a ZIP with
 * WAV files + manifest.json, posts the Blob back to the main thread.
 */

import type { AudioBufferData, PackManifest, WorkerRequest } from "./types";
import {
  generatePack,
  PRESET_OUTPUT_COUNTS,
  PRESET_CATEGORIES,
} from "./presets";
import { encodeWav } from "./wav";
import { interleave } from "./transforms";
import { buildZip } from "./zip";

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  if (e.data.type !== "generate") return;

  const { files, preset, chaos } = e.data;

  (async () => {
    try {
      const TIMEOUT_MS = 120_000;
      const deadline = Date.now() + TIMEOUT_MS;
      const packId = `pack_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      /** Check deadline and throw if exceeded. Called between heavy ops. */
      const checkDeadline = () => {
        if (Date.now() > deadline) {
          throw new Error("Processing timed out");
        }
      };

      // Generate samples
      const reportProgress = (value: number, message: string) => {
        checkDeadline();
        self.postMessage({ type: "progress", value, message });
      };

      const { samples, manifestSamples } = generatePack(
        files,
        preset,
        chaos,
        reportProgress,
        e.data.lengthMode,
      );

      checkDeadline();
      reportProgress(0.65, "Building ZIP…");

      // Encode each sample as a WAV file
      const zipEntries: { name: string; data: Uint8Array }[] = [];

      for (let i = 0; i < samples.length; i++) {
        checkDeadline();
        const s = samples[i];
        const interleaved = interleave(s.channels);
        const wavBuf = encodeWav(interleaved, s.sampleRate, s.channels.length);
        const cat = s.category;
        zipEntries.push({
          name: `samples/${cat}/${s.filename}`,
          data: new Uint8Array(wavBuf),
        });
      }

      checkDeadline();
      reportProgress(0.85, "Writing manifest…");

      // Build manifest
      const manifest: PackManifest = {
        pack_id: packId,
        preset,
        chaos,
        source_files: files.map((f: AudioBufferData) => f.name),
        generated_at: new Date().toISOString(),
        local_processing: true,
        samples: manifestSamples,
      };

      reportProgress(0.95, "Compressing…");

      // Build ZIP
      checkDeadline();
      const zipBlob = buildZip(zipEntries);

      reportProgress(1.0, "Complete!");

      self.postMessage({
        type: "complete",
        zipBlob,
        manifest,
      });
    } catch (err) {
      self.postMessage({
        type: "error",
        error: err instanceof Error ? err.message : "Unknown error in worker",
      });
    }
  })();
};
