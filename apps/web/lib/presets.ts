import { Preset } from "@/lib/types";

export const PRESETS: Preset[] = [
  {
    id: "ambient_stretch",
    name: "Ambient Stretch Lab",
    description:
      "Cinematic stretched textures: cathedral beds, toxic air, doom choir drift, submerged pads, reverse bloom — all with tape warmth and hall reverb",
    tools: ["ffmpeg", "numpy", "scipy"],
    output_count: 5,
    categories: ["ambience", "ambience", "ambience", "ambience", "ambience"],
  },
  {
    id: "ghost_reverse",
    name: "Ghost Reverse Lab",
    description:
      "Reverse tails, pre-impact sucks, ghost swells, diffusion delay clouds, haunted metallic room tails with bloom reverbs",
    tools: ["ffmpeg", "numpy", "scipy"],
    output_count: 4,
    categories: ["ambience", "ambience", "oddity", "ambience"],
  },
  {
    id: "granular_shards",
    name: "Granular Shards",
    description:
      "Stereo shrapnel loops, bitcrushed shards, particle clouds, frozen textures, delay swarms, reverb blooms, pitch clouds, glitch bits — cloud + shard modes",
    tools: ["numpy", "scipy"],
    output_count: 10,
    categories: [
      "granular",
      "granular",
      "granular",
      "granular",
      "granular",
      "granular",
      "granular",
      "granular",
      "granular",
      "granular",
    ],
  },
  {
    id: "bitrot_dirt",
    name: "Bitrot Dirt",
    description:
      "Rotted room loops, cassette collapse, speaker cone tear, bitcrushed tails — musical degradation with tape loss and metallic reverb",
    tools: ["numpy", "scipy"],
    output_count: 4,
    categories: ["oddity", "oddity", "oddity", "oddity"],
  },
  {
    id: "pitch_wreckage",
    name: "Pitch Wreckage",
    description:
      "Sub beast layers, glass octave tails, detuned metal pairs, falling pitch smears — pitch mutation with convolution wash and tape processing",
    tools: ["ffmpeg", "numpy"],
    output_count: 4,
    categories: ["oddity", "oddity", "oddity", "oddity"],
  },
  {
    id: "loop_extractor",
    name: "Loop Extractor",
    description:
      "Clean loops, dirty room loops, delayed loops, ambient loops, one-shot tail extraction — heuristic loop finding with finishing polish",
    tools: ["ffmpeg", "numpy", "scipy"],
    output_count: 5,
    categories: ["loop", "loop", "loop", "loop", "one-shot"],
  },
  {
    id: "impact_riser",
    name: "Impact / Riser Mutator",
    description:
      "Doom risers, pressure drops, metal impacts, reverse slams, sub collapses — cinematic impact design with filter sweeps, convolution, and limiting",
    tools: ["ffmpeg", "numpy", "scipy"],
    output_count: 5,
    categories: ["ambience", "one-shot", "one-shot", "one-shot", "one-shot"],
  },
  {
    id: "chaos_pack",
    name: "Chaos Pack",
    description:
      "Curated multi-recipe: cathedral bed, haunted ghost, particle cloud, delay swarm, dirty loop, doom riser, sub beast — seven flavors of controlled entropy",
    tools: ["ffmpeg", "numpy", "scipy"],
    output_count: 7,
    categories: [
      "ambience",
      "oddity",
      "granular",
      "granular",
      "loop",
      "ambience",
      "oddity",
    ],
  },
];

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
  };
  return icons[id] || "♪";
}
