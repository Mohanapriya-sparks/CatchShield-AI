"""
Matching dashboard – shows which batches overlap each confirmed alert.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ..database import get_db
from ..models import Batch, Alert
from ..matching import evaluate_match
from .auth import require_role

router = APIRouter()


@router.get("")
async def matching_dashboard(
    x_role: str = Header(..., alias="X-Role"),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns all confirmed alerts with per-batch match/no-match reasons.
    """
    require_role(x_role, "officer", "inspector", "admin")

    alerts_q = await db.execute(select(Alert).where(Alert.status == "CONFIRMED"))
    confirmed_alerts = alerts_q.scalars().all()

    batches_q = await db.execute(select(Batch))
    batches = batches_q.scalars().all()

    results = []
    for alert in confirmed_alerts:
        matches = []
        non_matches = []
        for batch in batches:
            mr = evaluate_match(batch, alert)
            entry = {
                "batch_id": batch.id,
                "species": batch.species,
                "catch_zone": batch.catch_zone,
                "catch_time": batch.catch_time.isoformat(),
                "matched": mr.matched,
                "reason": mr.reason,
            }
            if mr.matched:
                matches.append(entry)
            else:
                non_matches.append(entry)

        results.append(
            {
                "alert_id": alert.id,
                "alert_zone": alert.zone,
                "alert_window": {
                    "start": alert.start_time.isoformat(),
                    "end": alert.end_time.isoformat(),
                },
                "alert_reason": alert.reason,
                "matched_batches": matches,
                "non_matched_batches": non_matches,
            }
        )

    return {
        "disclaimer": "No alert overlap or matching hash proves seafood safety.",
        "confirmed_alerts_evaluated": len(confirmed_alerts),
        "total_batches": len(batches),
        "results": results,
    }
