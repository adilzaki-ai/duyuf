"""
Duyuf — Platform API

Operations for Hajj and Umrah service companies: groups, pilgrims and their
journey through the Kingdom. The web console and any integration are clients
of this surface; nothing reaches the database except through here.

Run:  ./run-backend.sh
Docs: http://localhost:8100/docs
"""
from __future__ import annotations

import os

import psycopg.errors
from fastapi import Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .core.auth import Identity, identity
from .core.db import PoolUnavailable, healthy
from .routers import arrivals, groups, overview, pilgrims, resources

VERSION = "0.3.0"

app = FastAPI(title="Duyuf Platform API", version=VERSION,
              description="Hajj and Umrah operations: groups, pilgrims, journeys, arrivals.")


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
                       allow_headers=["Authorization", "Content-Type", "X-Duyuf-Tenant"], max_age=600)

app.include_router(overview.router)
app.include_router(groups.router)
app.include_router(pilgrims.router)
app.include_router(arrivals.router)
app.include_router(resources.router)


@app.get("/health", tags=["platform"])
def health():
    ok = healthy()
    return JSONResponse(status_code=200 if ok else 503,
                        content={"status": "ok" if ok else "database unreachable", "version": VERSION})


@app.get("/v1/me", tags=["platform"])
def me(who: Identity = Depends(identity)):
    return {
        "tenant": {"id": who.tenant_id, "slug": who.tenant_slug, "name": who.tenant_name,
                   "name_ar": who.tenant_name_ar, "is_demo": who.is_demo},
        "principal": {"id": who.principal_id, "name": who.display_name, "role": who.role},
        "scopes": sorted(who.scopes),
    }
