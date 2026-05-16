'use client'

import { Preset } from '@/lib/types'
import { getPresetIcon } from '@/lib/presets'

interface PresetCardProps {
  preset: Preset
  isSelected: boolean
  onSelect: (id: string) => void
}

export default function PresetCard({ preset, isSelected, onSelect }: PresetCardProps) {
  return (
    <button
      onClick={() => onSelect(preset.id)}
      className={`text-left p-4 rounded-lg border transition-all ${
        isSelected
          ? 'border-accent bg-accent-dim/10 shadow-lg shadow-accent-dim/10'
          : 'border-zinc-800 bg-zinc-900/40 hover:border-zinc-600 hover:bg-zinc-800/40'
      }`}
    >
      <div className="flex items-center gap-3 mb-2">
        <span className="text-xl">{getPresetIcon(preset.id)}</span>
        <span className="font-medium text-sm">{preset.name}</span>
      </div>
      <p className="text-xs text-zinc-500 leading-relaxed">{preset.description}</p>
      <div className="flex items-center gap-2 mt-3">
        <span className="text-xs text-zinc-600">{preset.output_count} outputs</span>
        <span className="text-zinc-700">·</span>
        <div className="flex gap-1 flex-wrap">
          {[...new Set(preset.categories)].map((cat) => (
            <span
              key={cat}
              className="text-xs px-1.5 py-0.5 rounded-full bg-zinc-800 text-zinc-400 capitalize"
            >
              {cat.replace('_', ' ')}
            </span>
          ))}
        </div>
      </div>
    </button>
  )
}
