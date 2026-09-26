"""
Batch registration (operator screen).
Role: OPERATOR – required header X-Role: operator
"""
from __future__ import annotations
import os
import uuid
import shutil
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, Header, HTTPException, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ..database import get_db
from ..models import Batch, CustodyEvent
from .auth import require_role

router = APIRouter()

UPLOADS_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "..", "uploads")
os.makedirs(UPLOADS_DIR, exist_ok=True)


def _generate_batch_id() -> str:
    """CF-XXX style unique Batch ID."""
    suffix = str(uuid.uuid4().int)[:6].upper()
    return f"CF-{suffix}"


@router.post("", status_code=201)
async def register_batch(
    fisher_internal_id: str = Form(...),
    species: str = Form(...),
    weight_kg: float = Form(...),
    catch_zone: str = Form(...),
    catch_time: str = Form(..., description="ISO 8601, e.g. 2026-09-24T07:00:00Z"),
    landing_centre: str = Form(...),
    photo: Optional[UploadFile] = File(None),
    idempotency_key: Optional[str] = Form(None, description="Client UUID for offline dedup"),
    x_role: str = Header(..., alias="X-Role"),
    db: AsyncSession = Depends(get_db),
):
    require_role(x_role, "operator", "admin")

    # Offline dedup: if idempotency_key already exists, return existing batch
    if idempotency_key:
        existing = await db.execute(
            select(Batch).where(Batch.id.like(f"%"))  # placeholder; use custody note
        )
        # Check via a dedicated lookup (custody note carries idempotency_key)
        from ..models import CustodyEvent as CE
        dup_q = await db.execute(
            select(CE).where(CE.note == f"idempotency:{idempotency_key}")
        )
        dup_event = dup_q.scalars().first()
        if dup_event:
            batch_q = await db.execute(
                select(Batch).where(Batch.id == dup_event.batch_id)
            )
            dup_batch = batch_q.scalars().first()
            if dup_batch:
                return {"batch_id": dup_batch.id, "deduplicated": True}

    # Parse catch_time
    try:
        parsed_catch_time = datetime.fromisoformat(catch_time.replace("Z", "+00:00"))
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid catch_time format. Use ISO 8601.")

    registered_at = datetime.now(timezone.utc)
    batch_id = _generate_batch_id()

    # Handle photo upload – store only, path never exposed in public API
    photo_path: Optional[str] = None
    if photo:
        ext = os.path.splitext(photo.filename or "")[1] or ".jpg"
        safe_name = f"{batch_id}{ext}"
        dest = os.path.join(UPLOADS_DIR, safe_name)
        with open(dest, "wb") as f:
            shutil.copyfileobj(photo.file, f)
        photo_path = safe_name

    fingerprint = Batch.compute_fingerprint(
        batch_id=batch_id,
        fisher_internal_id=fisher_internal_id,
        species=species,
        weight_kg=weight_kg,
        catch_zone=catch_zone,
        catch_time=parsed_catch_time.isoformat(),
        landing_centre=landing_centre,
        registered_at=registered_at.isoformat(),
    )

    is_incomplete = not catch_zone.strip() or catch_zone.upper() == "UNKNOWN"
    initial_status = "TRACEABILITY_INCOMPLETE" if is_incomplete else "NO_CONFIRMED_ALERT_OVERLAP_FOUND"

    batch = Batch(
        id=batch_id,
        fisher_internal_id=fisher_internal_id,
        species=species,
        weight_kg=weight_kg,
        catch_zone=catch_zone,
        catch_time=parsed_catch_time,
        landing_centre=landing_centre,
        photo_path=photo_path,
        registered_at=registered_at,
        fingerprint=fingerprint,
        status=initial_status,
    )
    db.add(batch)

    # Registration custody event
    reg_event = CustodyEvent(
        batch_id=batch_id,
        event_type="REGISTERED",
        actor_role="OPERATOR",
        note=f"Batch registered at {landing_centre}.",
    )
    db.add(reg_event)

    # Idempotency marker event
    if idempotency_key:
        idem_event = CustodyEvent(
            batch_id=batch_id,
            event_type="IDEMPOTENCY_KEY",
            actor_role="SYSTEM",
            note=f"idempotency:{idempotency_key}",
        )
        db.add(idem_event)

    await db.commit()

    # Check against existing confirmed alerts
    from ..models import Alert
    from ..matching import run_matching_for_alert
    alerts_q = await db.execute(
        select(Alert).where(Alert.status == "CONFIRMED")
    )
    confirmed_alerts = alerts_q.scalars().all()
    for alert in confirmed_alerts:
        from ..matching import evaluate_match
        mr = evaluate_match(batch, alert)
        if mr.matched:
            batch.status = "UNDER_ENVIRONMENTAL_REVIEW"
            match_event = CustodyEvent(
                batch_id=batch_id,
                event_type="ALERT_MATCHED",
                actor_role="SYSTEM",
                note=f"Matched to alert {alert.id}: {mr.reason}",
            )
            db.add(match_event)
    await db.commit()

    qr_url = f"/lookup/{batch_id}"

    return {
        "batch_id": batch_id,
        "fingerprint": fingerprint,
        "qr_url": qr_url,
        "status": batch.status,
        "disclaimer": "No alert overlap or matching hash proves seafood safety.",
        "deduplicated": False,
    }


@router.get("")
async def list_batches(
    x_role: str = Header(..., alias="X-Role"),
    db: AsyncSession = Depends(get_db),
):
    require_role(x_role, "operator", "inspector", "admin")
    result = await db.execute(select(Batch))
    batches = result.scalars().all()
    return [
        {
            "id": b.id,
            "species": b.species,
            "weight_kg": b.weight_kg,
            "catch_zone": b.catch_zone,
            "catch_time": b.catch_time.isoformat(),
            "landing_centre": b.landing_centre,
            "status": b.status,
            "registered_at": b.registered_at.isoformat(),
            "fingerprint": b.fingerprint,
        }
        for b in batches
    ]


@router.get("/{batch_id}/fingerprint")
async def verify_fingerprint(
    batch_id: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Recomputes the expected fingerprint from stored fields and compares.
    A mismatch indicates that stored registration data was changed after creation.
    """
    result = await db.execute(select(Batch).where(Batch.id == batch_id))
    batch = result.scalars().first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found.")

    expected = Batch.compute_fingerprint(
        batch_id=batch.id,
        fisher_internal_id=batch.fisher_internal_id,
        species=batch.species,
        weight_kg=batch.weight_kg,
        catch_zone=batch.catch_zone,
        catch_time=batch.catch_time.isoformat(),
        landing_centre=batch.landing_centre,
        registered_at=batch.registered_at.isoformat(),
    )
    match = expected == batch.fingerprint
    return {
        "batch_id": batch_id,
        "stored_fingerprint": batch.fingerprint,
        "computed_fingerprint": expected,
        "match": match,
        "integrity_status": "OK" if match else "FINGERPRINT_MISMATCH_DATA_MAY_HAVE_CHANGED",
    }
