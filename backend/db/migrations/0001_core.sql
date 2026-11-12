-- =====================================================================
-- Duyuf — Migration 0001: tenants, people, keys
--
-- A tenant is one operator: a Hajj or Umrah service company. Every row
-- that belongs to an operator carries tenant_id, and 0002 makes the
-- database refuse to show it to anyone else.
-- =====================================================================

SET search_path = duyuf, public;

CREATE TABLE tenant (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug        text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9][a-z0-9-]{1,62}$'),
    name        text NOT NULL,
    name_ar     text,
    -- A demonstration operator holds invented pilgrims only. Set at creation
    -- and never changed (trigger below), so real records can never be wiped
    -- by a demo reset and sample records can never pass as real ones.
    is_demo     boolean NOT NULL DEFAULT false,
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE FUNCTION tenant_demo_fixed() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.is_demo IS DISTINCT FROM OLD.is_demo THEN
        RAISE EXCEPTION 'is_demo is fixed at creation';
    END IF;
    RETURN NEW;
END $$;

CREATE TRIGGER tenant_demo_fixed BEFORE UPDATE ON tenant
    FOR EACH ROW EXECUTE FUNCTION tenant_demo_fixed();

CREATE TABLE principal (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     uuid NOT NULL REFERENCES tenant(id),
    external_id   text NOT NULL,
    display_name  text NOT NULL,
    role          text NOT NULL CHECK (role IN ('administrator', 'supervisor', 'staff', 'viewer')),
    created_at    timestamptz NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, external_id),
    UNIQUE (tenant_id, id)
);

-- Only the hash is stored. The key itself is shown once, by issue_key.py.
CREATE TABLE api_key (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     uuid NOT NULL REFERENCES tenant(id),
    principal_id  uuid NOT NULL,
    name          text NOT NULL,
    prefix        text NOT NULL,
    key_hash      text NOT NULL UNIQUE,
    expires_at    timestamptz,
    revoked_at    timestamptz,
    created_at    timestamptz NOT NULL DEFAULT now(),
    FOREIGN KEY (tenant_id, principal_id) REFERENCES principal (tenant_id, id)
);
