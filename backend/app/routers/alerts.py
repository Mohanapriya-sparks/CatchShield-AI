"""
Environmental officer alert management.
Role: OFFICER – required header X-Role: officer
"""
from __future__ import annotations
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, File, Header, HTTPException, UploadFile
from pydantic import BaseModel, field_validator
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ..database import get_db
from ..models import Alert
from ..screening import screen_image
from ..matching import run_matching_for_alert
from .auth import require_role

router = APIRouter()


class AlertConfirmRequest(BaseModel):
    zone: str
    start_time: str   # ISO 8601
    end_time: str     # ISO 8601
    reason: str
    confirmed_by: str
    alert_id: Optional[str] = None  # officer may supply their own ID
    screening_note: Optional[str] = None

    @field_validator("start_time", "end_time")
    @classmethod
    def _parse_dt(cls, v: str) -> str:
        try:
            datetime.fromisoformat(v.replace("Z", "+00:00"))
        except ValueError:
            raise ValueError(f"Invalid datetime: {v}. Use ISO 8601.")
        return v


@router.post("/screen-image")
async def screen_image_endpoint(
    image: UploadFile = File(...),
    x_role: str = Header(..., alias="X-Role"),
):
    """
    Upload an ocean image. Returns a DEMONSTRATION HEURISTIC advisory.
    AI must not confirm alerts automatically – officer must use /confirm.
    """
    require_role(x_role, "officer")
    img_bytes = await image.read()
    result = screen_image(img_bytes)
    return result


@router.post("/confirm", status_code=201)
async def confirm_alert(
    body: AlertConfirmRequest,
    x_role: str = Header(..., alias="X-Role"),
    db: AsyncSession = Depends(get_db),
):
    """
    Officer explicitly confirms a pollution alert.
    Triggers re-matching of all existing batches.
    """
    require_role(x_role, "officer")

    alert_id = body.alert_id or f"PA-{str(uuid.uuid4().int)[:5]}"

    # Check for duplicate
    existing = await db.execute(select(Alert).where(Alert.id == alert_id))
    if existing.scalars().first():
        raise HTTPException(status_code=409, detail=f"Alert {alert_id} already exists.")

    start_dt = datetime.fromisoformat(body.start_time.replace("Z", "+00:00"))
    end_dt = datetime.fromisoformat(body.end_time.replace("Z", "+00:00"))

    if end_dt <= start_dt:
        raise HTTPException(status_code=422, detail="end_time must be after start_time.")

    alert = Alert(
        id=alert_id,
        zone=body.zone,
        start_time=start_dt,
        end_time=end_dt,
        reason=body.reason,
        confirmed_by=body.confirmed_by,
        confirmed_at=datetime.now(timezone.utc),
        screening_note=body.screening_note,
        status="CONFIRMED",
    )
    db.add(alert)
    await db.commit()
    await db.refresh(alert)

    # Re-run matching for all existing batches
    match_results = await run_matching_for_alert(alert, db)
    matched_ids = [mr.batch_id for mr in match_results if mr.matched]

    return {
        "alert_id": alert_id,
        "status": "CONFIRMED",
        "matched_batches": matched_ids,
        "total_evaluated": len(match_results),
    }


@router.post("/reject", status_code=200)
async def reject_alert(
    body: AlertConfirmRequest,
    x_role: str = Header(..., alias="X-Role"),
    db: AsyncSession = Depends(get_db),
):
    """Officer explicitly rejects (dismisses) a proposed alert."""
    require_role(x_role, "officer")
    alert_id = body.alert_id or f"PA-{str(uuid.uuid4().int)[:5]}"

    start_dt = datetime.fromisoformat(body.start_time.replace("Z", "+00:00"))
    end_dt = datetime.fromisoformat(body.end_time.replace("Z", "+00:00"))

    alert = Alert(
        id=alert_id,
        zone=body.zone,
        start_time=start_dt,
        end_time=end_dt,
        reason=body.reason,
        confirmed_by=body.confirmed_by,
        confirmed_at=datetime.now(timezone.utc),
        screening_note=body.screening_note,
        status="REJECTED",
    )
    db.add(alert)
    await db.commit()
    return {"alert_id": alert_id, "status": "REJECTED"}


@router.get("")
async def list_alerts(
    x_role: str = Header(..., alias="X-Role"),
    db: AsyncSession = Depends(get_db),
):
    require_role(x_role, "officer", "inspector", "admin")
    result = await db.execute(select(Alert))
    alerts = result.scalars().all()
    return [
        {
            "id": a.id,
            "zone": a.zone,
            "start_time": a.start_time.isoformat(),
            "end_time": a.end_time.isoformat(),
            "reason": a.reason,
            "confirmed_by": a.confirmed_by,
            "confirmed_at": a.confirmed_at.isoformat(),
            "status": a.status,
            "screening_note": a.screening_note,
        }
        for a in alerts
    ]
