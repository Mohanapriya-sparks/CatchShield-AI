"""
Matching logic: determine which batches overlap a confirmed alert
by zone AND time window (inclusive boundaries).
"""
from __future__ import annotations
from datetime import datetime, timezone
from typing import NamedTuple

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .models import Batch, Alert, CustodyEvent


class MatchResult(NamedTuple):
    batch_id: str
    matched: bool
    reason: str


def _zone_matches(batch_zone: str, alert_zone: str) -> bool:
    """Zone match: case-insensitive exact match."""
    return batch_zone.strip().upper() == alert_zone.strip().upper()


def _time_overlaps(
    catch_time: datetime,
    alert_start: datetime,
    alert_end: datetime,
) -> bool:
    """
    Inclusive boundary check:
    batch catch_time is within [alert_start, alert_end].
    """
    # Ensure timezone-aware comparison
    if catch_time.tzinfo is None:
        catch_time = catch_time.replace(tzinfo=timezone.utc)
    if alert_start.tzinfo is None:
        alert_start = alert_start.replace(tzinfo=timezone.utc)
    if alert_end.tzinfo is None:
        alert_end = alert_end.replace(tzinfo=timezone.utc)
    return alert_start <= catch_time <= alert_end


def evaluate_match(batch: Batch, alert: Alert) -> MatchResult:
    zone_ok = _zone_matches(batch.catch_zone, alert.zone)
    time_ok = _time_overlaps(batch.catch_time, alert.start_time, alert.end_time)

    is_incomplete = not batch.catch_zone.strip() or batch.catch_zone.upper() == "UNKNOWN"
    if is_incomplete:
        return MatchResult(batch.id, False, "Traceability incomplete: missing or uncertain catch zone/time.")

    if zone_ok and time_ok:
        return MatchResult(
            batch.id,
            True,
            f"Zone '{batch.catch_zone}' matches alert zone '{alert.zone}'; "
            f"catch time {batch.catch_time.isoformat()} is within alert window "
            f"[{alert.start_time.isoformat()}, {alert.end_time.isoformat()}].",
        )
    reasons = []
    if not zone_ok:
        reasons.append(
            f"Zone mismatch: batch zone '{batch.catch_zone}' ≠ alert zone '{alert.zone}'."
        )
    if not time_ok:
        reasons.append(
            f"Time outside window: batch catch time {batch.catch_time.isoformat()} "
            f"not in [{alert.start_time.isoformat()}, {alert.end_time.isoformat()}]."
        )
    return MatchResult(batch.id, False, " ".join(reasons))


async def run_matching_for_alert(
    alert: Alert, db: AsyncSession
) -> list[MatchResult]:
    """
    Re-evaluate all batches against a confirmed alert.
    Batches that match get status UNDER_ENVIRONMENTAL_REVIEW and a custody event.
    Returns full list of MatchResults (matched and non-matched).
    """
    result = await db.execute(select(Batch))
    batches = result.scalars().all()

    match_results: list[MatchResult] = []
    for batch in batches:
        mr = evaluate_match(batch, alert)
        match_results.append(mr)
        if mr.matched and batch.status == "NO_CONFIRMED_ALERT_OVERLAP_FOUND":
            batch.status = "UNDER_ENVIRONMENTAL_REVIEW"
            event = CustodyEvent(
                batch_id=batch.id,
                event_type="ALERT_MATCHED",
                actor_role="SYSTEM",
                note=f"Matched to alert {alert.id}: {mr.reason}",
            )
            db.add(event)

    await db.commit()
    return match_results
