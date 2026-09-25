"""
Database setup – SQLite via SQLAlchemy (async).
"""
import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase

# Use Render/PostgreSQL DATABASE_URL if available, else fallback to SQLite
DATABASE_URL = os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    DB_PATH = os.environ.get("DB_PATH", "catchshield.db")
    DATABASE_URL = f"sqlite+aiosqlite:///{DB_PATH}"

# Render PostgreSQL URL might start with postgres:// instead of postgresql+asyncpg://
if DATABASE_URL.startswith("postgres://") or DATABASE_URL.startswith("postgresql://"):
    # SQLAlchemy 1.4+ requires postgresql:// and async requires +asyncpg
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+asyncpg://", 1)
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)

engine = create_async_engine(DATABASE_URL, echo=False)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


class Base(DeclarativeBase):
    pass


async def init_db():
    from . import models  # noqa: F401 – registers all models
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await seed_sample_alerts()


async def seed_sample_alerts():
    from datetime import datetime, timezone, timedelta
    from sqlalchemy import select
    from .models import Alert

    async with SessionLocal() as session:
        result = await session.execute(select(Alert).where(Alert.id.in_(["ALT-2026-Z03", "ALT-2026-Z04", "ALT-2026-Z06", "ALT-2026-Z08", "ALT-2026-Z10"])))
        existing = {a.id for a in result.scalars().all()}

        now = datetime.now(timezone.utc)
        start = now - timedelta(days=30)
        end = now + timedelta(days=365)
        to_add = []

        if "ALT-2026-Z03" not in existing:
            to_add.append(Alert(
                id="ALT-2026-Z03",
                zone="ZONE 03",
                start_time=start,
                end_time=end,
                reason="Estuary Effluent Discharge: Chemical parameters elevated near estuary mouth in Zone 03.",
                confirmed_by="Env Officer Dr. V. Nair",
                confirmed_at=now,
                status="CONFIRMED",
                screening_note="Water samples confirm discharge. Catch batches in Zone 03 flagged for environmental review."
            ))

        if "ALT-2026-Z04" not in existing:
            to_add.append(Alert(
                id="ALT-2026-Z04",
                zone="ZONE 04",
                start_time=start,
                end_time=end,
                reason="Harmful Algal Bloom (HAB / Red Tide): Algal toxin surge detected in coastal waters of Zone 04.",
                confirmed_by="Coastal Authority Officer K. Sharma",
                confirmed_at=now,
                status="CONFIRMED",
                screening_note="Routine satellite & water monitoring detected algal bloom event."
            ))

        if "ALT-2026-Z06" not in existing:
            to_add.append(Alert(
                id="ALT-2026-Z06",
                zone="ZONE 06",
                start_time=start,
                end_time=end,
                reason="Heavy Metal Contamination: Elevated mercury levels detected in Zone 06.",
                confirmed_by="Env Officer Dr. V. Nair",
                confirmed_at=now,
                status="CONFIRMED",
                screening_note="Water samples confirm discharge."
            ))
            
        if "ALT-2026-Z08" not in existing:
            to_add.append(Alert(
                id="ALT-2026-Z08",
                zone="ZONE 08",
                start_time=start,
                end_time=end,
                reason="Oil Spill Remnants: Traces of hydrocarbons detected.",
                confirmed_by="Env Officer Dr. V. Nair",
                confirmed_at=now,
                status="CONFIRMED",
                screening_note="Monitoring ongoing."
            ))

        if "ALT-2026-Z10" not in existing:
            to_add.append(Alert(
                id="ALT-2026-Z10",
                zone="ZONE 10",
                start_time=start,
                end_time=end,
                reason="Microplastic Surge: High density detected after storm.",
                confirmed_by="Env Officer Dr. V. Nair",
                confirmed_at=now,
                status="CONFIRMED",
                screening_note="Review needed."
            ))

        if to_add:
            session.add_all(to_add)
            await session.commit()


async def get_db():
    async with SessionLocal() as session:
        yield session
