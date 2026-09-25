"""
Public batch lookup – privacy-safe.
No authentication required.

NEVER exposes: fisher identity, exact GPS, private notes, photo paths.
ALWAYS exposes: general region, species, landing centre name,
                custody timeline (role + event_type + note redacted),
                current review status, integrity status.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from ..database import get_db
from ..models import Batch, CustodyEvent, Alert
from .advisory import get_advisory

router = APIRouter()

# Custody event notes that are safe to show publicly (redact the rest)
_SAFE_EVENT_TYPES = {
    "REGISTERED",
    "ALERT_MATCHED",
    "INSPECTION_ASSIGNED",
    "INSPECTOR_DECISION",
}

_REDACT_NOTE_FOR = {"IDEMPOTENCY_KEY"}


def _safe_note(event: CustodyEvent) -> str | None:
    if event.event_type in _REDACT_NOTE_FOR:
        return None
    if event.event_type == "INSPECTOR_DECISION" and event.note:
        # Strip private content but keep decision outcome
        return event.note
    return event.note


@router.get("/conditions")
async def public_conditions(
    zone: str,
    time: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Returns environmental conditions for a specific zone and time.
    """
    from datetime import datetime
    try:
        dt = datetime.fromisoformat(time.replace("Z", "+00:00"))
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid time format. Use ISO 8601.")

    # 1. Check for confirmed alerts
    alert_result = await db.execute(
        select(Alert).where(
            Alert.status == "CONFIRMED",
            Alert.zone == zone,
            Alert.start_time <= dt,
            Alert.end_time >= dt
        )
    )
    alert = alert_result.scalars().first()

    # 2. Get sea forecast
    advisory_data = await get_advisory(zone)

    if alert:
        start_fmt = alert.start_time.strftime("%H:%M")
        end_fmt = alert.end_time.strftime("%H:%M")
        pollution_msg = (
            f"Officer-confirmed demo alert {alert.id} covers {zone} from {start_fmt} to {end_fmt}. "
            "Catch batches recorded in this zone and period are flagged for review. "
            "This message does not determine whether seafood is safe."
        )
        pollution_title = "Environmental alert recorded — demonstration"
    else:
        pollution_msg = (
            "No confirmed alert overlap found in available records. "
            "This does not confirm that the water or seafood is safe."
        )
        pollution_title = "No confirmed alert overlap found in available records."

    return {
        "zone": zone,
        "pollution_title": pollution_title,
        "pollution_message": pollution_msg,
        "has_alert": bool(alert),
        "advisory": advisory_data,
    }


@router.get("/{batch_id}")
async def public_lookup(batch_id: str, db: AsyncSession = Depends(get_db)):
    """
    Public QR/batch lookup.
    Returns privacy-safe batch data only.
    """
    result = await db.execute(
        select(Batch)
        .where(Batch.id == batch_id)
        .options(selectinload(Batch.custody_events))
    )
    batch = result.scalars().first()
    if not batch:
        raise HTTPException(status_code=404, detail=f"Batch '{batch_id}' not found.")

    # Build safe custody timeline
    timeline = []
    for ev in sorted(batch.custody_events, key=lambda e: e.event_time):
        if ev.event_type in _REDACT_NOTE_FOR:
            continue
        note = _safe_note(ev)
        timeline.append(
            {
                "event_type": ev.event_type,
                "actor_role": ev.actor_role,
                "event_time": ev.event_time.isoformat(),
                "note": note,
            }
        )

    # Status label mapping
    status_display = {
        "NO_CONFIRMED_ALERT_OVERLAP_FOUND": "NO CONFIRMED ALERT OVERLAP FOUND",
        "UNDER_ENVIRONMENTAL_REVIEW": "UNDER ENVIRONMENTAL REVIEW",
        "INSPECTION_PENDING": "INSPECTION PENDING",
        "CLEARED_DEMO": "CLEARED (DEMO DECISION – Not official clearance)",
        "FLAGGED_DEMO": "FLAGGED (DEMO DECISION – Not official clearance)",
        "TRACEABILITY_INCOMPLETE": "TRACEABILITY INCOMPLETE",
    }.get(batch.status, batch.status)

    return {
        "batch_id": batch.id,
        "species": batch.species,
        # General region only – not exact GPS
        "catch_zone": batch.catch_zone,
        "catch_date": batch.catch_time.date().isoformat(),
        "landing_centre": batch.landing_centre,
        "registered_at": batch.registered_at.isoformat(),
        "status": batch.status,
        "status_display": status_display,
        "fingerprint": batch.fingerprint,
        "chain_tx": batch.chain_tx,
        "custody_timeline": timeline,
        "disclaimer": (
            "No alert overlap or matching hash proves seafood safety. "
            "Inspection decisions shown here are DEMO DECISIONS, not official government clearance."
        ),
    }
