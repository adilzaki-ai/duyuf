-- =====================================================================
-- Duyuf — Migration 0010: health readings, live location, automatic SOS
--
-- A pilgrim who agrees shares heart rate and temperature from a wearable,
-- and where they are. Readings are judged by the rules in
-- api/duyuf/health/rules.py (thresholds PROPOSED, not yet signed off by a
-- doctor). Dangerous readings start a 30-second countdown on the pilgrim's
-- page; unless they press "I am OK", an urgent medical incident is raised
-- with their last known place.
--
-- Health readings are special personal data (PDPL): only a medic or an
-- administrator reads them (scope health:read). Nothing is taken without
-- the pilgrim's consent, and consent can be withdrawn on their page.
-- Readings are kept 7 days and places 48 hours (PROPOSED retention).
-- =====================================================================

SET search_path = duyuf, public;

-- A medic: reads health, works incidents.
ALTER TABLE principal DROP CONSTRAINT principal_role_check;
ALTER TABLE principal ADD CONSTRAINT principal_role_check
    CHECK (role IN ('administrator', 'supervisor', 'staff', 'viewer', 'medic'));

-- What the pilgrim agreed to share, and since when. NULL: not agreed, or withdrawn.
CREATE TABLE pilgrim_consent (
    tenant_id    uuid NOT NULL DEFAULT current_tenant() REFERENCES tenant(id),
    pilgrim_id   uuid NOT NULL,
    health_at    timestamptz,
    location_at  timestamptz,
    updated_at   timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, pilgrim_id),
    FOREIGN KEY (tenant_id, pilgrim_id) REFERENCES pilgrim (tenant_id, id) ON DELETE CASCADE
);

CREATE TABLE vital_reading (
    id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tenant_id    uuid NOT NULL DEFAULT current_tenant() REFERENCES tenant(id),
    pilgrim_id   uuid NOT NULL,
    at           timestamptz NOT NULL,
    heart_rate   smallint CHECK (heart_rate BETWEEN 20 AND 250),
    temperature  numeric(3,1) CHECK (temperature BETWEEN 30 AND 45),
    -- simulated: the demonstration's "try it" buttons, on demonstration operators only
    source       text NOT NULL CHECK (source IN ('device', 'simulated')),
    device       text CHECK (length(device) <= 80),
    received_at  timestamptz NOT NULL DEFAULT now(),
    CHECK (heart_rate IS NOT NULL OR temperature IS NOT NULL),
    FOREIGN KEY (tenant_id, pilgrim_id) REFERENCES pilgrim (tenant_id, id) ON DELETE CASCADE
);
CREATE INDEX vital_reading_idx ON vital_reading (tenant_id, pilgrim_id, at DESC);

-- "I drank water", pressed on the page.
CREATE TABLE water_log (
    id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tenant_id    uuid NOT NULL DEFAULT current_tenant() REFERENCES tenant(id),
    pilgrim_id   uuid NOT NULL,
    at           timestamptz NOT NULL DEFAULT now(),
    FOREIGN KEY (tenant_id, pilgrim_id) REFERENCES pilgrim (tenant_id, id) ON DELETE CASCADE
);
CREATE INDEX water_log_idx ON water_log (tenant_id, pilgrim_id, at DESC);

CREATE TABLE pilgrim_location (
    id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tenant_id    uuid NOT NULL DEFAULT current_tenant() REFERENCES tenant(id),
    pilgrim_id   uuid NOT NULL,
    at           timestamptz NOT NULL,
    lat          double precision NOT NULL CHECK (lat BETWEEN -90 AND 90),
    lon          double precision NOT NULL CHECK (lon BETWEEN -180 AND 180),
    accuracy_m   real CHECK (accuracy_m >= 0),
    source       text NOT NULL CHECK (source IN ('phone', 'device', 'simulated')),
    received_at  timestamptz NOT NULL DEFAULT now(),
    FOREIGN KEY (tenant_id, pilgrim_id) REFERENCES pilgrim (tenant_id, id) ON DELETE CASCADE
);
CREATE INDEX pilgrim_location_idx ON pilgrim_location (tenant_id, pilgrim_id, at DESC);

-- Dangerous readings: counting down on the pilgrim's page, cancelled by
-- "I am OK", or sent as an incident when the count ran out.
CREATE TABLE health_alert (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id    uuid NOT NULL DEFAULT current_tenant() REFERENCES tenant(id),
    pilgrim_id   uuid NOT NULL,
    reasons      text[] NOT NULL,
    heart_rate   smallint,
    temperature  numeric(3,1),
    state        text NOT NULL DEFAULT 'counting' CHECK (state IN ('counting', 'cancelled', 'sent')),
    started_at   timestamptz NOT NULL DEFAULT now(),
    fires_at     timestamptz NOT NULL,
    ended_at     timestamptz,
    incident_id  uuid REFERENCES incident (id),
    CHECK (state = 'counting' OR ended_at IS NOT NULL),
    CHECK (state <> 'sent' OR incident_id IS NOT NULL),
    FOREIGN KEY (tenant_id, pilgrim_id) REFERENCES pilgrim (tenant_id, id) ON DELETE CASCADE
);
-- One countdown at a time per pilgrim.
CREATE UNIQUE INDEX health_alert_counting_key ON health_alert (tenant_id, pilgrim_id) WHERE state = 'counting';
CREATE INDEX health_alert_due_idx ON health_alert (fires_at) WHERE state = 'counting';
CREATE INDEX health_alert_pilgrim_idx ON health_alert (tenant_id, pilgrim_id, started_at DESC);

DO $$
DECLARE t text;
BEGIN
    FOREACH t IN ARRAY ARRAY['pilgrim_consent', 'vital_reading', 'water_log', 'pilgrim_location', 'health_alert'] LOOP
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

GRANT SELECT, INSERT, UPDATE ON pilgrim_consent TO duyuf_app;
-- DELETE only for the retention rule: readings older than 7 days, places older than 48 hours.
GRANT SELECT, INSERT, DELETE ON vital_reading TO duyuf_app;
GRANT SELECT, INSERT, DELETE ON water_log TO duyuf_app;
GRANT SELECT, INSERT, DELETE ON pilgrim_location TO duyuf_app;
GRANT SELECT, INSERT, UPDATE ON health_alert TO duyuf_app;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA duyuf TO duyuf_app;
