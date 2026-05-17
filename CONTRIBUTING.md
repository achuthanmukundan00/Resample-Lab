# Contributing

Issues, PRs, and forks welcome. Resample-Lab is an experimental DSP sandbox and all genuine help is appreciated.

---

## Project Overview

The entire DSP pipeline runs client-side in a Web Worker:

1. **`lib/dsp/transforms.ts`** — 40+ atomic transform functions: biquad filters, WSOLA, convolution, bitcrush, tape wow, DC block, fades, etc.
2. **`lib/dsp/finish.ts`** — Finishing rack applied to every output: trim silence, DC block, EQ profiles, stereo width, soft clip, peak limiter, normalize, fades, tail extend. Also defines chaos lane mapper and length modes.
3. **`lib/dsp/tape.ts`** — Tape-style tone/filter/loss from first principles: 6 profiles (subtle→destroyed), DC blocker, head bump, tape loss (speed/age HF rolloff), tone tilt, wow/flutter, soft saturation.
4. **`lib/dsp/delay.ts`** — 5 delay types: mono, ping-pong, diffusion/allpass, reverse, multi-tap — all with filtered feedback, bounded gain, rendered tails.
5. **`lib/dsp/reverb.ts`** — 5 reverb engines: dark room, modulated hall, dirty metallic, reverse bloom, convolution smear — all with damping, stereo spread, tail rendering.
6. **`lib/dsp/granular.ts`** — Two-mode granular engine: shard mode (concatenative) and cloud mode (overlap-add with Hann/Tukey envelopes). Includes freeze texture, reverb bloom, delay swarm.
7. **`lib/dsp/presets.ts`** — 8 preset recipes that chain mutation → tape → delay/reverb → finishing rack, each returning `GeneratedSample[]` with category metadata.
8. **`lib/dsp/packWorker.ts`** — Web Worker entry: receives decoded audio → runs a preset → encodes WAVs → builds ZIP → posts Blob back.
9. **`lib/dsp/wav.ts`** — WAV encoding (source sample rate, 16-bit, interleaved).
10. **`lib/dsp/zip.ts`** — ZIP builder (stored entries, no compression).

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
- **validateOutput + ensureSanitary** — the `makeSample()` helper handles stereo conversion, RMS validation (rejects silence/NaN), and peak normalization automatically.
- **Finishing rack** — every output passes through `finishSample()` (DC block, fades, normalize, optional limiting). Do not skip this stage.
- **Tape + space** — wire tape emulation (`applyTape()`) and reverb/delay between mutation and finishing.
- **Chaos lanes** — map chaos into 8 lanes per preset using `mapChaosToLanes()`. Define your lane weights in `CHAOS_MAPS`.
- **Progress reporting** — for recipes with multiple sub-recipes, call `onProgress?.(value, message)` between them so the UI stays responsive.
- **Deterministic RNG** — use `seededRng(hashCode(stem) + ...)` for repeatable grain ordering.

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
| Character | `finalWarm` (HP20 + LP60 + soft clip), `haasEffect`, `ensureSanitary`                                       |
| Utility   | `interleave`, `capDuration`, `validateOutput`, `tremolo`                                                    |

### Higher-level DSP modules

| Module        | File             | Key exports                                                                                         |
| ------------- | ---------------- | --------------------------------------------------------------------------------------------------- |
| Finishing     | `finish.ts`      | `finishSample()`, `trimSilence()`, `extendTail()`, `applyLimiter()`, `mapChaosToLanes()`           |
| Tape          | `tape.ts`        | `applyTape()`, `applyTapeLoss()`, `applyHeadBump()`, `applyTilt()` — 6 profiles                     |
| Delay         | `delay.ts`       | `monoDelay()`, `pingPongDelay()`, `diffusionDelay()`, `reverseDelay()`, `multiTapDelay()`          |
| Reverb        | `reverb.ts`      | `darkRoom()`, `modulatedHall()`, `dirtyMetallic()`, `reverseBloom()`, `convolutionSmear()`         |
| Granular      | `granular.ts`    | `granularCloud()`, `frozenTexture()`, `grainReverbBloom()`, `granularDelaySwarm()`                 |

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
