<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/achuthanmukundan00/Resample-Lab/main/apps/web/public/wyt-logo.png">
  <img alt="Resample-Lab" src="https://raw.githubusercontent.com/achuthanmukundan00/Resample-Lab/main/apps/web/public/wyt-logo.png" width="80" height="80">
</picture>

# Resample-Lab

**Non-AI audio mutation lab. Turn any sound into a sample pack — entirely in your browser.**

Upload audio, pick a DSP preset, dial in the chaos. Your browser runs the processing — WSOLA time-stretch, granular synthesis, biquad filters, convolution reverb, tape wow, bitcrushing, Haas-effect stereo widening, and more. Nothing is uploaded. No API calls. No GPU needed. Just Float32Array math and Web Workers.

> **[→ Try it live](https://resample-lab.pages.dev)** &nbsp;|&nbsp; [→ Full documentation](https://resample-lab.pages.dev/docs) &nbsp;|&nbsp; [→ Contributing](CONTRIBUTING.md)

---

## Features

- **8 distinct DSP presets** — ambient pads, ghost reverses, granular shards, bitrot degradation, pitch wreckage, loop extraction, impact risers, and the chaos pack (curated multi-recipe)
- **Chaos parameter** — a single knob from *Clean* → *Weird* → *Broken* → *Illegal Texture*, modulating every parameter across the entire DSP chain
- **Fully local** — Web Workers process Float32Array audio in-browser. Your source files never touch a server. Works offline after first load.
- **Watchyourtemper® character chain** — every ambient, ghost, and riser output runs through Haas-effect stereo widening + a warm chain (20 Hz highpass, 60 Hz lowpass, soft clip saturation)
- **Zero AI** — all DSP is deterministic signal processing. No black boxes, no hallucinations, no "we'll fix it in the model."
- **Static deployment** — one `pnpm build` produces a static export that deploys anywhere (Cloudflare Pages, Vercel, S3, etc.)

---

## Presets

| Preset | Outputs | What it does |
|--------|---------|-------------|
| **Ambient Stretch Lab** | 5 | WSOLA time-stretch (8–20×), Schroeder reverb, tape wow, lowpass filter sweep, reverse smear with delay, ghost pads with stereo widening, reverse reverb wash |
| **Ghost Reverse Lab** | 4 | Reverse tails with feedback delay, bandpass-filtered ghost hits with reverb, highpass pre-echoes with tape wow, distorted reverse pre-impacts |
| **Granular Shards** | 10 | Slice/shuffle/reassemble at 4 window sizes (40–200ms), pitch-shifted clouds (±24 semitones), bitcrushed fragments, reverb throws, stutter repeats, noise-layered grains, speed variants |
| **Bitrot Dirt** | 4 | Multi-stage downsample (2–14×), bitcrush (2–8 bit), noise layering, tape wow/flutter, bandpass filtering, saturation, degraded loop extraction with full degrade chain |
| **Pitch Wreckage** | 4 | Octave-down resample (–12 to –24 st) with saturation, octave-up bandpass (+12 to +24 st), unstable pitch drift (LFO + noise modulation), dual-layer ±18 st mix with distortion |
| **Loop Extractor** | 4 | Heuristic candidate finder using energy analysis + boundary correlation scoring, crossfade smoothing, repeat-to-duration, with clean/degraded/ghost/driven variants |
| **Impact / Riser Mutator** | 4 | Reversed risers with filter sweep, pitch-dropped impacts (–24 to –36 st), transient smear via convolution reverb, long filter sweep risers with delay |
| **Chaos Pack** | 7 | Curated multi-recipe: takes the most interesting output from each preset and combines them — maximum entropy in one ZIP |

---

## Chaos Parameter

The chaos knob is a single 0–1 float that modulates every parameter in the DSP chain simultaneously:

| Value | Label | Behavior |
|-------|-------|----------|
| 0.00 | Clean | Subtle processing: 8× stretch, light reverb, minimal drive |
| 0.33 | Weird | Moderate: 12× stretch, noticeable artifacts, medium saturation |
| 0.66 | Broken | Aggressive: 16× stretch, heavy degradation, wide modulation |
| 1.00 | Illegal Texture | Maximum: 20× stretch, full reverb, extreme bitcrush/downsample, unstable LFO |

Internally, chaos is applied as `baseValue + chaos * range` across stretch ratios, filter cutoffs, feedback amounts, reverb decay times, drive levels, bit depths, downsampling factors, pitch ranges, and modulation depths. Each preset also seeds a deterministic RNG from the source filename + chaos value for reproducible grain ordering and stochastic variation.

---

## DSP Techniques

All processing runs in a Web Worker using raw `Float32Array` buffers — no AudioContext processing, no WebAudio nodes, no WASM dependencies:

| Technique | Implementation |
|-----------|---------------|
| **WSOLA Time-Stretch** | Overlap-add with Hann windowing, adaptive hop sizes, linear interpolation at extreme ratios |
| **Biquad Filters** | Direct-form II transposed: lowpass, highpass, bandpass with configurable Q |
| **Schroeder Reverb** | 4 parallel comb filters (31/37/43/53 ms) + 2 cascaded all-pass sections |
| **Convolution Reverb** | O(n·k) naive convolution with exponential-decay noise IR, wet/dry mix (capped to 5s input for performance) |
| **Granular Synthesis** | Slice at 4 window sizes (40/80/120/200ms), shuffle with LCG PRNG, per-grain pitch shift via linear resample |
| **Tape Wow/Flutter** | Sinusoidal + multi-harmonic LFO modulating a fractional delay line with linear interpolation |
| **Downsample + Bitcrush** | Pre-filter with lowpass at Nyquist/factor, then zero-order-hold, then uniform quantization at N-bit resolution |
| **Haas Effect** | Random per-channel delay (1–12 ms) for precedence-effect stereo widening |
| **Warm Chain** | Highpass (20 Hz) → lowpass (60 Hz) → soft clip (tanh saturation) → normalize (–1 dBFS) |
| **Loop Detection** | Sliding-window energy analysis, boundary correlation scoring, non-overlapping candidate selection with fallback |
| **DC Blocking** | Single-pole IIR highpass at 30 Hz cutoff |

---

## Quickstart

```bash
git clone https://github.com/achuthanmukundan00/Resample-Lab.git
cd Resample-Lab/apps/web
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). No backend. No API keys. No database.

### Build for production

```bash
pnpm build    # outputs to out/
pnpm start    # serves the static export locally
```

### Deploy to Cloudflare Pages

```bash
npx wrangler pages deploy out --branch main
```

Or connect your GitHub repo to Cloudflare Pages dashboard — build command: `cd apps/web && pnpm install && pnpm build`, output directory: `apps/web/out`.

---

## Project Structure

```
Resample-Lab/
├── apps/web/                  # Next.js static site + DSP engine
│   ├── app/
│   │   ├── page.tsx           # Main UI (upload, presets, chaos, download)
│   │   └── docs/page.tsx      # Full documentation page
│   ├── components/            # React components
│   ├── lib/dsp/               # DSP engine (the core)
│   │   ├── transforms.ts      # 35+ audio transform functions
│   │   ├── presets.ts         # 8 preset recipes orchestrating transforms
│   │   ├── packWorker.ts      # Web Worker entry point
│   │   ├── wav.ts             # WAV encoding
│   │   ├── zip.ts             # ZIP building
│   │   ├── constants.ts       # Centralized limits
│   │   └── types.ts           # Shared types
│   └── public/                # Static assets
├── docs/                      # Operational docs
├── examples/                  # Example assets
└── CONTRIBUTING.md
```

---

## Output Structure

Downloaded ZIPs are organized by category:

```
{source}__{preset}__chaos{nn}.zip
└── samples/
    ├── ambience/     # Ambient pads, washes, textures
    ├── one-shot/     # Impacts, hits, transient-heavy sounds
    ├── loop/         # Rhythmic/gated/extracted loops
    ├── oddity/       # Degraded, wrecked, unstable artifacts
    └── granular/     # Sliced, shuffled, pitch-shifted grains
```

No `manifest.json` in the zip — all metadata is displayed in the browser UI before download.

---

## Technical Limits

| Limit | Value |
|-------|-------|
| Max files per pack | 8 |
| Max duration per file | 300 s (5 min) |
| Max output sample duration | 90 s |
| Supported input formats | WAV, AIFF, FLAC, MP3, M4A, OGG |
| Output format | 48 kHz, 16-bit WAV |
| Normalization headroom | –1 dBFS (0.89 peak) |
| Processing | Single Web Worker, synchronous Float32Array |

---

## License

MIT — use it, fork it, ship it. If you make something cool, [let me know](https://github.com/achuthanmukundan00/Resample-Lab).
