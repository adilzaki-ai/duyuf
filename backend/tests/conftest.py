"""Tests run against duyuf_test, which run-tests.sh rebuilds from the migrations
every time — never against duyuf_dev."""
from __future__ import annotations

import os
import pathlib
import sys
import uuid

import pytest

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "api"))
sys.path.insert(0, str(ROOT / "scripts"))

if "duyuf_test" not in os.environ.get("DUYUF_DSN", ""):
    raise SystemExit("tests run only against duyuf_test: use ./run-tests.sh")

os.environ["DUYUF_DEV_AUTH"] = "1"

from fastapi.testclient import TestClient  # noqa: E402

from duyuf.main import app  # noqa: E402
from provision import provision  # noqa: E402


@pytest.fixture(scope="session")
def client() -> TestClient:
    return TestClient(app)


def _operator(prefix: str) -> str:
    slug = f"{prefix}-{uuid.uuid4().hex[:8]}"
    provision(slug, f"Test {prefix}")
    return slug


@pytest.fixture
def op_a() -> str:
    return _operator("a")


@pytest.fixture
def op_b() -> str:
    return _operator("b")


def as_op(slug: str) -> dict:
    return {"X-Duyuf-Tenant": slug}
