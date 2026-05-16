"""App settings from environment variables with safe defaults."""

from __future__ import annotations

import os


class Settings:
    """Env-backed settings for public deployment hardening."""

    @property
    def max_upload_mb(self) -> int:
        return int(os.environ.get("MAX_UPLOAD_MB", "100"))

    @property
    def max_audio_duration(self) -> float:
        return float(os.environ.get("MAX_AUDIO_DURATION", "600"))

    @property
    def job_timeout(self) -> int:
        return int(os.environ.get("JOB_TIMEOUT", "300"))

    @property
    def cors_origins(self) -> list[str]:
        raw = os.environ.get("CORS_ORIGINS", "*")
        if raw == "*":
            return ["*"]
        return [o.strip() for o in raw.split(",") if o.strip()]

    @property
    def pack_ttl_hours(self) -> int:
        return int(os.environ.get("PACK_TTL_HOURS", "24"))


settings = Settings()
