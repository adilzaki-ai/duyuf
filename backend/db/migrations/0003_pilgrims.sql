-- =====================================================================
-- Duyuf — Migration 0003: pilgrim groups and pilgrims
--
-- A group travels together: one season, one arrival, one departure, one
-- leader. A pilgrim belongs to exactly one group, and the group must be
-- the same operator's (the composite key, not trust).
-- =====================================================================

SET search_path = duyuf, public;

CREATE TABLE pilgrim_group (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       uuid NOT NULL DEFAULT current_tenant() REFERENCES tenant(id),
    code            text NOT NULL CHECK (length(code) BETWEEN 1 AND 32),
    name            text NOT NULL,
    kind            text NOT NULL CHECK (kind IN ('hajj', 'umrah')),
    season          text NOT NULL,              -- "1448", the Hijri year
    origin_country  char(2) NOT NULL CHECK (origin_country ~ '^[A-Z]{2}$'),
    arrival_date    date,
    departure_date  date,
    leader_name     text,
    leader_phone    text,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, code),
    UNIQUE (tenant_id, id),
    CHECK (departure_date IS NULL OR arrival_date IS NULL OR departure_date >= arrival_date)
);

CREATE TABLE pilgrim (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     uuid NOT NULL DEFAULT current_tenant() REFERENCES tenant(id),
    group_id      uuid NOT NULL,
    full_name     text NOT NULL,
    full_name_ar  text,
    gender        text NOT NULL CHECK (gender IN ('male', 'female')),
    date_of_birth date,
    nationality   char(2) NOT NULL CHECK (nationality ~ '^[A-Z]{2}$'),
    passport_no   text NOT NULL,
    phone         text,
    -- The journey, in order. See api/duyuf/pilgrims/status.py for the moves allowed.
    status        text NOT NULL DEFAULT 'registered'
                  CHECK (status IN ('registered', 'visa_issued', 'arrived',
                                    'in_makkah', 'in_madinah', 'departed')),
    -- Care the service team must plan for: wheelchair, medical, elderly, …
    needs         text[] NOT NULL DEFAULT '{}',
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, nationality, passport_no),
    FOREIGN KEY (tenant_id, group_id) REFERENCES pilgrim_group (tenant_id, id)
);

CREATE INDEX pilgrim_group_idx ON pilgrim (tenant_id, group_id);
CREATE INDEX pilgrim_status_idx ON pilgrim (tenant_id, status);

-- Every status change, who made it and when. Append-only for the app.
CREATE TABLE pilgrim_event (
    id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tenant_id    uuid NOT NULL DEFAULT current_tenant() REFERENCES tenant(id),
    pilgrim_id   uuid NOT NULL REFERENCES pilgrim(id) ON DELETE CASCADE,
    from_status  text,
    to_status    text NOT NULL,
    note         text,
    actor        text NOT NULL,
    at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX pilgrim_event_idx ON pilgrim_event (tenant_id, pilgrim_id, at);

DO $$
DECLARE t text;
BEGIN
    FOREACH t IN ARRAY ARRAY['pilgrim_group', 'pilgrim', 'pilgrim_event'] LOOP
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

GRANT SELECT, INSERT, UPDATE, DELETE ON pilgrim_group, pilgrim TO duyuf_app;
GRANT SELECT, INSERT ON pilgrim_event TO duyuf_app;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA duyuf TO duyuf_app;
