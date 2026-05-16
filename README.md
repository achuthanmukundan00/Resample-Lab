# Resample-Lab

**Upload audio → pick a mutation preset → download a sample pack.**

All processing happens locally using non-AI DSP (ffmpeg + numpy/scipy). Nothing leaves your machine.

---

## Quickstart

```bash
git clone https://github.com/achuthanmukundan00/Resample-Lab.git
cd Resample-Lab

# Backend
cd apps/api && python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt
uvicorn app.main:app --reload  # → http://localhost:8000

# Frontend (new terminal, from repo root)
pnpm dev  # → http://localhost:3000
```

**Prerequisites:** `ffmpeg` (`brew install ffmpeg`), Python 3.10+, Node.js 20+, pnpm.

---

## Usage

1. Upload audio (WAV, AIFF, FLAC, MP3, M4A, OGG)
2. Choose a mutation preset (Ambient Stretch, Granular Shards, Bitrot Dirt, etc.)
3. Set chaos level (Clean → Weird → Broken → Illegal Texture)
4. Click **Generate Sample Pack** — processing runs in the background
5. Download a ZIP of organized samples + manifest

## API

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/health` | Health check |
| GET | `/api/capabilities` | Available presets, tools, limits |
| POST | `/api/packs` | Upload audio + create pack |
| GET | `/api/packs/{id}` | Pack status / manifest |
| GET | `/api/packs/{id}/download` | Download ZIP |
| DELETE | `/api/packs/{id}` | Delete pack |

## Generated ZIP

```
pack-{name}.zip
├── manifest.json          # Complete output manifest
├── tools.json             # Detected tools & versions
├── README.txt             # Generation notes
└── samples/{categories}/  # WAV files organized by type
```

## Smoke Test

```bash
cd apps/api
python3 generate-test-audio.py
bash smoke-pack.sh
```

## Deployment

See [docs/deployment.md](docs/deployment.md) and [docs/LAUNCH_CHECKLIST.md](docs/LAUNCH_CHECKLIST.md).

## License

MIT
