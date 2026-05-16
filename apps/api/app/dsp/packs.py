"""Pack orchestrator — runs recipe, builds manifest, creates ZIP."""

from __future__ import annotations

import logging
import os
import shutil
import threading
import time
from pathlib import Path

from app.dsp import io, manifest, recipes, tools as dsp_tools, zip as pack_zip

logger = logging.getLogger(__name__)

PACK_BASE_DIR = Path.home() / ".resample-lab" / "packs"

# MVP free-tier: only one pack generation at a time to bound peak memory
_process_semaphore = threading.Semaphore(1)


def _current_rss() -> int:
    """Return current RSS in bytes, or 0 if unavailable."""
    try:
        # Linux
        with open("/proc/self/status") as f:
            for line in f:
                if line.startswith("VmRSS:"):
                    return int(line.split()[1]) * 1024  # kB -> bytes
    except (FileNotFoundError, OSError, ValueError):
        pass
    try:
        import psutil
        return psutil.Process().memory_info().rss
    except ImportError:
        pass
    return 0


def _fmt_bytes(n: int) -> str:
    if n < 1024 * 1024:
        return f"{n / 1024:.0f}KB"
    return f"{n / (1024 * 1024):.0f}MB"


def _report(progress_callback, pct: float, msg: str) -> None:
    if progress_callback:
        try:
            progress_callback(pct, msg)
        except Exception:
            pass


def run_pack(
    pack_id: str,
    pack_name: str,
    preset_id: str,
    chaos: float,
    source_paths: list[Path],
    progress_callback: callable | None = None,
) -> dict:
    """Execute a full pack generation.

    1. Detect tools
    2. Validate sources
    3. Create working directory
    4. Run recipe
    5. Write manifest
    6. Create ZIP
    7. Return manifest dict
    """
    _report(progress_callback, 0.02, "Waiting for processing slot...")
    acquired = _process_semaphore.acquire(timeout=300)
    if not acquired:
        raise RuntimeError("Processing slot unavailable after 300s wait — try again later")
    try:
        _report(progress_callback, 0.05, "Detecting tools...")

        tools = dsp_tools.check_all()
        tool_versions: dict[str, str] = {}

        if isinstance(tools.get("ffmpeg"), dsp_tools.ToolInfo) and tools["ffmpeg"].available:
            tool_versions["ffmpeg"] = tools["ffmpeg"].version or "unknown"
        if isinstance(tools.get("ffprobe"), dsp_tools.ToolInfo) and tools["ffprobe"].available:
            tool_versions["ffprobe"] = tools["ffprobe"].version or "unknown"
        python_dsp = tools.get("python_dsp", {})
        if isinstance(python_dsp, dict):
            for pkg, info in python_dsp.items():
                if hasattr(info, "available") and info.available and info.version:
                    tool_versions[pkg] = info.version

        # Validate sources
        _report(progress_callback, 0.08, "Validating audio files...")
        source_info = []
        for src in source_paths:
            validation = io.validate_audio(src)
            if not validation.get("valid", True):
                raise ValueError(f"Invalid source {src.name}: {validation.get('reason')}")
            source_info.append({
                "filename": src.name,
                "format": src.suffix.lower().lstrip("."),
                "duration": io.probe_duration(src),
                "sample_rate": io.probe_sample_rate(src),
            })

        # Create working directory
        pack_dir = PACK_BASE_DIR / pack_id
        samples_dir = pack_dir / "samples"
        samples_dir.mkdir(parents=True, exist_ok=True)

        # Copy sources to working dir
        _report(progress_callback, 0.12, "Preparing working directory...")
        working_sources = []
        for src in source_paths:
            dest = pack_dir / src.name
            shutil.copy2(src, dest)
            working_sources.append(dest)

        # Log source memory footprint
        for si in source_info:
            sr = si.get("sample_rate", 48000)
            dur = si.get("duration", 0)
            channels = 2  # always stereo after read_audio
            est_mb = sr * dur * channels * 4 / (1024 * 1024)  # float32
            logger.info(
                "Source %s: %.1fs %dch %dHz -> ~%.0fMB float32",
                si["filename"], dur, channels, sr, est_mb,
            )

        # Run recipe
        _report(progress_callback, 0.15, "Processing audio...")
        start = time.time()
        rss_before = _current_rss()
        try:
            outputs = recipes.generate_preset(preset_id, working_sources, samples_dir, chaos)
        except Exception as e:
            logger.exception("Recipe failed")
            raise
        rss_after = _current_rss()
        processing_time = int((time.time() - start) * 1000)
        logger.info(
            "Pack %s processed in %dms, RSS: %s -> %s (delta %s)",
            pack_id, processing_time,
            _fmt_bytes(rss_before), _fmt_bytes(rss_after), _fmt_bytes(max(0, rss_after - rss_before)),
        )
        _report(progress_callback, 0.85, "Building manifest...")

        # Build output metadata with durations
        output_entries = []
        for o in outputs:
            path_str = o["path"]
            path = Path(path_str)
            if not path.is_absolute():
                path = samples_dir / path_str
            dur = io.probe_duration(path) if path.exists() else 0.0
            o["duration"] = dur
            output_entries.append(o)

        # Write manifest.json
        manifest_data = manifest.build_manifest(
            pack_id=pack_id,
            pack_name=pack_name,
            preset=preset_id,
            chaos=chaos,
            sources=source_info,
            outputs=output_entries,
            tools_used=tool_versions,
        )
        manifest.write_manifest(manifest_data, pack_dir / "manifest.json")

        # Write tools.json
        tools_data = manifest.build_tools_info(tools)
        (pack_dir / "tools.json").write_text(
            __import__("json").dumps(tools_data, indent=2, default=str), encoding="utf-8"
        )

        # Write README.txt
        readme_text = manifest.build_readme(pack_name, preset_id, chaos, output_entries)
        (pack_dir / "README.txt").write_text(readme_text, encoding="utf-8")

        # Create ZIP
        _report(progress_callback, 0.92, "Creating ZIP archive...")
        zip_path = pack_dir / f"{pack_name or pack_id}.zip"
        pack_zip.create_pack_zip(pack_dir, zip_path)

        # Clean up source copies
        _report(progress_callback, 0.97, "Finalizing...")
        for s in working_sources:
            s.unlink(missing_ok=True)

        manifest_data["processing_time_ms"] = processing_time
        manifest_data["zip_path"] = str(zip_path)
        return manifest_data
    finally:
        _process_semaphore.release()


def get_pack_dir(pack_id: str) -> Path:
    return PACK_BASE_DIR / pack_id


def delete_pack(pack_id: str) -> bool:
    pack_dir = PACK_BASE_DIR / pack_id
    if pack_dir.exists():
        shutil.rmtree(pack_dir, ignore_errors=True)
        return True
    return False


def list_packs() -> list[Path]:
    if not PACK_BASE_DIR.exists():
        return []
    return sorted(
        [d for d in PACK_BASE_DIR.iterdir() if d.is_dir() and not d.name.startswith(".")],
        key=lambda p: p.stat().st_mtime, reverse=True,
    )


def count_outputs_in_zip(zip_path: Path) -> int:
    """Count WAV files in a completed pack ZIP."""
    import zipfile
    try:
        with zipfile.ZipFile(zip_path, "r") as zf:
            return sum(1 for n in zf.namelist() if n.endswith(".wav"))
    except Exception:
        return 0
