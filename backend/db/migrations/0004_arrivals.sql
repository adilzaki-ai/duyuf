-- =====================================================================
-- Duyuf — Migration 0004: flights and arrivals
--
-- A flight is the operator's own record of a plane its pilgrims land on.
-- Two operators with pilgrims on the same plane each keep their own row.
-- A pilgrim lands on at most one flight; a large group may be split
-- across several. The composite key keeps a pilgrim on its own
-- operator's flights.
-- =====================================================================

SET search_path = duyuf, public;

CREATE TABLE flight (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id        uuid NOT NULL DEFAULT current_tenant() REFERENCES tenant(id),
    -- "SV 3102": airline code, one space, number (the API normalises it)
    number           text NOT NULL CHECK (number ~ '^[A-Z0-9]{2}[A-Z]? [0-9]{1,4}[A-Z]?$'),
    origin_airport   char(3) NOT NULL CHECK (origin_airport ~ '^[A-Z]{3}$'),
    arrival_airport  char(3) NOT NULL CHECK (arrival_airport ~ '^[A-Z]{3}$'),
    scheduled_at     timestamptz NOT NULL,
    -- the latest word on landing; null while it is on schedule
    estimated_at     timestamptz,
    -- set when someone on the ground confirms it is down
    landed_at        timestamptz,
    note             text,
    created_at       timestamptz NOT NULL DEFAULT now(),
    updated_at       timestamptz NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, number, scheduled_at),
    UNIQUE (tenant_id, id)
);

CREATE INDEX flight_when_idx ON flight (tenant_id, scheduled_at);

-- What happened to a flight, who did it and when. Append-only for the app.
CREATE TABLE flight_event (
    id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tenant_id   uuid NOT NULL DEFAULT current_tenant() REFERENCES tenant(id),
    flight_id   uuid NOT NULL REFERENCES flight(id) ON DELETE CASCADE,
    kind        text NOT NULL CHECK (kind IN ('created', 'expected', 'added', 'landed')),
    detail      jsonb NOT NULL DEFAULT '{}',
    actor       text NOT NULL,
    at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX flight_event_idx ON flight_event (tenant_id, flight_id, at);

-- The language a pilgrim speaks (ISO 639-1), for interpreters on arrival.
ALTER TABLE pilgrim ADD COLUMN language text CHECK (language ~ '^[a-z]{2}$');
ALTER TABLE pilgrim ADD COLUMN arrival_flight_id uuid;
ALTER TABLE pilgrim ADD FOREIGN KEY (tenant_id, arrival_flight_id) REFERENCES flight (tenant_id, id);
CREATE INDEX pilgrim_flight_idx ON pilgrim (tenant_id, arrival_flight_id);

DO $$
DECLARE t text;
BEGIN
    FOREACH t IN ARRAY ARRAY['flight', 'flight_event'] LOOP
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

-- No DELETE: a flight that does not come stays on record with a note.
GRANT SELECT, INSERT, UPDATE ON flight TO duyuf_app;
GRANT SELECT, INSERT ON flight_event TO duyuf_app;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA duyuf TO duyuf_app;
