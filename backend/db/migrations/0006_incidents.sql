-- =====================================================================
-- Duyuf — Migration 0006: incidents
--
-- Something has happened to a pilgrim or a group: an SOS, someone lost,
-- a medical or heat case, a bus that did not come. It is raised, given to
-- a team, and resolved; every step is kept with who took it and when, so
-- the time to help can be measured and nothing is quietly closed.
-- =====================================================================

SET search_path = duyuf, public;

-- So an incident can point at a pilgrim of its own operator only (composite key).
ALTER TABLE pilgrim ADD CONSTRAINT pilgrim_tenant_id_key UNIQUE (tenant_id, id);

CREATE TABLE incident (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id    uuid NOT NULL DEFAULT current_tenant() REFERENCES tenant(id),
    ref          bigint GENERATED ALWAYS AS IDENTITY,   -- "#1042" on screen and on the radio
    kind         text NOT NULL CHECK (kind IN ('sos', 'lost', 'medical', 'heat', 'transport', 'other')),
    priority     text NOT NULL CHECK (priority IN ('urgent', 'high', 'normal')),
    -- The journey of an incident. See api/duyuf/incidents/flow.py for the moves allowed.
    status       text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'assigned', 'resolved')),
    pilgrim_id   uuid,
    group_id     uuid,
    location     text,
    description  text NOT NULL CHECK (length(description) BETWEEN 1 AND 2000),
    team         text,
    resolution   text,
    reported_by  text NOT NULL,
    opened_at    timestamptz NOT NULL DEFAULT now(),
    -- the first time it was given to a team, and the latest time it was resolved
    assigned_at  timestamptz,
    resolved_at  timestamptz,
    updated_at   timestamptz NOT NULL DEFAULT now(),
    FOREIGN KEY (tenant_id, pilgrim_id) REFERENCES pilgrim (tenant_id, id),
    FOREIGN KEY (tenant_id, group_id) REFERENCES pilgrim_group (tenant_id, id),
    CHECK (status <> 'resolved' OR resolved_at IS NOT NULL),
    CHECK (status = 'open' OR team IS NOT NULL OR status = 'resolved')
);

CREATE INDEX incident_status_idx ON incident (tenant_id, status, opened_at DESC);
CREATE INDEX incident_pilgrim_idx ON incident (tenant_id, pilgrim_id);

-- Every step, who took it and when. Append-only for the app.
CREATE TABLE incident_event (
    id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tenant_id    uuid NOT NULL DEFAULT current_tenant() REFERENCES tenant(id),
    incident_id  uuid NOT NULL REFERENCES incident(id) ON DELETE CASCADE,
    kind         text NOT NULL CHECK (kind IN ('opened', 'assigned', 'note', 'resolved', 'reopened')),
    note         text,
    team         text,
    actor        text NOT NULL,
    at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX incident_event_idx ON incident_event (tenant_id, incident_id, at);

DO $$
DECLARE t text;
BEGIN
    FOREACH t IN ARRAY ARRAY['incident', 'incident_event'] LOOP
        EXECUTE format('ALTER TABLE duyuf.%I ENABLE ROW LEVEL SECURITY', t);
        EXECUTE format('ALTER TABLE duyuf.%I FORCE ROW LEVEL SECURITY', t);
        EXECUTE format($f$
            CREATE POLICY tenant_isolation ON duyuf.%I TO duyuf_app
            USING (tenant_id = duyuf.current_tenant())
            WITH CHECK (tenant_id = duyuf.current_tenant())
        $f$, t);
        EXECUTE format('CREATE POLICY tenant_owner ON duyuf.%I TO CURRENT_USER USING (true) WITH CHECK (true)', t);
    END LOOP;
END $$;

-- No DELETE: an incident raised in error is resolved with that said.
GRANT SELECT, INSERT, UPDATE ON incident TO duyuf_app;
GRANT SELECT, INSERT ON incident_event TO duyuf_app;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA duyuf TO duyuf_app;
