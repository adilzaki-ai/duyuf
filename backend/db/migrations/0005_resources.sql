-- =====================================================================
-- Duyuf — Migration 0005: resources on shift
--
-- What the operator has at an airport for a stretch of time: wheelchairs,
-- buses, interpreters (each in one language). The arrivals board sets
-- these against what landing flights need and shows the gaps.
-- A shift is planned, not edited: wrong ones are removed and added again.
-- =====================================================================

SET search_path = duyuf, public;

CREATE TABLE resource_shift (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   uuid NOT NULL DEFAULT current_tenant() REFERENCES tenant(id),
    airport     char(3) NOT NULL CHECK (airport ~ '^[A-Z]{3}$'),
    kind        text NOT NULL CHECK (kind IN ('wheelchair', 'bus', 'interpreter')),
    -- the language an interpreter speaks; only interpreters have one
    language    text CHECK (language ~ '^[a-z]{2}$'),
    quantity    integer NOT NULL CHECK (quantity BETWEEN 1 AND 1000),
    starts_at   timestamptz NOT NULL,
    ends_at     timestamptz NOT NULL,
    note        text,
    created_by  text NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now(),
    CHECK (ends_at > starts_at),
    CHECK ((kind = 'interpreter') = (language IS NOT NULL))
);

CREATE INDEX resource_shift_when_idx ON resource_shift (tenant_id, airport, starts_at, ends_at);

ALTER TABLE resource_shift ENABLE ROW LEVEL SECURITY;
ALTER TABLE resource_shift FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON resource_shift TO duyuf_app
    USING (tenant_id = current_tenant()) WITH CHECK (tenant_id = current_tenant());
CREATE POLICY tenant_owner ON resource_shift TO CURRENT_USER USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, DELETE ON resource_shift TO duyuf_app;
