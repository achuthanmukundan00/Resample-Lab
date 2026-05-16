"""ZIP packaging for sample packs."""

from __future__ import annotations

import zipfile
from pathlib import Path


def create_pack_zip(
    pack_dir: Path,
    output_path: Path | None = None,
    include_manifest: bool = True,
) -> Path:
    """Create a ZIP archive of a completed pack directory.

    Structure inside ZIP:
      pack_name/
        samples/ambiences/...
        samples/granular/...
        samples/one-shots/...
        samples/loops/...
        samples/oddities/...
        manifest.json
        tools.json
        README.txt
    """
    if output_path is None:
        output_path = pack_dir.parent / f"{pack_dir.name}.zip"

    with zipfile.ZipFile(output_path, "w", zipfile.ZIP_DEFLATED, compresslevel=6) as zf:
        for file_path in sorted(pack_dir.rglob("*")):
            if file_path.is_file() and file_path.suffix != ".zip":
                arcname = str(file_path.relative_to(pack_dir))
                # Organize into folders
                if arcname.startswith("samples") or arcname in ("manifest.json", "tools.json", "README.txt"):
                    zf.write(file_path, arcname=arcname)

    return output_path


def validate_zip(zip_path: Path) -> bool:
    """Verify ZIP integrity."""
    try:
        with zipfile.ZipFile(zip_path, "r") as zf:
            bad_file = zf.testzip()
            return bad_file is None
    except Exception:
        return False
