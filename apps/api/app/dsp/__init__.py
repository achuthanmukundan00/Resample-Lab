"""Resample-Lab DSP engine — non-AI audio processing."""

from app.dsp.io import (
    read_audio, write_audio, normalize_peak,
    fade_in, fade_out, apply_fades,
    convert_to_wav, probe_duration, probe_sample_rate,
    validate_audio, is_supported_format, ACCEPTED_EXTENSIONS,
    SAMPLE_RATE,
)
from app.dsp.tools import check_all, check_ffmpeg, check_ffprobe, check_python_dsp, DspTool
from app.dsp.manifest import build_manifest, write_manifest, build_tools_info, build_readme
from app.dsp.packs import run_pack, get_pack_dir, delete_pack, list_packs
from app.dsp.recipes import list_presets, get_preset_info, generate_preset

__all__ = [
    "read_audio", "write_audio", "normalize_peak",
    "fade_in", "fade_out", "apply_fades",
    "convert_to_wav", "probe_duration", "probe_sample_rate",
    "validate_audio", "is_supported_format", "ACCEPTED_EXTENSIONS",
    "SAMPLE_RATE",
    "check_all", "check_ffmpeg", "check_ffprobe", "check_python_dsp", "DspTool",
    "build_manifest", "write_manifest", "build_tools_info", "build_readme",
    "run_pack", "get_pack_dir", "delete_pack", "list_packs",
    "list_presets", "get_preset_info", "generate_preset",
]
