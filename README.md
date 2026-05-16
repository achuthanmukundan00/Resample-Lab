<p align="center">
  <img src="docs/assets/logo-ascii.svg" alt="RESAMPLE LAB" width="680" />
</p>

<p align="center">
  <a href="https://resample-lab.pages.dev"><img src="https://img.shields.io/badge/🚀_LIVE-resample--lab.pages.dev-39ff14?style=for-the-badge&logo=cloudflare&logoColor=fff&labelColor=111" alt="Live Site" /></a>
  <a href="https://resample-lab.pages.dev/docs"><img src="https://img.shields.io/badge/📖_DOCS-read_now-00ff41?style=for-the-badge&logo=readthedocs&logoColor=fff&labelColor=111" alt="Docs" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/LICENSE-MIT-32cd32?style=for-the-badge&logo=opensourceinitiative&logoColor=fff&labelColor=111" alt="License: MIT" /></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=fff&labelColor=222" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Next.js-000000?style=flat-square&logo=next.js&logoColor=fff&labelColor=222" alt="Next.js" />
  <img src="https://img.shields.io/badge/Web_Audio-39ff14?style=flat-square&logo=webaudio&logoColor=fff&labelColor=222" alt="Web Audio" />
  <img src="https://img.shields.io/badge/DSP-8_presets-32cd32?style=flat-square&labelColor=222" alt="8 Presets" />
  <img src="https://img.shields.io/badge/AI-NONE-39ff14?style=flat-square&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNiIgaGVpZ2h0PSIxNiIgdmlld0JveD0iMCAwIDE2IDE2Ij48cmVjdCB4PSIyIiB5PSIyIiB3aWR0aD0iMTIiIGhlaWdodD0iMTIiIHJ4PSIxIiBmaWxsPSIjMzlmZjE0Ii8+PC9zdmc+&labelColor=222" alt="Zero AI" />
  <img src="https://img.shields.io/badge/PRs-welcome-00ff41?style=flat-square&logo=github&logoColor=fff&labelColor=222" alt="PRs Welcome" />
  <img src="https://img.shields.io/badge/Python-3776AB?style=flat-square&logo=python&logoColor=fff&labelColor=222" alt="Python" />
  <img src="https://img.shields.io/badge/pnpm-F69220?style=flat-square&logo=pnpm&logoColor=fff&labelColor=222" alt="pnpm" />
  <img src="https://img.shields.io/badge/Cloudflare-F6821F?style=flat-square&logo=cloudflare&logoColor=fff&labelColor=222" alt="Cloudflare" />
</p>

<br />

<p align="center">
  <em><b>Upload audio. Pick a preset. Dial in the chaos. Download your sample pack.</b></em>
</p>

<p align="center">
  <em>Stretched ambiences · Ghost reverses · Granular shards · Bitrot degradation · Pitch wreckage · Loop extraction · Impact risers · Chaos pack</em>
</p>

<br />

---

<p align="center">
  <video src="docs/assets/demo.webm" controls width="100%"></video>
</p>

---

## ⚡ Quickstart

```bash
git clone https://github.com/achuthanmukundan00/Resample-Lab.git
cd Resample-Lab/apps/web
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). No backend. No API keys. No database.

### ☁️ One-command deploy

```bash
pnpm build
npx wrangler pages deploy out --branch main
```

> <sub>Or connect to Cloudflare Pages → build: `cd apps/web && pnpm install && pnpm build`, output: `apps/web/out`</sub>

---

## 🧬 How it works

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

> *Everything runs in-browser via Web Workers. Float32Array math. No uploads. No API calls. No GPU needed.*

---

## 🎛️ Features

|     |     |
| --- | --- |
| 🎹 **8 DSP presets** | Ambient pads, ghost reverses, granular shards, bitrot, pitch wreckage, loop extraction, impact risers, chaos pack |
| 🌪️ **Chaos parameter** | Single knob: *Clean → Weird → Broken → Illegal Texture* |
| 🔒 **Fully local** | Web Workers process audio in-browser. Works offline after first load |
| 💀 **Zero AI** | All DSP is deterministic signal processing. No black boxes, no hallucinations |
| ⚡ **Static deployment** | One `pnpm build` → static export that deploys anywhere |

---

## 🎚️ Chaos Parameter

| Value | Label | Behavior |
| :---: | :--- | :--- |
| 0.00 | *Clean* | Subtle — 8× stretch, light reverb, minimal drive |
| 0.33 | *Weird* | Moderate — 12× stretch, noticeable artifacts, medium saturation |
| 0.66 | *Broken* | Aggressive — 16× stretch, heavy degradation, wide modulation |
| 1.00 | **Illegal Texture** | Maximum — 20× stretch, full reverb, extreme bitcrush, unstable LFO |

---

## 🧪 DSP Techniques

<sub>All processing runs in a Web Worker — raw `Float32Array` buffers, no AudioContext nodes, no WASM.</sub>

| Technique | Implementation |
| :--- | :--- |
| WSOLA Time‑Stretch | Overlap-add with Hann windowing, adaptive hop sizes |
| Biquad Filters | Direct-form II transposed — LP/HP/BP with configurable Q |
| Schroeder Reverb | 4 comb filters (31/37/43/53ms) + 2 all-pass sections |
| Convolution Reverb | O(n·k) with exponential-decay noise IR |
| Granular Synthesis | 4 window sizes (40–200ms), LCG shuffle, per-grain pitch shift |
| Tape Wow/Flutter | Multi‑harmonic LFO → fractional delay line |
| Downsample + Bitcrush | Pre‑filter → zero-order-hold → N‑bit quantization |
| Haas Effect | Per‑channel delay (1–12ms) stereo widening |
| Warm Chain | HP20 → LP60 → soft clip (tanh) → normalize (−1dBFS) |
| Loop Detection | Sliding-window energy analysis, boundary correlation scoring |

---

## 📂 Project Structure

```
Resample-Lab/
├── apps/web/                  # Next.js static site + DSP engine
│   ├── app/
│   │   ├── page.tsx           # Main UI
│   │   └── docs/page.tsx      # Full docs
│   ├── components/            # React components
│   ├── lib/dsp/               # Core DSP engine
│   │   ├── transforms.ts      # 35+ audio transforms
│   │   ├── presets.ts         # 8 preset recipes
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

## 📦 Outputs

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

## 🔬 Technical Limits

| Limit | Value |
| :--- | :--- |
| Max files per pack | 8 |
| Max input duration | 300s (5 min) |
| Max output duration | 90s |
| Input formats | WAV, AIFF, FLAC, MP3, M4A, OGG |
| Output format | 48kHz · 16‑bit WAV |
| Processing | Single Web Worker, sync Float32Array |

---

## 📜 License

<p align="center">
  <em>MIT — use it, fork it, ship it. If you make something cool, <a href="https://github.com/achuthanmukundan00/Resample-Lab">let me know</a>.</em>
</p>
