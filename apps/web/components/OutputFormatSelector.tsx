"use client";

interface OutputFormatSelectorProps {
  value: string;
  onChange: (value: string) => void;
  formats: string[];
}

export default function OutputFormatSelector({
  value,
  onChange,
  formats,
}: OutputFormatSelectorProps) {
  return (
    <div>
      <label className="block text-xs font-medium text-accent uppercase tracking-wider mb-2">
        Output Format
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-accent-dim"
      >
        {formats.map((fmt) => (
          <option key={fmt} value={fmt}>
            {fmt.toUpperCase()}
          </option>
        ))}
      </select>
    </div>
  );
}
