"""
Duyuf — Platform API

Operations for Hajj and Umrah service companies: groups, pilgrims and their
journey through the Kingdom. The web console and any integration are clients
of this surface; nothing reaches the database except through here.

Run:  ./run-backend.sh
Docs: http://localhost:8100/docs
"""
from __future__ import annotations

import asyncio
import os
from contextlib import asynccontextmanager

import psycopg.errors
from fastapi import Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .core.auth import Identity, identity
from .core.db import PoolUnavailable, healthy
from .core.jobs import run_forever
from .routers import (analyst, arrivals, groups, health, imports, incidents, overview, pilgrims, rafeeq,
                      resources, session, staff)

VERSION = "0.8.0"

@asynccontextmanager
async def _lifespan(_: FastAPI):
    # Sends automatic medical alerts whose countdown ran out (core/jobs.py).
    jobs = asyncio.create_task(run_forever())
    try:
        yield
    finally:
        jobs.cancel()


app = FastAPI(title="Duyuf Platform API", version=VERSION, lifespan=_lifespan,
              description="Hajj and Umrah operations: groups, pilgrims, journeys, arrivals, and Rafeeq, the pilgrim's own page.")


def _first_line(exc: Exception) -> str:
    diag = getattr(exc, "diag", None)
    return (getattr(diag, "message_primary", None) or str(exc).splitlines()[0]) if str(exc) else type(exc).__name__


@app.exception_handler(psycopg.errors.UniqueViolation)
async def _duplicate(_: Request, exc: Exception) -> JSONResponse:
    detail = getattr(getattr(exc, "diag", None), "message_detail", None) or _first_line(exc)
    return JSONResponse(status_code=409, content={"detail": f"already exists: {detail}"})


@app.exception_handler(psycopg.errors.ForeignKeyViolation)
async def _missing_ref(_: Request, exc: Exception) -> JSONResponse:
    return JSONResponse(status_code=422, content={"detail": f"refers to something that does not exist: {_first_line(exc)}"})


@app.exception_handler(psycopg.errors.CheckViolation)
@app.exception_handler(psycopg.errors.InvalidTextRepresentation)
@app.exception_handler(psycopg.errors.InvalidDatetimeFormat)
async def _malformed(_: Request, exc: Exception) -> JSONResponse:
    return JSONResponse(status_code=400, content={"detail": f"a value is not in the form expected: {_first_line(exc)}"})


@app.exception_handler(PoolUnavailable)
async def _busy(_: Request, __: Exception) -> JSONResponse:
    return JSONResponse(status_code=503, content={"detail": "the platform is busy; try again in a moment"},
                        headers={"Retry-After": "2"})


# Named origins only, never `*`: these calls carry a key.
_origins = [o.strip().rstrip("/") for o in os.environ.get("DUYUF_CORS_ORIGINS", "").split(",") if o.strip()]
if _origins:
    app.add_middleware(CORSMiddleware, allow_origins=_origins, allow_credentials=True,
                       allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
                       allow_headers=["Authorization", "Content-Type", "X-Duyuf-Tenant", "X-Duyuf-Client"], max_age=600)

app.include_router(overview.router)
app.include_router(groups.router)
app.include_router(imports.router)
app.include_router(pilgrims.router)
app.include_router(arrivals.router)
app.include_router(resources.router)
app.include_router(incidents.router)
app.include_router(analyst.router)
app.include_router(session.router)
app.include_router(staff.router)
app.include_router(rafeeq.router)
app.include_router(health.router)


@app.get("/health", tags=["platform"])
def health():
    ok = healthy()
    return JSONResponse(status_code=200 if ok else 503,
                        content={"status": "ok" if ok else "database unreachable", "version": VERSION})


@app.get("/v1/me", tags=["platform"])
def me(who: Identity = Depends(identity)):
    """Who is signed in. Open even while a new password is due, so the web app can ask for one."""
    return session.me_payload(who)
