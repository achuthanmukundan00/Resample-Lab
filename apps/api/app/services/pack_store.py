"""In-memory pack store — thread-safe job state tracking."""

from __future__ import annotations

import threading
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum


class PackStatus(str, Enum):
    QUEUED = "queued"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    DELETED = "deleted"


@dataclass
class PackState:
    pack_id: str
    status: PackStatus = PackStatus.QUEUED
    pack_name: str = ""
    preset: str = ""
    chaos: float = 0.0
    output_format: str = "wav"
    source_filenames: list[str] = field(default_factory=list)
    progress: float = 0.0
    message: str = "Queued"
    error: str | None = None
    manifest: dict | None = None
    zip_path: str | None = None
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


class PackStore:
    """Thread-safe in-memory store for pack states."""

    def __init__(self) -> None:
        self._packs: dict[str, PackState] = {}
        self._lock = threading.Lock()

    def create(self, state: PackState) -> PackState:
        with self._lock:
            self._packs[state.pack_id] = state
        return state

    def get(self, pack_id: str) -> PackState | None:
        with self._lock:
            return self._packs.get(pack_id)

    def delete(self, pack_id: str) -> bool:
        with self._lock:
            if pack_id in self._packs:
                state = self._packs[pack_id]
                if state.status == PackStatus.PROCESSING:
                    return False
                del self._packs[pack_id]
                return True
            return False

    def list(self, limit: int = 20, status: str | None = None) -> list[PackState]:
        with self._lock:
            items = list(self._packs.values())
            if status:
                items = [p for p in items if p.status.value == status]
            items.sort(key=lambda p: p.created_at, reverse=True)
            return items[:limit]

    def update(self, pack_id: str, **kwargs) -> PackState | None:
        with self._lock:
            state = self._packs.get(pack_id)
            if state is None:
                return None
            for k, v in kwargs.items():
                if hasattr(state, k):
                    setattr(state, k, v)
            state.updated_at = datetime.now(timezone.utc)
            return state


pack_store = PackStore()
