"""
Seed script for judge demonstration.

Creates:
  CF-101  Zone 01  07:00
  CF-104  Zone 03  08:15
  CF-107  Zone 03  14:00
  Alert PA-21  Zone 03  06:00-10:00  (confirmed)

Expected: Only CF-104 enters UNDER_ENVIRONMENTAL_REVIEW.
Then records a demo inspector decision on CF-104.
"""
import sys
import os
sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import asyncio
from datetime import datetime, timezone
from sqlalchemy import text

from app.database import init_db, SessionLocal
from app.models import Batch, Alert, CustodyEvent, InspectionDecision
from app.matching import run_matching_for_alert

BASE_DATE = "2026-09-24"


def _dt(time_str: str) -> datetime:
    return datetime.fromisoformat(f"{BASE_DATE}T{time_str}+00:00")


BATCHES = [
    {
        "id": "CF-101",
        "fisher_internal_id": "FISHER-001",
        "species": "Indian Mackerel",
        "weight_kg": 120.5,
        "catch_zone": "Zone 01",
        "catch_time": _dt("07:00:00"),
        "landing_centre": "Kochi Fish Landing Centre",
    },
    {
        "id": "CF-104",
        "fisher_internal_id": "FISHER-004",
        "species": "Sardine",
        "weight_kg": 85.0,
        "catch_zone": "Zone 03",
        "catch_time": _dt("08:15:00"),
        "landing_centre": "Calicut Fish Landing Centre",
    },
    {
        "id": "CF-107",
        "fisher_internal_id": "FISHER-007",
        "species": "King Fish",
        "weight_kg": 45.0,
        "catch_zone": "Zone 03",
        "catch_time": _dt("14:00:00"),
        "landing_centre": "Calicut Fish Landing Centre",
    },
]

ALERT = {
    "id": "PA-21",
    "zone": "Zone 03",
    "start_time": _dt("06:00:00"),
    "end_time": _dt("10:00:00"),
    "reason": "Elevated hydrocarbon levels detected near Zone 03 following tanker discharge report.",
    "confirmed_by": "Officer Priya Menon",
    "status": "CONFIRMED",
    "screening_note": "DEMONSTRATION HEURISTIC flagged elevated green-channel ratio in uploaded sample image.",
}

INSPECTION = {
    "batch_id": "CF-104",
    "alert_id": "PA-21",
    "inspector_name": "Inspector Rahul Nair",
    "decision": "FLAGGED_DEMO",
    "reason": "Physical inspection confirms hydrocarbon odour in batch CF-104. Batch held for further testing. DEMO DECISION - Not official government clearance.",
}


async def main():
    await init_db()

    async with SessionLocal() as db:
        # Clear existing seed data using raw SQL to avoid FK issues
        batch_ids = [b["id"] for b in BATCHES]
        for bid in batch_ids:
            await db.execute(text("DELETE FROM inspection_decisions WHERE batch_id = :bid"), {"bid": bid})
            await db.execute(text("DELETE FROM lot_batches WHERE batch_id = :bid"), {"bid": bid})
            await db.execute(text("DELETE FROM custody_events WHERE batch_id = :bid"), {"bid": bid})
            await db.execute(text("DELETE FROM batches WHERE id = :bid"), {"bid": bid})
        await db.execute(text("DELETE FROM alerts WHERE id = 'PA-21'"))
        await db.commit()

        # Create batches
        registered_at = datetime.now(timezone.utc)
        for bd in BATCHES:
            fp = Batch.compute_fingerprint(
                batch_id=bd["id"],
                fisher_internal_id=bd["fisher_internal_id"],
                species=bd["species"],
                weight_kg=bd["weight_kg"],
                catch_zone=bd["catch_zone"],
                catch_time=bd["catch_time"].isoformat(),
                landing_centre=bd["landing_centre"],
                registered_at=registered_at.isoformat(),
            )
            batch = Batch(
                id=bd["id"],
                fisher_internal_id=bd["fisher_internal_id"],
                species=bd["species"],
                weight_kg=bd["weight_kg"],
                catch_zone=bd["catch_zone"],
                catch_time=bd["catch_time"],
                landing_centre=bd["landing_centre"],
                registered_at=registered_at,
                fingerprint=fp,
                status="NO_CONFIRMED_ALERT_OVERLAP_FOUND",
            )
            db.add(batch)
            db.add(CustodyEvent(
                batch_id=bd["id"],
                event_type="REGISTERED",
                actor_role="OPERATOR",
                note=f"Batch registered at {bd['landing_centre']} (SEED DATA).",
            ))

        await db.commit()
        print("Seed batches created: CF-101, CF-104, CF-107")

        # Create and confirm alert PA-21
        alert = Alert(
            id=ALERT["id"],
            zone=ALERT["zone"],
            start_time=ALERT["start_time"],
            end_time=ALERT["end_time"],
            reason=ALERT["reason"],
            confirmed_by=ALERT["confirmed_by"],
            status=ALERT["status"],
            screening_note=ALERT["screening_note"],
            confirmed_at=datetime.now(timezone.utc),
        )
        db.add(alert)
        await db.commit()
        print("Alert PA-21 confirmed for Zone 03 [06:00-10:00]")

        # Run matching
        results = await run_matching_for_alert(alert, db)
        for r in results:
            status = "MATCHED" if r.matched else "no match"
            print(f"  {r.batch_id}: {status} - {r.reason}")

        # Inspector decision on CF-104
        from sqlalchemy import select
        q = await db.execute(
            select(InspectionDecision).where(
                InspectionDecision.batch_id == INSPECTION["batch_id"],
                InspectionDecision.alert_id == INSPECTION["alert_id"],
            )
        )
        if not q.scalars().first():
            decision = InspectionDecision(
                batch_id=INSPECTION["batch_id"],
                alert_id=INSPECTION["alert_id"],
                inspector_name=INSPECTION["inspector_name"],
                decision=INSPECTION["decision"],
                reason=INSPECTION["reason"],
            )
            db.add(decision)

            cf104_q = await db.execute(select(Batch).where(Batch.id == "CF-104"))
            cf104 = cf104_q.scalars().first()
            if cf104:
                cf104.status = "FLAGGED_DEMO"
                db.add(CustodyEvent(
                    batch_id="CF-104",
                    event_type="INSPECTOR_DECISION",
                    actor_role="INSPECTOR",
                    note=(
                        f"DEMO DECISION by {INSPECTION['inspector_name']}: "
                        f"{INSPECTION['decision']}. {INSPECTION['reason']}"
                    ),
                ))
            await db.commit()
            print("Inspector decision recorded on CF-104: FLAGGED_DEMO")

        print("\n=== Seed complete ===")
        print("CF-101 -> NO_CONFIRMED_ALERT_OVERLAP_FOUND  (Zone 01, outside alert)")
        print("CF-104 -> FLAGGED_DEMO                      (Zone 03, 08:15 within 06:00-10:00)")
        print("CF-107 -> NO_CONFIRMED_ALERT_OVERLAP_FOUND  (Zone 03, 14:00 outside 06:00-10:00)")
        print("\nDisclaimer: No alert overlap or matching hash proves seafood safety.")


if __name__ == "__main__":
    asyncio.run(main())
