import Link from "next/link";

export const metadata = {
  title: "Resample-Lab — Documentation",
  description:
    "Full DSP documentation, preset reference, chaos guide, and developer docs for Resample-Lab.",
};

const sections = [
  { id: "overview", label: "Overview" },
  { id: "presets", label: "Preset Reference" },
  { id: "chaos", label: "Chaos Parameter" },
  { id: "length", label: "Length Modes" },
  { id: "dsp", label: "DSP Techniques" },
  { id: "specs", label: "Technical Specs" },
  { id: "faq", label: "FAQ" },
  { id: "dev", label: "Developer Guide" },
];

export default function DocsPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-300">
      <div className="max-w-4xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="mb-12">
          <Link
            href="/"
            className="text-accent hover:text-accent-glow text-sm transition-colors"
          >
            ← Back to app
          </Link>
          <h1 className="text-3xl font-bold tracking-tight text-foreground mt-4 mb-2">
            Documentation
          </h1>
          <p className="text-zinc-500">
            Everything you need to know about using, hacking, and understanding
            Resample-Lab.
          </p>
        </div>

        {/* Sidebar + content */}
        <div className="flex gap-12">
          {/* Table of contents */}
          <nav className="hidden lg:block w-56 shrink-0">
            <div className="sticky top-12 space-y-1 text-sm">
              <p className="text-zinc-600 font-medium uppercase tracking-wider mb-3 text-xs">
                On this page
              </p>
              {sections.map((s) => (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  className="block text-zinc-500 hover:text-zinc-300 transition-colors py-1"
                >
                  {s.label}
                </a>
              ))}
            </div>
          </nav>

          {/* Main content */}
          <div className="flex-1 min-w-0 space-y-16 leading-relaxed">
            {/* Overview */}
            <section id="overview">
              <h2 className="text-2xl font-semibold text-foreground mb-4">
                Overview
              </h2>
              <p className="mb-4">
                Resample-Lab is a browser-based audio mutation lab. Upload any
                sound, pick a DSP preset, dial in the amount of chaos, and
                download a sample pack. The entire processing pipeline runs in a
                Web Worker using raw Float32Array math — no server, no AI, no
                WebAudio nodes, no external dependencies.
              </p>
              <p className="mb-4">
                It was built to scratch a specific creative itch: fast,
                destructive, interesting sample generation that doesn&apos;t
                require loading a DAW, patching a modular synth, or praying to a
                model. Every parameter is deterministic. Every effect is a known
                DSP technique. If you want to know exactly why an output sounds
                the way it does, the code will tell you.
              </p>
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 text-sm space-y-2 mt-6">
                <p className="text-zinc-400">
                  <span className="text-accent font-medium">Local-first:</span>{" "}
                  All audio is decoded via{" "}
                  <code className="text-xs bg-zinc-800 px-1 rounded">
                    AudioContext.decodeAudioData()
                  </code>
                  , processed in a Web Worker, encoded to WAV, and zipped — all
                  in the browser tab. Your files never leave your machine.
                </p>
                <p className="text-zinc-400">
                  <span className="text-accent font-medium">Zero AI:</span> No
                  neural networks, no black boxes. Every sample is produced by
                  explicit signal processing: biquad filters, overlap-add
                  time-stretching, granular slicing, convolution, and a dozen
                  other classic techniques.
                </p>
                <p className="text-zinc-400">
                  <span className="text-accent font-medium">Chaos-driven:</span>{" "}
                  A single 0–1 knob modulates every parameter in the active
                  preset simultaneously, letting you dial in anything from
                  subtle texture to total destruction.
                </p>
              </div>
            </section>

            {/* Preset Reference */}
            <section id="presets">
              <h2 className="text-2xl font-semibold text-foreground mb-4">
                Preset Reference
              </h2>
              <p className="text-sm text-zinc-400 mb-6">
                Every preset follows the same architecture:{" "}
                <strong>source → mutation → tape/tone → delay/reverb →
                finishing rack → output</strong>. Chaos maps into 8 lanes per
                preset (mutation, degradation, space, modulation, instability,
                finish, stereo, tail), so each preset responds differently to
                the same chaos value.
              </p>

              <div className="space-y-10">
                {/* Ambient Stretch Lab */}
                <div>
                  <h3 className="text-lg font-medium text-foreground mb-2">
                    Ambient Stretch Lab
                  </h3>
                  <span className="text-xs bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded">
                    5 outputs · tape: cinematic_dark · length: absurd (120s)
                  </span>
                  <div className="mt-3 space-y-2 text-sm">
                    <p>
                      WSOLA time-stretch from 8× (clean) to 20× (illegal
                      texture), followed by tape warmth, modulated hall reverb,
                      and finishing rack. Chaos prioritizes space, tail,
                      modulation, and stereo width — not degradation.
                    </p>
                    <table className="w-full text-xs mt-3">
                      <thead>
                        <tr className="text-zinc-600 border-b border-zinc-800">
                          <th className="text-left py-2 pr-4">Output</th>
                          <th className="text-left py-2 pr-4">Chain</th>
                          <th className="text-left py-2">Character</th>
                        </tr>
                      </thead>
                      <tbody className="text-zinc-400">
                        <tr className="border-b border-zinc-900">
                          <td className="py-2 pr-4 text-zinc-300">
                            cathedral_bed
                          </td>
                          <td className="py-2 pr-4">
                            WSOLA → tape(warm) → modulatedHall → finish(gentle)
                          </td>
                          <td className="py-2">Lush, cinematic, warm drone</td>
                        </tr>
                        <tr className="border-b border-zinc-900">
                          <td className="py-2 pr-4 text-zinc-300">
                            toxic_air
                          </td>
                          <td className="py-2 pr-4">
                            Resample → reverse → diffusionDelay → darkRoom →
                            tape(warm) → finish(gentle)
                          </td>
                          <td className="py-2">Smeared reverse wash with diffusion</td>
                        </tr>
                        <tr className="border-b border-zinc-900">
                          <td className="py-2 pr-4 text-zinc-300">
                            doom_choir_drift
                          </td>
                          <td className="py-2 pr-4">
                            Lowpass → tape(cinematic_dark) → convolutionSmear →
                            finish(warm)
                          </td>
                          <td className="py-2">Heavy, dark, convolution-soaked pad</td>
                        </tr>
                        <tr className="border-b border-zinc-900">
                          <td className="py-2 pr-4 text-zinc-300">
                            submerged_pad
                          </td>
                          <td className="py-2 pr-4">
                            Lowpass → tape(sub_heavy) → modulatedHall →
                            finish(gentle)
                          </td>
                          <td className="py-2">Deep, sub-heavy, underwater</td>
                        </tr>
                        <tr className="border-b border-zinc-900">
                          <td className="py-2 pr-4 text-zinc-300">
                            reverse_bloom_long
                          </td>
                          <td className="py-2 pr-4">
                            Reverse → reverseBloom → tape(warm) →
                            finish(gentle, long tail)
                          </td>
                          <td className="py-2">Swelling reverse bloom with warm tape</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Ghost Reverse Lab */}
                <div>
                  <h3 className="text-lg font-medium text-foreground mb-2">
                    Ghost Reverse Lab
                  </h3>
                  <span className="text-xs bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded">
                    4 outputs · tape: warm · length: long (90s)
                  </span>
                  <div className="mt-3 space-y-2 text-sm">
                    <p>
                      Reverse-based effects with reverse delays, diffusion
                      clouds, dark rooms, and metallic textures. Chaos
                      prioritizes space, mutation, and tail extension.
                    </p>
                    <table className="w-full text-xs mt-3">
                      <thead>
                        <tr className="text-zinc-600 border-b border-zinc-800">
                          <th className="text-left py-2 pr-4">Output</th>
                          <th className="text-left py-2 pr-4">Chain</th>
                          <th className="text-left py-2">Character</th>
                        </tr>
                      </thead>
                      <tbody className="text-zinc-400">
                        <tr className="border-b border-zinc-900">
                          <td className="py-2 pr-4 text-zinc-300">
                            pre_impact_suck
                          </td>
                          <td className="py-2 pr-4">
                            Reverse → reverseDelay → darkRoom → tape(warm) →
                            finish(gentle)
                          </td>
                          <td className="py-2">Short reverse pre-impact with suck</td>
                        </tr>
                        <tr className="border-b border-zinc-900">
                          <td className="py-2 pr-4 text-zinc-300">
                            ghost_swell_long
                          </td>
                          <td className="py-2 pr-4">
                            Resample → reverse → darkRoom → tape(warm) →
                            finish(gentle, long fade)
                          </td>
                          <td className="py-2">Long swelling ghost reverse</td>
                        </tr>
                        <tr className="border-b border-zinc-900">
                          <td className="py-2 pr-4 text-zinc-300">
                            reverse_delay_cloud
                          </td>
                          <td className="py-2 pr-4">
                            Reverse → diffusionDelay → convolutionSmear →
                            tape(subtle) → finish(gentle)
                          </td>
                          <td className="py-2">Diffused reverse delay into cloud</td>
                        </tr>
                        <tr className="border-b border-zinc-900">
                          <td className="py-2 pr-4 text-zinc-300">
                            haunted_room_tail
                          </td>
                          <td className="py-2 pr-4">
                            Reverse → dirtyMetallic → tape(degraded) →
                            finish(gentle)
                          </td>
                          <td className="py-2">Haunted metallic reverse decay</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Granular Shards */}
                <div>
                  <h3 className="text-lg font-medium text-foreground mb-2">
                    Granular Shards
                  </h3>
                  <span className="text-xs bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded">
                    10 outputs · tape: subtle · length: medium (45s)
                  </span>
                  <div className="mt-3 space-y-2 text-sm">
                    <p>
                      <strong>Two engine modes:</strong> Concatenative shards
                      (slices audio at 4 window sizes: 40–200ms, shuffles with
                      seeded LCG PRNG, per-grain processing) and{" "}
                      <strong>cloud mode</strong> (overlap-add with Hann/Tukey
                      envelopes, random pan, pitch distribution, reverse
                      probability, density/jitter control). Chaos prioritizes
                      mutation, pan spread, and instability.
                    </p>
                    <p className="text-xs text-accent mt-2">
                      — Shard mode —
                    </p>
                    <ul className="space-y-1 mt-1 text-zinc-400">
                      <li>
                        <span className="text-zinc-300">stereo_shrapnel_loop</span>{" "}
                        — Wide stereo micro-chop with fades
                      </li>
                      <li>
                        <span className="text-zinc-300">crushed_shards</span> —
                        2–8 bit quantization per grain
                      </li>
                      <li>
                        <span className="text-zinc-300">glitch_bits</span> —
                        Saturated (tanh) grains
                      </li>
                      <li>
                        <span className="text-zinc-300">pitch_cloud</span> —
                        ±4–24 semitones per grain
                      </li>
                      <li>
                        <span className="text-zinc-300">verb_throws</span> —
                        Dark room reverb on each grain
                      </li>
                      <li>
                        <span className="text-zinc-300">stutter_bits</span> —
                        Loop-based stutter repeats with tape
                      </li>
                    </ul>
                    <p className="text-xs text-accent mt-2">
                      — Cloud mode —
                    </p>
                    <ul className="space-y-1 mt-1 text-zinc-400">
                      <li>
                        <span className="text-zinc-300">particle_cloud</span> —
                        Overlap-add grains, pitch spread, pan drift
                      </li>
                      <li>
                        <span className="text-zinc-300">frozen_texture</span> —
                        Sustained drone from short freeze region
                      </li>
                      <li>
                        <span className="text-zinc-300">
                          granular_delay_swarm
                        </span>{" "}
                        — Grains fed into delay feedback network
                      </li>
                      <li>
                        <span className="text-zinc-300">
                          grain_reverb_bloom
                        </span>{" "}
                        — Grains with exponential decay wash
                      </li>
                    </ul>
                  </div>
                </div>

                {/* Bitrot Dirt */}
                <div>
                  <h3 className="text-lg font-medium text-foreground mb-2">
                    Bitrot Dirt
                  </h3>
                  <span className="text-xs bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded">
                    4 outputs · tape: degraded · length: medium (45s)
                  </span>
                  <div className="mt-3 space-y-2 text-sm">
                    <p>
                      Musical degradation — not just digital fracture. Tape
                      loss (speed/age-dependent HF rolloff), cassette flutter,
                      metallic reverb, and convolution smear. Chaos strongly
                      prioritizes degradation, instability, and modulation.
                    </p>
                    <table className="w-full text-xs mt-3">
                      <thead>
                        <tr className="text-zinc-600 border-b border-zinc-800">
                          <th className="text-left py-2 pr-4">Output</th>
                          <th className="text-left py-2 pr-4">Chain</th>
                        </tr>
                      </thead>
                      <tbody className="text-zinc-400">
                        <tr className="border-b border-zinc-900">
                          <td className="py-2 pr-4 text-zinc-300">
                            rotted_room_loop
                          </td>
                          <td className="py-2 pr-4">
                            Downsample → bitcrush → tape(degraded) → darkRoom →
                            finish
                          </td>
                        </tr>
                        <tr className="border-b border-zinc-900">
                          <td className="py-2 pr-4 text-zinc-300">
                            cassette_collapse
                          </td>
                          <td className="py-2 pr-4">
                            Downsample → tape(destroyed) → dirtyMetallic →
                            finish(degraded)
                          </td>
                        </tr>
                        <tr className="border-b border-zinc-900">
                          <td className="py-2 pr-4 text-zinc-300">
                            speaker_cone_tear
                          </td>
                          <td className="py-2 pr-4">
                            Soft clip → bandpass → noise → dirtyMetallic →
                            finish(limited)
                          </td>
                        </tr>
                        <tr className="border-b border-zinc-900">
                          <td className="py-2 pr-4 text-zinc-300">
                            bitcrushed_tail
                          </td>
                          <td className="py-2 pr-4">
                            Bitcrush → downsample → convolutionSmear →
                            tape(degraded) → finish
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Pitch Wreckage */}
                <div>
                  <h3 className="text-lg font-medium text-foreground mb-2">
                    Pitch Wreckage
                  </h3>
                  <span className="text-xs bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded">
                    4 outputs · tape: degraded · length: medium (45s)
                  </span>
                  <div className="mt-3 space-y-2 text-sm">
                    <p>
                      Pitch mutation via linear resampling with tape processing
                      and convolution wash. Octave shifts are ±12–24 semitones.
                      Chaos controls mutation intensity and instability.
                    </p>
                    <ul className="space-y-1 mt-3 text-zinc-400">
                      <li>
                        <span className="text-zinc-300">sub_beast_layer</span> —
                        –12 to –24 st → tape(sub_heavy) → convolutionSmear →
                        finish(limited)
                      </li>
                      <li>
                        <span className="text-zinc-300">glass_octave_tail</span>{" "}
                        — +12 to +24 st → bandpass → darkRoom → finish(bright)
                      </li>
                      <li>
                        <span className="text-zinc-300">detuned_metal_pair</span>{" "}
                        — Dual ±18 st layers → dirtyMetallic → tape(degraded)
                      </li>
                      <li>
                        <span className="text-zinc-300">falling_pitch_smear</span>{" "}
                        — Resample down → tape(cinematic_dark) →
                        convolutionSmear → finish(warm)
                      </li>
                    </ul>
                  </div>
                </div>

                {/* Loop Extractor */}
                <div>
                  <h3 className="text-lg font-medium text-foreground mb-2">
                    Loop Extractor
                  </h3>
                  <span className="text-xs bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded">
                    5 outputs · tape: subtle · length: medium (45s)
                  </span>
                  <div className="mt-3 space-y-2 text-sm">
                    <p>
                      Heuristic energy analysis finds loop-worthy sections.
                      Sliding-window RMS, boundary correlation, transient
                      scoring, and crossfade smoothing. Each candidate gets
                      multiple finishing treatments.
                    </p>
                    <ul className="space-y-1 mt-3 text-zinc-400">
                      <li>
                        <span className="text-zinc-300">clean_loop</span> —
                        Crossfaded loop, finish(gentle)
                      </li>
                      <li>
                        <span className="text-zinc-300">dirty_room_loop</span> —
                        Tape(subtle) → darkRoom → finish(warm)
                      </li>
                      <li>
                        <span className="text-zinc-300">delayed_loop</span> —
                        Ping-pong delay with filtered feedback
                      </li>
                      <li>
                        <span className="text-zinc-300">ambient_loop</span> —
                        Modulated hall → tape(warm) → finish(warm)
                      </li>
                      <li>
                        <span className="text-zinc-300">one_shot_from_loop</span>{" "}
                        — Extracted one-shot with convolution tail
                      </li>
                    </ul>
                  </div>
                </div>

                {/* Impact / Riser Mutator */}
                <div>
                  <h3 className="text-lg font-medium text-foreground mb-2">
                    Impact / Riser Mutator
                  </h3>
                  <span className="text-xs bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded">
                    5 outputs · tape: cinematic_dark · length: long (90s)
                  </span>
                  <div className="mt-3 space-y-2 text-sm">
                    <p>
                      Cinematic impact design. Filter sweeps, convolution
                      reverb, reverse blooms, metallic hits, and sub-heavy
                      collapses. Chaos amplifies tail length, space, and
                      mutation. All outputs are peak-limited for safety.
                    </p>
                    <ul className="space-y-1 mt-3 text-zinc-400">
                      <li>
                        <span className="text-zinc-300">doom_riser</span> —
                        Reverse → filterSweep → tape(cinematic_dark) →
                        modulatedHall → finish(warm)
                      </li>
                      <li>
                        <span className="text-zinc-300">pressure_drop</span> —
                        –24 to –36 st → tape(sub_heavy) → convolutionSmear →
                        finish(limited)
                      </li>
                      <li>
                        <span className="text-zinc-300">metal_impact</span> —
                        Reverse → dirtyMetallic → tape(degraded) →
                        finish(gentle)
                      </li>
                      <li>
                        <span className="text-zinc-300">reverse_slam</span> —
                        Soft clip → reverseBloom → finish(limited)
                      </li>
                      <li>
                        <span className="text-zinc-300">sub_collapse</span> —
                        –30 st → tape(sub_heavy) → convolutionSmear (damped) →
                        finish(warm, long tail)
                      </li>
                    </ul>
                  </div>
                </div>

                {/* Chaos Pack */}
                <div>
                  <h3 className="text-lg font-medium text-foreground mb-2">
                    Chaos Pack
                  </h3>
                  <span className="text-xs bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded">
                    7 outputs · tape: warm · length: long (90s)
                  </span>
                  <div className="mt-3 space-y-2 text-sm">
                    <p>
                      Curated multi-preset mashup. Runs 7 sub-recipes with
                      adjusted chaos, picking the most interesting output from
                      each. Seven flavors of controlled entropy.
                    </p>
                    <ol className="list-decimal list-inside space-y-1 mt-3 text-sm text-zinc-400">
                      <li>cathedral_bed from Ambient Stretch</li>
                      <li>haunted_room_tail from Ghost Reverse</li>
                      <li>particle_cloud from Granular Shards</li>
                      <li>granular_delay_swarm from Granular Shards</li>
                      <li>dirty_room_loop from Loop Extractor</li>
                      <li>doom_riser from Impact/Riser</li>
                      <li>sub_beast_layer from Pitch Wreckage</li>
                    </ol>
                  </div>
                </div>
              </div>
            </section>

            {/* Chaos Parameter */}
            <section id="chaos">
              <h2 className="text-2xl font-semibold text-foreground mb-4">
                Chaos Parameter
              </h2>
              <p className="mb-4">
                The chaos knob is a single 0–1 float that simultaneously
                modulates every parameter in the active preset. It&apos;s not a
                simple &quot;more effect&quot; knob — it shifts the behavior of
                each DSP transform along a spectrum from subtle to extreme.
              </p>

              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-zinc-600 border-b border-zinc-800">
                      <th className="text-left py-2 pr-4">Label</th>
                      <th className="text-left py-2 pr-4">Value</th>
                      <th className="text-left py-2 pr-4">Stretch</th>
                      <th className="text-left py-2 pr-4">Reverb</th>
                      <th className="text-left py-2 pr-4">Bitcrush</th>
                      <th className="text-left py-2 pr-4">Downsample</th>
                      <th className="text-left py-2 pr-4">Drive</th>
                      <th className="text-left py-2">Pitch Range</th>
                    </tr>
                  </thead>
                  <tbody className="text-zinc-400">
                    <tr className="border-b border-zinc-900">
                      <td className="py-2 pr-4 text-zinc-300">Clean</td>
                      <td className="py-2 pr-4">0.00</td>
                      <td className="py-2 pr-4">8×</td>
                      <td className="py-2 pr-4">0.4</td>
                      <td className="py-2 pr-4">8 bit</td>
                      <td className="py-2 pr-4">4×</td>
                      <td className="py-2 pr-4">0.2</td>
                      <td className="py-2">±4 st</td>
                    </tr>
                    <tr className="border-b border-zinc-900">
                      <td className="py-2 pr-4 text-zinc-300">Weird</td>
                      <td className="py-2 pr-4">0.33</td>
                      <td className="py-2 pr-4">12×</td>
                      <td className="py-2 pr-4">0.57</td>
                      <td className="py-2 pr-4">6 bit</td>
                      <td className="py-2 pr-4">8×</td>
                      <td className="py-2 pr-4">0.37</td>
                      <td className="py-2">±11 st</td>
                    </tr>
                    <tr className="border-b border-zinc-900">
                      <td className="py-2 pr-4 text-zinc-300">Broken</td>
                      <td className="py-2 pr-4">0.66</td>
                      <td className="py-2 pr-4">16×</td>
                      <td className="py-2 pr-4">0.73</td>
                      <td className="py-2 pr-4">4 bit</td>
                      <td className="py-2 pr-4">12×</td>
                      <td className="py-2 pr-4">0.53</td>
                      <td className="py-2">±17 st</td>
                    </tr>
                    <tr className="border-b border-zinc-900">
                      <td className="py-2 pr-4 text-zinc-300">
                        Illegal Texture
                      </td>
                      <td className="py-2 pr-4">1.00</td>
                      <td className="py-2 pr-4">20×</td>
                      <td className="py-2 pr-4">0.90</td>
                      <td className="py-2 pr-4">2 bit</td>
                      <td className="py-2 pr-4">14×</td>
                      <td className="py-2 pr-4">0.70</td>
                      <td className="py-2">±24 st</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <p className="text-sm text-zinc-500 mt-4">
                Values are approximate — actual parameter ranges depend on the
                preset. Chaos also affects less obvious parameters: reverb decay
                time, filter cutoff frequencies, tape wow depth/rate, feedback
                amounts, noise levels, loop durations, and stereo width.
              </p>
            </section>

            {/* Length Modes */}
            <section id="length">
              <h2 className="text-2xl font-semibold text-foreground mb-4">
                Length Modes
              </h2>
              <p className="mb-4">
                A length mode controls how long each generated sample can be and
                how much silence extends the tail. Longer modes produce bigger
                files and take more processing time. Each preset has a default
                mode tuned to its character — you can override it for shorter
                snippets or maximal drone textures.
              </p>

              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-zinc-600 border-b border-zinc-800">
                      <th className="text-left py-2 pr-4">Mode</th>
                      <th className="text-left py-2 pr-4">Max Duration</th>
                      <th className="text-left py-2 pr-4">Tail Extend</th>
                      <th className="text-left py-2">Use Case</th>
                    </tr>
                  </thead>
                  <tbody className="text-zinc-400">
                    <tr className="border-b border-zinc-900">
                      <td className="py-2 pr-4 text-zinc-300">Short</td>
                      <td className="py-2 pr-4">15s</td>
                      <td className="py-2 pr-4">None</td>
                      <td className="py-2">Quick one-shots, tight loops</td>
                    </tr>
                    <tr className="border-b border-zinc-900">
                      <td className="py-2 pr-4 text-zinc-300">Medium</td>
                      <td className="py-2 pr-4">45s</td>
                      <td className="py-2 pr-4">0.3s</td>
                      <td className="py-2">Versatile default for most material</td>
                    </tr>
                    <tr className="border-b border-zinc-900">
                      <td className="py-2 pr-4 text-zinc-300">Long</td>
                      <td className="py-2 pr-4">90s</td>
                      <td className="py-2 pr-4">0.5s</td>
                      <td className="py-2">Extended pads, ambient tails</td>
                    </tr>
                    <tr className="border-b border-zinc-900">
                      <td className="py-2 pr-4 text-zinc-300">Absurd</td>
                      <td className="py-2 pr-4">120s</td>
                      <td className="py-2 pr-4">1.0s</td>
                      <td className="py-2">
                        Maximal drones, large file sizes
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <p className="text-sm text-zinc-500 mt-4">
                <strong className="text-zinc-300">Note:</strong> &quot;Absurd&quot;
                mode can produce output files over 20 MB each, and ZIP downloads
                may be substantial. Chaos also slightly extends tails — higher
                chaos adds up to 0.5s of extra tail.
              </p>
            </section>

            {/* DSP Techniques */}
            <section id="dsp">
              <h2 className="text-2xl font-semibold text-foreground mb-4">
                DSP Techniques
              </h2>
              <p className="mb-6">
                Every transform is implemented in pure TypeScript using{" "}
                Float32Array buffers. No WebAudio nodes, no WASM, no external
                DSP libraries. Deterministic, browser-safe, reviewable.
              </p>

              <div className="space-y-6">
                <div>
                  <h3 className="text-base font-medium text-foreground mb-1">
                    Processing Pipeline
                  </h3>
                  <p className="text-sm text-zinc-400">
                    Every preset output flows through a consistent architecture:
                  </p>
                  <div className="bg-zinc-900 rounded-lg p-3 mt-2">
                    <pre className="text-xs text-zinc-400 overflow-x-auto">
                      <code>{`source → mutation → tape/tone → delay/reverb → finishing rack → output

1. Mutation    — WSOLA stretch, resample, reverse, bitcrush, etc.
2. Tape/Tone   — DC block, head bump, tape loss (speed/age HF rolloff),
                 tone tilt, wow/flutter, soft saturation
3. Delay/Reverb — Dark room, modulated hall, dirty metallic,
                 reverse bloom, convolution smear, ping-pong delay,
                 diffusion delay, reverse delay, multi-tap
4. Finishing   — Trim silence, DC block, EQ profile, stereo width,
                 soft clip, peak limiter, normalize, fades, tail extend`}</code>
                    </pre>
                  </div>
                </div>

                <div>
                  <h3 className="text-base font-medium text-foreground mb-1">
                    Finishing Rack
                  </h3>
                  <p className="text-sm text-zinc-400">
                    Shared post-processing applied to every output. Order:
                    trim silence → DC block → EQ profile (gentle/warm/bright/
                    degraded) → stereo width → soft clip → peak limiter →
                    normalize to –1 dBFS → fades (5ms in, 20ms out) → tail
                    extend. The limiter uses tanh-based soft-knee saturation
                    above 85% of ceiling.
                  </p>
                </div>

                <div>
                  <h3 className="text-base font-medium text-foreground mb-1">
                    Tape Emulation
                  </h3>
                  <p className="text-sm text-zinc-400">
                    Implemented from first principles — no GPL code, no{" "}
                    CHOWTapeModel port. 6 profiles: subtle, warm, degraded,
                    destroyed, cinematic_dark, sub_heavy. Each profile includes
                    DC blocker (single-pole IIR, R≈0.997), input highpass/
                    lowpass, head bump (peaking EQ at 45–120 Hz with
                    configurable Q), tape loss (speed/age-dependent HF rolloff
                    via first-order lowpass), tone tilt (dark/neutral/bright/
                    sub_heavy), optional wow/flutter (delegates to sinusoidal
                    fractional delay modulation), and optional soft saturation.
                    Chaos pushes parameters toward more degradation: lower
                    speed, older age, deeper wow, more drive.
                  </p>
                </div>

                <div>
                  <h3 className="text-base font-medium text-foreground mb-1">
                    Delay Architecture
                  </h3>
                  <p className="text-sm text-zinc-400">
                    5 delay types, all with bounded feedback (≤0.95) and full
                    tail rendering. Mono delay with optional LPF/HPF in the
                    feedback path. Stereo ping-pong with cross-channel feedback.
                    Diffusion delay with cascaded allpass smearing (2–6 stages).
                    Reverse delay that reads the buffer backwards for pre-echo
                    effects. Multi-tap delay with per-tap gain and stereo pan.
                    All delays normalize to 0.95 peak and guarantee finite output.
                  </p>
                </div>

                <div>
                  <h3 className="text-base font-medium text-foreground mb-1">
                    Reverb Architecture
                  </h3>
                  <p className="text-sm text-zinc-400">
                    5 reverb engines with damping, stereo spread, and rendered
                    tails. Dark room: 4-comb + 2-allpass FDN with heavy LPF
                    damping. Modulated hall: sinusoidal delay-read modulation
                    for cloud/bloom effects, extended tail. Dirty metallic: 6
                    shorter combs with configurable brightness for ringy
                    textures. Reverse bloom: input reversed → FDN → reversed
                    back for swelling pre-effects. Convolution smear: O(n·k)
                    with procedurally generated exponential-decay noise IR
                    (LPF-damped). All reverbs guarantee peak ≤1.0 and finite
                    output.
                  </p>
                </div>

                <div>
                  <h3 className="text-base font-medium text-foreground mb-1">
                    Granular Synthesis (Two Modes)
                  </h3>
                  <p className="text-sm text-zinc-400">
                    <strong>Shard mode:</strong> Slices at 4 window sizes
                    (40–200ms), shuffles with seeded LCG PRNG, concatenates
                    with per-grain processing (pitch shift, bitcrush, reverb,
                    saturation).{" "}
                    <strong>Cloud mode:</strong> Overlap-add with Hann/Tukey
                    envelopes, random grain position, pitch (±semitone range),
                    pan per grain, reverse probability, density (grains/sec),
                    jitter. Freeze mode sustains a short window via dense
                    overlapping grains. Delay swarm feeds grains into a
                    feedback delay network. Reverb bloom applies exponential
                    decay envelopes for grain-to-wash transitions. All modes
                    are deterministic for a given seed.
                  </p>
                </div>

                <div>
                  <h3 className="text-base font-medium text-foreground mb-1">
                    WSOLA Time-Stretch
                  </h3>
                  <p className="text-sm text-zinc-400">
                    Waveform-Similarity Overlap-Add. 30ms frames with Hann
                    window, hop ratio from stretch factor. Falls back to simple
                    resample at extreme ratios (20×+). Source capped at 60s
                    before stretching.
                  </p>
                </div>

                <div>
                  <h3 className="text-base font-medium text-foreground mb-1">
                    Biquad Filters
                  </h3>
                  <p className="text-sm text-zinc-400">
                    Direct Form II transposed. LP/HP at Q=0.707 (Butterworth);
                    bandpass Q from bandwidth ratio. Cutoff clamped to [20Hz,
                    Nyquist–1Hz]. Coefficients pre-computed, state per-instance.
                  </p>
                </div>

                <div>
                  <h3 className="text-base font-medium text-foreground mb-1">
                    Schroeder Reverb
                  </h3>
                  <p className="text-sm text-zinc-400">
                    Classic 4-comb (31/37/43/53ms) + cascaded allpass (5ms).
                    Feedback gain set by decay. Output normalized to peak 1.0.
                    Used as a lightweight option where more expensive reverbs
                    aren&apos;t needed.
                  </p>
                </div>

                <div>
                  <h3 className="text-base font-medium text-foreground mb-1">
                    Convolution Reverb
                  </h3>
                  <p className="text-sm text-zinc-400">
                    O(n·k) direct convolution with exponential-decay noise IR.
                    IR generated procedurally and LPF-damped. Input capped at
                    5s, IR typically 0.5–4s. Used for transient smear and
                    cinematic wash effects.
                  </p>
                </div>

                <div>
                  <h3 className="text-base font-medium text-foreground mb-1">
                    Loop Detection
                  </h3>
                  <p className="text-sm text-zinc-400">
                    Heuristic sliding-window finder with adaptive step size.
                    Scores on RMS energy, peak-to-RMS ratio, front-loaded
                    energy, tail energy, and boundary correlation. Top
                    non-overlapping candidates selected; fallback to middle
                    section if none pass threshold.
                  </p>
                </div>

                <div>
                  <h3 className="text-base font-medium text-foreground mb-1">
                    Chaos Lane Mapping
                  </h3>
                  <p className="text-sm text-zinc-400">
                    The single 0–1 chaos knob maps into 8 per-preset lanes:
                    mutation, degradation, space, modulation, instability,
                    finish, stereo, tail. Each preset defines its own lane
                    weights. Ambient Stretch prioritizes space and tail;
                    Bitrot Dirt prioritizes degradation and instability;
                    Impact/Riser prioritizes space, tail, and stereo. Chaos
                    is applied as{" "}
                    <code className="text-xs bg-zinc-800 px-1">
                      chaos × laneWeight
                    </code>{" "}
                    for each lane.
                  </p>
                </div>

                <div>
                  <h3 className="text-base font-medium text-foreground mb-1">
                    Tape Wow &amp; Flutter
                  </h3>
                  <p className="text-sm text-zinc-400">
                    Sinusoidal LFO modulating a fractional delay line. Linear
                    interpolation between samples. Separate from the broader
                    tape emulation module — this is the raw pitch modulation
                    primitive.
                  </p>
                </div>

                <div>
                  <h3 className="text-base font-medium text-foreground mb-1">
                    Downsample + Bitcrush
                  </h3>
                  <p className="text-sm text-zinc-400">
                    Two-stage: lowpass at Nyquist/factor → zero-order-hold
                    decimation, then uniform quantization to N bits (1–16).
                    N ≥ 16 passes through.
                  </p>
                </div>

                <div>
                  <h3 className="text-base font-medium text-foreground mb-1">
                    Haas Effect
                  </h3>
                  <p className="text-sm text-zinc-400">
                    Per-channel random delay (1–12ms) for precedence-effect
                    stereo widening. Randomized per-call. Combined with warm
                    chain (HP20 + LP60 + soft clip + normalize) for the
                    watchyourtemper® character chain.
                  </p>
                </div>
              </div>
            </section>

            {/* Technical Specs */}
            <section id="specs">
              <h2 className="text-2xl font-semibold text-foreground mb-4">
                Technical Specs
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                  <h3 className="text-foreground font-medium mb-2">Input</h3>
                  <ul className="space-y-1 text-zinc-400">
                    <li>Formats: WAV, AIFF, FLAC, MP3, M4A, OGG</li>
                    <li>Max files: 8 per pack</li>
                    <li>Max duration: 300 s (5 min) per file</li>
                    <li>Max upload: 50 MB per file</li>
                  </ul>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                  <h3 className="text-foreground font-medium mb-2">Output</h3>
                  <ul className="space-y-1 text-zinc-400">
                    <li>Format: 16-bit WAV at source sample rate</li>
                    <li>Max duration: 15–120 s (selectable via Length mode)</li>
                    <li>Normalization: –1 dBFS peak (0.89)</li>
                    <li>Always stereo (mono sources are duplicated)</li>
                  </ul>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                  <h3 className="text-foreground font-medium mb-2">
                    Processing
                  </h3>
                  <ul className="space-y-1 text-zinc-400">
                    <li>Thread: single Web Worker</li>
                    <li>Data: Float32Array only (no float64 audio)</li>
                    <li>Decoding: AudioContext.decodeAudioData()</li>
                    <li>All transforms return new arrays (no mutation)</li>
                  </ul>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                  <h3 className="text-foreground font-medium mb-2">Codebase</h3>
                  <ul className="space-y-1 text-zinc-400">
                    <li>Framework: Next.js 16 (static export)</li>
                    <li>DSP: ~4,300 lines of pure TypeScript across 8 modules</li>
                    <li>40+ transform functions</li>
                    <li>5 new DSP modules: finish, tape, delay, reverb, granular</li>
                    <li>92 automated DSP tests</li>
                    <li>Zero runtime dependencies for audio</li>
                  </ul>
                </div>
              </div>
            </section>

            {/* FAQ */}
            <section id="faq">
              <h2 className="text-2xl font-semibold text-foreground mb-4">
                FAQ
              </h2>
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium text-foreground mb-1">
                    Does this upload my audio anywhere?
                  </h3>
                  <p className="text-sm text-zinc-400">
                    No. All processing happens in your browser tab. The app has
                    no backend — it&apos;s a static site. Your files never leave
                    your computer.
                  </p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-foreground mb-1">
                    Can I use this offline?
                  </h3>
                  <p className="text-sm text-zinc-400">
                    Yes, after the first page load. The entire DSP engine is
                    client-side JavaScript. No API calls are made at runtime.
                  </p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-foreground mb-1">
                    Why is convolution reverb slow at high chaos?
                  </h3>
                  <p className="text-sm text-zinc-400">
                    Convolution uses direct O(n·k) convolution. The impulse
                    response length scales with reverb time (up to 4s at
                    high chaos = ~192k samples). Input is capped to bound
                    the operation count. On a modern laptop this typically
                    takes 2–5 seconds. Consider this a tradeoff for
                    deterministic, dependency-free convolution.
                  </p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-foreground mb-1">
                    Can I use my own sample rate?
                  </h3>
                  <p className="text-sm text-zinc-400">
                    Outputs use the sample rate of the source audio (decoded by
                    the browser). Most browsers output 48 kHz, but the DSP
                    handles any rate transparently.
                  </p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-foreground mb-1">
                    Why are some outputs skipped?
                  </h3>
                  <p className="text-sm text-zinc-400">
                    Every output passes validation (RMS &ge; 10⁻⁷, length
                    &ge; 20 samples, no NaN/Infinity) via{" "}
                    <code className="text-xs bg-zinc-800 px-1 rounded">
                      validateOutput()
                    </code>{" "}
                    before it&apos;s included. If the processed audio is
                    silent or corrupted, it&apos;s skipped to avoid broken
                    WAV files. The finishing rack also clamps NaN to 0 and
                    limits peaks, so skipped outputs are rare with normal
                    source material.
                  </p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-foreground mb-1">
                    What is the &quot;watchyourtemper&quot; character chain?
                  </h3>
                  <p className="text-sm text-zinc-400">
                    A signature processing chain: Haas-effect stereo widening
                    (random 1–12 ms per-channel delay) followed by the finishing
                    rack (DC block, EQ profile, stereo width, soft clip
                    saturation, limiter, peak normalize, fades). Every output
                    passes through the finishing rack. The earlier warm chain
                    (HP20 → LP60 → soft clip) is still available as{" "}
                    <code className="text-xs bg-zinc-800 px-1 rounded">
                      finalWarm()
                    </code>{" "}
                    but most presets now use the full finishing rack.
                  </p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-foreground mb-1">
                    Can I contribute a preset?
                  </h3>
                  <p className="text-sm text-zinc-400">
                    Yes. See the{" "}
                    <a
                      href="https://github.com/achuthanmukundan00/Resample-Lab/blob/main/CONTRIBUTING.md"
                      className="text-accent hover:text-accent-glow underline"
                    >
                      contributing guide
                    </a>{" "}
                    for the recipe API and conventions.
                  </p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-foreground mb-1">
                    Is this AI?
                  </h3>
                  <p className="text-sm text-zinc-400">
                    No. Every sample is produced by explicit, deterministic DSP.
                    No neural networks, no machine learning — just biquad
                    filters, overlap-add, convolution, and other classic signal
                    processing.
                  </p>
                </div>
              </div>
            </section>

            {/* Developer Guide */}
            <section id="dev">
              <h2 className="text-2xl font-semibold text-foreground mb-4">
                Developer Guide
              </h2>

              <div className="space-y-6">
                <div>
                  <h3 className="text-base font-medium text-foreground mb-1">
                    Local Development
                  </h3>
                  <div className="bg-zinc-900 rounded-lg p-4 mt-2">
                    <pre className="text-xs text-zinc-400 overflow-x-auto">
                      <code>
                        git clone
                        https://github.com/achuthanmukundan00/Resample-Lab.git
                        cd Resample-Lab/apps/web pnpm install pnpm dev # →
                        http://localhost:3000
                      </code>
                    </pre>
                  </div>
                  <p className="text-sm text-zinc-400 mt-2">
                    No backend, no database, no environment variables. The dev
                    server starts in seconds.
                  </p>
                </div>

                <div>
                  <h3 className="text-base font-medium text-foreground mb-1">
                    Production Build
                  </h3>
                  <div className="bg-zinc-900 rounded-lg p-4 mt-2">
                    <pre className="text-xs text-zinc-400 overflow-x-auto">
                      <code>
                        pnpm build # static export → out/ pnpm start # serve
                        locally
                      </code>
                    </pre>
                  </div>
                  <p className="text-sm text-zinc-400 mt-2">
                    Outputs a fully self-contained static site. Deploy to
                    Cloudflare Pages, Vercel, Netlify, S3, or any web server.
                  </p>
                </div>

                <div>
                  <h3 className="text-base font-medium text-foreground mb-1">
                    Project Structure
                  </h3>
                  <div className="bg-zinc-900 rounded-lg p-4 mt-2">
                    <pre className="text-xs text-zinc-400 overflow-x-auto">
                      <code>{`apps/web/lib/dsp/    # DSP engine
├── transforms.ts   # 40+ atomic audio transforms
├── presets.ts      # 8 preset recipes + registry
├── finish.ts       # Finishing rack (DC block, EQ, limiter, fades)
├── tape.ts         # Tape emulation (6 profiles, loss, head bump)
├── delay.ts        # Delay effects (mono, ping-pong, diffusion, reverse)
├── reverb.ts       # Reverb engines (dark, hall, metallic, bloom, convolution)
├── granular.ts     # Granular synthesis (cloud, freeze, swarm, bloom)
├── packWorker.ts   # Web Worker entry point
├── wav.ts          # 16-bit WAV encoding
├── zip.ts          # ZIP builder (stored, no compression)
├── constants.ts    # Centralized limits
├── types.ts        # Shared types
└── __tests__/      # 92 DSP tests
    └── dsp.test.ts`}</code>
                    </pre>
                  </div>
                </div>

                <div>
                  <h3 className="text-base font-medium text-foreground mb-1">
                    Adding a Transform
                  </h3>
                  <p className="text-sm text-zinc-400 mb-2">
                    All transforms live in{" "}
                    <code className="text-xs bg-zinc-800 px-1 rounded">
                      transforms.ts
                    </code>{" "}
                    and follow a consistent signature:
                  </p>
                  <div className="bg-zinc-900 rounded-lg p-4">
                    <pre className="text-xs text-zinc-400 overflow-x-auto">
                      <code>{`// Input:  Float32Array[] channels, sample rate, params
// Output: New Float32Array[] (never mutate inputs)
export function myEffect(
  channels: Float32Array[],
  sr: number,
  intensity: number,
): Float32Array[] {
  return channels.map((ch) => {
    const out = new Float32Array(ch.length);
    for (let i = 0; i < ch.length; i++) {
      out[i] = ch[i] * intensity; // your processing here
    }
    return out;
  });
}`}</code>
                    </pre>
                  </div>
                </div>

                <div>
                  <h3 className="text-base font-medium text-foreground mb-1">
                    Running Tests
                  </h3>
                  <div className="bg-zinc-900 rounded-lg p-4 mt-2">
                    <pre className="text-xs text-zinc-400 overflow-x-auto">
                      <code>
                        npx tsx apps/web/lib/dsp/__tests__/dsp.test.ts
                      </code>
                    </pre>
                  </div>
                  <p className="text-sm text-zinc-400 mt-2">
                    114+ tests covering transforms, finishing rack, tape
                    emulation, delays, reverbs, granular engine, stereo/mono
                    compatibility, and audio analysis utilities.
                  </p>
                </div>

                <div>
                  <h3 className="text-base font-medium text-foreground mb-1">
                    Render-Audit (Listen Test)
                  </h3>
                  <p className="text-sm text-zinc-400 mb-2">
                    Generate every preset × every source file × 3 chaos values ×
                    4 length modes and produce a structured report. Useful for
                    evaluating output quality across source material.
                  </p>
                  <div className="bg-zinc-900 rounded-lg p-4 mt-2">
                    <pre className="text-xs text-zinc-400 overflow-x-auto">
                      <code>
                        npx tsx scripts/render-dsp-corpus.ts --input ./my-wavs
                      </code>
                    </pre>
                  </div>
                  <p className="text-sm text-zinc-400 mt-2">
                    Output goes to{" "}
                    <code className="text-xs bg-zinc-800 px-1 rounded">
                      .render-audit/
                    </code>{" "}
                    with a structured folder tree,{" "}
                    <code className="text-xs bg-zinc-800 px-1 rounded">
                      report.json
                    </code>
                    , and a human-readable{" "}
                    <code className="text-xs bg-zinc-800 px-1 rounded">
                      report.md
                    </code>
                    .
                  </p>
                  <p className="text-sm text-zinc-500 mt-2">
                    Recommended source material for listen-testing:
                  </p>
                  <ul className="list-disc list-inside text-xs text-zinc-500 space-y-1 mt-1">
                    <li>Dry drum loop (120 BPM, ~4 bars)</li>
                    <li>Vocal one-shot or short phrase</li>
                    <li>Synth one-shot (piano, pad, brass stab)</li>
                    <li>Melodic loop (bassline or chord progression)</li>
                    <li>Noisy field recording (street ambience, room tone)</li>
                    <li>Full mixed snippet (15–30 s of a mastered track)</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-base font-medium text-foreground mb-1">
                    Demo Recorder (Playwright)
                  </h3>
                  <p className="text-sm text-zinc-400 mb-2">
                    Automated browser test that exercises the full UI: upload,
                    preset selection, chaos slider, length mode, and generation.
                    Can also record a screencast for the README.
                  </p>
                  <div className="bg-zinc-900 rounded-lg p-4 mt-2">
                    <pre className="text-xs text-zinc-400 overflow-x-auto">
                      <code>
                        # Install (one-time)
                        pnpm add -D playwright
                        npx playwright install

                        # Start dev server (new terminal)
                        pnpm dev

                        # Smoke test (no video)
                        node scripts/demo-recorder.mjs

                        # Record demo video
                        node scripts/demo-recorder.mjs --record
                      </code>
                    </pre>
                  </div>
                  <p className="text-sm text-zinc-400 mt-2">
                    Requires a{" "}
                    <code className="text-xs bg-zinc-800 px-1 rounded">
                      test.wav
                    </code>{" "}
                    file at the repo root and the dev server running on port
                    3000. The recorded video is saved to{" "}
                    <code className="text-xs bg-zinc-800 px-1 rounded">
                      docs/assets/demo.webm
                    </code>
                    .
                  </p>
                </div>

                <div>
                  <h3 className="text-base font-medium text-foreground mb-1">
                    Architecture Notes
                  </h3>
                  <ul className="list-disc list-inside space-y-1 text-sm text-zinc-400">
                    <li>
                      Audio decoding uses the browser&apos;s native{" "}
                      <code className="text-xs bg-zinc-800 px-1 rounded">
                        AudioContext.decodeAudioData()
                      </code>
                    </li>
                    <li>
                      All DSP runs in a single Web Worker — no blocking the main
                      thread
                    </li>
                    <li>
                      Progress is reported via{" "}
                      <code className="text-xs bg-zinc-800 px-1 rounded">
                        worker.postMessage()
                      </code>{" "}
                      — the UI renders a real-time progress bar
                    </li>
                    <li>
                      Each preset recipe declares its output count and
                      categories in the registry at the bottom of{" "}
                      <code className="text-xs bg-zinc-800 px-1 rounded">
                        presets.ts
                      </code>
                    </li>
                    <li>
                      The{" "}
                      <code className="text-xs bg-zinc-800 px-1 rounded">
                        makeSample()
                      </code>{" "}
                      helper handles stereo conversion, validation,
                      sanitization, and peak normalization
                    </li>
                  </ul>
                </div>
              </div>
            </section>
          </div>
        </div>

        {/* Footer */}
        <footer className="border-t border-zinc-800 mt-16 pt-8 text-xs text-zinc-600">
          <p>
            <span className="text-accent">Resample</span>-Lab — MIT licensed.
            Built by{" "}
            <a
              href="https://github.com/achuthanmukundan00"
              className="text-zinc-400 hover:text-zinc-300"
            >
              achuthanmukundan00
            </a>
            . DSP powered by Float32Array and coffee.
          </p>
        </footer>
      </div>
    </div>
  );
}
