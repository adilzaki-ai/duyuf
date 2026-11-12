"""Database access, tenant binding, and the connection pool.

Two kinds of session:

- `tenant_session(tenant_id)` — what every request uses. The transaction runs
  as `duyuf_app` with `duyuf.tenant_id` set, and row-level security (0002)
  keeps it inside that operator. Both settings are transaction-local, so they
  end with the transaction.
- `owner_session()` — for the few things that happen before a tenant is
  known (resolving an API key) or above tenants (provisioning). Never handed
  to a route.

A connection returned to the pool is checked, not trusted: one still bound to
an operator is discarded, because reusing it is how one company's pilgrims
would reach another company's screen.
"""
from __future__ import annotations

import atexit
import os
import threading
from contextlib import contextmanager
from typing import Any, Iterator

import psycopg
from psycopg.rows import dict_row

DSN = os.environ.get("DUYUF_DSN", "host=/tmp port=5432 user=duyuf dbname=duyuf_dev")
POOL_MAX = int(os.environ.get("DUYUF_POOL_MAX", "10") or 10)
POOL_TIMEOUT = float(os.environ.get("DUYUF_POOL_TIMEOUT", "10") or 10)

_pool: Any = None
_pool_pid: int | None = None
_lock = threading.Lock()


class PoolUnavailable(RuntimeError):
    """No connection could be had within the timeout: busy, not broken."""


def _configure(conn: psycopg.Connection) -> None:
    conn.execute("SET search_path = duyuf, public")
    # Makkah and Madinah keep one clock. "Today" in a query is the Saudi day,
    # whatever the server's own zone is.
    conn.execute("SELECT set_config('TimeZone', %s, false)",
                 (os.environ.get("DUYUF_TIMEZONE", "Asia/Riyadh"),))
    conn.commit()


def _reset(conn: psycopg.Connection) -> None:
    conn.rollback()
    row = conn.execute("SELECT current_setting('duyuf.tenant_id', true) AS tenant, "
                       "current_user AS role").fetchone()
    conn.commit()
    if row["tenant"] or row["role"] == "duyuf_app":
        raise psycopg.OperationalError(
            f"connection returned still bound (tenant={row['tenant']!r}); discarding it")


def _get_pool():
    global _pool, _pool_pid
    pid = os.getpid()
    if _pool is not None and _pool_pid == pid:
        return _pool
    with _lock:
        if _pool is None or _pool_pid != pid:
            from psycopg_pool import ConnectionPool
            _pool = ConnectionPool(
                DSN, min_size=1, max_size=POOL_MAX,
                kwargs={"row_factory": dict_row, "autocommit": False},
                configure=_configure, reset=_reset, timeout=POOL_TIMEOUT,
                open=True, name="duyuf")
            _pool_pid = pid
    return _pool


def close_pool() -> None:
    global _pool, _pool_pid
    with _lock:
        if _pool is not None:
            _pool.close()
        _pool, _pool_pid = None, None


atexit.register(close_pool)


@contextmanager
def _connection() -> Iterator[psycopg.Connection]:
    if POOL_MAX <= 0:
        conn = psycopg.connect(DSN, row_factory=dict_row, autocommit=False)
        try:
            _configure(conn)
            yield conn
        finally:
            conn.close()
        return
    from psycopg_pool import PoolTimeout
    pool = _get_pool()
    try:
        conn = pool.getconn()
    except PoolTimeout as exc:
        raise PoolUnavailable(str(exc)) from exc
    try:
        yield conn
    finally:
        pool.putconn(conn)   # runs _reset


@contextmanager
def tenant_session(tenant_id: str) -> Iterator[psycopg.Connection]:
    """One transaction, as the app role, inside one operator."""
    with _connection() as conn:
        try:
            conn.execute("SET LOCAL ROLE duyuf_app")
            conn.execute("SELECT set_config('duyuf.tenant_id', %s, true)", (str(tenant_id),))
            yield conn
            conn.commit()
        except BaseException:
            conn.rollback()
            raise


@contextmanager
def owner_session() -> Iterator[psycopg.Connection]:
    """One transaction as the schema owner. Scripts and key lookup only."""
    with _connection() as conn:
        try:
            yield conn
            conn.commit()
        except BaseException:
            conn.rollback()
            raise


def healthy() -> bool:
    try:
        with owner_session() as conn:
            conn.execute("SELECT 1")
        return True
    except Exception:  # noqa: BLE001
        return False
