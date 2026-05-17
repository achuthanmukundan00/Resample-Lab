"use client";

import { useEffect, useState } from "react";
import { PackManifest } from "@/lib/dsp/types";
import { MICRO_MESSAGES } from "@/lib/microcopy";

interface PackStatusCardProps {
  localStatus?: "idle" | "processing" | "complete" | "error";
  localProgress?: number;
  localMessage?: string;
  manifest?: PackManifest | null;
  onLocalDownload?: () => void;
  onReset?: () => void;
}

export default function PackStatusCard({
  localStatus,
  localProgress = 0,
  localMessage,
  manifest,
  onLocalDownload,
  onReset,
}: PackStatusCardProps) {
  const [microIndex, setMicroIndex] = useState(0);

  // Micro-message rotation
  const isActive = localStatus === "processing";

  useEffect(() => {
    if (!isActive) return;
    const t = setInterval(() => {
      setMicroIndex((i) => (i + 1) % MICRO_MESSAGES.length);
    }, 3000);
    return () => clearInterval(t);
  }, [isActive]);

  // ---- Error display ----
  if (localStatus === "error") {
    return (
      <div className="rounded-lg border border-red-900/50 bg-red-950/20 p-4">
        <p className="text-sm text-red-400">{localMessage || "An error occurred"}</p>
        {onReset && (
          <button
            onClick={onReset}
            className="mt-3 text-xs text-zinc-500 hover:text-zinc-400 underline"
          >
            Dismiss
          </button>
        )}
      </div>
    );
  }

  if (!localStatus || localStatus === "idle") return null;

  const progress = Math.min(1, Math.max(0, localProgress));

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">
          {localStatus === "complete" ? "completed" : "processing"}
        </span>
        <span className="text-xs font-mono text-accent">
          {Math.round(progress * 100)}%
        </span>
      </div>

      <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-accent rounded-full transition-all duration-500 shadow-sm shadow-accent-dim/30"
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      {localStatus === "processing" && (
        <p className="text-xs text-zinc-500 italic">
          {localMessage || MICRO_MESSAGES[microIndex]}
        </p>
      )}

      {localStatus === "complete" && (
        <div className="space-y-2">
          <button
            onClick={onLocalDownload}
            className="w-full py-2 px-4 rounded-lg bg-accent text-black hover:bg-accent-glow text-sm font-medium transition-colors shadow-lg shadow-accent-dim/20"
          >
            Download Pack
          </button>
          {manifest && (
            <details className="text-xs">
              <summary className="text-zinc-500 cursor-pointer hover:text-zinc-400">
                View manifest
              </summary>
              <pre className="mt-2 p-2 rounded bg-zinc-950 text-zinc-500 overflow-x-auto max-h-48 overflow-y-auto">
                {JSON.stringify(manifest, null, 2)}
              </pre>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
