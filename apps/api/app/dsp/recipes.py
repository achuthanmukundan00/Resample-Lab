"""Recipe registry — mapping preset IDs to generation functions."""

from __future__ import annotations

import logging
import math
import random
from pathlib import Path

import numpy as np

import scipy.signal as scipy_signal

from app.dsp import io, transforms

logger = logging.getLogger(__name__)

SAMPLE_RATE = 48000

# Chaos parameter:
# 0.0 = conservative, musical results
# 0.5 = moderate variation
# 1.0 = extreme, weird results

# ---------- Ambient Stretch Lab ----------

def ambient_stretch_lab(source_paths: list[Path], output_dir: Path, chaos: float) -> list[dict]:
    outputs = []
    for src in source_paths:
        stem = src.stem
        audio, sr = io.read_audio(src)
        dur = len(audio) / sr

        # 1. Long stretch bed (8x-16x)
        stretch = 8.0 + chaos * 8.0
        temp = output_dir / f"{stem}__ambient_bed.wav"
        dst = io.convert_to_wav(src, output_dir)
        transforms.ffmpeg_stretch(dst, temp, 1.0 / stretch)
        # Reverb wash
        audio_bed, _ = io.read_audio(temp)
        reverb_decay = 0.3 + chaos * 0.5
        audio_bed = transforms.simple_reverb(audio_bed, sr, decay=reverb_decay, tail_s=2.0)
        audio_bed = transforms.tape_wow(audio_bed, sr, depth=0.002 + chaos * 0.005)
        io.write_audio(temp, audio_bed)
        outputs.append({
            "path": str(temp.name), "category": "ambience",
            "recipe": "stretch", "source": src.name,
            "tools": ["ffmpeg"], "parameters": {"stretch": stretch},
        })

        # 2. Reverse smear
        temp2 = output_dir / f"{stem}__reverse_smear.wav"
        rev = output_dir / f"{stem}__rev_tmp.wav"
        transforms.ffmpeg_stretch(dst, rev, 0.25)  # 4x slower
        # Reverse + filter via Python
        audio_rev, _ = io.read_audio(rev)
        audio_rev = transforms.reverse(audio_rev, sr)
        audio_rev = transforms.lowpass(audio_rev, sr, 1000.0 - chaos * 600.0)
        audio_rev = io.fade_in(audio_rev, sr, 300)
        io.write_audio(temp2, audio_rev)
        rev.unlink(missing_ok=True)
        outputs.append({
            "path": str(temp2.name), "category": "ambience",
            "recipe": "reverse_smear", "source": src.name,
            "tools": ["ffmpeg", "numpy", "scipy"],
            "parameters": {"stretch": 4.0, "lowpass": 1000.0 - chaos * 600.0},
        })

        # 3. Ghost pad
        temp3 = output_dir / f"{stem}__ghost_pad.wav"
        audio_pad, _ = io.read_audio(src)
        audio_pad = transforms.lowpass(audio_pad, sr, 400.0 - chaos * 300.0)
        audio_pad = transforms.soft_clip(audio_pad, sr, drive=chaos * 0.4)
        audio_pad = transforms.tape_wow(audio_pad, sr, depth=0.003, rate=3.0 + chaos * 2.0)
        audio_pad = io.fade_in(audio_pad, sr, 200)
        audio_pad = io.fade_out(audio_pad, sr, 500)
        io.write_audio(temp3, audio_pad)
        outputs.append({
            "path": str(temp3.name), "category": "ambience",
            "recipe": "ghost_pad", "source": src.name,
            "tools": ["numpy", "scipy"],
            "parameters": {"lowpass": 400.0 - chaos * 300.0},
        })

        dst.unlink(missing_ok=True)

    return outputs


# ---------- Ghost Reverse Lab ----------

def ghost_reverse_lab(source_paths: list[Path], output_dir: Path, chaos: float) -> list[dict]:
    outputs = []
    for src in source_paths:
        stem = src.stem
        audio, sr = io.read_audio(src)

        # 1. Reverse tail — reverse + echo decay
        rev_audio = transforms.reverse(audio, sr)
        delay_ms = 80 + int(chaos * 200)
        decay = 0.3 + chaos * 0.5
        echoed = transforms.delay_echo(rev_audio, sr, delay_ms=delay_ms, feedback=decay, mix=0.4)
        echoed = transforms.simple_reverb(echoed, sr, decay=0.2, tail_s=1.0)
        echoed = io.fade_in(echoed, sr, 200)
        temp1 = output_dir / f"{stem}__reverse_tail.wav"
        io.write_audio(temp1, echoed)
        outputs.append({
            "path": str(temp1.name), "category": "ambience",
            "recipe": "reverse_tail", "source": src.name,
            "tools": ["numpy"],
            "parameters": {"delay_ms": delay_ms, "decay": decay},
        })

        # 2. Ghost hit — bandpass + reverse + 2x stretch + reverb
        temp2 = output_dir / f"{stem}__ghost_hit.wav"
        wav_src = io.convert_to_wav(src, output_dir)
        transforms.ffmpeg_stretch(wav_src, temp2, 0.5)
        audio_ghost, _ = io.read_audio(temp2)
        audio_ghost = transforms.reverse(audio_ghost, sr)
        center_freq = 600.0 + chaos * 1400.0
        q_factor = 1.0 + chaos * 4.0
        low = center_freq / (math.sqrt(2) * q_factor)
        high = center_freq * math.sqrt(2) * q_factor
        audio_ghost = transforms.bandpass(audio_ghost, sr, max(20, low), min(sr / 2 - 1, high))
        audio_ghost = transforms.simple_reverb(audio_ghost, sr, decay=0.3 + chaos * 0.4, tail_s=1.5)
        audio_ghost = io.fade_in(audio_ghost, sr, 300)
        io.write_audio(temp2, audio_ghost)
        wav_src.unlink(missing_ok=True)
        outputs.append({
            "path": str(temp2.name), "category": "oddity",
            "recipe": "ghost_hit", "source": src.name,
            "tools": ["ffmpeg", "numpy", "scipy"],
            "parameters": {"center_freq": center_freq, "q": q_factor},
        })

        # 3. Reverse-echo-forward
        temp3 = output_dir / f"{stem}__reverse_echo_fwd.wav"
        rev = transforms.reverse(audio, sr)
        delay_ms_2 = 50.0 + chaos * 200.0
        feedback = 0.3 + chaos * 0.5
        echoed_rev = transforms.delay_echo(rev, sr, delay_ms=delay_ms_2, feedback=feedback, mix=0.5)
        echoed_rev = transforms.soft_clip(echoed_rev, sr, drive=chaos * 0.3)
        echoed_rev = io.normalize_peak(echoed_rev, -3.0)
        rev_back = transforms.reverse(echoed_rev, sr)
        mix = 0.3 + chaos * 0.4
        fade_len = min(len(audio) // 4, int(sr * 3))
        output = audio.copy()
        output[-fade_len:] = audio[-fade_len:] * (1 - mix) + rev_back[-fade_len:] * mix
        output = io.apply_fades(output, sr, 5)
        io.write_audio(temp3, output)
        outputs.append({
            "path": str(temp3.name), "category": "oddity",
            "recipe": "reverse_echo_fwd", "source": src.name,
            "tools": ["numpy"],
            "parameters": {"delay_ms": delay_ms_2, "feedback": feedback},
        })

    return outputs


# ---------- Granular Shards ----------

def granular_shards(source_paths: list[Path], output_dir: Path, chaos: float) -> list[dict]:
    outputs = []
    for src in source_paths:
        stem = src.stem
        audio, sr = io.read_audio(src)
        rng = random.Random(hash(stem) + int(chaos * 1000))

        # 1. Micro-chop sequence
        grain_ms = 120.0 - chaos * 80.0
        grains = transforms.slice_audio(audio, sr, grain_ms)
        if grains:
            indices = list(range(len(grains)))
            rng.shuffle(indices)
            reordered = [grains[i] for i in indices]
            chopped = []
            for g in reordered:
                g = transforms.soft_clip(g, sr, drive=chaos * 0.3)
                chopped.append(io.fade_in(io.fade_out(g, sr, 3), sr, 3))
            result = np.concatenate(chopped, axis=0)
            result = io.normalize_peak(result)
            temp1 = output_dir / f"{stem}__micro_chop.wav"
            io.write_audio(temp1, result)
            outputs.append({
                "path": str(temp1.name), "category": "granular",
                "recipe": "micro_chop", "source": src.name,
                "tools": ["numpy"],
                "parameters": {"grain_ms": grain_ms, "shuffle": chaos},
            })

        # 2. Pitch-shifted grain cloud
        grain_ms_2 = 150.0 - chaos * 110.0
        grains2 = transforms.slice_audio(audio, sr, grain_ms_2)
        if grains2:
            pitch_range = 6.0 + chaos * 18.0
            cloud_grains = []
            for g in grains2:
                semitones = rng.uniform(-pitch_range, pitch_range)
                shifted = transforms.pitch_shift_grain(g, semitones)
                shifted = io.fade_in(io.fade_out(shifted, sr, 5), sr, 5)
                cloud_grains.append(shifted)
            result2 = np.concatenate(cloud_grains, axis=0)
            result2 = transforms.delay_echo(result2, sr, delay_ms=80.0, feedback=0.2 + chaos * 0.3, mix=0.3)
            result2 = io.normalize_peak(result2)
            temp2 = output_dir / f"{stem}__grain_cloud.wav"
            io.write_audio(temp2, result2)
            outputs.append({
                "path": str(temp2.name), "category": "granular",
                "recipe": "grain_cloud", "source": src.name,
                "tools": ["numpy", "scipy"],
                "parameters": {"grain_ms": grain_ms_2, "pitch_range": pitch_range},
            })

        # 3. Stutter bits
        loop_ms = 120.0 - chaos * 100.0
        max_repeats = int(4 + chaos * 28)
        loop_samples = int(sr * loop_ms / 1000)
        gate_shape = 0.3 + chaos * 0.6
        chunks = []
        pos = 0
        while pos + loop_samples <= len(audio):
            chunks.append(audio[pos:pos + loop_samples].copy())
            pos += loop_samples
        stutter_parts = []
        for ch in chunks:
            repeats = rng.randint(1, max_repeats + 1)
            gate = np.ones(loop_samples)
            gate_end = int(loop_samples * gate_shape)
            gate[gate_end:] *= np.exp(-np.arange(loop_samples - gate_end) / (loop_samples * 0.1))
            for _ in range(repeats):
                gated = ch * gate[:, None]
                gated = io.fade_in(io.fade_out(gated, sr, 2), sr, 2)
                stutter_parts.append(gated)
        if stutter_parts:
            result3 = np.concatenate(stutter_parts, axis=0)
            result3 = transforms.tape_wow(result3, sr, depth=0.003 + chaos * 0.008, rate=5.0)
            result3 = transforms.soft_clip(result3, sr, drive=chaos * 0.25)
            result3 = io.normalize_peak(result3)
            temp3 = output_dir / f"{stem}__stutter_bits.wav"
            io.write_audio(temp3, result3)
            outputs.append({
                "path": str(temp3.name), "category": "granular",
                "recipe": "stutter_bits", "source": src.name,
                "tools": ["numpy"],
                "parameters": {"loop_ms": loop_ms, "max_repeats": max_repeats},
            })

    return outputs


# ---------- Bitrot Dirt ----------

def bitrot_dirt(source_paths: list[Path], output_dir: Path, chaos: float) -> list[dict]:
    outputs = []
    for src in source_paths:
        stem = src.stem
        audio, sr = io.read_audio(src)

        # 1. Crushed texture
        bits = 8 - int(chaos * 6)
        crushed = transforms.bitcrush(audio, sr, max(2, bits))
        noise_amt = chaos * 0.02
        crushed = transforms.soft_clip(crushed, sr, drive=0.1 + chaos * 0.4)
        crushed = transforms.add_noise(crushed, sr, noise_amt)
        crushed = io.apply_fades(crushed, sr, 5)
        temp1 = output_dir / f"{stem}__crushed.wav"
        io.write_audio(temp1, crushed)
        outputs.append({
            "path": str(temp1.name), "category": "oddity",
            "recipe": "crushed", "source": src.name,
            "tools": ["numpy"],
            "parameters": {"bits": max(2, bits), "noise": noise_amt},
        })

        # 2. Downsampled artifact
        factor = 4 + int(chaos * 12)
        down = transforms.downsample(audio, sr, factor)
        down = transforms.tape_wow(down, sr, depth=0.004 + chaos * 0.006, rate=3.5)
        down = io.apply_fades(down, sr, 5)
        temp2 = output_dir / f"{stem}__downsampled.wav"
        io.write_audio(temp2, down)
        outputs.append({
            "path": str(temp2.name), "category": "oddity",
            "recipe": "downsampled", "source": src.name,
            "tools": ["numpy", "scipy"],
            "parameters": {"factor": factor},
        })

        # 3. Filtered noisy loop
        noise_mix = 0.2 + chaos * 0.6
        noise = np.random.uniform(-1, 1, audio.shape).astype(np.float64)
        bp_low = 100.0 + chaos * 200.0
        bp_high = 2000.0 + chaos * 6000.0
        filtered_noise = transforms.bandpass(noise, sr, bp_low, bp_high)
        noisy = audio * (1.0 - noise_mix) + filtered_noise * noise_mix
        crossfade_len = min(int(sr * 0.02), len(noisy) // 3)
        if crossfade_len > 0:
            fade_up = np.linspace(0, 1, crossfade_len)
            fade_down = np.linspace(1, 0, crossfade_len)
            noisy[:crossfade_len] *= fade_up[:, None]
            noisy[-crossfade_len:] *= fade_down[:, None]
        noisy = io.normalize_peak(noisy)
        temp3 = output_dir / f"{stem}__noisy_loop.wav"
        io.write_audio(temp3, noisy)
        outputs.append({
            "path": str(temp3.name), "category": "loop",
            "recipe": "noisy_loop", "source": src.name,
            "tools": ["numpy", "scipy"],
            "parameters": {"noise_mix": noise_mix, "bp_low": bp_low, "bp_high": bp_high},
        })

    return outputs


# ---------- Pitch Wreckage ----------

def pitch_wreckage(source_paths: list[Path], output_dir: Path, chaos: float) -> list[dict]:
    outputs = []
    for src in source_paths:
        stem = src.stem
        audio, sr = io.read_audio(src)
        wav_src = io.convert_to_wav(src, output_dir)

        # 1. Octave down (-12 to -24 semitones)
        semitones_down = -12 - int(chaos * 12)
        temp1 = output_dir / f"{stem}__octave_down.wav"
        transforms.ffmpeg_pitch_shift(wav_src, temp1, semitones_down)
        outputs.append({
            "path": str(temp1.name), "category": "oddity",
            "recipe": "octave_down", "source": src.name,
            "tools": ["ffmpeg"],
            "parameters": {"semitones": semitones_down},
        })

        # 2. Octave up (+12 to +24)
        semitones_up = 12 + int(chaos * 12)
        temp2 = output_dir / f"{stem}__octave_up.wav"
        transforms.ffmpeg_pitch_shift(wav_src, temp2, semitones_up)
        outputs.append({
            "path": str(temp2.name), "category": "oddity",
            "recipe": "octave_up", "source": src.name,
            "tools": ["ffmpeg"],
            "parameters": {"semitones": semitones_up},
        })

        # 3. Unstable pitch drift
        drift_range = 2.0 + chaos * 10.0
        n = len(audio)
        duration_s = n / sr
        t = np.linspace(0, duration_s, n, endpoint=False)
        mod_rate = 0.1 + chaos * 0.4
        pitch_env = (
            np.sin(2 * np.pi * mod_rate * t) +
            0.3 * np.sin(2 * np.pi * mod_rate * 3.7 * t) +
            0.1 * np.random.randn(n)
        )
        pitch_env = drift_range * (pitch_env / (np.max(np.abs(pitch_env)) + 1e-10))
        speed = 2.0 ** (pitch_env / 12.0)
        phase = np.cumsum(1.0 / speed)
        phase = np.clip(phase, 0, n - 1)
        drift_out = np.zeros_like(audio)
        for ch in range(audio.shape[1]):
            drift_out[:, ch] = np.interp(phase, np.arange(n), audio[:, ch])
        drift_out = io.apply_fades(drift_out, sr, 10)
        drift_out = io.normalize_peak(drift_out)
        temp3 = output_dir / f"{stem}__pitch_drift.wav"
        io.write_audio(temp3, drift_out)
        outputs.append({
            "path": str(temp3.name), "category": "oddity",
            "recipe": "pitch_drift", "source": src.name,
            "tools": ["numpy"],
            "parameters": {"drift_range": drift_range, "mod_rate": mod_rate},
        })

        wav_src.unlink(missing_ok=True)

    return outputs


# ---------- Loop Extractor ----------

def loop_extractor(source_paths: list[Path], output_dir: Path, chaos: float) -> list[dict]:
    outputs = []
    for src in source_paths:
        stem = src.stem
        audio, sr = io.read_audio(src)

        # 1. Loop cut
        wav_src = io.convert_to_wav(src, output_dir)
        dur = len(audio) / sr
        loop_dur = min(dur * 0.5, 8.0)
        temp1 = output_dir / f"{stem}__loop.wav"
        transforms.ffmpeg_stretch(wav_src, temp1, dur / loop_dur)
        outputs.append({
            "path": str(temp1.name), "category": "loop",
            "recipe": "loop_cut", "source": src.name,
            "tools": ["ffmpeg"],
            "parameters": {"duration": loop_dur},
        })

        # 2. Texture loop
        lp_hz = 2000.0 - chaos * 1500.0
        tex_dur = min(dur * 0.3, 4.0)
        temp2 = output_dir / f"{stem}__texture_loop.wav"
        transforms.ffmpeg_stretch(wav_src, temp2, dur / tex_dur)
        audio_tex, _ = io.read_audio(temp2)
        audio_tex = transforms.lowpass(audio_tex, sr, max(50, lp_hz))
        audio_tex = transforms.simple_reverb(audio_tex, sr, decay=0.2 + chaos * 0.3, tail_s=1.0)
        audio_tex = io.apply_fades(audio_tex, sr, 10)
        io.write_audio(temp2, audio_tex)
        outputs.append({
            "path": str(temp2.name), "category": "loop",
            "recipe": "texture_loop", "source": src.name,
            "tools": ["ffmpeg", "numpy", "scipy"],
            "parameters": {"lowpass": max(50, lp_hz), "duration": tex_dur},
        })

        wav_src.unlink(missing_ok=True)

    return outputs


# ---------- Impact/Riser Mutator ----------

def impact_riser_mutator(source_paths: list[Path], output_dir: Path, chaos: float) -> list[dict]:
    outputs = []
    for src in source_paths:
        stem = src.stem
        audio, sr = io.read_audio(src)
        wav_src = io.convert_to_wav(src, output_dir)

        # 1. Reversed riser
        audio_rev = transforms.reverse(audio, sr)
        fade_ms = 100 + int(chaos * 400)
        riser_audio = io.fade_in(audio_rev, sr, fade_ms)
        sweep_start = 100.0 + chaos * 100.0
        sweep_end = 2000.0 + chaos * 6000.0
        n = len(riser_audio)
        if n > sr * 10:
            riser_audio = riser_audio[:int(sr * 10)]
            n = len(riser_audio)
        t = np.arange(n) / sr
        fc = sweep_start + (sweep_end - sweep_start) * (t / t[-1]) if n > 0 else np.array([])
        Q = 2.0 + chaos * 3.0
        # Apply time-varying bandpass via STFT
        if n > 2048:
            f, t_step, Zxx = scipy_signal.stft(
                riser_audio[:, 0], fs=sr, nperseg=2048, noverlap=1536
            )
            for i, ti in enumerate(t_step):
                cf = sweep_start + (sweep_end - sweep_start) * (ti / t_step[-1])
                bw = cf / Q
                mask = 1.0 / (1.0 + ((f - cf) / (bw / 2.0)) ** 2) if bw > 0 else np.ones_like(f)
                Zxx[:, i] *= mask
            _, left = scipy_signal.istft(Zxx, fs=sr)
            riser_out = np.zeros((n, 2))
            riser_out[:min(n, len(left)), 0] = left[:min(n, len(left))]
            riser_out[:min(n, len(left)), 1] = left[:min(n, len(left))]
            riser_out = transforms.soft_clip(riser_out, sr, drive=chaos * 0.3)
            riser_out = io.normalize_peak(riser_out)
            temp1 = output_dir / f"{stem}__riser.wav"
            io.write_audio(temp1, riser_out)
            outputs.append({
                "path": str(temp1.name), "category": "ambience",
                "recipe": "riser", "source": src.name,
                "tools": ["numpy", "scipy"],
                "parameters": {"fade_ms": fade_ms, "sweep_start": sweep_start, "sweep_end": sweep_end},
            })

        # 2. Pitch-dropped impact
        semitones = -24 - int(chaos * 12)
        temp2 = output_dir / f"{stem}__impact.wav"
        transforms.ffmpeg_pitch_shift(wav_src, temp2, semitones)
        audio_impact, _ = io.read_audio(temp2)
        audio_impact = transforms.soft_clip(audio_impact, sr, drive=0.2 + chaos * 0.4)
        audio_impact = io.normalize_peak(audio_impact)
        io.write_audio(temp2, audio_impact)
        outputs.append({
            "path": str(temp2.name), "category": "one_shot",
            "recipe": "impact", "source": src.name,
            "tools": ["ffmpeg"],
            "parameters": {"semitones": semitones},
        })

        # 3. Transient smear (reverb)
        reverb_time = 0.5 + chaos * 2.5
        ir_length = min(int(sr * reverb_time), len(audio))
        decay = np.exp(-np.linspace(0, 5, ir_length)) if ir_length > 0 else np.array([])
        noise_ir = np.random.randn(ir_length) * decay if ir_length > 0 else np.array([])
        if len(noise_ir) > 0:
            noise_ir = noise_ir / (np.max(np.abs(noise_ir)) + 1e-12) * 0.3
            left = scipy_signal.fftconvolve(audio[:, 0], noise_ir, mode="full")[:len(audio)]
            right = scipy_signal.fftconvolve(audio[:, 1], noise_ir, mode="full")[:len(audio)]
            wet = 0.3 + chaos * 0.5
            smeared = audio * (1 - wet) + np.column_stack([left, right]) * wet
            smeared = io.normalize_peak(smeared)
            smeared = io.fade_out(smeared, sr, 50)
            temp3 = output_dir / f"{stem}__smear.wav"
            io.write_audio(temp3, smeared)
            outputs.append({
                "path": str(temp3.name), "category": "one_shot",
                "recipe": "smear", "source": src.name,
                "tools": ["numpy", "scipy"],
                "parameters": {"reverb_time": reverb_time, "wet": wet},
            })

        wav_src.unlink(missing_ok=True)

    return outputs


# ---------- Chaos Pack ----------

def chaos_pack(source_paths: list[Path], output_dir: Path, chaos: float) -> list[dict]:
    outputs = []
    for src in source_paths:
        stem = src.stem
        rng = random.Random(hash(stem) + 9999 + int(chaos * 1000))

        c_ambient = min(1.0, chaos * 0.7 + rng.random() * 0.4)
        c_granular = min(1.0, chaos * 0.8 + rng.random() * 0.3)
        c_stutter = min(1.0, chaos * 0.9 + rng.random() * 0.2)
        c_oddity = min(1.0, chaos * 0.9 + rng.random() * 0.2)
        c_loop = min(1.0, chaos + rng.random() * 0.2)

        # Pick one output from each sub-recipe for exactly 5 outputs
        ambient_results = ambient_stretch_lab([src], output_dir, c_ambient)
        outputs.append(ambient_results[0])

        granular_results = granular_shards([src], output_dir, c_granular)
        outputs.append(granular_results[0])

        stutter_results = granular_shards([src], output_dir, c_stutter)
        outputs.append(stutter_results[0])

        if rng.random() < 0.5:
            oddity_results = ghost_reverse_lab([src], output_dir, c_oddity)
        else:
            oddity_results = pitch_wreckage([src], output_dir, c_oddity)
        outputs.append(oddity_results[0])

        loop_results = loop_extractor([src], output_dir, c_loop)
        outputs.append(loop_results[0])

    return outputs


# ---------- Registry ----------

RECIPE_REGISTRY: dict[str, dict] = {
    "ambient_stretch": {
        "name": "Ambient Stretch Lab",
        "description": "Long stretched pads, reverse smear, low-pass ghost textures",
        "fn": ambient_stretch_lab,
        "tools": ["ffmpeg", "numpy", "scipy"],
        "output_count": 3,
        "categories": ["ambience", "ambience", "ambience"],
    },
    "ghost_reverse": {
        "name": "Ghost Reverse Lab",
        "description": "Reverse tails, echo-forward textures, filtered ghost hits",
        "fn": ghost_reverse_lab,
        "tools": ["ffmpeg", "numpy", "scipy"],
        "output_count": 3,
        "categories": ["ambience", "oddity", "oddity"],
    },
    "granular_shards": {
        "name": "Granular Shards",
        "description": "Micro-chopped sequences, pitch-shifted grain clouds, stutter bits",
        "fn": granular_shards,
        "tools": ["numpy", "scipy"],
        "output_count": 3,
        "categories": ["granular", "granular", "granular"],
    },
    "bitrot_dirt": {
        "name": "Bitrot Dirt",
        "description": "Crushed textures, downsampled artifacts, filtered noisy loops",
        "fn": bitrot_dirt,
        "tools": ["numpy", "scipy"],
        "output_count": 3,
        "categories": ["oddity", "oddity", "loop"],
    },
    "pitch_wreckage": {
        "name": "Pitch Wreckage",
        "description": "Octave-down monsters, octave-up insects, unstable pitch drift",
        "fn": pitch_wreckage,
        "tools": ["ffmpeg", "numpy"],
        "output_count": 3,
        "categories": ["oddity", "oddity", "oddity"],
    },
    "loop_extractor": {
        "name": "Loop Extractor",
        "description": "Loop cuts and filtered texture loops",
        "fn": loop_extractor,
        "tools": ["ffmpeg", "numpy", "scipy"],
        "output_count": 2,
        "categories": ["loop", "loop"],
    },
    "impact_riser": {
        "name": "Impact / Riser Mutator",
        "description": "Reversed risers, pitched impacts, transient smears",
        "fn": impact_riser_mutator,
        "tools": ["ffmpeg", "numpy", "scipy"],
        "output_count": 3,
        "categories": ["ambience", "one_shot", "one_shot"],
    },
    "chaos_pack": {
        "name": "Chaos Pack",
        "description": "Maximum entropy — mixture of all categories with extreme randomization",
        "fn": chaos_pack,
        "tools": ["ffmpeg", "numpy", "scipy"],
        "output_count": 5,
        "categories": ["ambience", "granular", "granular", "oddity", "loop"],
    },
}


def get_preset_info(preset_id: str) -> dict | None:
    entry = RECIPE_REGISTRY.get(preset_id)
    if entry is None:
        return None
    return {
        "id": preset_id,
        "name": entry["name"],
        "description": entry["description"],
        "tools": entry["tools"],
        "output_count": entry["output_count"],
        "categories": entry["categories"],
    }


def list_presets() -> list[dict]:
    return [
        {
            "id": preset_id,
            "name": info["name"],
            "description": info["description"],
            "tools": info["tools"],
            "output_count": info["output_count"],
            "categories": info["categories"],
        }
        for preset_id, info in RECIPE_REGISTRY.items()
    ]


def generate_preset(preset_id: str, source_paths: list[Path], output_dir: Path, chaos: float) -> list[dict]:
    entry = RECIPE_REGISTRY.get(preset_id)
    if entry is None:
        raise ValueError(f"Unknown preset: {preset_id}")
    return entry["fn"](source_paths, output_dir, chaos)
