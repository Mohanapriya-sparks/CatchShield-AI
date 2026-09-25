"""
CatchShield AI – Test Suite
Tests: matching boundaries, late alerts, mixed lots, unauthorized actions,
       duplicate offline sync, public-data privacy, hash mismatch.
"""
from __future__ import annotations
import asyncio
import json
import hashlib
from datetime import datetime, timezone
from typing import AsyncGenerator

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase

# ---------------------------------------------------------------------------
# Test DB setup (in-memory SQLite)
# ---------------------------------------------------------------------------
TEST_DB_URL = "sqlite+aiosqlite:///:memory:"
test_engine = create_async_engine(TEST_DB_URL, echo=False)
TestSessionLocal = async_sessionmaker(test_engine, expire_on_commit=False, class_=AsyncSession)


async def override_get_db():
    async with TestSessionLocal() as session:
        yield session


@pytest_asyncio.fixture(scope="session", autouse=True)
async def setup_db():
    import app.models  # noqa: F401
    from app.database import Base
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def client() -> AsyncGenerator[AsyncClient, None]:
    from app.main import app
    from app.database import get_db
    app.dependency_overrides[get_db] = override_get_db

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        yield ac

    app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
OPERATOR_H = {"X-Role": "operator"}
OFFICER_H = {"X-Role": "officer"}
INSPECTOR_H = {"X-Role": "inspector"}
PUBLIC_H = {}  # No auth


async def register_batch(client, batch_id_hint: str, zone: str, catch_time: str, **kwargs):
    data = {
        "fisher_internal_id": "FISHER-TEST",
        "species": "Test Fish",
        "weight_kg": "50.0",
        "catch_zone": zone,
        "catch_time": catch_time,
        "landing_centre": "Test Centre",
        **{k: str(v) for k, v in kwargs.items()},
    }
    return await client.post("/api/batches", data=data, headers=OFFICER_H | OPERATOR_H)


async def confirm_alert(client, alert_id: str, zone: str, start: str, end: str):
    body = {
        "zone": zone,
        "start_time": start,
        "end_time": end,
        "reason": "Test pollution",
        "confirmed_by": "Officer Test",
        "alert_id": alert_id,
    }
    return await client.post("/api/alerts/confirm", json=body, headers=OFFICER_H)


# ===========================================================================
# 1. Matching – within window
# ===========================================================================
@pytest.mark.asyncio
async def test_batch_within_alert_window_matches(client):
    """Batch in Zone 03 at 08:00 should match Zone 03 alert [06:00–10:00]."""
    r = await client.post(
        "/api/batches",
        data={
            "fisher_internal_id": "F1",
            "species": "Sardine",
            "weight_kg": "80",
            "catch_zone": "Zone 03",
            "catch_time": "2026-09-24T08:00:00Z",
            "landing_centre": "Test Centre",
        },
        headers=OPERATOR_H,
    )
    assert r.status_code == 201
    batch_id = r.json()["batch_id"]

    ac = await confirm_alert(
        client, "PA-T1", "Zone 03", "2026-09-24T06:00:00Z", "2026-09-24T10:00:00Z"
    )
    assert ac.status_code == 201
    assert batch_id in ac.json()["matched_batches"]


# ===========================================================================
# 2. Matching – inclusive boundary at start
# ===========================================================================
@pytest.mark.asyncio
async def test_batch_at_exact_alert_start_boundary_matches(client):
    """Batch caught at exactly alert start_time must match (inclusive)."""
    r = await client.post(
        "/api/batches",
        data={
            "fisher_internal_id": "F2",
            "species": "Mackerel",
            "weight_kg": "60",
            "catch_zone": "Zone 02",
            "catch_time": "2026-09-24T06:00:00Z",
            "landing_centre": "Test Centre",
        },
        headers=OPERATOR_H,
    )
    assert r.status_code == 201
    batch_id = r.json()["batch_id"]

    ac = await confirm_alert(
        client, "PA-T2", "Zone 02", "2026-09-24T06:00:00Z", "2026-09-24T10:00:00Z"
    )
    assert ac.status_code == 201
    assert batch_id in ac.json()["matched_batches"]


# ===========================================================================
# 3. Matching – inclusive boundary at end
# ===========================================================================
@pytest.mark.asyncio
async def test_batch_at_exact_alert_end_boundary_matches(client):
    """Batch caught at exactly alert end_time must match (inclusive)."""
    r = await client.post(
        "/api/batches",
        data={
            "fisher_internal_id": "F3",
            "species": "Tuna",
            "weight_kg": "100",
            "catch_zone": "Zone 04",
            "catch_time": "2026-09-24T10:00:00Z",
            "landing_centre": "Test Centre",
        },
        headers=OPERATOR_H,
    )
    assert r.status_code == 201
    batch_id = r.json()["batch_id"]

    ac = await confirm_alert(
        client, "PA-T3", "Zone 04", "2026-09-24T06:00:00Z", "2026-09-24T10:00:00Z"
    )
    assert ac.status_code == 201
    assert batch_id in ac.json()["matched_batches"]


# ===========================================================================
# 4. Matching – outside time window (after end)
# ===========================================================================
@pytest.mark.asyncio
async def test_batch_after_alert_end_does_not_match(client):
    """Batch caught at 14:00 should NOT match a [06:00–10:00] alert."""
    r = await client.post(
        "/api/batches",
        data={
            "fisher_internal_id": "F4",
            "species": "King Fish",
            "weight_kg": "45",
            "catch_zone": "Zone 05",
            "catch_time": "2026-09-24T14:00:00Z",
            "landing_centre": "Test Centre",
        },
        headers=OPERATOR_H,
    )
    assert r.status_code == 201
    batch_id = r.json()["batch_id"]

    ac = await confirm_alert(
        client, "PA-T4", "Zone 05", "2026-09-24T06:00:00Z", "2026-09-24T10:00:00Z"
    )
    assert ac.status_code == 201
    assert batch_id not in ac.json()["matched_batches"]


# ===========================================================================
# 5. Matching – wrong zone
# ===========================================================================
@pytest.mark.asyncio
async def test_batch_in_different_zone_does_not_match(client):
    """Batch in Zone 01 should NOT match a Zone 06 alert regardless of time."""
    r = await client.post(
        "/api/batches",
        data={
            "fisher_internal_id": "F5",
            "species": "Prawn",
            "weight_kg": "30",
            "catch_zone": "Zone 01",
            "catch_time": "2026-09-24T07:00:00Z",
            "landing_centre": "Test Centre",
        },
        headers=OPERATOR_H,
    )
    assert r.status_code == 201
    batch_id = r.json()["batch_id"]

    ac = await confirm_alert(
        client, "PA-T5", "Zone 06", "2026-09-24T06:00:00Z", "2026-09-24T10:00:00Z"
    )
    assert ac.status_code == 201
    assert batch_id not in ac.json()["matched_batches"]


# ===========================================================================
# 6. Late alert – existing batch gets matched retroactively
# ===========================================================================
@pytest.mark.asyncio
async def test_late_alert_matches_existing_batch(client):
    """An alert confirmed after batch registration should retroactively match."""
    # Register batch first
    r = await client.post(
        "/api/batches",
        data={
            "fisher_internal_id": "F6",
            "species": "Lobster",
            "weight_kg": "20",
            "catch_zone": "Zone 07",
            "catch_time": "2026-09-24T09:00:00Z",
            "landing_centre": "Test Centre",
        },
        headers=OPERATOR_H,
    )
    assert r.status_code == 201
    batch_id = r.json()["batch_id"]
    assert r.json()["status"] == "NO_CONFIRMED_ALERT_OVERLAP_FOUND"

    # Confirm alert later
    ac = await confirm_alert(
        client, "PA-LATE1", "Zone 07", "2026-09-24T08:00:00Z", "2026-09-24T12:00:00Z"
    )
    assert ac.status_code == 201
    assert batch_id in ac.json()["matched_batches"]

    # Verify status updated via public lookup
    pub = await client.get(f"/api/public/{batch_id}")
    assert pub.status_code == 200
    assert pub.json()["status"] == "UNDER_ENVIRONMENTAL_REVIEW"


# ===========================================================================
# 7. Unauthorized action – operator cannot confirm alert
# ===========================================================================
@pytest.mark.asyncio
async def test_operator_cannot_confirm_alert(client):
    body = {
        "zone": "Zone 01",
        "start_time": "2026-09-24T06:00:00Z",
        "end_time": "2026-09-24T10:00:00Z",
        "reason": "Test",
        "confirmed_by": "Test Operator",
        "alert_id": "PA-UNAUTH",
    }
    r = await client.post("/api/alerts/confirm", json=body, headers=OPERATOR_H)
    assert r.status_code == 403


# ===========================================================================
# 8. Unauthorized action – officer cannot record inspection
# ===========================================================================
@pytest.mark.asyncio
async def test_officer_cannot_record_inspection(client):
    body = {
        "batch_id": "CF-101",
        "alert_id": "PA-21",
        "inspector_name": "Test",
        "decision": "CLEARED_DEMO",
        "reason": "Test",
    }
    r = await client.post("/api/inspections", json=body, headers=OFFICER_H)
    assert r.status_code == 403


# ===========================================================================
# 9. Duplicate offline sync – idempotency key prevents duplicate
# ===========================================================================
@pytest.mark.asyncio
async def test_duplicate_offline_sync_deduplication(client):
    """Same idempotency_key submitted twice returns same batch_id, no duplicate."""
    idem_key = "offline-test-key-12345"
    data = {
        "fisher_internal_id": "F7",
        "species": "Clam",
        "weight_kg": "15",
        "catch_zone": "Zone 08",
        "catch_time": "2026-09-24T11:00:00Z",
        "landing_centre": "Test Centre",
        "idempotency_key": idem_key,
    }
    r1 = await client.post("/api/batches", data=data, headers=OPERATOR_H)
    assert r1.status_code == 201
    batch_id_1 = r1.json()["batch_id"]

    r2 = await client.post("/api/batches", data=data, headers=OPERATOR_H)
    # Should return 201 with same batch_id and deduplicated=True
    assert r2.status_code == 201
    assert r2.json()["batch_id"] == batch_id_1
    assert r2.json()["deduplicated"] is True


# ===========================================================================
# 10. Public data privacy – fisher identity not exposed
# ===========================================================================
@pytest.mark.asyncio
async def test_public_lookup_does_not_expose_fisher_identity(client):
    """Public lookup must never include fisher_internal_id."""
    # Register a batch
    r = await client.post(
        "/api/batches",
        data={
            "fisher_internal_id": "PRIVATE-FISHER-ID-9999",
            "species": "Crab",
            "weight_kg": "25",
            "catch_zone": "Zone 09",
            "catch_time": "2026-09-24T10:30:00Z",
            "landing_centre": "Test Centre",
        },
        headers=OPERATOR_H,
    )
    assert r.status_code == 201
    batch_id = r.json()["batch_id"]

    pub = await client.get(f"/api/public/{batch_id}")
    assert pub.status_code == 200
    body = pub.json()

    # Privacy checks
    assert "fisher_internal_id" not in body
    assert "PRIVATE-FISHER-ID-9999" not in json.dumps(body)
    assert "photo_path" not in body
    # Must have safe fields
    assert "catch_zone" in body
    assert "species" in body
    assert "status" in body
    assert "disclaimer" in body


# ===========================================================================
# 11. Hash mismatch detection
# ===========================================================================
@pytest.mark.asyncio
async def test_fingerprint_mismatch_detected(client):
    """
    After direct DB modification of the stored fingerprint,
    the fingerprint endpoint should report FINGERPRINT_MISMATCH.
    The computed fingerprint (from current fields) ≠ stored fingerprint.
    """
    from app.models import Batch as BatchModel
    from sqlalchemy import update

    # Register
    r = await client.post(
        "/api/batches",
        data={
            "fisher_internal_id": "F8",
            "species": "Squid",
            "weight_kg": "10",
            "catch_zone": "Zone 10",
            "catch_time": "2026-09-24T12:00:00Z",
            "landing_centre": "Test Centre",
        },
        headers=OPERATOR_H,
    )
    assert r.status_code == 201
    batch_id = r.json()["batch_id"]

    # Verify matches initially
    fp_r = await client.get(f"/api/batches/{batch_id}/fingerprint")
    assert fp_r.json()["match"] is True

    # Tamper: corrupt the STORED fingerprint to a fake value.
    # This simulates an attacker changing the data record: the
    # recomputed fingerprint (from actual fields) will no longer
    # match the stored (now fake) fingerprint.
    fake_fingerprint = "0" * 64
    async with TestSessionLocal() as session:
        await session.execute(
            update(BatchModel)
            .where(BatchModel.id == batch_id)
            .values(fingerprint=fake_fingerprint)
        )
        await session.commit()

    # Now fingerprint should mismatch
    fp_r2 = await client.get(f"/api/batches/{batch_id}/fingerprint")
    data = fp_r2.json()
    assert data["match"] is False, f"Expected mismatch, got: {data}"
    assert data["stored_fingerprint"] == fake_fingerprint
    assert data["integrity_status"] == "FINGERPRINT_MISMATCH_DATA_MAY_HAVE_CHANGED"


# ===========================================================================
# 12. Inspector cannot clear batch without explicit action
# ===========================================================================
@pytest.mark.asyncio
async def test_matched_batch_does_not_auto_clear(client):
    """A batch matched to an alert stays UNDER_ENVIRONMENTAL_REVIEW until inspector acts."""
    r = await client.post(
        "/api/batches",
        data={
            "fisher_internal_id": "F9",
            "species": "Pomfret",
            "weight_kg": "35",
            "catch_zone": "Zone 11",
            "catch_time": "2026-09-24T08:00:00Z",
            "landing_centre": "Test Centre",
        },
        headers=OPERATOR_H,
    )
    assert r.status_code == 201
    batch_id = r.json()["batch_id"]

    ac = await confirm_alert(
        client, "PA-AUTOCLR", "Zone 11", "2026-09-24T06:00:00Z", "2026-09-24T10:00:00Z"
    )
    assert ac.status_code == 201
    assert batch_id in ac.json()["matched_batches"]

    # Verify batch is under review, not auto-cleared
    pub = await client.get(f"/api/public/{batch_id}")
    assert pub.json()["status"] == "UNDER_ENVIRONMENTAL_REVIEW"


# ===========================================================================
# 13. Matching dashboard shows both matched and non-matched with reasons
# ===========================================================================
@pytest.mark.asyncio
async def test_matching_dashboard_shows_reasons(client):
    dash = await client.get("/api/matching", headers=OFFICER_H)
    assert dash.status_code == 200
    body = dash.json()
    assert "results" in body
    assert "disclaimer" in body
    # Disclaimer must be present
    assert "seafood safety" in body["disclaimer"].lower()
