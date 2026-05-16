import { Preset } from "@/lib/types"

export const PRESETS: Preset[] = [
  {
    id: "ambient_stretch",
    name: "Ambient Stretch Lab",
    description: "Long stretched pads, reverse smear, low-pass ghost textures",
    tools: ["ffmpeg", "numpy", "scipy"],
    output_count: 3,
    categories: ["ambience", "ambience", "ambience"],
  },
  {
    id: "ghost_reverse",
    name: "Ghost Reverse Lab",
    description: "Reverse tails, echo-forward textures, filtered ghost hits",
    tools: ["ffmpeg", "numpy", "scipy"],
    output_count: 3,
    categories: ["ambience", "oddity", "oddity"],
  },
  {
    id: "granular_shards",
    name: "Granular Shards",
    description: "Micro-chopped sequences, pitch-shifted grain clouds, stutter bits",
    tools: ["numpy", "scipy"],
    output_count: 3,
    categories: ["granular", "granular", "granular"],
  },
  {
    id: "bitrot_dirt",
    name: "Bitrot Dirt",
    description: "Crushed textures, downsampled artifacts, filtered noisy loops",
    tools: ["numpy", "scipy"],
    output_count: 3,
    categories: ["oddity", "oddity", "loop"],
  },
  {
    id: "pitch_wreckage",
    name: "Pitch Wreckage",
    description: "Octave-down monsters, octave-up insects, unstable pitch drift",
    tools: ["ffmpeg", "numpy"],
    output_count: 3,
    categories: ["oddity", "oddity", "oddity"],
  },
  {
    id: "loop_extractor",
    name: "Loop Extractor",
    description: "Loop cuts and filtered texture loops",
    tools: ["ffmpeg", "numpy", "scipy"],
    output_count: 2,
    categories: ["loop", "loop"],
  },
  {
    id: "impact_riser",
    name: "Impact / Riser Mutator",
    description: "Reversed risers, pitched impacts, transient smears",
    tools: ["ffmpeg", "numpy", "scipy"],
    output_count: 3,
    categories: ["ambience", "one_shot", "one_shot"],
  },
  {
    id: "chaos_pack",
    name: "Chaos Pack",
    description: "Maximum entropy — mixture of all categories with extreme randomization",
    tools: ["ffmpeg", "numpy", "scipy"],
    output_count: 5,
    categories: ["ambience", "granular", "granular", "oddity", "loop"],
  },
]

export function getPresetIcon(id: string): string {
  const icons: Record<string, string> = {
    ambient_stretch: "◌",
    ghost_reverse: "↻",
    granular_shards: "✦",
    bitrot_dirt: "■",
    pitch_wreckage: "↕",
    loop_extractor: "○",
    impact_riser: "▲",
    chaos_pack: "◆",
  }
  return icons[id] || "♪"
}
