"""
Inspector decisions.
Role: INSPECTOR – required header X-Role: inspector

Matching batches NEVER auto-clear. Inspector must take explicit action.
All decisions are labelled DEMO DECISIONS, not official government clearance.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, field_validator
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ..database import get_db
from ..models import Batch, Alert, InspectionDecision, CustodyEvent
from .auth import require_role

router = APIRouter()


class InspectionRequest(BaseModel):
    batch_id: str
    alert_id: str
    inspector_name: str
    # Must be one of: CLEARED_DEMO | FLAGGED_DEMO
    decision: str
    reason: str

    @field_validator("decision")
    @classmethod
    def _validate_decision(cls, v: str) -> str:
        valid = {"CLEARED_DEMO", "FLAGGED_DEMO"}
        if v.upper() not in valid:
            raise ValueError(f"decision must be one of {valid}")
        return v.upper()


@router.post("", status_code=201)
async def record_inspection(
    body: InspectionRequest,
    x_role: str = Header(..., alias="X-Role"),
    db: AsyncSession = Depends(get_db),
):
    require_role(x_role, "inspector")

    # Verify batch exists
    batch_q = await db.execute(select(Batch).where(Batch.id == body.batch_id))
    batch = batch_q.scalars().first()
    if not batch:
        raise HTTPException(status_code=404, detail=f"Batch {body.batch_id} not found.")

    # Verify alert exists and is confirmed
    alert_q = await db.execute(
        select(Alert).where(Alert.id == body.alert_id, Alert.status == "CONFIRMED")
    )
    alert = alert_q.scalars().first()
    if not alert:
        raise HTTPException(
            status_code=404,
            detail=f"Confirmed alert {body.alert_id} not found.",
        )

    # Check for duplicate decision
    dup_q = await db.execute(
        select(InspectionDecision).where(
            InspectionDecision.batch_id == body.batch_id,
            InspectionDecision.alert_id == body.alert_id,
        )
    )
    if dup_q.scalars().first():
        raise HTTPException(
            status_code=409,
            detail=f"Inspection decision for batch {body.batch_id} / alert {body.alert_id} already recorded.",
        )

    decision = InspectionDecision(
        batch_id=body.batch_id,
        alert_id=body.alert_id,
        inspector_name=body.inspector_name,
        decision=body.decision,
        reason=body.reason,
    )
    db.add(decision)

    # Update batch status
    batch.status = body.decision  # CLEARED_DEMO or FLAGGED_DEMO

    # Custody event
    event = CustodyEvent(
        batch_id=body.batch_id,
        event_type="INSPECTOR_DECISION",
        actor_role="INSPECTOR",
        note=(
            f"DEMO DECISION by {body.inspector_name}: {body.decision}. "
            f"Reason: {body.reason}. "
            f"NOT official government clearance."
        ),
    )
    db.add(event)
    await db.commit()

    return {
        "batch_id": body.batch_id,
        "alert_id": body.alert_id,
        "decision": body.decision,
        "note": "DEMO DECISION – Not official government clearance.",
        "disclaimer": "No alert overlap or matching hash proves seafood safety.",
    }


@router.get("")
async def list_decisions(
    x_role: str = Header(..., alias="X-Role"),
    db: AsyncSession = Depends(get_db),
):
    require_role(x_role, "inspector", "admin")
    result = await db.execute(select(InspectionDecision))
    decisions = result.scalars().all()
    return [
        {
            "id": d.id,
            "batch_id": d.batch_id,
            "alert_id": d.alert_id,
            "inspector_name": d.inspector_name,
            "decision": d.decision,
            "reason": d.reason,
            "decided_at": d.decided_at.isoformat(),
            "note": "DEMO DECISION – Not official government clearance.",
        }
        for d in decisions
    ]
