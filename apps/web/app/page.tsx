"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import UploadDropzone from "@/components/UploadDropzone";
import PresetCard from "@/components/PresetCard";
import ChaosSlider from "@/components/ChaosSlider";
import LengthModeSelector from "@/components/LengthModeSelector";
import type { LengthMode } from "@/components/LengthModeSelector";
import LocalFirstBadge from "@/components/LocalFirstBadge";
import GenerateButton from "@/components/GenerateButton";
import PackStatusCard from "@/components/PackStatusCard";
import ManifestPreview from "@/components/ManifestPreview";
import Footer from "@/components/Footer";
import { PRESETS } from "@/lib/presets";
import { assetPath } from "@/lib/paths";
import { AudioBufferData, PackManifest } from "@/lib/dsp/types";
import { Capabilities } from "@/lib/types";

export default function Home() {
  const [files, setFiles] = useState<File[]>([]);
  const [selectedPreset, setSelectedPreset] = useState<string>(PRESETS[0].id);
  const [chaos, setChaos] = useState(0.33);
  const [lengthMode, setLengthMode] = useState<LengthMode>("medium");
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [capabilities, setCapabilities] = useState<Capabilities | null>(null);

  // Local processing state
  const [localProgress, setLocalProgress] = useState(0);
  const [localMessage, setLocalMessage] = useState("");
  const [localStatus, setLocalStatus] = useState<
    "idle" | "processing" | "complete" | "error"
  >("idle");
  const [zipBlob, setZipBlob] = useState<Blob | null>(null);
  const [manifest, setManifest] = useState<PackManifest | null>(null);

  const workerRef = useRef<Worker | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    setCapabilities({
      presets: PRESETS,
      chaos_levels: { min: 0, max: 1, step: 0.01 },
      output_formats: ["wav"],
      accepted_extensions: ["wav", "aiff", "flac", "mp3", "m4a", "ogg"],
      max_upload_mb: 50,
      max_duration_seconds: 600,
      tools: {},
    });
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
      audioCtxRef.current?.close();
    };
  }, []);

  const handleDownload = useCallback(() => {
    if (!zipBlob) return;
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement("a");
    a.href = url;
    const base =
      files.length === 1
        ? files[0].name.replace(/\.[^.]+$/, "")
        : `resample-pack-${Date.now()}`;
    const chaosInt = Math.round(chaos * 100);
    a.download = `${base}__${selectedPreset}__chaos${chaosInt}__${lengthMode}.zip`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, [zipBlob, files, selectedPreset, chaos, lengthMode]);

  const handleSubmit = useCallback(async () => {
    if (files.length === 0 || !selectedPreset || isProcessing) return;

    setIsProcessing(true);
    setError(null);
    setLocalStatus("processing");
    setLocalProgress(0);
    setLocalMessage("Decoding audio…");
    setZipBlob(null);
    setManifest(null);

    try {
      // 1. Decode audio files in the browser
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioContext();
      }
      const ctx = audioCtxRef.current;

      const decodedFiles: AudioBufferData[] = [];
      for (const file of files) {
        const buf = await file.arrayBuffer();
        const audioBuf = await ctx.decodeAudioData(buf);
        const channels: Float32Array[] = [];
        for (let i = 0; i < audioBuf.numberOfChannels; i++) {
          channels.push(audioBuf.getChannelData(i));
        }
        decodedFiles.push({
          name: file.name,
          sampleRate: audioBuf.sampleRate,
          channels,
        });
      }

      // 2. Terminate previous worker
      workerRef.current?.terminate();

      // 3. Create processing worker
      const worker = new Worker(
        new URL("../lib/dsp/packWorker.ts", import.meta.url),
      );
      workerRef.current = worker;

      worker.onmessage = (e) => {
        const msg = e.data;
        if (msg.type === "progress") {
          setLocalProgress(msg.value);
          setLocalMessage(msg.message);
        } else if (msg.type === "complete") {
          setZipBlob(msg.zipBlob);
          setManifest(msg.manifest);
          setLocalStatus("complete");
          setIsProcessing(false);
        } else if (msg.type === "error") {
          setError(msg.error);
          setLocalStatus("error");
          setIsProcessing(false);
        }
      };

      // 4. Start processing
      setLocalMessage("Generating samples…");
      worker.postMessage({
        type: "generate",
        files: decodedFiles,
        preset: selectedPreset,
        chaos,
        lengthMode,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Processing failed");
      setLocalStatus("error");
      setIsProcessing(false);
    }
  }, [files, selectedPreset, chaos, lengthMode, isProcessing]);

  const handleReset = useCallback(() => {
    setLocalStatus("idle");
    setLocalProgress(0);
    setZipBlob(null);
    setManifest(null);
    setError(null);
  }, []);

  return (
    <div className="flex flex-col min-h-screen">
      <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <div className="flex items-start sm:items-center gap-4 flex-wrap">
            <a
              href="https://watchyourtemper.com"
              target="_blank"
              rel="noopener noreferrer"
            >
              <img
                src={assetPath("/wyt-logo.png")}
                alt="watchyourtemper"
                className="h-20 w-20 sm:h-40 sm:w-40 object-contain opacity-85 shrink-0 hover:opacity-100 transition-opacity"
              />
            </a>
            <h1 className="text-lg sm:text-xl font-semibold tracking-tight mt-2 sm:mt-0">
              <span className="text-foreground">Resample</span>
              <span className="text-accent">-Lab</span>
            </h1>
            <LocalFirstBadge />
          </div>
          <p className="text-sm text-zinc-500">
            Turn any sound into a sample pack. Non-AI DSP, fully local — your
            files never leave this browser.
          </p>
        </div>

        {/* Upload */}
        <section className="space-y-3">
          <h2 className="text-xs font-medium uppercase tracking-wider text-zinc-500">
            Source Audio
          </h2>
          <UploadDropzone
            onFilesSelected={setFiles}
            acceptedExtensions={
              capabilities?.accepted_extensions || [
                "wav",
                "aiff",
                "flac",
                "mp3",
                "m4a",
                "ogg",
              ]
            }
            maxUploadMb={capabilities?.max_upload_mb || 50}
          />
        </section>

        {/* Preset Selection */}
        <section className="space-y-3">
          <h2 className="text-xs font-medium uppercase tracking-wider text-accent">
            Preset
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(capabilities?.presets || PRESETS).map((preset) => (
              <PresetCard
                key={preset.id}
                preset={preset}
                isSelected={selectedPreset === preset.id}
                onSelect={setSelectedPreset}
              />
            ))}
          </div>
        </section>

        {/* Chaos + Length + Privacy Note */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
          <div>
            <ChaosSlider value={chaos} onChange={setChaos} />
          </div>
          <div>
            <LengthModeSelector value={lengthMode} onChange={setLengthMode} />
          </div>
        </div>
        <p className="text-xs text-zinc-600 italic -mt-3">
          All processing runs in your browser. Your audio is never uploaded
          to any server.
        </p>

        {/* Error */}
        {error && (
          <div className="rounded-lg border border-accent-dim/50 bg-accent-dim/10 p-3">
            <p className="text-sm text-accent">{error}</p>
          </div>
        )}

        {/* Generate */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit();
          }}
        >
          <GenerateButton
            disabled={files.length === 0 || isProcessing}
            isProcessing={isProcessing}
          />
        </form>

        {/* Processing Status */}
        {(localStatus === "processing" || localStatus === "complete") && (
          <PackStatusCard
            localStatus={localStatus}
            localProgress={localProgress}
            localMessage={localMessage}
            manifest={manifest}
            onLocalDownload={handleDownload}
            onReset={handleReset}
          />
        )}

        {/* Manifest preview after completion */}
        {localStatus === "complete" && manifest && (
          <ManifestPreview
            manifest={manifest as unknown as Record<string, unknown>}
          />
        )}
      </main>

      <Footer />
    </div>
  );
}
