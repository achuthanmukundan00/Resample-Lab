
<div align="center">
  <h1>RESAMPLE LAB</h1> 
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

<p align="center">
  <video
    src="https://raw.githubusercontent.com/achuthanmukundan00/Resample-Lab/main/docs/assets/demo.webm"
    controls
    muted
    width="100%"
  >
    Your browser does not support the video tag.
  </video>
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

## Who this is for

### Music producers

Resample-Lab turns a single sample into a complete sample pack. Drop in a drum hit, a synth stab, a vocal phrase, or a field recording — the DSP engine generates 8 variants across five categories: ambiences, one-shots, loops, oddities, and granular textures.

- **Sound designers** — stretch, degrade, and smear a source into unrecognizable territory with the chaos knob
- **Beatmakers** — extract loops, generate risers, build impact one-shots from any transient
- **Ambient producers** — create 90-second drones from a 2-second piano note
- **Live performers** — pre-generate texture packs for a set. Everything runs locally, no internet needed

No AI. No cloud uploads. Deterministic DSP — the same source + preset + chaos value always gives the same output.

### Developers

The DSP pipeline is a pure TypeScript signal processing chain running in a Web Worker. See [How it works](#how-it-works) for the architecture. If you want to add a preset, fix a transform, or improve performance, start with [CONTRIBUTING.md](CONTRIBUTING.md).

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

114 DSP tests: transforms, finishing rack, tape, delays, reverbs, granular engine, stereo/mono compatibility.

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

# Terminal 2: record the demo
node scripts/demo-recorder.mjs          # records demo.webm to docs/assets/
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

> Each preset has a default mode tuned to its character. Absurd ambient stretches, short one-shots, medium loops.
> **Absurd mode** can produce files over 20 MB each and large ZIP downloads.

---

## DSP Techniques

<sub>All processing runs in a Web Worker — raw `Float32Array` buffers, no AudioContext nodes, no WASM.</sub>

### Pipeline

```
source audio → mutation → tape/tone → delay/reverb → finishing rack → output
                  ↑            ↑            ↑               ↑
             Chaos lanes:  degradation   space         finish
             mutation      modulation    stereo        tail
```

Every preset output flows through this 5-stage pipeline. Chaos maps into 8
per-preset lanes that control how aggressively each stage operates.

| Technique             | Implementation                                                                     |
| :-------------------- | :--------------------------------------------------------------------------------- |
| WSOLA Time‑Stretch    | Overlap-add with Hann windowing, adaptive hop sizes                                |
| Biquad Filters        | Direct-form II transposed — LP/HP/BP with configurable Q                           |
| Finishing Rack        | Trim silence → DC block → EQ profile → stereo width → soft clip → limiter → fades  |
| Tape Emulation        | 6 profiles (subtle→destroyed): DC block, head bump, tape loss, tone tilt, wow      |
| Modulated Reverbs     | 5 engines: dark room, modulated hall, metallic, reverse bloom, convolution smear   |
| Delay Effects         | 5 types: mono, ping-pong, diffusion/allpass, reverse, multi-tap — all with tails   |
| Granular Cloud        | Overlap-add with Hann/Tukey envelopes, pan/pitch/reverse per grain                 |
| Granular Shards       | 4 window sizes (40–200ms), LCG shuffle, per-grain processing                       |
| Downsample + Bitcrush | Pre‑filter → zero-order-hold → N‑bit quantization                                  |
| Haas Effect           | Per‑channel delay (1–12ms) stereo widening                                         |
| Loop Detection        | Sliding-window energy analysis, boundary correlation scoring                       |

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
│   │   ├── transforms.ts      # 40+ audio transforms
│   │   ├── presets.ts         # 8 preset recipes
│   │   ├── finish.ts          # Finishing rack (DC block, EQ, limiter)
│   │   ├── tape.ts            # Tape emulation (wow, loss, head bump)
│   │   ├── delay.ts           # Delay effects (mono, ping-pong, diffusion)
│   │   ├── reverb.ts          # Reverb engines (dark, hall, metallic)
│   │   ├── granular.ts        # Granular synthesis (cloud, freeze, swarm)
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
| Tests               | 114 (npx tsx apps/web/lib/dsp/__tests__/dsp.test.ts) |

---

## License

<p align="center">
  <em>MIT — use it, fork it, ship it. If you make something cool, <a href="https://github.com/achuthanmukundan00/Resample-Lab">let me know</a>.</em>
</p>
