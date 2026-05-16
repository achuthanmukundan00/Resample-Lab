"""Individual audio transform operations.

All transforms accept (audio: np.ndarray, sample_rate: int, **kwargs) -> np.ndarray.
Operations work on float64 arrays in shape (samples, channels).
"""

import subprocess
import tempfile
from pathlib import Path

import numpy as np
from scipy import signal as scipy_signal
from scipy.ndimage import gaussian_filter1d


# ---------- Basic operations ----------

def reverse(audio: np.ndarray, sr: int) -> np.ndarray:
    return audio[::-1].copy()


def normalize(audio: np.ndarray, sr: int, peak: float = 0.95) -> np.ndarray:
    amp = np.max(np.abs(audio))
    if amp < 1e-12:
        return audio
    return audio * (peak / amp)


# ---------- Filtering ----------

def lowpass(audio: np.ndarray, sr: int, cutoff: float, order: int = 4) -> np.ndarray:
    cutoff = max(20.0, min(cutoff, sr / 2 - 1))
    sos = scipy_signal.butter(order, cutoff, btype="low", fs=sr, output="sos")
    return scipy_signal.sosfilt(sos, audio, axis=0)


def highpass(audio: np.ndarray, sr: int, cutoff: float, order: int = 4) -> np.ndarray:
    cutoff = max(20.0, min(cutoff, sr / 2 - 1))
    sos = scipy_signal.butter(order, cutoff, btype="high", fs=sr, output="sos")
    return scipy_signal.sosfilt(sos, audio, axis=0)


def bandpass(audio: np.ndarray, sr: int, low: float, high: float, order: int = 4) -> np.ndarray:
    low = max(20.0, low)
    high = min(sr / 2 - 1, high)
    sos = scipy_signal.butter(order, [low, high], btype="band", fs=sr, output="sos")
    return scipy_signal.sosfilt(sos, audio, axis=0)


# ---------- Effects ----------

def bitcrush(audio: np.ndarray, sr: int, bits: int = 8) -> np.ndarray:
    bits = max(1, min(16, int(bits)))
    if bits >= 16:
        return audio.copy()
    levels = 2 ** (bits - 1)
    return np.round(audio * levels) / levels


def add_noise(audio: np.ndarray, sr: int, amount: float = 0.01) -> np.ndarray:
    noise = np.random.randn(*audio.shape).astype(np.float64)
    peak = np.max(np.abs(audio))
    if peak > 1e-12:
        noise = noise * (peak * amount)
    return audio + noise


def gaussian_smooth(audio: np.ndarray, sr: int, sigma_ms: float = 10.0) -> np.ndarray:
    sigma_samples = sigma_ms * sr / 1000.0
    if sigma_ms <= 0.1 or sigma_samples < 1.0:
        return audio.copy()
    return gaussian_filter1d(audio, sigma=sigma_samples, axis=0, mode="reflect")


# ---------- Simple reverb ----------

def simple_reverb(audio: np.ndarray, sr: int, decay: float = 0.5, tail_s: float = 1.0) -> np.ndarray:
    """Schroeder-style reverb: comb filters + all-pass."""
    delays_ms = [31, 37, 43, 53]
    feedback = decay * 0.7
    output = audio.copy()
    for delay_ms in delays_ms:
        delay = int(sr * delay_ms / 1000)
        comb = np.zeros_like(audio)
        for i in range(delay, len(audio)):
            comb[i] = audio[i] + feedback * comb[i - delay]
        output += comb * 0.25
    # All-pass
    ap_delay = int(sr * 5 / 1000)
    ap_gain = 0.7
    for i in range(ap_delay, len(output)):
        output[i] = output[i] + ap_gain * output[i - ap_delay]
    return normalize(output, sr, 1.0)


# ---------- Pitch / stretch via ffmpeg ----------

def _compute_atempo_stages(ratio: float) -> list[float]:
    """Compute atempo stages for ratios outside [0.5, 2.0]."""
    if 0.5 <= ratio <= 2.0:
        return [ratio]
    stages = []
    if ratio < 0.5:
        while ratio < 0.5:
            stages.append(0.5)
            ratio *= 2.0
        stages.append(max(0.5, ratio))
    else:
        while ratio > 2.0:
            stages.append(2.0)
            ratio /= 2.0
        if ratio >= 0.5:
            stages.append(ratio)
    return stages


def ffmpeg_stretch(
    input_path: Path, output_path: Path, ratio: float,
    ffmpeg_path: str = "ffmpeg", timeout: int = 120,
) -> None:
    """Time-stretch audio file via ffmpeg atempo."""
    stages = _compute_atempo_stages(ratio)
    filter_chain = ",".join(f"atempo={s:.4f}" for s in stages)
    cmd = [
        ffmpeg_path, "-y", "-i", str(input_path),
        "-af", filter_chain,
        "-ar", "48000", "-ac", "2", "-sample_fmt", "s16",
        str(output_path),
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
    if result.returncode != 0:
        raise RuntimeError(f"ffmpeg stretch failed: {result.stderr}")


def ffmpeg_pitch_shift(
    input_path: Path, output_path: Path, semitones: float,
    ffmpeg_path: str = "ffmpeg", timeout: int = 120,
) -> None:
    """Pitch shift via ffmpeg asetrate + atempo."""
    sr = 48000
    ratio = 2.0 ** (semitones / 12.0)
    new_rate = int(sr * ratio)
    filter_chain = f"asetrate={new_rate},aresample={sr},atempo=1.0"
    cmd = [
        ffmpeg_path, "-y", "-i", str(input_path),
        "-af", filter_chain,
        "-ar", "48000", "-ac", "2", "-sample_fmt", "s16",
        str(output_path),
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
    if result.returncode != 0:
        raise RuntimeError(f"ffmpeg pitch shift failed: {result.stderr}")


# ---------- Granular operations ----------

def slice_audio(audio: np.ndarray, sr: int, grain_ms: float = 100.0) -> list[np.ndarray]:
    """Divide audio into equal-length slices."""
    grain_samples = int(sr * grain_ms / 1000)
    if grain_samples <= 0:
        return [audio]
    grains = []
    pos = 0
    while pos + grain_samples <= len(audio):
        grains.append(audio[pos:pos + grain_samples].copy())
        pos += grain_samples
    return grains


def pitch_shift_grain(grain: np.ndarray, semitones: float) -> np.ndarray:
    """Pitch shift a single grain via resampling + trim/pad."""
    ratio = 2.0 ** (semitones / 12.0)
    n = len(grain)
    shifted = scipy_signal.resample(grain, int(n / ratio), axis=0)
    if len(shifted) < n:
        shifted = np.pad(shifted, ((0, n - len(shifted)), (0, 0)), mode="constant")
    else:
        shifted = shifted[:n]
    return shifted


# ---------- Delay / echo ----------

def delay_echo(
    audio: np.ndarray, sr: int, delay_ms: float = 200.0,
    feedback: float = 0.3, mix: float = 0.5,
) -> np.ndarray:
    """Feedback delay line / echo."""
    delay_samples = int(sr * delay_ms / 1000)
    if delay_samples <= 0 or delay_samples >= len(audio):
        return audio.copy()
    wet = np.zeros_like(audio)
    for i in range(delay_samples, len(audio)):
        wet[i] = audio[i - delay_samples] + feedback * wet[i - delay_samples]
    out = audio * (1.0 - mix) + wet * mix
    return normalize(out, sr, 0.95)


# ---------- Saturation / soft clipping ----------

def soft_clip(audio: np.ndarray, sr: int, drive: float = 0.5) -> np.ndarray:
    """Arctan-style soft saturation. drive 0=transparent, 1=heavy."""
    if drive <= 0.0:
        return audio.copy()
    gain = 1.0 + drive * 9.0
    scaled = audio * gain
    clipped = np.where(np.abs(scaled) < (1.0 / gain), scaled, np.tanh(scaled))
    return normalize(clipped, sr, 0.95)


# ---------- Tape wow / flutter ----------

def tape_wow(audio: np.ndarray, sr: int, depth: float = 0.005, rate: float = 4.0) -> np.ndarray:
    """Subtle pitch wobble simulating tape degradation."""
    if depth <= 0.0:
        return audio.copy()
    n = len(audio)
    t = np.arange(n) / sr
    mod = 1.0 + depth * np.sin(2 * np.pi * rate * t)
    phase = np.cumsum(1.0 / mod)
    phase = np.clip(phase, 0, n - 1)
    out = np.zeros_like(audio)
    for ch in range(audio.shape[1]):
        out[:, ch] = np.interp(phase, np.arange(n), audio[:, ch])
    return out


def downsample(audio: np.ndarray, sr: int, factor: int = 4) -> np.ndarray:
    """Reduce effective sample rate by factor. Lowpass then decimate."""
    factor = max(2, int(factor))
    cutoff = sr / (2.0 * factor)
    sos = scipy_signal.butter(8, cutoff, btype="low", fs=sr, output="sos")
    filtered = scipy_signal.sosfilt(sos, audio, axis=0)
    step = int(factor)
    decimated = filtered[::step].copy()
    orig_indices = np.arange(len(decimated)) * step
    target_indices = np.arange(len(audio))
    upsampled = np.zeros_like(audio)
    for ch in range(audio.shape[1]):
        upsampled[:, ch] = np.interp(target_indices, orig_indices, decimated[:, ch])
    return upsampled
