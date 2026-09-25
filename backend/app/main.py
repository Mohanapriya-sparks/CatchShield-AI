"""
CatchShield AI – Backend
FastAPI application entry point.
"""
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .database import init_db
from .routers import batches, alerts, matching, inspections, public, advisory, auth_router

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOADS_DIR = os.path.join(BASE_DIR, "..", "uploads")
os.makedirs(UPLOADS_DIR, exist_ok=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield

app = FastAPI(
    title="CatchShield AI",
    description=(
        "MVP prototype for CodeGyaan'26 ChainCraft. "
        "DISCLAIMER: No alert overlap or matching hash proves seafood safety. "
        "Inspector decisions in this prototype are demo decisions, not official government clearance."
    ),
    version="1.0.0-mvp",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(batches.router, prefix="/api/batches", tags=["batches"])
app.include_router(alerts.router, prefix="/api/alerts", tags=["alerts"])
app.include_router(matching.router, prefix="/api/matching", tags=["matching"])
app.include_router(inspections.router, prefix="/api/inspections", tags=["inspections"])
app.include_router(public.router, prefix="/api/public", tags=["public"])
app.include_router(advisory.router, prefix="/api/advisory", tags=["advisory"])
app.include_router(auth_router.router, prefix="/api/auth", tags=["auth"])

# Serve uploaded photos (no personal data in path)
app.mount("/uploads", StaticFiles(directory=UPLOADS_DIR), name="uploads")



@app.get("/health")
async def health():
    return {"status": "ok", "disclaimer": "No alert overlap or matching hash proves seafood safety."}
