"use client";

import { useState } from "react";

interface ManifestPreviewProps {
  manifest: Record<string, unknown> | null;
}

export default function ManifestPreview({ manifest }: ManifestPreviewProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (!manifest) return null;

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 flex items-center justify-between text-xs font-medium text-zinc-400 hover:text-zinc-300 transition-colors"
      >
        <span>Manifest</span>
        <span
          className="transition-transform duration-200 inline-block"
          style={{ transform: isOpen ? "rotate(90deg)" : "rotate(0deg)" }}
        >
          ›
        </span>
      </button>
      {isOpen && (
        <pre className="px-4 pb-4 text-xs text-zinc-500 overflow-x-auto max-h-64 overflow-y-auto">
          {JSON.stringify(manifest, null, 2)}
        </pre>
      )}
    </div>
  );
}
