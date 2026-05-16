import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes.packs import router as packs_router
from app.settings import settings

logger = logging.getLogger(__name__)


def _cleanup_stale_packs():
    """Remove pack directories older than PACK_TTL_HOURS."""
    from app.dsp.packs import PACK_BASE_DIR
    import time

    if not PACK_BASE_DIR.exists():
        return
    now = time.time()
    ttl_sec = settings.pack_ttl_hours * 3600
    for d in PACK_BASE_DIR.iterdir():
        if d.is_dir() and not d.name.startswith("."):
            age = now - d.stat().st_mtime
            if age > ttl_sec:
                import shutil
                shutil.rmtree(d, ignore_errors=True)
                logger.info("Cleaned stale pack dir: %s (age %.1fh)", d.name, age / 3600)


@asynccontextmanager
async def lifespan(app: FastAPI):
    _cleanup_stale_packs()
    from app.dsp import check_all
    tools = check_all()
    ffmpeg = tools.get("ffmpeg")
    if hasattr(ffmpeg, "available"):
        if ffmpeg.available:
            print(f"  ffmpeg: {ffmpeg.version} ({ffmpeg.path})")
        else:
            print("  ffmpeg: NOT FOUND — install with: brew install ffmpeg")
    py = tools.get("python_dsp", {})
    if isinstance(py, dict):
        for name, info in py.items():
            if hasattr(info, "available") and info.available:
                print(f"  {name}: {info.version}")
    yield


app = FastAPI(title="Resample-Lab API", version="1.0.0", lifespan=lifespan)

origins = settings.cors_origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok"}


app.include_router(packs_router)