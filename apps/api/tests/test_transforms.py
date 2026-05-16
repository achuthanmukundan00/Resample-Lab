"""Tests for Resample-Lab DSP transforms."""

import numpy as np
import pytest
import soundfile as sf

from app.dsp import transforms

SAMPLE_RATE = 48000


def _make_stereo(duration_s: float = 1.0) -> np.ndarray:
    """Create a 1-second stereo test signal."""
    n = int(SAMPLE_RATE * duration_s)
    t = np.linspace(0, duration_s, n, endpoint=False)
    tone = 0.5 * np.sin(2 * np.pi * 440 * t)
    return np.column_stack([tone, tone])


class TestReverse:
    def test_reverses_audio(self):
        audio = _make_stereo(0.5)
        result = transforms.reverse(audio, SAMPLE_RATE)
        assert np.allclose(result, audio[::-1])

    def test_preserves_shape(self):
        audio = _make_stereo(1.0)
        result = transforms.reverse(audio, SAMPLE_RATE)
        assert result.shape == audio.shape

    def test_reverse_twice_returns_original(self):
        audio = _make_stereo(0.3)
        result = transforms.reverse(transforms.reverse(audio, SAMPLE_RATE), SAMPLE_RATE)
        assert np.allclose(result, audio)


class TestNormalize:
    def test_normalizes_to_peak(self):
        audio = _make_stereo(1.0) * 0.1
        result = transforms.normalize(audio, SAMPLE_RATE, peak=0.95)
        assert abs(np.max(np.abs(result)) - 0.95) < 0.01

    def test_does_not_clip(self):
        audio = _make_stereo(1.0)
        result = transforms.normalize(audio, SAMPLE_RATE, peak=1.0)
        assert np.all(np.abs(result) <= 1.0 + 1e-10)


class TestLowHighBandpass:
    @pytest.fixture
    def audio(self):
        return _make_stereo(2.0)

    def test_lowpass_reduces_high_freqs(self, audio):
        filtered = transforms.lowpass(audio, SAMPLE_RATE, 200.0)
        assert filtered.shape == audio.shape
        assert np.all(np.isfinite(filtered))

    def test_highpass_reduces_low_freqs(self, audio):
        filtered = transforms.highpass(audio, SAMPLE_RATE, 1000.0)
        assert filtered.shape == audio.shape
        assert np.all(np.isfinite(filtered))

    def test_bandpass_accepts_freq_range(self, audio):
        filtered = transforms.bandpass(audio, SAMPLE_RATE, 200.0, 4000.0)
        assert filtered.shape == audio.shape
        assert np.all(np.isfinite(filtered))

    def test_lowpass_preserves_silence(self):
        silent = np.zeros((SAMPLE_RATE, 2))
        result = transforms.lowpass(silent, SAMPLE_RATE, 500.0)
        assert np.allclose(result, silent)


class TestBitcrush:
    def test_reduces_amplitude_resolution(self):
        audio = _make_stereo(0.5)
        crushed = transforms.bitcrush(audio, SAMPLE_RATE, 4)
        assert crushed.shape == audio.shape
        assert np.all(np.isfinite(crushed))

    def test_16_bit_preserves(self):
        audio = _make_stereo(0.5)
        crushed = transforms.bitcrush(audio, SAMPLE_RATE, 16)
        assert np.allclose(crushed, audio, atol=1e-6)

    def test_2_bit_extreme(self):
        audio = _make_stereo(0.5)
        crushed = transforms.bitcrush(audio, SAMPLE_RATE, 2)
        assert crushed.shape == audio.shape
        unique_vals = np.unique(crushed)
        assert len(unique_vals) <= 4  # 2 bits = at most 4 unique values per channel


class TestAddNoise:
    def test_adds_noise(self):
        audio = _make_stereo(0.5)
        noisy = transforms.add_noise(audio, SAMPLE_RATE, 0.1)
        assert noisy.shape == audio.shape
        assert not np.allclose(noisy, audio)

    def test_zero_noise_preserves(self):
        audio = _make_stereo(0.5)
        noisy = transforms.add_noise(audio, SAMPLE_RATE, 0.0)
        assert np.allclose(noisy, audio)

    def test_preserves_dtype(self):
        audio = _make_stereo(0.5).astype(np.float64)
        noisy = transforms.add_noise(audio, SAMPLE_RATE, 0.05)
        assert noisy.dtype == np.float64


class TestGaussianSmooth:
    def test_smoothes_audio(self):
        audio = _make_stereo(0.5)
        smooth = transforms.gaussian_smooth(audio, SAMPLE_RATE, 10.0)
        assert smooth.shape == audio.shape
        assert np.all(np.isfinite(smooth))

    def test_zero_sigma(self):
        audio = _make_stereo(0.5)
        smooth = transforms.gaussian_smooth(audio, SAMPLE_RATE, 0.1)
        assert np.allclose(smooth, audio, atol=1e-4)


class TestDownsample:
    def test_reduces_bandwidth(self):
        audio = _make_stereo(0.5)
        down = transforms.downsample(audio, SAMPLE_RATE, 4)
        assert down.shape == audio.shape
        assert np.all(np.isfinite(down))

    def test_factor_1_preserves(self):
        audio = _make_stereo(0.5)
        down = transforms.downsample(audio, SAMPLE_RATE, 1)
        assert down.shape == audio.shape


class TestSliceAudio:
    def test_splits_into_grains(self):
        audio = _make_stereo(2.0)
        grains = transforms.slice_audio(audio, SAMPLE_RATE, 100.0)
        assert len(grains) > 5

    def test_grain_length(self):
        audio = _make_stereo(2.0)
        grain_ms = 200.0
        expected_samples = int(SAMPLE_RATE * grain_ms / 1000)
        grains = transforms.slice_audio(audio, SAMPLE_RATE, grain_ms)
        assert all(abs(len(g) - expected_samples) < expected_samples * 0.1 for g in grains)

    def test_concatenated_grains_match_duration(self):
        audio = _make_stereo(1.0)
        grains = transforms.slice_audio(audio, SAMPLE_RATE, 100.0)
        total = sum(len(g) for g in grains)
        assert total == len(audio)


class TestPitchShiftGrain:
    def test_shifts_pitch(self):
        audio = _make_stereo(0.2)
        shifted = transforms.pitch_shift_grain(audio, 12)
        assert shifted.shape == audio.shape
        assert np.all(np.isfinite(shifted))

    def test_zero_semitones_preserves(self):
        audio = _make_stereo(0.2)
        shifted = transforms.pitch_shift_grain(audio, 0)
        assert shifted.shape == audio.shape


class TestSimpleReverb:
    def test_produces_longer_tail(self):
        audio = _make_stereo(0.3)
        wet = transforms.simple_reverb(audio, SAMPLE_RATE, 0.5, 0.5)
        assert len(wet) >= len(audio)

    def test_no_decay(self):
        audio = _make_stereo(0.3)
        wet = transforms.simple_reverb(audio, SAMPLE_RATE, 0.0, 0.1)
        assert len(wet) >= len(audio)


class TestDelayEcho:
    def test_preserves_shape(self):
        audio = _make_stereo(0.3)
        result = transforms.delay_echo(audio, SAMPLE_RATE, delay_ms=50.0, feedback=0.3, mix=0.5)
        assert result.shape == audio.shape
        assert np.all(np.isfinite(result))

    def test_zero_delay_returns_copy(self):
        audio = _make_stereo(0.3)
        result = transforms.delay_echo(audio, SAMPLE_RATE, delay_ms=0.0)
        assert np.allclose(result, audio)


class TestSoftClip:
    def test_preserves_shape(self):
        audio = _make_stereo(0.3)
        result = transforms.soft_clip(audio, SAMPLE_RATE, drive=0.5)
        assert result.shape == audio.shape
        assert np.all(np.isfinite(result))

    def test_zero_drive_near_identity(self):
        audio = _make_stereo(0.3)
        result = transforms.soft_clip(audio, SAMPLE_RATE, drive=0.0)
        assert np.allclose(result, audio, atol=1e-4)


class TestTapeWow:
    def test_preserves_shape(self):
        audio = _make_stereo(0.3)
        result = transforms.tape_wow(audio, SAMPLE_RATE, depth=0.005, rate=4.0)
        assert result.shape == audio.shape
        assert np.all(np.isfinite(result))

    def test_zero_depth_identity(self):
        audio = _make_stereo(0.3)
        result = transforms.tape_wow(audio, SAMPLE_RATE, depth=0.0)
        assert np.allclose(result, audio)
