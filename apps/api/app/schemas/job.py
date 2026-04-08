from __future__ import annotations

from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, StrictInt, StrictStr
from app.models.job import JobStatus

status: JobStatus

class JobCreateRequest(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        strict=True,
        json_schema_extra={
            "example": {
                "preset": "default",
                "input_metadata": {
                    "source_url": "https://example.com/audio.wav",
                    "filename": "audio.wav"
                },
                "output_count": 1
            }
        },
    )

    preset: StrictStr = Field(..., min_length=1, max_length=100)
    input_metadata: dict[str, Any] = Field(default_factory=dict)
    output_count: StrictInt = Field(default=1, ge=1, le=100)


class JobResponse(BaseModel):
    model_config = ConfigDict(
        from_attributes=True,
        extra="forbid",
        strict=True,
    )

    id: UUID
    status: JobStatus
    preset: str
    input_metadata: dict[str, Any]
    output_count: int
    processing_time_ms: int | None
    error: str | None
    created_at: datetime
    updated_at: datetime


class JobListResponse(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        strict=True,
    )

    items: list[JobResponse]


class JobStatusUpdateRequest(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        strict=True,
    )

    status: JobStatus
    processing_time_ms: StrictInt | None = Field(default=None, ge=0)
    error: StrictStr | None = None