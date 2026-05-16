"""Tests for Resample-Lab recipe generation."""

import tempfile
from pathlib import Path

import numpy as np
import pytest
import soundfile as sf

from app.dsp import recipes

SAMPLE_RATE = 48000


@pytest.fixture
def source_paths(tmp_path):
    """Create a short stereo test WAV for recipe testing."""
    n = int(SAMPLE_RATE * 1.0)
    t = np.linspace(0, 1.0, n, endpoint=False)
    data = 0.5 * np.sin(2 * np.pi * 440 * t)
    data = np.column_stack([data, data])
    path = tmp_path / "source.wav"
    sf.write(str(path), data, SAMPLE_RATE, subtype="PCM_16")
    return [path]


@pytest.fixture
def output_dir(tmp_path):
    d = tmp_path / "output"
    d.mkdir()
    return d


class TestAmbientStretchLab:
    def test_generates_three_outputs(self, source_paths, output_dir):
        outputs = recipes.ambient_stretch_lab(source_paths, output_dir, 0.33)
        assert len(outputs) == 3
        for o in outputs:
            assert (output_dir / o["path"]).exists()

    def test_generates_with_max_chaos(self, source_paths, output_dir):
        outputs = recipes.ambient_stretch_lab(source_paths, output_dir, 1.0)
        assert len(outputs) == 3


class TestGhostReverseLab:
    def test_generates_three_outputs(self, source_paths, output_dir):
        outputs = recipes.ghost_reverse_lab(source_paths, output_dir, 0.5)
        assert len(outputs) == 3
        for o in outputs:
            assert (output_dir / o["path"]).exists()

    def test_zero_chaos(self, source_paths, output_dir):
        outputs = recipes.ghost_reverse_lab(source_paths, output_dir, 0.0)
        assert len(outputs) == 3


class TestGranularShards:
    def test_generates_three_outputs(self, source_paths, output_dir):
        outputs = recipes.granular_shards(source_paths, output_dir, 0.5)
        assert len(outputs) == 3
        for o in outputs:
            assert (output_dir / o["path"]).exists()

    def test_extreme_chaos(self, source_paths, output_dir):
        outputs = recipes.granular_shards(source_paths, output_dir, 1.0)
        assert len(outputs) == 3


class TestBitrotDirt:
    def test_generates_three_outputs(self, source_paths, output_dir):
        outputs = recipes.bitrot_dirt(source_paths, output_dir, 0.5)
        assert len(outputs) == 3
        for o in outputs:
            assert (output_dir / o["path"]).exists()


class TestPitchWreckage:
    def test_generates_three_outputs(self, source_paths, output_dir):
        outputs = recipes.pitch_wreckage(source_paths, output_dir, 0.5)
        assert len(outputs) == 3
        for o in outputs:
            assert (output_dir / o["path"]).exists()


class TestLoopExtractor:
    def test_generates_two_outputs(self, source_paths, output_dir):
        outputs = recipes.loop_extractor(source_paths, output_dir, 0.5)
        assert len(outputs) == 2
        for o in outputs:
            assert (output_dir / o["path"]).exists()


class TestImpactRiserMutator:
    def test_generates_three_outputs(self, source_paths, output_dir):
        outputs = recipes.impact_riser_mutator(source_paths, output_dir, 0.5)
        assert len(outputs) == 3
        for o in outputs:
            assert (output_dir / o["path"]).exists()


class TestChaosPack:
    def test_generates_five_outputs(self, source_paths, output_dir):
        outputs = recipes.chaos_pack(source_paths, output_dir, 0.5)
        assert len(outputs) == 5
        for o in outputs:
            assert (output_dir / o["path"]).exists()

    def test_zero_chaos(self, source_paths, output_dir):
        outputs = recipes.chaos_pack(source_paths, output_dir, 0.0)
        assert len(outputs) == 5


class TestRegistry:
    def test_all_presets_registered(self):
        presets = recipes.list_presets()
        assert len(presets) == 8

    def test_get_preset_info(self):
        info = recipes.get_preset_info("ambient_stretch")
        assert info is not None
        assert info["name"] == "Ambient Stretch Lab"

    def test_get_preset_info_unknown(self):
        info = recipes.get_preset_info("nonexistent")
        assert info is None

    def test_generate_unknown_raises(self, source_paths, output_dir):
        with pytest.raises(ValueError, match="Unknown preset"):
            recipes.generate_preset("nonexistent", source_paths, output_dir, 0.5)

    def test_generate_via_registry(self, source_paths, output_dir):
        outputs = recipes.generate_preset("granular_shards", source_paths, output_dir, 0.5)
        assert len(outputs) == 3


class TestRecipeFXIntegration:
    """Verify FX transforms are wired into recipes without breaking output."""

    def test_ambient_stretch_produces_files_with_fx(self, source_paths, output_dir):
        outputs = recipes.ambient_stretch_lab(source_paths, output_dir, 0.5)
        assert len(outputs) == 3
        for o in outputs:
            path = output_dir / o["path"]
            assert path.exists()
            assert path.stat().st_size > 0

    def test_ghost_reverse_produces_files_with_fx(self, source_paths, output_dir):
        outputs = recipes.ghost_reverse_lab(source_paths, output_dir, 0.5)
        assert len(outputs) == 3
        for o in outputs:
            path = output_dir / o["path"]
            assert path.exists()
            assert path.stat().st_size > 0
