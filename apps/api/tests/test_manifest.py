"""Tests for Resample-Lab manifest and ZIP utilities."""

import json
from pathlib import Path

import pytest

from app.dsp import manifest
from app.dsp.zip import create_pack_zip, validate_zip


def test_build_manifest():
    sources = [{"filename": "tone.wav", "format": "wav", "duration": 2.0}]
    outputs = [
        {"path": "tone__ambient_bed.wav", "category": "ambience", "recipe": "stretch", "source": "tone.wav"},
        {"path": "tone__reverse_smear.wav", "category": "ambience", "recipe": "reverse_smear", "source": "tone.wav"},
    ]
    tools_used = {"numpy": "1.26.0"}
    m = manifest.build_manifest(
        pack_id="test-123",
        pack_name="test_pack",
        preset="ambient_stretch",
        chaos=0.33,
        sources=sources,
        outputs=outputs,
        tools_used=tools_used,
    )
    assert m["pack_name"] == "test_pack"
    assert len(m["outputs"]) == 2
    assert m["preset"] == "ambient_stretch"
    assert m["chaos"] == 0.33
    assert m["pack_id"] == "test-123"


def test_write_manifest(tmp_path):
    m = {"pack_name": "test", "outputs": []}
    p = tmp_path / "manifest.json"
    manifest.write_manifest(m, p)
    assert p.exists()
    with open(p) as f:
        assert json.load(f)["pack_name"] == "test"


def test_build_readme():
    outputs = [
        {"path": "out.wav", "recipe": "stretch", "category": "ambience", "duration": 3.0},
    ]
    readme = manifest.build_readme("test_pack", preset="ambient_stretch", chaos=0.5, outputs=outputs)
    assert "test_pack" in readme
    assert "ambient_stretch" in readme
    assert "0.5" in readme
    assert "out.wav" in readme


class TestZip:
    def test_create_pack_zip(self, tmp_path):
        source_dir = tmp_path / "pack_files"
        source_dir.mkdir()
        (source_dir / "output.wav").write_text("fake audio data")
        (source_dir / "manifest.json").write_text('{"pack_name":"test"}')
        (source_dir / "README.txt").write_text("Test readme")

        zip_path = tmp_path / "output.zip"
        result = create_pack_zip(source_dir, zip_path)
        assert result.exists()
        assert result.stat().st_size > 0

    def test_validate_zip(self, tmp_path):
        source_dir = tmp_path / "pack_files2"
        source_dir.mkdir()
        (source_dir / "output.wav").write_text("fake audio data")
        (source_dir / "manifest.json").write_text('{"pack_name":"test"}')

        zip_path = tmp_path / "valid.zip"
        create_pack_zip(source_dir, zip_path)
        result = validate_zip(zip_path)
        assert result is True

    def test_validate_zip_nonexistent(self, tmp_path):
        result = validate_zip(tmp_path / "nothing.zip")
        assert result is False
