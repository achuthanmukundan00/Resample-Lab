"""Pack API routes — upload, generate, download, delete."""

from __future__ import annotations

import asyncio
import logging
import re
import shutil
import uuid
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse

from app.dsp import (
    check_all, delete_pack, get_pack_dir, get_preset_info, io, list_presets, run_pack,
)
from app.dsp.packs import count_outputs_in_zip
from app.dsp.recipes import RECIPE_REGISTRY
from app.schemas.pack import (
    CapabilitiesResponse, ErrorResponse, PackCreateResponse,
    PackListResponse, PackStatusResponse, PresetInfo,
)
from app.services.pack_store import PackState, PackStatus, pack_store
from app.settings import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["packs"])


@router.get("/capabilities", response_model=CapabilitiesResponse)
def get_capabilities():
    tools_raw = check_all()
    tools_out: dict = {}
    for name, info in tools_raw.items():
        if hasattr(info, "available"):
            tools_out[name] = {"available": info.available, "version": info.version}
        elif isinstance(info, dict):
            sub = {}
            for sub_name, sub_info in info.items():
                if hasattr(sub_info, "available"):
                    sub[sub_name] = {
                        "available": sub_info.available,
                        "version": sub_info.version,
                    }
            if sub:
                tools_out[name] = {"available": any(
                    v.get("available") for v in sub.values()
                ), "engines": sub}
            else:
                tools_out[name] = {"available": False}

    presets = [
        PresetInfo(id=pid, **{k: v for k, v in info.items() if k != "fn" and k in PresetInfo.model_fields})
        for pid, info in RECIPE_REGISTRY.items()
    ]

    return CapabilitiesResponse(
        presets=presets,
        tools=tools_out,
        max_upload_mb=settings.max_upload_mb,
        max_duration_seconds=settings.max_audio_duration,
    )


def _sanitize_filename(name: str) -> str:
    """Remove path separators and dangerous characters."""
    name = Path(name).name
    name = re.sub(r"[^\w\-._]", "_", name)
    if not name:
        name = f"file_{uuid.uuid4().hex[:8]}"
    return name


def _validate_content_type(filename: str) -> bool:
    return io.is_supported_format(filename)


async def process_pack_in_background(pack_id: str, upload_dir: Path, preset: str, chaos: float, pack_name: str):
    """Run pack generation in background with phase-based progress and timeout."""
    logger.info("Processing pack %s (preset=%s, chaos=%s)", pack_id, preset, chaos)
    try:
        pack_store.update(pack_id, status=PackStatus.PROCESSING, progress=0.01, message="Queued — processing will begin shortly")

        source_paths = sorted(upload_dir.iterdir())
        logger.info("Pack %s sources: %s", pack_id, [p.name for p in source_paths])

        def progress_callback(pct: float, msg: str) -> None:
            logger.debug("Pack %s progress: %.2f — %s", pack_id, pct, msg)
            pack_store.update(pack_id, progress=pct, message=msg)

        logger.info("Pack %s running run_pack (timeout=%ss)", pack_id, settings.job_timeout)
        manifest = await asyncio.wait_for(
            asyncio.to_thread(
                run_pack,
                pack_id=pack_id,
                pack_name=pack_name,
                preset_id=preset,
                chaos=chaos,
                source_paths=source_paths,
                progress_callback=progress_callback,
            ),
            timeout=settings.job_timeout,
        )
        logger.info("Pack %s completed successfully", pack_id)
        pack_store.update(
            pack_id,
            status=PackStatus.COMPLETED,
            progress=1.0,
            message="Pack generated successfully",
            manifest=manifest,
            zip_path=manifest.get("zip_path"),
        )
    except asyncio.TimeoutError:
        logger.error("Pack %s timed out after %ss", pack_id, settings.job_timeout)
        pack_store.update(
            pack_id,
            status=PackStatus.FAILED,
            error=f"Job timed out after {settings.job_timeout}s. Try shorter audio files or lower chaos.",
            message="Pack generation timed out",
        )
    except Exception as e:
        logger.exception("Pack %s failed with exception", pack_id)
        pack_store.update(
            pack_id,
            status=PackStatus.FAILED,
            error=str(e),
            message="Pack generation failed",
        )


@router.post("/packs", response_model=PackCreateResponse, status_code=201,
             responses={400: {"model": ErrorResponse}})
async def create_pack(
    background_tasks: BackgroundTasks,
    files: list[UploadFile] = File(...),
    preset: str = Form(...),
    chaos: float = Form(0.5),
    output_format: str = Form("wav"),
    pack_name: str = Form(""),
):
    if not files:
        raise HTTPException(status_code=400, detail="No files uploaded")

    if preset not in RECIPE_REGISTRY:
        raise HTTPException(status_code=400, detail=f"Unknown preset: {preset}")

    if chaos < 0.0 or chaos > 1.0:
        raise HTTPException(status_code=400, detail="Chaos must be between 0.0 and 1.0")

    max_upload_bytes = settings.max_upload_mb * 1024 * 1024
    total_size = 0
    for f in files:
        if not _validate_content_type(f.filename or ""):
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported format: {f.filename}. Supported: {', '.join(io.ACCEPTED_EXTENSIONS)}",
            )

    pack_id = uuid.uuid4().hex
    name = pack_name or f"pack_{pack_id[:8]}"

    # Create upload directory
    upload_dir = get_pack_dir(pack_id) / "uploads"
    upload_dir.mkdir(parents=True, exist_ok=True)

    # Save files
    source_filenames = []
    for f in files:
        safe_name = _sanitize_filename(f.filename or "audio.wav")
        file_path = upload_dir / safe_name
        content = await f.read()
        total_size += len(content)
        if total_size > max_upload_bytes:
            shutil.rmtree(str(get_pack_dir(pack_id)), ignore_errors=True)
            raise HTTPException(
                status_code=413,
                detail=f"Total upload exceeds {settings.max_upload_mb}MB limit. "
                       f"Uploaded {total_size / 1024 / 1024:.1f}MB, limit {settings.max_upload_mb}MB.",
            )
        file_path.write_bytes(content)
        source_filenames.append(safe_name)

    # Validate audio files
    for fname in source_filenames:
        fpath = upload_dir / fname
        result = io.validate_audio(fpath)
        if not result.get("valid", True):
            reason = result.get("reason", "unknown error")
            shutil.rmtree(str(get_pack_dir(pack_id)), ignore_errors=True)
            raise HTTPException(
                status_code=400,
                detail=f"Invalid file {fname}: {reason}",
            )

    # Create pack state
    state = PackState(
        pack_id=pack_id,
        pack_name=name,
        preset=preset,
        chaos=chaos,
        output_format=output_format,
        source_filenames=source_filenames,
        progress=0.01,
        message="Queued — processing will begin shortly",
    )
    pack_store.create(state)
    preset_info = get_preset_info(preset)
    output_count = (preset_info or {}).get("output_count", 3) * len(source_filenames)

    # Enqueue background task
    background_tasks.add_task(
        process_pack_in_background, pack_id, upload_dir, preset, chaos, name
    )

    return PackCreateResponse(
        pack_id=pack_id,
        status="queued",
        message=f"Pack created. {len(source_filenames)} file(s) uploaded, ~{output_count} variants queued.",
    )


@router.get("/packs", response_model=PackListResponse)
def list_packs(status: Optional[str] = Query(None)):
    items = pack_store.list(limit=50, status=status)
    return PackListResponse(
        items=[_state_to_response(s) for s in items],
        total=len(items),
    )


@router.get("/packs/{pack_id}", response_model=PackStatusResponse,
            responses={404: {"model": ErrorResponse}})
def get_pack(pack_id: str):
    state = pack_store.get(pack_id)
    if state is None:
        raise HTTPException(status_code=404, detail="Pack not found")
    return _state_to_response(state)


@router.get("/packs/{pack_id}/download",
            responses={400: {"model": ErrorResponse}, 404: {"model": ErrorResponse}, 409: {"model": ErrorResponse}, 425: {"model": ErrorResponse}})
def download_pack(pack_id: str):
    state = pack_store.get(pack_id)
    if state is None:
        raise HTTPException(status_code=404, detail="Pack not found")
    if state.status == PackStatus.PROCESSING:
        raise HTTPException(status_code=425, detail="Pack is still processing — try again later")
    if state.status == PackStatus.QUEUED:
        raise HTTPException(status_code=425, detail="Pack is queued — try again later")
    if state.status == PackStatus.FAILED:
        raise HTTPException(status_code=409, detail=f"Pack generation failed: {state.error}")
    if state.status == PackStatus.DELETED:
        raise HTTPException(status_code=404, detail="Pack has been deleted")

    zip_path = state.zip_path
    if not zip_path or not Path(zip_path).exists():
        # Try to find ZIP in pack dir
        pack_dir = get_pack_dir(pack_id)
        zips = list(pack_dir.glob("*.zip"))
        if zips:
            zip_path = str(zips[0])
        else:
            raise HTTPException(status_code=404, detail="ZIP file not found on disk")

    filename = f"resample-lab_{state.pack_name or pack_id[:8]}.zip"
    return FileResponse(zip_path, media_type="application/zip", filename=filename)


@router.delete("/packs/{pack_id}", status_code=204,
               responses={404: {"model": ErrorResponse}, 409: {"model": ErrorResponse}})
def delete_pack_endpoint(pack_id: str):
    state = pack_store.get(pack_id)
    if state is None:
        raise HTTPException(status_code=404, detail="Pack not found")
    if state.status == PackStatus.PROCESSING:
        raise HTTPException(status_code=409, detail="Cannot delete a pack that is processing")

    # Remove from in-memory store
    pack_store.delete(pack_id)

    # Remove from disk
    delete_pack(pack_id)
    return None


def _state_to_response(state: PackState) -> PackStatusResponse:
    return PackStatusResponse(
        pack_id=state.pack_id,
        status=state.status.value,
        progress=state.progress,
        message=state.message,
        error=state.error,
        manifest=state.manifest,
        zip_path=state.zip_path,
        source_files=state.source_filenames,
        preset=state.preset,
        chaos=state.chaos,
        created_at=state.created_at.isoformat() if state.created_at else "",
        updated_at=state.updated_at.isoformat() if state.updated_at else "",
    )
