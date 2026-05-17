"use client";

import { CHAOS_LABELS } from "@/lib/microcopy";

interface ChaosSliderProps {
  value: number;
  onChange: (value: number) => void;
}

export default function ChaosSlider({ value, onChange }: ChaosSliderProps) {
  const currentLabel = CHAOS_LABELS.reduce((prev, curr) =>
    Math.abs(curr.value - value) < Math.abs(prev.value - value) ? curr : prev,
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-xs font-medium text-accent uppercase tracking-wider">
          Chaos
        </label>
        <span className="text-sm font-mono text-accent-glow">
          {currentLabel.label}
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
    </div>
  );
}
