"""Tool detection for DSP engines."""

from __future__ import annotations

import importlib
import logging
import re
import shutil
import subprocess
from dataclasses import dataclass
from enum import Enum

logger = logging.getLogger(__name__)


class DspTool(str, Enum):
    FFMPEG = "ffmpeg"
    FFPROBE = "ffprobe"
    PYTHON_DSP = "python_dsp"


@dataclass(frozen=True)
class ToolInfo:
    available: bool
    version: str | None = None
    path: str | None = None
    error: str | None = None


FFMPEG_VERSION_RE = re.compile(r"ffmpeg version (\S+)")
FFPROBE_VERSION_RE = re.compile(r"ffprobe version (\S+)")

PYTHON_DSP_PACKAGES: dict[str, str] = {
    "numpy": "numpy",
    "scipy": "scipy",
    "soundfile": "soundfile",
}


def _run_tool_version(
    executable: str, version_flag: str, version_re: re.Pattern, timeout: int = 10
) -> ToolInfo:
    exe_path = shutil.which(executable)
    if exe_path is None:
        return ToolInfo(available=False, error=f"{executable} not found on PATH")
    try:
        result = subprocess.run(
            [exe_path, version_flag],
            capture_output=True, text=True, timeout=timeout,
        )
        full_output = result.stdout + result.stderr
        match = version_re.search(full_output)
        version = match.group(1) if match else "unknown"
        return ToolInfo(available=True, version=version, path=exe_path)
    except (FileNotFoundError, subprocess.TimeoutExpired, OSError) as e:
        return ToolInfo(available=False, error=str(e))


def check_ffmpeg() -> ToolInfo:
    return _run_tool_version("ffmpeg", "-version", FFMPEG_VERSION_RE)


def check_ffprobe() -> ToolInfo:
    return _run_tool_version("ffprobe", "-version", FFPROBE_VERSION_RE)


def check_python_dsp() -> dict[str, ToolInfo]:
    results: dict[str, ToolInfo] = {}
    for pkg_name, import_name in PYTHON_DSP_PACKAGES.items():
        try:
            mod = importlib.import_module(import_name)
            version = getattr(mod, "__version__", None)
            results[pkg_name] = ToolInfo(
                available=True, version=version or "unknown",
                path=getattr(mod, "__file__", None),
            )
        except ImportError as exc:
            results[pkg_name] = ToolInfo(available=False, error=str(exc))
    return results


def check_all() -> dict[str, ToolInfo | dict[str, ToolInfo]]:
    return {
        "ffmpeg": check_ffmpeg(),
        "ffprobe": check_ffprobe(),
        "python_dsp": check_python_dsp(),
    }
