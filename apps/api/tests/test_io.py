"""Tests for Resample-Lab DSP I/O functions."""

import tempfile
from pathlib import Path

import numpy as np
import pytest
import soundfile as sf

from app.dsp import io, tools

SAMPLE_RATE = 48000


def _make_stereo_wav(path: Path, duration_s: float = 1.0) -> Path:
    n = int(SAMPLE_RATE * duration_s)
    t = np.linspace(0, duration_s, n, endpoint=False)
    data = 0.5 * np.sin(2 * np.pi * 440 * t)
    data = np.column_stack([data, data])
    sf.write(str(path), data, SAMPLE_RATE, subtype="PCM_16")
    return path


class TestReadWrite:
    def test_read_audio(self):
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
            path = Path(f.name)
        try:
            _make_stereo_wav(path)
            audio, sr = io.read_audio(path)
            assert sr == SAMPLE_RATE
            assert audio.shape[1] == 2
        finally:
            path.unlink(missing_ok=True)

    def test_write_audio(self):
        audio = np.random.randn(SAMPLE_RATE, 2).astype(np.float64)
        audio = audio / np.max(np.abs(audio)) * 0.5
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
            path = Path(f.name)
        try:
            io.write_audio(path, audio)
            data, sr = sf.read(str(path))
            assert sr == SAMPLE_RATE
            assert data.shape[1] == 2
        finally:
            path.unlink(missing_ok=True)


class TestNormalizePeak:
    def test_normalizes_to_target(self):
        audio = np.random.randn(SAMPLE_RATE, 2).astype(np.float64) * 0.1
        result = io.normalize_peak(audio, -6.0)
        peak_db = 20 * np.log10(np.max(np.abs(result)))
        assert abs(peak_db - (-6.0)) < 1.0

    def test_preserves_stereo(self):
        audio = np.random.randn(SAMPLE_RATE, 2).astype(np.float64) * 0.3
        result = io.normalize_peak(audio)
        assert result.shape == audio.shape


class TestFades:
    def test_fade_in(self):
        audio = np.ones((SAMPLE_RATE, 2))
        result = io.fade_in(audio, SAMPLE_RATE, 100)
        assert result[0, 0] < 0.1
        assert result[-1, 0] > 0.99

    def test_fade_out(self):
        audio = np.ones((SAMPLE_RATE, 2))
        result = io.fade_out(audio, SAMPLE_RATE, 100)
        assert result[-1, 0] < 0.1
        assert result[0, 0] > 0.99

    def test_apply_fades(self):
        audio = np.ones((SAMPLE_RATE, 2))
        result = io.apply_fades(audio, SAMPLE_RATE, 10)
        assert result[0, 0] < 0.5
        assert result[-1, 0] < 0.5


class TestProbe:
    def test_probe_duration(self, tmp_path):
        wav = _make_stereo_wav(tmp_path / "test.wav", duration_s=2.0)
        dur = io.probe_duration(wav)
        assert abs(dur - 2.0) < 0.1

    def test_probe_sample_rate(self, tmp_path):
        wav = _make_stereo_wav(tmp_path / "test.wav", duration_s=1.0)
        sr = io.probe_sample_rate(wav)
        assert sr == SAMPLE_RATE


class TestValidate:
    def test_valid_audio(self, tmp_path):
        wav = _make_stereo_wav(tmp_path / "valid.wav", duration_s=1.0)
        result = io.validate_audio(wav)
        assert result["valid"] is True

    def test_missing_file(self):
        result = io.validate_audio(Path("/nonexistent/file.wav"))
        assert result["valid"] is False

    def test_is_supported_format(self):
        assert io.is_supported_format("test.wav") is True
        assert io.is_supported_format("test.mp3") is True
        assert io.is_supported_format("test.aiff") is True
        assert io.is_supported_format("test.txt") is False
        assert io.is_supported_format("test") is False


class TestConvertToWav:
    def test_wav_passthrough(self, tmp_path):
        wav = _make_stereo_wav(tmp_path / "source.wav", duration_s=0.5)
        out = io.convert_to_wav(wav, tmp_path)
        assert out.exists()
        assert out.suffix == ".wav"

    def test_convert_to_wav_returns_path(self, tmp_path):
        wav = _make_stereo_wav(tmp_path / "input.wav", duration_s=0.3)
        out = io.convert_to_wav(wav, tmp_path)
        assert isinstance(out, Path)
        assert out.name.endswith(".wav")


class TestTools:
    def test_check_ffmpeg_returns_toolinfo(self):
        info = tools.check_ffmpeg()
        assert hasattr(info, "available")

    def test_check_ffprobe(self):
        info = tools.check_ffprobe()
        assert hasattr(info, "available")

    def test_check_python_dsp_returns_dict(self):
        result = tools.check_python_dsp()
        assert isinstance(result, dict)
        for name in ("numpy", "scipy", "soundfile"):
            assert name in result
            assert result[name].available is True

    def test_check_all_includes_keys(self):
        result = tools.check_all()
        assert "ffmpeg" in result
        assert "python_dsp" in result
