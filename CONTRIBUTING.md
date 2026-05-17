# Contributing

Issues, PRs, and forks welcome. Resample-Lab is an experimental DSP sandbox and all genuine help is appreciated.

---

## Project Overview

The entire DSP pipeline runs client-side in a Web Worker:

1. **`lib/dsp/transforms.ts`** — 35+ atomic transform functions operating on `Float32Array[]` channels (biquad filters, WSOLA stretch, convolution reverb, granular slicing, tape wow, bitcrushing, etc.)
2. **`lib/dsp/presets.ts`** — 8 preset recipes that chain transforms together, each returning `GeneratedSample[]` with category metadata
3. **`lib/dsp/packWorker.ts`** — Web Worker entry: receives decoded audio → runs a preset → encodes WAVs → builds ZIP → posts Blob back
4. **`lib/dsp/wav.ts`** — WAV encoding (48 kHz, 16-bit, interleaved)
5. **`lib/dsp/zip.ts`** — ZIP building without external dependencies

The UI (`app/page.tsx`) decodes uploaded audio via `AudioContext.decodeAudioData()`, passes `Float32Array` buffers to the worker, and renders progress/status from worker messages.

---

## Adding a Preset

1. Write the recipe function in `presets.ts`:
   ```typescript
   function myPreset(
     files: AudioBufferData[],
     chaos: number,
     onProgress?: (v: number, msg: string) => void,
   ): GeneratedSample[] {
     // Use transforms from * as T
     // Ensure stereo: const stereo = ensureStereo(src.channels);
     // Build each output with makeSample(filename, channels, sr, category, description)
     // Return outputs.filter((s): s is GeneratedSample => s !== null)
   }
   ```
2. Register it in `RECIPE_REGISTRY` at the bottom of `presets.ts`:
   ```typescript
   my_preset: { fn: myPreset, outputCount: N, categories: [...] },
   ```
3. Add the preset metadata in `lib/presets.ts` (name, description, output count, categories)
4. Add an icon in `getPresetIcon()` in the same file

### Key constraints

- **Float32Array only** — never allocate Float64 for audio data. All transforms return `Float32Array[]`.
- **No WebAudio nodes** — all DSP is raw array math in the worker. No `AudioContext` processing, no `AudioNode` connections.
- **validateOutput + ensureSanitary** — every sample goes through RMS validation (rejects silence/NaN) and peak normalization (–1 dBFS headroom)
- **Progress reporting** — for recipes with multiple sub-recipes, call `onProgress?.(value, message)` between them so the UI stays responsive
- **Deterministic RNG** — use `seededRng(hashCode(stem) + ...)` for repeatable grain ordering

---

## DSP Transform Conventions

```typescript
// All transforms take Float32Array[] and return new Float32Array[]
// (no mutation of inputs)
function transform(channels: Float32Array[], ...params): Float32Array[];

// Filter helpers are classes extending BiquadFilter
// applyFilter() wraps per-channel instantiation
```

Transforms at 30,000 ft:

| Group     | Functions                                                                                                   |
| --------- | ----------------------------------------------------------------------------------------------------------- |
| Filters   | `lowpass`, `highpass`, `bandpass`, `dcBlock`, `filterSweep`                                                 |
| Dynamics  | `softClip`, `normalizePeak`, `ensureSanitary`                                                               |
| Time      | `wsolaStretch`, `resample`, `pitchShiftGrain`, `resampleChannels`                                           |
| Delay     | `delayEcho`, `simpleReverb`, `haasEffect`                                                                   |
| Degrade   | `bitcrush`, `downsample`, `addNoise`, `tapeWow`                                                             |
| Spatial   | `stereoWiden`, `haasEffect`                                                                                 |
| Granular  | `sliceAudio`, `fadeIn`, `fadeOut`, `applyFades`                                                             |
| Loop      | `findLoopCandidates`, `analyzeWindow`, `scoreLoopCandidate`, `extractLoopWithCrossfade`, `repeatToDuration` |
| Character | `finalWarm` (HP20 + LP60 + soft clip), `haasEffect`                                                         |
| Utility   | `interleave`, `capDuration`, `makeAudioData`, `validateOutput`                                              |

---

## Issues

Bug reports, feature ideas, and questions are all fine. Be specific:

- What you did, what you expected, what happened instead
- If it's a crash, paste the error
- If it's a feature request, explain the _why_ — what musical problem does it solve?

## Pull Requests

Keep them focused. A good PR:

- Addresses one thing
- Has a descriptive title and summary
- Doesn't mix refactors with bugfixes unless they're the same change
- Runs `pnpm build` and checks for TypeScript errors
- If it touches the UI, test in a browser

If your PR is large, open an issue first so we can talk about direction before you sink time into code.

## AI-Generated Contributions

This project is explicitly **non-AI** in its core processing — raw DSP math, no models. That doesn't mean AI tooling is banned, but here's the rule:

**Don't submit clanker slop.**

If you use an LLM to write code, that's fine, but _you_ are responsible for what it produces. Review it. Understand it. Make sure it's correct, necessary, and follows the project's style. PRs that are obviously vomited out with no human review will be closed.

Good AI-assisted contribution: you describe what needs to change, the tool generates a draft, you clean it up, test it, and submit something thoughtful.

Clanker slop: a 500-line PR with hallucinated imports, broken logic, and a commit message of "fix: update code" that the submitter clearly never read.

Be the first kind, not the second.

## Code of Conduct

Don't be a jerk. That's it.
