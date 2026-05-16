import { Preset } from "@/lib/types"

export const PRESETS: Preset[] = [
  {
    id: "ambient_stretch",
    name: "Ambient Stretch Lab",
    description: "Long stretched pads, reverse smear, ghost textures, driven textures, reverse reverb wash",
    tools: ["ffmpeg", "numpy", "scipy"],
    output_count: 5,
    categories: ["ambience", "ambience", "ambience", "ambience", "ambience"],
  },
  {
    id: "ghost_reverse",
    name: "Ghost Reverse Lab",
    description: "Reverse tails with echo, bandpassed ghost hits, filtered pre-echoes, distorted pre-impacts",
    tools: ["ffmpeg", "numpy", "scipy"],
    output_count: 4,
    categories: ["ambience", "oddity", "oddity", "one-shot"],
  },
  {
    id: "granular_shards",
    name: "Granular Shards",
    description: "Micro-chopped sequences, bitcrushed shards, pitch-shifted clouds, reverb throws, glitch bits, stutter repeats, noise shards, speed variants",
    tools: ["numpy", "scipy"],
    output_count: 10,
    categories: [
      "granular", "granular", "granular", "granular", "granular",
      "granular", "granular", "granular", "granular", "granular",
    ],
  },
  {
    id: "bitrot_dirt",
    name: "Bitrot Dirt",
    description: "Heavily crushed textures, degraded wow/flutter, broken degraded loops, saturated noise artifacts",
    tools: ["numpy", "scipy"],
    output_count: 4,
    categories: ["oddity", "oddity", "loop", "oddity"],
  },
  {
    id: "pitch_wreckage",
    name: "Pitch Wreckage",
    description: "Saturated octave-down monsters, bandpassed octave-up insects, unstable pitch drift, dual-layer pitch distortion",
    tools: ["ffmpeg", "numpy"],
    output_count: 4,
    categories: ["oddity", "oddity", "oddity", "oddity"],
  },
  {
    id: "loop_extractor",
    name: "Loop Extractor",
    description: "Clean crossfaded loops, degraded loops with bitcrush, ghost loops with reverb, driven loops with saturation",
    tools: ["ffmpeg", "numpy", "scipy"],
    output_count: 4,
    categories: ["loop", "loop", "loop", "loop"],
  },
  {
    id: "impact_riser",
    name: "Impact / Riser Mutator",
    description: "Reversed risers with filter sweeps, pitched impacts with tails, transient smear reverbs, long filter sweep risers",
    tools: ["ffmpeg", "numpy", "scipy"],
    output_count: 4,
    categories: ["ambience", "one-shot", "one-shot", "ambience"],
  },
  {
    id: "chaos_pack",
    name: "Chaos Pack",
    description: "Curated mix: ambience, ghost hit, granular shards, degraded loop, riser, pitch oddity — maximum entropy",
    tools: ["ffmpeg", "numpy", "scipy"],
    output_count: 7,
    categories: ["ambience", "oddity", "granular", "granular", "loop", "ambience", "oddity"],
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
