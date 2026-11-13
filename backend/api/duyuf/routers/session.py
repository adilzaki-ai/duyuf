"""Signing in and out of the web app, and changing one's own password.

The session itself lives in an HttpOnly cookie the page's scripts cannot
read. Signing in also needs `X-Duyuf-Client: web`, so another site cannot
sign someone in to an account of its choosing.
"""
from __future__ import annotations

import os

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field

from ..core import auth
from ..core.auth import Identity, identity

router = APIRouter(prefix="/v1/auth", tags=["sign in"])


class SignIn(BaseModel):
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=1, max_length=200)


class NewPassword(BaseModel):
    current: str = Field(min_length=1, max_length=200)
    new: str = Field(min_length=1, max_length=200)


def me_payload(who: Identity) -> dict:
    return {
        "tenant": {"id": who.tenant_id, "slug": who.tenant_slug, "name": who.tenant_name,
                   "name_ar": who.tenant_name_ar, "is_demo": who.is_demo},
        "principal": {"id": who.principal_id, "name": who.display_name, "role": who.role, "email": who.email,
                      "must_change_password": who.must_change_password},
        "via": who.via,
        "scopes": sorted(who.scopes),
    }


def _secure(request: Request) -> bool:
    return request.url.scheme == "https" or os.environ.get("DUYUF_COOKIE_SECURE") == "1"


@router.post("/sign-in")
def sign_in(body: SignIn, request: Request, response: Response):
    if request.headers.get(auth.CLIENT_HEADER) != "web":
        raise HTTPException(403, "sign in from the Duyuf web app")
    try:
        token, who = auth.sign_in(body.email, body.password, request.headers.get("user-agent"))
    except auth.SignInRefused as exc:
        raise HTTPException(exc.status, exc.message)
    response.set_cookie(auth.SESSION_COOKIE, token, max_age=int(auth.SESSION_HOURS * 3600), httponly=True,
                        samesite="strict", secure=_secure(request), path="/")
    return me_payload(who)


@router.post("/sign-out", status_code=204)
def sign_out(request: Request, response: Response):
    token = request.cookies.get(auth.SESSION_COOKIE)
    if token:
        auth.sign_out(token)
    response.delete_cookie(auth.SESSION_COOKIE, path="/")


@router.post("/password")
def change_password(body: NewPassword, who: Identity = Depends(identity)):
    try:
        return me_payload(auth.change_password(who, body.current, body.new))
    except auth.SignInRefused as exc:
        raise HTTPException(exc.status, exc.message)
