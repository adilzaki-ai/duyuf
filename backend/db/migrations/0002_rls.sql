-- =====================================================================
-- Duyuf — Migration 0002: tenant isolation
--
-- Requests run as duyuf_app with `duyuf.tenant_id` set from the verified
-- caller. Row-level security keys every operator table on it, so a query
-- that forgets a WHERE tenant_id clause still sees only its own operator.
-- =====================================================================

SET search_path = duyuf, public;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'duyuf_app') THEN
        CREATE ROLE duyuf_app NOLOGIN;
    END IF;
END $$;

GRANT duyuf_app TO CURRENT_USER;
-- No default privileges: each migration grants what its tables need, so a
-- new table is closed to the app until someone decides otherwise.
GRANT USAGE ON SCHEMA duyuf TO duyuf_app;

CREATE FUNCTION current_tenant() RETURNS uuid
LANGUAGE sql STABLE AS $$
    SELECT NULLIF(current_setting('duyuf.tenant_id', true), '')::uuid
$$;

-- The app reads its own operator's row and nothing else; it never writes it.
GRANT SELECT ON tenant TO duyuf_app;
ALTER TABLE tenant ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_self ON tenant USING (id = current_tenant());
-- The owner provisions tenants and resolves keys; it is not bound to one.
CREATE POLICY tenant_owner ON tenant TO CURRENT_USER USING (true) WITH CHECK (true);

GRANT SELECT ON principal TO duyuf_app;
ALTER TABLE principal ENABLE ROW LEVEL SECURITY;
ALTER TABLE principal FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON principal TO duyuf_app
    USING (tenant_id = current_tenant()) WITH CHECK (tenant_id = current_tenant());
CREATE POLICY tenant_owner ON principal TO CURRENT_USER USING (true) WITH CHECK (true);

-- Keys are resolved before any tenant is known, by the owner only.
REVOKE ALL ON api_key FROM duyuf_app;
