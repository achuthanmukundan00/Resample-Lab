"""Tests for Resample-Lab pack store and API endpoints."""

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.routes.packs import router
from app.services.pack_store import PackState, PackStatus, pack_store

app = FastAPI()
app.include_router(router)
client = TestClient(app)


class TestPackStore:
    def setup_method(self):
        self.state = pack_store.create(PackState(pack_id="test-store-1", preset="test-preset", chaos=0.5))

    def test_create_pack(self):
        state = pack_store.get("test-store-1")
        assert state is not None
        assert state.status == PackStatus.QUEUED
        assert state.preset == "test-preset"
        assert state.chaos == 0.5

    def test_get_nonexistent_pack(self):
        retrieved = pack_store.get("nonexistent-id")
        assert retrieved is None

    def test_update_pack(self):
        state = pack_store.get("test-store-1")
        assert state is not None
        pack_store.update(state.pack_id, progress=50, status=PackStatus.PROCESSING)
        retrieved = pack_store.get(state.pack_id)
        assert retrieved is not None
        assert retrieved.progress == 50
        assert retrieved.status == PackStatus.PROCESSING

    def test_list_packs(self):
        result = pack_store.list()
        assert len(result) >= 1

    def test_list_packs_filtered(self):
        state = pack_store.get("test-store-1")
        assert state is not None
        pack_store.update(state.pack_id, status=PackStatus.COMPLETED)
        result = pack_store.list(status="completed")
        assert len(result) >= 1

    def test_delete_pack(self):
        state = pack_store.create(PackState(pack_id="test-delete-1", preset="loop_extractor", chaos=0.0))
        pack_store.delete(state.pack_id)
        retrieved = pack_store.get(state.pack_id)
        assert retrieved is None

    def teardown_method(self):
        for s in pack_store.list():
            pack_store.delete(s.pack_id)


class TestCapabilitiesEndpoint:
    def test_returns_capabilities(self):
        response = client.get("/api/capabilities")
        assert response.status_code == 200
        data = response.json()
        assert "presets" in data
        assert "chaos_levels" in data
        assert "output_formats" in data
        assert len(data["presets"]) == 8

    def test_presets_have_required_fields(self):
        response = client.get("/api/capabilities")
        data = response.json()
        for p in data["presets"]:
            assert "id" in p
            assert "name" in p
            assert "description" in p
            assert "output_count" in p


class TestCreatePackEndpoint:
    def test_rejects_no_files(self):
        response = client.post(
            "/api/packs",
            data={"preset": "ambient_stretch", "chaos": 0.33, "output_format": "wav", "pack_name": "test"},
        )
        assert response.status_code == 422

    def test_rejects_invalid_preset(self, tmp_path):
        wav = tmp_path / "test.wav"
        wav.write_text("not a wav")
        with open(str(wav), "rb") as f:
            response = client.post(
                "/api/packs",
                data={"preset": "nonexistent", "chaos": 0.33, "output_format": "wav", "pack_name": "test"},
                files={"files": ("test.wav", f, "audio/wav")},
            )
        assert response.status_code == 400

    def test_rejects_invalid_chaos(self, tmp_path):
        wav = tmp_path / "test.wav"
        wav.write_text("not a wav")
        with open(str(wav), "rb") as f:
            response = client.post(
                "/api/packs",
                data={"preset": "ambient_stretch", "chaos": 2.0, "output_format": "wav", "pack_name": "test"},
                files={"files": ("test.wav", f, "audio/wav")},
            )
        assert response.status_code == 400


class TestPackLifecycleEndpoint:
    def test_get_pack_status_nonexistent(self):
        response = client.get("/api/packs/nonexistent")
        assert response.status_code == 404

    def test_get_pack_status(self):
        state = pack_store.create(PackState(pack_id="api-status-test", preset="bitrot_dirt", chaos=0.5))
        response = client.get(f"/api/packs/{state.pack_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["pack_id"] == state.pack_id
        assert data["status"] == "queued"

    def test_download_completed(self, tmp_path):
        state = pack_store.create(PackState(pack_id="api-dl-test", preset="loop_extractor", chaos=0.0))
        zip_path = tmp_path / "pack.zip"
        zip_path.write_text("fake zip content")
        pack_store.update(state.pack_id, status=PackStatus.COMPLETED, zip_path=str(zip_path))
        response = client.get(f"/api/packs/{state.pack_id}/download")
        assert response.status_code == 200

    def test_download_not_completed(self):
        state = pack_store.create(PackState(pack_id="api-dl-fail", preset="granular_shards", chaos=0.5))
        response = client.get(f"/api/packs/{state.pack_id}/download")
        assert response.status_code == 425  # Too Early

    def test_download_nonexistent(self):
        response = client.get("/api/packs/nonexistent/download")
        assert response.status_code == 404

    def test_delete_pack_endpoint(self):
        state = pack_store.create(PackState(pack_id="api-del-test", preset="ambient_stretch", chaos=0.33))
        response = client.delete(f"/api/packs/{state.pack_id}")
        assert response.status_code == 204

    def test_delete_nonexistent(self):
        response = client.delete("/api/packs/nonexistent")
        assert response.status_code == 404


class TestProgressTracking:
    def test_progress_starts_visible(self):
        state = pack_store.create(PackState(pack_id="progress-test", preset="loop_extractor", chaos=0.0, progress=0.01))
        assert state.progress == 0.01

    def test_progress_phases_monotonic(self):
        """Verify progress values are set and can transition."""
        state = pack_store.create(PackState(pack_id="progress-phases", preset="granular_shards", chaos=0.5, progress=0.01))
        pack_store.update(state.pack_id, progress=0.50)
        assert pack_store.get(state.pack_id).progress == 0.50
        pack_store.update(state.pack_id, progress=1.0)
        assert pack_store.get(state.pack_id).progress == 1.0

    def test_run_pack_accepts_progress_callback(self, tmp_path):
        """Verify run_pack accepts and invokes progress_callback with milestones."""
        from pathlib import Path
        import soundfile as sf
        import numpy as np
        from app.dsp.packs import run_pack

        # Create test audio
        src = tmp_path / "source.wav"
        n = int(48000 * 0.5)
        t = np.linspace(0, 0.5, n, endpoint=False)
        data = 0.5 * np.sin(2 * np.pi * 440 * t)
        data = np.column_stack([data, data])
        sf.write(str(src), data, 48000, subtype="PCM_16")

        milestones = []
        def cb(pct, msg):
            milestones.append((pct, msg))

        output = run_pack(
            pack_id="test-progress-cb",
            pack_name="test",
            preset_id="loop_extractor",
            chaos=0.0,
            source_paths=[src],
            progress_callback=cb,
        )

        assert len(milestones) > 0
        # Verify at least detecting tools, validating, and finalizing milestones
        milestones_pct = [m[0] for m in milestones]
        assert 0.05 in milestones_pct  # detecting tools
        assert 0.08 in milestones_pct  # validating
        assert 0.97 in milestones_pct  # finalizing
        assert output["processing_time_ms"] > 0
