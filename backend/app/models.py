"""
SQLAlchemy ORM models for CatchShield AI.
"""
from __future__ import annotations
import uuid
import hashlib
import json
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import (
    String, Integer, Float, DateTime, Text, ForeignKey, Boolean
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def _now() -> datetime:
    return datetime.now(timezone.utc)


# ---------------------------------------------------------------------------
# Batch (Digital Catch Passport)
# ---------------------------------------------------------------------------
class Batch(Base):
    __tablename__ = "batches"

    id: Mapped[str] = mapped_column(String(20), primary_key=True)
    # Fisher identity – stored only server-side, never exposed in public API
    fisher_internal_id: Mapped[str] = mapped_column(String(100))
    species: Mapped[str] = mapped_column(String(100))
    weight_kg: Mapped[float] = mapped_column(Float)
    catch_zone: Mapped[str] = mapped_column(String(50))
    catch_time: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    landing_centre: Mapped[str] = mapped_column(String(200))
    photo_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    registered_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    # Integrity fingerprint (SHA-256 of canonical registration fields)
    fingerprint: Mapped[str] = mapped_column(String(64))
    # On-chain tx hash (Hardhat local node); empty until submitted
    chain_tx: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    # Lot membership
    lot_memberships: Mapped[list[LotBatch]] = relationship(
        "LotBatch", back_populates="batch"
    )

    status: Mapped[str] = mapped_column(
        String(50), default="NO_CONFIRMED_ALERT_OVERLAP_FOUND"
    )
    # Statuses:
    # NO_CONFIRMED_ALERT_OVERLAP_FOUND
    # UNDER_ENVIRONMENTAL_REVIEW
    # INSPECTION_PENDING
    # CLEARED_DEMO
    # FLAGGED_DEMO

    custody_events: Mapped[list[CustodyEvent]] = relationship(
        "CustodyEvent", back_populates="batch", order_by="CustodyEvent.event_time"
    )

    @staticmethod
    def _norm_dt(dt_str: str) -> str:
        """Normalise a datetime ISO string to UTC with +00:00 suffix for consistent hashing."""
        # Parse, ensure UTC, strip microseconds for stability
        dt = datetime.fromisoformat(dt_str.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        else:
            from datetime import timezone as _tz
            import datetime as _dt_mod
            dt = dt.astimezone(_tz.utc)
        return dt.strftime("%Y-%m-%dT%H:%M:%S+00:00")

    @staticmethod
    def compute_fingerprint(
        batch_id: str,
        fisher_internal_id: str,
        species: str,
        weight_kg: float,
        catch_zone: str,
        catch_time: str,          # ISO string
        landing_centre: str,
        registered_at: str,       # ISO string
    ) -> str:
        """SHA-256 of a canonical JSON blob (sorted keys, no whitespace).
        Datetimes are normalised to UTC before hashing for consistency.
        """
        canonical = json.dumps(
            {
                "batch_id": batch_id,
                "fisher_internal_id": fisher_internal_id,
                "species": species,
                "weight_kg": round(weight_kg, 3),
                "catch_zone": catch_zone,
                "catch_time": Batch._norm_dt(catch_time),
                "landing_centre": landing_centre,
                "registered_at": Batch._norm_dt(registered_at),
            },
            sort_keys=True,
            separators=(",", ":"),
        )
        return hashlib.sha256(canonical.encode()).hexdigest()


# ---------------------------------------------------------------------------
# Custody Event
# ---------------------------------------------------------------------------
class CustodyEvent(Base):
    __tablename__ = "custody_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    batch_id: Mapped[str] = mapped_column(ForeignKey("batches.id"))
    event_type: Mapped[str] = mapped_column(String(50))  # REGISTERED, ALERT_MATCHED, INSPECTION_ASSIGNED, INSPECTOR_DECISION
    actor_role: Mapped[str] = mapped_column(String(50))
    note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    event_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    batch: Mapped[Batch] = relationship("Batch", back_populates="custody_events")


# ---------------------------------------------------------------------------
# Alert
# ---------------------------------------------------------------------------
class Alert(Base):
    __tablename__ = "alerts"

    id: Mapped[str] = mapped_column(String(20), primary_key=True)
    zone: Mapped[str] = mapped_column(String(50))
    start_time: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    end_time: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    reason: Mapped[str] = mapped_column(Text)
    confirmed_by: Mapped[str] = mapped_column(String(100))  # officer display name
    confirmed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    screening_note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # CONFIRMED | REJECTED
    status: Mapped[str] = mapped_column(String(20), default="CONFIRMED")


# ---------------------------------------------------------------------------
# Inspector Decision
# ---------------------------------------------------------------------------
class InspectionDecision(Base):
    __tablename__ = "inspection_decisions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    batch_id: Mapped[str] = mapped_column(ForeignKey("batches.id"))
    alert_id: Mapped[str] = mapped_column(ForeignKey("alerts.id"))
    inspector_name: Mapped[str] = mapped_column(String(100))
    # CLEARED_DEMO | FLAGGED_DEMO
    decision: Mapped[str] = mapped_column(String(30))
    reason: Mapped[str] = mapped_column(Text)
    decided_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


# ---------------------------------------------------------------------------
# Mixed Lot
# ---------------------------------------------------------------------------
class Lot(Base):
    __tablename__ = "lots"

    id: Mapped[str] = mapped_column(String(20), primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    # COMPLETE | TRACEABILITY_INCOMPLETE
    traceability_status: Mapped[str] = mapped_column(String(40), default="COMPLETE")
    review_status: Mapped[str] = mapped_column(String(50), default="NO_CONFIRMED_ALERT_OVERLAP_FOUND")

    lot_batches: Mapped[list[LotBatch]] = relationship("LotBatch", back_populates="lot")


class LotBatch(Base):
    __tablename__ = "lot_batches"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    lot_id: Mapped[str] = mapped_column(ForeignKey("lots.id"))
    batch_id: Mapped[Optional[str]] = mapped_column(ForeignKey("batches.id"), nullable=True)
    # True when source batch is unknown
    unknown_source: Mapped[bool] = mapped_column(Boolean, default=False)

    lot: Mapped[Lot] = relationship("Lot", back_populates="lot_batches")
    batch: Mapped[Optional[Batch]] = relationship("Batch", back_populates="lot_memberships")
