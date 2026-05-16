import Link from 'next/link'

export const metadata = {
  title: 'Resample-Lab — Documentation',
  description: 'Full DSP documentation, preset reference, chaos guide, and developer docs for Resample-Lab.',
}

const sections = [
  { id: 'overview', label: 'Overview' },
  { id: 'presets', label: 'Preset Reference' },
  { id: 'chaos', label: 'Chaos Parameter' },
  { id: 'dsp', label: 'DSP Techniques' },
  { id: 'specs', label: 'Technical Specs' },
  { id: 'faq', label: 'FAQ' },
  { id: 'dev', label: 'Developer Guide' },
]

export default function DocsPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-300">
      <div className="max-w-4xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="mb-12">
          <Link href="/" className="text-accent hover:text-accent-glow text-sm transition-colors">
            ← Back to app
          </Link>
          <h1 className="text-3xl font-bold tracking-tight text-foreground mt-4 mb-2">
            Documentation
          </h1>
          <p className="text-zinc-500">
            Everything you need to know about using, hacking, and understanding Resample-Lab.
          </p>
        </div>

        {/* Sidebar + content */}
        <div className="flex gap-12">
          {/* Table of contents */}
          <nav className="hidden lg:block w-56 shrink-0">
            <div className="sticky top-12 space-y-1 text-sm">
              <p className="text-zinc-600 font-medium uppercase tracking-wider mb-3 text-xs">On this page</p>
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
              <h2 className="text-2xl font-semibold text-foreground mb-4">Overview</h2>
              <p className="mb-4">
                Resample-Lab is a browser-based audio mutation lab. Upload any sound, pick a DSP preset, dial in the
                amount of chaos, and download a sample pack. The entire processing pipeline runs in a Web Worker using
                raw Float32Array math — no server, no AI, no WebAudio nodes, no external dependencies.
              </p>
              <p className="mb-4">
                It was built to scratch a specific creative itch: fast, destructive, interesting sample generation
                that doesn&apos;t require loading a DAW, patching a modular synth, or praying to a model. Every
                parameter is deterministic. Every effect is a known DSP technique. If you want to know exactly why
                an output sounds the way it does, the code will tell you.
              </p>
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 text-sm space-y-2 mt-6">
                <p className="text-zinc-400">
                  <span className="text-accent font-medium">Local-first:</span> All audio is decoded via{' '}
                  <code className="text-xs bg-zinc-800 px-1 rounded">AudioContext.decodeAudioData()</code>,
                  processed in a Web Worker, encoded to WAV, and zipped — all in the browser tab. Your files never
                  leave your machine.
                </p>
                <p className="text-zinc-400">
                  <span className="text-accent font-medium">Zero AI:</span> No neural networks, no black boxes. Every
                  sample is produced by explicit signal processing: biquad filters, overlap-add time-stretching,
                  granular slicing, convolution, and a dozen other classic techniques.
                </p>
                <p className="text-zinc-400">
                  <span className="text-accent font-medium">Chaos-driven:</span> A single 0–1 knob modulates every
                  parameter in the active preset simultaneously, letting you dial in anything from subtle texture to
                  total destruction.
                </p>
              </div>
            </section>

            {/* Preset Reference */}
            <section id="presets">
              <h2 className="text-2xl font-semibold text-foreground mb-4">Preset Reference</h2>

              <div className="space-y-10">

                {/* Ambient Stretch Lab */}
                <div>
                  <h3 className="text-lg font-medium text-foreground mb-2">Ambient Stretch Lab</h3>
                  <span className="text-xs bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded">5 outputs</span>
                  <div className="mt-3 space-y-2 text-sm">
                    <p>
                      WSOLA time-stretch from 8× (clean) to 20× (illegal texture), followed by layered
                      processing chains. The source audio is capped at 60 seconds to keep the stretch
                      buffers manageable, and each output is capped at 90 seconds.
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
                          <td className="py-2 pr-4 text-zinc-300">stretched_bed</td>
                          <td className="py-2 pr-4">WSOLA → reverb → tape wow → lowpass → Haas → warm</td>
                          <td className="py-2">Wide, dark, evolving pad</td>
                        </tr>
                        <tr className="border-b border-zinc-900">
                          <td className="py-2 pr-4 text-zinc-300">reverse_smear</td>
                          <td className="py-2 pr-4">Slow resample → reverse → delay → reverb → lowpass → warm</td>
                          <td className="py-2">Backwards wash, textural</td>
                        </tr>
                        <tr className="border-b border-zinc-900">
                          <td className="py-2 pr-4 text-zinc-300">ghost_pad</td>
                          <td className="py-2 pr-4">Lowpass → reverb → soft clip → tape wow → stereo widen → Haas → warm</td>
                          <td className="py-2">Saturated, wide, ethereal</td>
                        </tr>
                        <tr className="border-b border-zinc-900">
                          <td className="py-2 pr-4 text-zinc-300">driven_texture</td>
                          <td className="py-2 pr-4">WSOLA → delay → soft clip → lowpass → widen → wow → Haas</td>
                          <td className="py-2">Gritty, rhythmic, wide</td>
                        </tr>
                        <tr className="border-b border-zinc-900">
                          <td className="py-2 pr-4 text-zinc-300">reverb_wash</td>
                          <td className="py-2 pr-4">Reverse → reverb → reverse → lowpass → Haas → warm</td>
                          <td className="py-2">Classic reverse reverb swell</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Ghost Reverse Lab */}
                <div>
                  <h3 className="text-lg font-medium text-foreground mb-2">Ghost Reverse Lab</h3>
                  <span className="text-xs bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded">4 outputs</span>
                  <div className="mt-3 space-y-2 text-sm">
                    <p>
                      Focused on reverse-based effects. Every output starts with the source played backwards,
                      then processed through combinations of delay, reverb, filtering, and saturation.
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
                          <td className="py-2 pr-4 text-zinc-300">reverse_tail</td>
                          <td className="py-2 pr-4">Reverse → delay → reverb → warm</td>
                          <td className="py-2">Decaying reverse echo tail</td>
                        </tr>
                        <tr className="border-b border-zinc-900">
                          <td className="py-2 pr-4 text-zinc-300">ghost_hit</td>
                          <td className="py-2 pr-4">Slow resample → reverse → bandpass → reverb → soft clip → Haas → warm</td>
                          <td className="py-2">Filtered, reverbed, wide</td>
                        </tr>
                        <tr className="border-b border-zinc-900">
                          <td className="py-2 pr-4 text-zinc-300">filtered_pre</td>
                          <td className="py-2 pr-4">Reverse → highpass → reverb → tape wow → Haas → warm</td>
                          <td className="py-2">Airy, shimmering pre-echo</td>
                        </tr>
                        <tr className="border-b border-zinc-900">
                          <td className="py-2 pr-4 text-zinc-300">distorted_pre</td>
                          <td className="py-2 pr-4">Reverse → soft clip → delay → reverb → lowpass → Haas</td>
                          <td className="py-2">Aggressive, wide pre-impact</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Granular Shards */}
                <div>
                  <h3 className="text-lg font-medium text-foreground mb-2">Granular Shards</h3>
                  <span className="text-xs bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded">10 outputs</span>
                  <div className="mt-3 space-y-2 text-sm">
                    <p>
                      Slices audio at four window sizes (40ms, 80ms, 120ms, 200ms) into a pooled grain
                      buffer, shuffles with a seeded LCG PRNG, then builds sequences with per-grain
                      processing. The seed is derived from the source filename + chaos value, so the same
                      input always produces the same grain order.
                    </p>
                    <ul className="space-y-1 mt-3 text-zinc-400">
                      <li><span className="text-zinc-300">micro_chop</span> — Clean shuffled grains with 3ms fades</li>
                      <li><span className="text-zinc-300">crushed_shards</span> — 2–8 bit quantization per grain</li>
                      <li><span className="text-zinc-300">pitch_cloud</span> — ±4–24 semitones per grain</li>
                      <li><span className="text-zinc-300">verb_throws</span> — Reverb-tail grains</li>
                      <li><span className="text-zinc-300">glitch_bits</span> — Saturated (tanh) grains</li>
                      <li><span className="text-zinc-300">stutter_bits</span> — Loop-based stutter repeats with tape wow</li>
                      <li><span className="text-zinc-300">noisy_shards_1/2</span> — Noise-layered and filtered noise grains</li>
                      <li><span className="text-zinc-300">speed_fast/slow_grains</span> — 0.3–3× resample per grain</li>
                    </ul>
                  </div>
                </div>

                {/* Bitrot Dirt */}
                <div>
                  <h3 className="text-lg font-medium text-foreground mb-2">Bitrot Dirt</h3>
                  <span className="text-xs bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded">4 outputs</span>
                  <div className="mt-3 space-y-2 text-sm">
                    <p>
                      Degradation-focused preset applying combinations of downsampling (2–14×),
                      bitcrushing (2–8 bit), noise injection, tape wow, and bandpass filtering.
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
                          <td className="py-2 pr-4 text-zinc-300">crushed</td>
                          <td className="py-2 pr-4">Downsample (4–14×) → bitcrush (2–8 bit) → noise → bandpass → soft clip</td>
                        </tr>
                        <tr className="border-b border-zinc-900">
                          <td className="py-2 pr-4 text-zinc-300">degraded_wow</td>
                          <td className="py-2 pr-4">Downsample → tape wow → soft clip → lowpass → noise → Haas</td>
                        </tr>
                        <tr className="border-b border-zinc-900">
                          <td className="py-2 pr-4 text-zinc-300">broken_loop</td>
                          <td className="py-2 pr-4">Loop finder → extract → repeat → downsample → bitcrush → noise → wow → soft clip → lowpass → Haas</td>
                        </tr>
                        <tr className="border-b border-zinc-900">
                          <td className="py-2 pr-4 text-zinc-300">noise_artifact</td>
                          <td className="py-2 pr-4">Soft clip → bandpass → noise → DC block → tape wow → hard clamp</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Pitch Wreckage */}
                <div>
                  <h3 className="text-lg font-medium text-foreground mb-2">Pitch Wreckage</h3>
                  <span className="text-xs bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded">4 outputs</span>
                  <div className="mt-3 space-y-2 text-sm">
                    <p>
                      Aggressive pitch manipulation via linear resampling (preserves the pitch-shifted
                      artifacts of sample-rate conversion). Octave shifts are ±12–24 semitones.
                    </p>
                    <ul className="space-y-1 mt-3 text-zinc-400">
                      <li><span className="text-zinc-300">octave_down</span> — –12 to –24 st with saturation + lowpass</li>
                      <li><span className="text-zinc-300">octave_up</span> — +12 to +24 st with bandpass + reverb</li>
                      <li><span className="text-zinc-300">pitch_drift</span> — Multi-LFO + noise-modulated time-varying resample (±3–13 st), reverb, Haas</li>
                      <li><span className="text-zinc-300">dual_pitch</span> — ±18 st layers mixed 50/50 with distortion + delay</li>
                    </ul>
                  </div>
                </div>

                {/* Loop Extractor */}
                <div>
                  <h3 className="text-lg font-medium text-foreground mb-2">Loop Extractor</h3>
                  <span className="text-xs bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded">4 outputs</span>
                  <div className="mt-3 space-y-2 text-sm">
                    <p>
                      Uses heuristic energy analysis to find loop-worthy sections in the source audio.
                      The candidate finder slides a window across the waveform, scoring each position
                      on RMS, boundary correlation, transient content, and tail energy. The top
                      non-overlapping candidates are extracted and crossfaded.
                    </p>
                    <ul className="space-y-1 mt-3 text-zinc-400">
                      <li><span className="text-zinc-300">clean_loop</span> — Crossfaded loop with Haas + warm chain</li>
                      <li><span className="text-zinc-300">degraded_loop</span> — Pre-normalized then crushed, bitcrushed, noise-layered, widened</li>
                      <li><span className="text-zinc-300">ghost_loop</span> — Reverb + lowpass + stereo widen + Haas + warm</li>
                      <li><span className="text-zinc-300">driven_loop</span> — Saturation + delay + bandpass + DC block + Haas</li>
                    </ul>
                  </div>
                </div>

                {/* Impact / Riser Mutator */}
                <div>
                  <h3 className="text-lg font-medium text-foreground mb-2">Impact / Riser Mutator</h3>
                  <span className="text-xs bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded">4 outputs</span>
                  <div className="mt-3 space-y-2 text-sm">
                    <p>
                      Transient manipulation and riser construction. The convolution-based transient
                      smear is the heaviest DSP operation — input is capped at 5 seconds to maintain
                      reasonable performance.
                    </p>
                    <ul className="space-y-1 mt-3 text-zinc-400">
                      <li><span className="text-zinc-300">riser</span> — Reverse → fade in → soft clip → reverb → filter sweep (200 Hz → 8 kHz) → Haas → warm</li>
                      <li><span className="text-zinc-300">impact</span> — Resample –24 to –36 st → soft clip → highpass 40 Hz → reverb → warm</li>
                      <li><span className="text-zinc-300">smear</span> — Convolution reverb (exponential-noise IR, wet/dry mix, 0.5–3 s reverb time)</li>
                      <li><span className="text-zinc-300">filter_riser</span> — Reverse → filter sweep (50 Hz → 4–12 kHz) → soft clip → delay → Haas → warm</li>
                    </ul>
                  </div>
                </div>

                {/* Chaos Pack */}
                <div>
                  <h3 className="text-lg font-medium text-foreground mb-2">Chaos Pack</h3>
                  <span className="text-xs bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded">7 outputs</span>
                  <div className="mt-3 space-y-2 text-sm">
                    <p>
                      A curated multi-preset mashup. Runs 7 sub-recipes with adjusted chaos levels and
                      picks the most interesting output from each. Maximum entropy in a single download.
                    </p>
                    <ol className="list-decimal list-inside space-y-1 mt-3 text-sm text-zinc-400">
                      <li>Ghost pad from Ambient Stretch</li>
                      <li>Ghost hit from Ghost Reverse</li>
                      <li>Micro chop from Granular Shards</li>
                      <li>Pitch cloud from Granular Shards</li>
                      <li>Degraded loop from Loop Extractor</li>
                      <li>Riser from Impact / Riser Mutator</li>
                      <li>Octave-down oddity from Pitch Wreckage</li>
                    </ol>
                  </div>
                </div>

              </div>
            </section>

            {/* Chaos Parameter */}
            <section id="chaos">
              <h2 className="text-2xl font-semibold text-foreground mb-4">Chaos Parameter</h2>
              <p className="mb-4">
                The chaos knob is a single 0–1 float that simultaneously modulates every parameter in the
                active preset. It&apos;s not a simple &quot;more effect&quot; knob — it shifts the behavior of each
                DSP transform along a spectrum from subtle to extreme.
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
                      <td className="py-2 pr-4 text-zinc-300">Illegal Texture</td>
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
                Values are approximate — actual parameter ranges depend on the preset. Chaos also
                affects less obvious parameters: reverb decay time, filter cutoff frequencies, tape
                wow depth/rate, feedback amounts, noise levels, loop durations, and stereo width.
              </p>
            </section>

            {/* DSP Techniques */}
            <section id="dsp">
              <h2 className="text-2xl font-semibold text-foreground mb-4">DSP Techniques</h2>
              <p className="mb-6">
                Every transform is implemented in pure JavaScript/TypeScript using Float32Array
                buffers. No WebAudio nodes, no WASM, no external DSP libraries.
              </p>

              <div className="space-y-6">
                <div>
                  <h3 className="text-base font-medium text-foreground mb-1">WSOLA Time-Stretch</h3>
                  <p className="text-sm text-zinc-400">
                    Waveform-Similarity Overlap-Add. Splits the signal into 30 ms frames with a Hann
                    window, overlaps them at a hop ratio derived from the stretch factor, and re-granulates.
                    At extreme ratios (20×+), falls back to simple resample to avoid absurd intermediate
                    buffers. Source audio is capped at 60 s before stretching.
                  </p>
                </div>

                <div>
                  <h3 className="text-base font-medium text-foreground mb-1">Biquad Filters</h3>
                  <p className="text-sm text-zinc-400">
                    Direct Form II transposed implementation of lowpass, highpass, and bandpass filters.
                    Cutoff frequency is clamped to [20 Hz, Nyquist – 1 Hz]. Q factor is fixed at 0.707
                    (Butterworth) for lowpass/highpass; bandpass Q is derived from the bandwidth ratio.
                    Coefficients are pre-computed in the constructor and the filter state is per-instance.
                  </p>
                </div>

                <div>
                  <h3 className="text-base font-medium text-foreground mb-1">Schroeder Reverb</h3>
                  <p className="text-sm text-zinc-400">
                    Classic algorithmic reverb: 4 parallel comb filters at staggered delays (31, 37, 43,
                    53 ms) with feedback gain set by the decay parameter, followed by a cascaded all-pass
                    section at 5 ms to dense the response. Output is wet-only (the caller mixes with dry
                    if needed) and normalized to peak 1.0.
                  </p>
                </div>

                <div>
                  <h3 className="text-base font-medium text-foreground mb-1">Convolution Reverb</h3>
                  <p className="text-sm text-zinc-400">
                    O(n·k) direct convolution between the audio signal and an exponential-decay noise
                    impulse response. The IR is generated procedurally: white noise multiplied by an
                    exponential envelope, scaled to 0.3 peak. Input is capped at 5 seconds (~240k
                    samples) and the IR is capped at 3 seconds (~144k samples) to bound the worst-case
                    operation count. Used exclusively in the transient smear effect.
                  </p>
                </div>

                <div>
                  <h3 className="text-base font-medium text-foreground mb-1">Granular Synthesis</h3>
                  <p className="text-sm text-zinc-400">
                    The source is sliced at 4 window sizes (40, 80, 120, 200 ms) into overlapping grain
                    pools. Grains are shuffled using a Linear Congruential Generator seeded from the
                    source filename + chaos for deterministic output. Sequences are built by selecting N
                    grains from the pool, applying per-grain processing (pitch shift, bitcrush, reverb,
                    saturation, resample), then concatenating with small fades at boundaries to avoid
                    clicks.
                  </p>
                </div>

                <div>
                  <h3 className="text-base font-medium text-foreground mb-1">Haas Effect</h3>
                  <p className="text-sm text-zinc-400">
                    Each channel receives a random delay between 1 and 12 ms (configurable), creating
                    a precedence-effect stereo widening. The delays are randomized per-call, so every
                    sample gets a unique stereo offset. Combined with the warm chain (HP20 + LP60 +
                    soft clip), this produces the signature watchyourtemper® character applied to
                    ambient, ghost, and riser outputs.
                  </p>
                </div>

                <div>
                  <h3 className="text-base font-medium text-foreground mb-1">Loop Detection</h3>
                  <p className="text-sm text-zinc-400">
                    The heuristic loop finder slides a window (adaptive step: 0.25 s for short sources,
                    1.0 s for long) across the waveform at candidate durations (1, 2, 3, 4, 6, 8 s).
                    Each window is scored on 6 weighted metrics: RMS energy, peak-to-RMS ratio,
                    front-loaded energy, tail energy, and start/end boundary correlation. The top
                    non-overlapping candidates are selected; if none exceed the threshold, a fallback
                    middle-section window is used.
                  </p>
                </div>

                <div>
                  <h3 className="text-base font-medium text-foreground mb-1">Tape Wow &amp; Flutter</h3>
                  <p className="text-sm text-zinc-400">
                    Modulates a fractional delay line with a sinusoidal LFO. A single tone at the wow
                    rate creates the pitch wobble; the depth parameter controls deviation in samples.
                    Linear interpolation between integer sample positions keeps the modulation smooth.
                  </p>
                </div>

                <div>
                  <h3 className="text-base font-medium text-foreground mb-1">Downsample + Bitcrush</h3>
                  <p className="text-sm text-zinc-400">
                    Two-stage degradation: first a lowpass filter at Nyquist/downsampleRatio, then
                    zero-order-hold decimation. Bitcrushing follows by uniform quantization to N bits
                    (1–16), with N &ge; 16 passing through unchanged.
                  </p>
                </div>
              </div>
            </section>

            {/* Technical Specs */}
            <section id="specs">
              <h2 className="text-2xl font-semibold text-foreground mb-4">Technical Specs</h2>

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
                    <li>Max sample duration: 90 s</li>
                    <li>Normalization: –1 dBFS peak (0.89)</li>
                    <li>Always stereo (mono sources are duplicated)</li>
                  </ul>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                  <h3 className="text-foreground font-medium mb-2">Processing</h3>
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
                    <li>DSP: ~2,600 lines of pure TypeScript</li>
                    <li>35+ transform functions</li>
                    <li>Zero runtime dependencies for audio</li>
                  </ul>
                </div>
              </div>
            </section>

            {/* FAQ */}
            <section id="faq">
              <h2 className="text-2xl font-semibold text-foreground mb-4">FAQ</h2>
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium text-foreground mb-1">Does this upload my audio anywhere?</h3>
                  <p className="text-sm text-zinc-400">No. All processing happens in your browser tab. The app has no backend — it&apos;s a static site. Your files never leave your computer.</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-foreground mb-1">Can I use this offline?</h3>
                  <p className="text-sm text-zinc-400">Yes, after the first page load. The entire DSP engine is client-side JavaScript. No API calls are made at runtime.</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-foreground mb-1">Why is the transient smear slow at high chaos?</h3>
                  <p className="text-sm text-zinc-400">The smear uses direct convolution (O(n·k)), which at worst case processes ~240k samples against a ~144k-sample IR. On a modern laptop this takes 2–5 seconds. The input is capped at 5 seconds to prevent browser hangs.</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-foreground mb-1">Can I use my own sample rate?</h3>
                  <p className="text-sm text-zinc-400">Outputs use the sample rate of the source audio (decoded by the browser). Most browsers output 48 kHz, but the DSP handles any rate transparently.</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-foreground mb-1">Why are some outputs skipped?</h3>
                  <p className="text-sm text-zinc-400">If the processed audio has near-zero RMS or contains NaN values, it&apos;s skipped to avoid silent or corrupted WAV files. This can happen with extreme settings on very quiet source material.</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-foreground mb-1">What is the &quot;watchyourtemper&quot; character chain?</h3>
                  <p className="text-sm text-zinc-400">A signature processing chain: Haas-effect stereo widening (random 1–12 ms per-channel delay) followed by a warm chain (20 Hz highpass → 60 Hz lowpass → soft clip saturation → normalize). It&apos;s applied to ambient, ghost, and riser outputs across all presets.</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-foreground mb-1">Can I contribute a preset?</h3>
                  <p className="text-sm text-zinc-400">Yes. See the <a href="https://github.com/achuthanmukundan00/Resample-Lab/blob/main/CONTRIBUTING.md" className="text-accent hover:text-accent-glow underline">contributing guide</a> for the recipe API and conventions.</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-foreground mb-1">Is this AI?</h3>
                  <p className="text-sm text-zinc-400">No. Every sample is produced by explicit, deterministic DSP. No neural networks, no machine learning — just biquad filters, overlap-add, convolution, and other classic signal processing.</p>
                </div>
              </div>
            </section>

            {/* Developer Guide */}
            <section id="dev">
              <h2 className="text-2xl font-semibold text-foreground mb-4">Developer Guide</h2>

              <div className="space-y-6">
                <div>
                  <h3 className="text-base font-medium text-foreground mb-1">Local Development</h3>
                  <div className="bg-zinc-900 rounded-lg p-4 mt-2">
                    <pre className="text-xs text-zinc-400 overflow-x-auto"><code>git clone https://github.com/achuthanmukundan00/Resample-Lab.git
cd Resample-Lab/apps/web
pnpm install
pnpm dev        # → http://localhost:3000</code></pre>
                  </div>
                  <p className="text-sm text-zinc-400 mt-2">No backend, no database, no environment variables. The dev server starts in seconds.</p>
                </div>

                <div>
                  <h3 className="text-base font-medium text-foreground mb-1">Production Build</h3>
                  <div className="bg-zinc-900 rounded-lg p-4 mt-2">
                    <pre className="text-xs text-zinc-400 overflow-x-auto"><code>pnpm build      # static export → out/
pnpm start      # serve locally</code></pre>
                  </div>
                  <p className="text-sm text-zinc-400 mt-2">Outputs a fully self-contained static site. Deploy to Cloudflare Pages, Vercel, Netlify, S3, or any web server.</p>
                </div>

                <div>
                  <h3 className="text-base font-medium text-foreground mb-1">Project Structure</h3>
                  <div className="bg-zinc-900 rounded-lg p-4 mt-2">
                    <pre className="text-xs text-zinc-400 overflow-x-auto"><code>apps/web/
├── app/
│   ├── page.tsx           # Main UI (upload, presets, chaos, download)
│   └── docs/page.tsx      # This documentation page
├── components/            # React components (UploadDropzone, PresetCard,
│                         #  ChaosSlider, GenerateButton, PackStatusCard, etc.)
├── lib/dsp/               # DSP engine
│   ├── transforms.ts      # 35+ audio transform functions
│   ├── presets.ts         # 8 preset recipes
│   ├── packWorker.ts      # Web Worker entry point
│   ├── wav.ts             # WAV encoding
│   ├── zip.ts             # ZIP building
│   ├── constants.ts       # DSP limits
│   └── types.ts           # Shared types
├── public/                # Static assets
└── next.config.ts         # Static export config</code></pre>
                  </div>
                </div>

                <div>
                  <h3 className="text-base font-medium text-foreground mb-1">Adding a Transform</h3>
                  <p className="text-sm text-zinc-400 mb-2">
                    All transforms live in <code className="text-xs bg-zinc-800 px-1 rounded">transforms.ts</code> and follow a
                    consistent signature:
                  </p>
                  <div className="bg-zinc-900 rounded-lg p-4">
                    <pre className="text-xs text-zinc-400 overflow-x-auto"><code>{`// Input:  Float32Array[] channels, sample rate, params
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
}`}</code></pre>
                  </div>
                </div>

                <div>
                  <h3 className="text-base font-medium text-foreground mb-1">Architecture Notes</h3>
                  <ul className="list-disc list-inside space-y-1 text-sm text-zinc-400">
                    <li>Audio decoding uses the browser&apos;s native <code className="text-xs bg-zinc-800 px-1 rounded">AudioContext.decodeAudioData()</code></li>
                    <li>All DSP runs in a single Web Worker — no blocking the main thread</li>
                    <li>Progress is reported via <code className="text-xs bg-zinc-800 px-1 rounded">worker.postMessage()</code> — the UI renders a real-time progress bar</li>
                    <li>Each preset recipe declares its output count and categories in the registry at the bottom of <code className="text-xs bg-zinc-800 px-1 rounded">presets.ts</code></li>
                    <li>The <code className="text-xs bg-zinc-800 px-1 rounded">makeSample()</code> helper handles stereo conversion, validation, sanitization, and peak normalization</li>
                  </ul>
                </div>
              </div>
            </section>

          </div>
        </div>

        {/* Footer */}
        <footer className="border-t border-zinc-800 mt-16 pt-8 text-xs text-zinc-600">
          <p>
            <span className="text-accent">Resample</span>-Lab — MIT licensed. Built by{' '}
            <a href="https://github.com/achuthanmukundan00" className="text-zinc-400 hover:text-zinc-300">achuthanmukundan00</a>
            . DSP powered by Float32Array and coffee.
          </p>
        </footer>
      </div>
    </div>
  )
}
