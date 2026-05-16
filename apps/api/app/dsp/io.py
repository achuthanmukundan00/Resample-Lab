"""Audio I/O utilities — reading, writing, converting, probing."""

from __future__ import annotations

import json
import logging
import subprocess
from pathlib import Path

import numpy as np
import soundfile as sf

logger = logging.getLogger(__name__)

SAMPLE_RATE = 48000
TARGET_DBFS = -1.0
FADE_MS = 5


class AudioError(Exception):
    pass


def read_audio(path: str | Path) -> tuple[np.ndarray, int]:
    """Read audio file. Returns (float32 array of shape (samples, channels), sample_rate).
    Promotes mono to stereo."""
    audio, sr = sf.read(str(path), always_2d=False, dtype="float32")
    if audio.ndim == 1:
        audio = np.column_stack([audio, audio])
    elif audio.shape[1] > 2:
        audio = audio[:, :2]
    return audio, sr


def write_audio(path: str | Path, audio: np.ndarray, sr: int = SAMPLE_RATE) -> Path:
    """Write float32 numpy array to 48kHz 16-bit WAV with peak normalization."""
    audio = normalize_peak(audio, TARGET_DBFS)
    sf.write(str(path), np.asarray(audio, dtype=np.float32), sr, subtype="PCM_16")
    return Path(path)


def normalize_peak(audio: np.ndarray, target_dbfs: float = TARGET_DBFS) -> np.ndarray:
    amplitude = 10 ** (target_dbfs / 20)
    peak = np.max(np.abs(audio))
    if peak < 1e-12:
        return audio
    return audio * (amplitude / peak)


def fade_in(audio: np.ndarray, sr: int, fade_ms: int = FADE_MS) -> np.ndarray:
    n = min(int(sr * fade_ms / 1000), len(audio))
    if n == 0:
        return audio
    fade = 0.5 * (1 - np.cos(np.pi * np.arange(n) / n))
    audio = audio.copy()
    if audio.ndim == 2:
        audio[:n] *= fade[:, None]
    else:
        audio[:n] *= fade
    return audio


def fade_out(audio: np.ndarray, sr: int, fade_ms: int = FADE_MS) -> np.ndarray:
    n = min(int(sr * fade_ms / 1000), len(audio))
    if n == 0:
        return audio
    fade = 0.5 * (1 - np.cos(np.pi * np.arange(n) / n))
    audio = audio.copy()
    if audio.ndim == 2:
        audio[-n:] *= fade[::-1, None]
    else:
        audio[-n:] *= fade[::-1]
    return audio


def apply_fades(audio: np.ndarray, sr: int, fade_ms: int = FADE_MS) -> np.ndarray:
    """Apply fade-in + fade-out to prevent clicks."""
    return fade_in(fade_out(audio, sr, fade_ms), sr, fade_ms)


def convert_to_wav(
    source_path: Path, output_dir: Path, ffmpeg_path: str = "ffmpeg"
) -> Path:
    """Convert any audio to 48kHz stereo 16-bit WAV via ffmpeg."""
    output_path = output_dir / f"{source_path.stem}.wav"
    if source_path.suffix.lower() == ".wav" and output_path.resolve() == source_path.resolve():
        return source_path
    cmd = [
        ffmpeg_path, "-y", "-i", str(source_path),
        "-ar", str(SAMPLE_RATE), "-ac", "2", "-sample_fmt", "s16",
        str(output_path),
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
    if result.returncode != 0:
        raise AudioError(f"ffmpeg conversion failed: {result.stderr}")
    if not output_path.exists() or output_path.stat().st_size == 0:
        raise AudioError("ffmpeg produced empty output")
    return output_path


def probe_duration(path: Path, ffprobe_path: str = "ffprobe") -> float:
    """Get duration in seconds via ffprobe."""
    try:
        result = subprocess.run(
            [ffprobe_path, "-v", "error", "-show_entries", "format=duration",
             "-of", "default=noprint_wrappers=1:nokey=1", str(path)],
            capture_output=True, text=True, timeout=10,
        )
        if result.returncode == 0 and result.stdout.strip():
            return float(result.stdout.strip())
    except (subprocess.TimeoutExpired, OSError, ValueError):
        pass
    try:
        info = sf.info(str(path))
        return info.duration
    except Exception:
        return 0.0


def probe_sample_rate(path: Path, ffprobe_path: str = "ffprobe") -> int:
    try:
        result = subprocess.run(
            [ffprobe_path, "-v", "error", "-show_entries", "stream=sample_rate",
             "-of", "default=noprint_wrappers=1:nokey=1", str(path)],
            capture_output=True, text=True, timeout=10,
        )
        if result.returncode == 0 and result.stdout.strip():
            return int(result.stdout.strip())
    except (subprocess.TimeoutExpired, OSError, ValueError):
        pass
    try:
        info = sf.info(str(path))
        return int(info.samplerate)
    except Exception:
        return 0


def validate_audio(
    path: Path,
    min_duration: float = 0.5,
    max_duration: float | None = None,
    max_size_mb: float | None = None,
) -> dict:
    from app.settings import settings
    if max_duration is None:
        max_duration = settings.max_audio_duration
    if max_size_mb is None:
        max_size_mb = settings.max_upload_mb
    """Validate an audio file before processing."""
    if not path.exists():
        return {"valid": False, "reason": "File not found"}
    if path.stat().st_size == 0:
        return {"valid": False, "reason": "File is empty"}
    if path.stat().st_size > max_size_mb * 1024 * 1024:
        return {"valid": False, "reason": f"File exceeds {max_size_mb}MB limit"}
    try:
        dur = probe_duration(path)
        if dur < min_duration:
            return {"valid": False, "reason": f"Duration {dur:.1f}s < minimum {min_duration}s"}
        if dur > max_duration:
            return {"valid": False, "reason": f"Duration {dur:.1f}s > maximum {max_duration}s"}
    except Exception as e:
        return {"valid": False, "reason": f"Could not read audio: {e}"}
    return {"valid": True}


ACCEPTED_EXTENSIONS = {".wav", ".aiff", ".aif", ".flac", ".mp3", ".m4a", ".ogg"}


def is_supported_format(filename: str) -> bool:
    ext = Path(filename).suffix.lower()
    return ext in ACCEPTED_EXTENSIONS
