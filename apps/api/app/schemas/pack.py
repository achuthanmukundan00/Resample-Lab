"""Pydantic schemas for pack API."""

from __future__ import annotations

from pydantic import BaseModel, Field
from typing import Optional


class PresetInfo(BaseModel):
    id: str
    name: str
    description: str
    tools: list[str] = []
    output_count: int = 3
    categories: list[str] = []


class CapabilitiesResponse(BaseModel):
    presets: list[PresetInfo]
    chaos_levels: dict = Field(default_factory=lambda: {"min": 0.0, "max": 1.0, "step": 0.05})
    output_formats: list[str] = ["wav"]
    accepted_extensions: list[str] = Field(
        default_factory=lambda: [".wav", ".aiff", ".aif", ".flac", ".mp3", ".m4a", ".ogg"]
    )
    max_upload_mb: int = 100
    max_duration_seconds: float = 600.0
    tools: dict = {}


class PackCreateRequest(BaseModel):
    preset: str
    chaos: float = Field(default=0.5, ge=0.0, le=1.0)
    output_format: str = "wav"
    pack_name: str = ""


class PackCreateResponse(BaseModel):
    pack_id: str
    status: str = "queued"
    message: str = ""


class PackStatusResponse(BaseModel):
    pack_id: str
    status: str
    progress: float = 0.0
    message: str = ""
    error: Optional[str] = None
    manifest: Optional[dict] = None
    zip_path: Optional[str] = None
    source_files: list[str] = []
    preset: str = ""
    chaos: float = 0.0
    created_at: str = ""
    updated_at: str = ""


class PackListResponse(BaseModel):
    items: list[PackStatusResponse]
    total: int


class ErrorResponse(BaseModel):
    detail: str
    code: Optional[str] = None
