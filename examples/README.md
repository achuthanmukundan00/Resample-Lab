# Example Assets

Source audio and generated output examples for Resample-Lab.

---

## Source Audio

Drop your own WAV/AIFF/FLAC/MP3/M4A/OGG files into `input/` for testing. Good source material:

| Type                   | Why                                                           | Duration  |
| ---------------------- | ------------------------------------------------------------- | --------- |
| **Vocal phrase**       | Formant-rich, great for ghost reverses and granular shards    | 2–10 s    |
| **Kick drum**          | Transient-heavy, perfect for impact risers and pitch wreckage | 0.5–2 s   |
| **Field recording**    | Texture-rich, ideal for ambient stretch and bitrot dirt       | 10–60 s   |
| **Melodic loop**       | Tonal material for loop extraction and pitch drift            | 4–16 bars |
| **Foley / percussion** | Complex transients for granular and stutter effects           | 1–5 s     |

## Generated Outputs

Place generated sample packs in `output/` for reference. Each subdirectory corresponds to a preset:

```
output/
├── ambient-stretch/     # Stretched beds, reverse smear, ghost pads, reverb washes
├── ghost-reverse/       # Reverse tails, bandpassed hits, filtered pre-echoes
├── granular-shards/     # Micro-chops, pitch clouds, verb throws, stutter bits
├── bitrot-dirt/         # Crushed textures, degraded wow, broken loops
├── pitch-wreckage/      # Octave shifts, pitch drift, dual-layer mixes
├── loop-extractor/      # Clean / degraded / ghost / driven loop variants
├── impact-riser/        # Filter sweeps, pitched impacts, transient smears
└── chaos-pack/          # Curated multi-preset mashups
```

## Note

Audio files are not included in the repository to keep clone sizes small. Drop your own source files into `input/` and generated packs into `output/` for local reference.
