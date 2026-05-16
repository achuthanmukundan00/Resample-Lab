<div align="center">
<svg xmlns="http://www.w3.org/2000/svg" width="600" height="140" viewBox="0 0 600 140">
  <defs>
    <linearGradient id="toxic" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#39ff14" />
      <stop offset="60%" stop-color="#39ff14" />
      <stop offset="100%" stop-color="#00cc00" />
    </linearGradient>
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="3" result="blur1"/>
      <feGaussianBlur stdDeviation="8" result="blur2"/>
      <feMerge>
        <feMergeNode in="blur2"/>
        <feMergeNode in="blur1"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
  <text x="50%" y="38%" text-anchor="middle" dominant-baseline="central"
        font-family="'Courier New', Courier, monospace" font-weight="700" font-size="56"
        fill="url(#toxic)" filter="url(#glow)">RESAMPLE</text>
  <text x="50%" y="74%" text-anchor="middle" dominant-baseline="central"
        font-family="'Courier New', Courier, monospace" font-weight="700" font-size="56"
        fill="url(#toxic)" filter="url(#glow)">LAB</text>
</svg>

<p>
  <a href="https://resample-lab.pages.dev">Live app</a> ·
  <a href="https://resample-lab.pages.dev/docs">Docs</a> ·
  <a href="LICENSE">MIT license</a>
</p>

<p align="center">
  <sub>TypeScript · Next.js · Web Audio · deterministic DSP · static deploy</sub>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/License-MIT-39ff14?logo=opensourceinitiative&logoColor=white" alt="License: MIT" />
  <img src="https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Next.js-000000?logo=nextdotjs&logoColor=white" alt="Next.js" />
  <img src="https://img.shields.io/badge/Web_Audio-FF6B6B?logo=audacity&logoColor=white" alt="Web Audio" />
</p>
</div>

<p align="center">
  <em>Upload audio. Pick a preset. Dial in the chaos. Download your sample pack.</em>
</p>

<p align="center">
  <em>Stretched ambiences · Ghost reverses · Granular shards · Bitrot degradation · Pitch wreckage · Loop extraction · Impact risers · Chaos pack</em>
</p>

<br />

---

<p align="center">
  <video src="docs/assets/demo.webm" controls width="100%"></video>
  <br/>
  <sub>Demo video — generate locally via <code>node scripts/demo-recorder.mjs --record</code> (see "Demo recorder" below)</sub>
</p>

---

## Quickstart

```bash
git clone https://github.com/achuthanmukundan00/Resample-Lab.git
cd Resample-Lab/apps/web
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). No backend. No API keys. No database.

### One-command deploy

```bash
pnpm build
npx wrangler pages deploy out --branch main
```

> <sub>Or connect to Cloudflare Pages → build: `cd apps/web && pnpm install && pnpm build`, output: `apps/web/out`</sub>

---

## Developer Workflows

### Run tests

```bash
npx tsx apps/web/lib/dsp/__tests__/dsp.test.ts
```

114+ DSP tests: transforms, finishing rack, tape, delays, reverbs, granular engine, stereo/mono compatibility, audio analysis.

### Render audit (listen-test across all presets)

```bash
# Point at a directory of WAV files
npx tsx scripts/render-dsp-corpus.ts --input ./my-samples

# Custom output dir, chaos values, file limit
npx tsx scripts/render-dsp-corpus.ts --input ./my-samples --output ./audit --chaos 0.0,0.5,1.0 --limit 3
```

Generates every preset × every file × 3 chaos levels × 4 length modes. Output goes to `.render-audit/` with `report.json` and `report.md`.

### Demo recorder (Playwright)

```bash
# One-time setup
pnpm add -D playwright
npx playwright install

# Terminal 1: start dev server
pnpm dev

# Terminal 2: smoke test or record
node scripts/demo-recorder.mjs          # quick smoke test
node scripts/demo-recorder.mjs --record  # record demo.webm
```

Requires `test.wav` at the repo root. The recorded video saves to `docs/assets/demo.webm`.

---

## How it works

```
┌──────────┐    ┌──────────┐    ┌──────────────┐    ┌───────────┐
│  Upload  │ -> │  Preset  │ -> │  Web Worker  │ -> │ Download  │
│  audio   │    │  select  │    │  DSP engine  │    │  ZIP pack │
└──────────┘    └──────────┘    └──────────────┘    └───────────┘
                      ↑
               ┌──────┴──────┐
               │ Chaos knob  │
               │ 0.0 → 1.0  │
               └─────────────┘
```

> _Everything runs in-browser via Web Workers. Float32Array math. No uploads. No API calls. No GPU needed._

---

## Features

|                       |                                                                                                                   |
| --------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **8 DSP presets**     | Ambient pads, ghost reverses, granular shards, bitrot, pitch wreckage, loop extraction, impact risers, chaos pack |
| **Chaos parameter**   | Single knob: _Clean → Weird → Broken → Illegal Texture_                                                           |
| **Length modes**      | Short (15s), Medium (45s), Long (90s), Absurd (120s) — control output duration                                    |
| **Fully local**       | Web Workers process audio in-browser. Works offline after first load                                              |
| **Zero AI**           | All DSP is deterministic signal processing. No black boxes, no hallucinations                                     |
| **Static deployment** | One `pnpm build` → static export that deploys anywhere                                                            |

---

## Chaos Parameter

| Value | Label               | Behavior                                                           |
| :---: | :------------------ | :----------------------------------------------------------------- |
| 0.00  | _Clean_             | Subtle — 8× stretch, light reverb, minimal drive                   |
| 0.33  | _Weird_             | Moderate — 12× stretch, noticeable artifacts, medium saturation    |
| 0.66  | _Broken_            | Aggressive — 16× stretch, heavy degradation, wide modulation       |
| 1.00  | **Illegal Texture** | Maximum — 20× stretch, full reverb, extreme bitcrush, unstable LFO |

---

## Length Modes

| Mode     | Max Duration | Use Case                              |
| :------- | :----------- | :------------------------------------ |
| **Short**   | 15s          | Quick one-shots, tight loops          |
| **Medium**  | 45s          | Versatile default for most material   |
| **Long**    | 90s          | Extended pads, ambient tails          |
| **Absurd**  | 120s         | Maximal drones, large file sizes      |

> Each preset has a default mode tuned to its character. Override it in the UI.
> **Absurd mode** can produce files over 20 MB each and large ZIP downloads.

---

## DSP Techniques

<sub>All processing runs in a Web Worker — raw `Float32Array` buffers, no AudioContext nodes, no WASM.</sub>

| Technique             | Implementation                                                |
| :-------------------- | :------------------------------------------------------------ |
| WSOLA Time‑Stretch    | Overlap-add with Hann windowing, adaptive hop sizes           |
| Biquad Filters        | Direct-form II transposed — LP/HP/BP with configurable Q      |
| Schroeder Reverb      | 4 comb filters (31/37/43/53ms) + 2 all-pass sections          |
| Convolution Reverb    | O(n·k) with exponential-decay noise IR                        |
| Granular Synthesis    | 4 window sizes (40–200ms), LCG shuffle, per-grain pitch shift |
| Tape Wow/Flutter      | Multi‑harmonic LFO → fractional delay line                    |
| Downsample + Bitcrush | Pre‑filter → zero-order-hold → N‑bit quantization             |
| Haas Effect           | Per‑channel delay (1–12ms) stereo widening                    |
| Warm Chain            | HP20 → LP60 → soft clip (tanh) → normalize (−1dBFS)           |
| Loop Detection        | Sliding-window energy analysis, boundary correlation scoring  |

---

## Project Structure

```
Resample-Lab/
├── apps/web/                  # Next.js static site + DSP engine
│   ├── app/
│   │   ├── page.tsx           # Main UI
│   │   └── docs/page.tsx      # Full docs
│   ├── components/            # React components (ChaosSlider, LengthModeSelector, etc.)
│   ├── lib/dsp/               # Core DSP engine
│   │   ├── transforms.ts      # 35+ audio transforms
│   │   ├── presets.ts         # 8 preset recipes
│   │   ├── finish.ts          # Finishing rack (DC block, EQ, limiter)
│   │   ├── tape.ts            # Tape emulation (wow, loss, head bump)
│   │   ├── delay.ts           # Delay effects (mono, ping-pong, diffusion)
│   │   ├── reverb.ts          # Reverb engines (dark, hall, metallic)
│   │   ├── granular.ts        # Granular synthesis (cloud, freeze, swarm)
│   │   ├── analysis.ts        # Audio analysis utilities (peak, RMS, clipping)
│   │   ├── packWorker.ts      # Web Worker entry
│   │   ├── wav.ts             # WAV encoding
│   │   ├── zip.ts             # ZIP builder
│   │   ├── constants.ts       # Centralized limits
│   │   └── types.ts           # Shared types
│   └── public/                # Static assets
├── docs/                      # Operational docs & assets
├── examples/                  # Example audio
├── infra/                     # Docker compose
└── CONTRIBUTING.md
```

---

## Outputs

```
{source}__{preset}__chaos{nn}.zip
└── samples/
    ├── ambience/     · Ambient pads, washes, textures
    ├── one-shot/     · Impacts, hits, transients
    ├── loop/         · Rhythmic, gated, extracted loops
    ├── oddity/       · Degraded, wrecked, unstable artifacts
    └── granular/     · Sliced, shuffled, pitch-shifted grains
```

---

## Technical Limits

| Limit               | Value                                         |
| :------------------ | :-------------------------------------------- |
| Max files per pack  | 8                                             |
| Max input duration  | 300s (5 min)                                  |
| Max output duration | 15–120 s (selectable via Length mode)         |
| Input formats       | WAV, AIFF, FLAC, MP3, M4A, OGG                |
| Output format       | 16‑bit WAV at source sample rate              |
| Processing          | Single Web Worker, sync Float32Array          |
| Tests               | 114+ (npx tsx apps/web/lib/dsp/__tests__/dsp.test.ts) |

---

## License

<p align="center">
  <em>MIT — use it, fork it, ship it. If you make something cool, <a href="https://github.com/achuthanmukundan00/Resample-Lab">let me know</a>.</em>
</p>
