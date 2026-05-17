"use client";

export type LengthMode = "short" | "medium" | "long" | "absurd";

export const LENGTH_MODES: { value: LengthMode; label: string; description: string }[] = [
  {
    value: "short",
    label: "Short",
    description: "Quick samples (~15s max)",
  },
  {
    value: "medium",
    label: "Medium",
    description: "Moderate length (~45s max)",
  },
  {
    value: "long",
    label: "Long",
    description: "Extended tails (~90s max)",
  },
  {
    value: "absurd",
    label: "Absurd",
    description: "Maximum duration (~120s, large files)",
  },
];

interface LengthModeSelectorProps {
  value: LengthMode;
  onChange: (value: LengthMode) => void;
}

export default function LengthModeSelector({
  value,
  onChange,
}: LengthModeSelectorProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-xs font-medium text-accent uppercase tracking-wider">
          Length
        </label>
        <span className="text-xs text-zinc-500 italic">
          {LENGTH_MODES.find((m) => m.value === value)?.description ?? ""}
        </span>
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {LENGTH_MODES.map((mode) => (
          <button
            key={mode.value}
            type="button"
            onClick={() => onChange(mode.value)}
            className={`px-2 py-1.5 rounded text-xs font-medium transition-all ${
              value === mode.value
                ? "bg-accent/20 text-accent border border-accent/40"
                : "bg-zinc-800/40 text-zinc-500 border border-zinc-800 hover:border-zinc-600 hover:text-zinc-300"
            }`}
          >
            {mode.label}
          </button>
        ))}
      </div>
    </div>
  );
}
