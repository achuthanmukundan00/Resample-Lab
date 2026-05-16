#!/usr/bin/env python3
"""Generate test audio files for Resample-Lab smoke testing."""

import argparse
import sys
from pathlib import Path

import numpy as np
import soundfile as sf


SAMPLE_RATE = 48000


def generate_tone(
    path: Path,
    freq: float = 440.0,
    duration_s: float = 3.0,
    sample_rate: int = SAMPLE_RATE,
) -> None:
    t = np.linspace(0, duration_s, int(sample_rate * duration_s), endpoint=False)
    tone = 0.5 * np.sin(2 * np.pi * freq * t)
    tone = np.column_stack([tone, tone])  # stereo
    sf.write(str(path), tone, sample_rate, subtype="PCM_16")
    print(f"  Created {path.name} ({freq}Hz, {duration_s}s, stereo)")


def generate_noise_burst(
    path: Path,
    duration_s: float = 2.0,
    sample_rate: int = SAMPLE_RATE,
) -> None:
    noise = np.random.randn(int(sample_rate * duration_s), 2).astype(np.float64)
    noise = noise / np.max(np.abs(noise)) * 0.5
    sf.write(str(path), noise, sample_rate, subtype="PCM_16")
    print(f"  Created {path.name} (noise burst, {duration_s}s, stereo)")


def generate_sweep(
    path: Path,
    duration_s: float = 4.0,
    sample_rate: int = SAMPLE_RATE,
) -> None:
    n = int(sample_rate * duration_s)
    t = np.linspace(0, duration_s, n, endpoint=False)
    freq = 50 + (20000 - 50) * (t / duration_s)
    sweep = 0.3 * np.sin(2 * np.pi * freq * t)
    sweep = np.column_stack([sweep, sweep])
    sf.write(str(path), sweep, sample_rate, subtype="PCM_16")
    print(f"  Created {path.name} (frequency sweep, {duration_s}s, stereo)")


def generate_drum_hit(
    path: Path,
    duration_s: float = 1.0,
    sample_rate: int = SAMPLE_RATE,
) -> None:
    n = int(sample_rate * duration_s)
    t = np.linspace(0, duration_s, n, endpoint=False)
    env = np.exp(-t * 6)
    tone = 0.5 * np.sin(2 * np.pi * 200 * t) * env
    noise = 0.3 * np.random.randn(n) * env
    hit = tone + noise
    hit = np.column_stack([hit, hit])
    hit = hit / np.max(np.abs(hit)) * 0.7
    sf.write(str(path), hit, sample_rate, subtype="PCM_16")
    print(f"  Created {path.name} (drum hit, {duration_s}s, stereo)")


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate test audio files")
    parser.add_argument(
        "--dir",
        type=Path,
        default=Path("test_audio"),
        help="Output directory (default: test_audio/)",
    )
    args = parser.parse_args()

    out_dir = args.dir
    out_dir.mkdir(parents=True, exist_ok=True)

    print(f"Generating test audio in {out_dir}/")
    generate_tone(out_dir / "tone_440.wav")
    generate_tone(out_dir / "tone_220.wav", freq=220.0)
    generate_noise_burst(out_dir / "noise_burst.wav")
    generate_sweep(out_dir / "sweep.wav")
    generate_drum_hit(out_dir / "drum_hit.wav")

    print("\nDone — 5 test files generated.")
    print(f"Total size: {sum(f.stat().st_size for f in out_dir.iterdir()) / 1024:.0f} KB")


if __name__ == "__main__":
    main()
