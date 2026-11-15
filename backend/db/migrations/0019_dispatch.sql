-- =====================================================================
-- Duyuf — Migration 0019: the roster, and asking people to cover gaps
--
-- worker: the operator's own staff and freelancers who can cover a shift:
-- interpreters (with the languages they speak), wheelchair staff and bus
-- drivers, the airports they work at, and a weekly limit on hours.
--
-- A shift can now be filled from the roster (source 'roster'): its people are
-- asked one by one (assignment), each through a personal link they open on
-- their phone to accept, decline, and say "I'm here" at the airport. Only the
-- people who have not declined count toward the shift on the arrivals board;
-- only those who accepted count as confirmed.
--
-- dispatch_setting: per operator, Off / Approve (a plan waits for a
-- supervisor) / Automatic (people are asked straight away), how far ahead to
-- look and how long a person has to answer. dispatch_plan keeps every plan,
-- proposed or carried out, with who decided.
--
-- No SMS/WhatsApp provider is signed yet: a request is sent by staff with one
-- tap on WhatsApp (sent_at records it). When a provider is added, it sends.
-- =====================================================================

SET search_path = duyuf, public;

CREATE TABLE worker (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id      uuid NOT NULL DEFAULT current_tenant() REFERENCES tenant(id),
    name           text NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
    name_ar        text CHECK (length(name_ar) <= 120),
    phone          text NOT NULL CHECK (phone ~ '^\+?[0-9 ]{8,20}$'),
    roles          text[] NOT NULL CHECK (cardinality(roles) >= 1 AND roles <@ ARRAY['interpreter', 'wheelchair', 'bus']),
    -- ISO 639-1, the languages an interpreter works in
    languages      text[] NOT NULL DEFAULT '{}',
    airports       text[] NOT NULL CHECK (cardinality(airports) >= 1),
    max_hours_week smallint NOT NULL DEFAULT 48 CHECK (max_hours_week BETWEEN 1 AND 84),
    active         boolean NOT NULL DEFAULT true,
    note           text CHECK (length(note) <= 300),
    created_at     timestamptz NOT NULL DEFAULT now(),
    updated_at     timestamptz NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, id),
    UNIQUE (tenant_id, phone)
);

ALTER TABLE resource_shift ADD COLUMN source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'roster'));

CREATE TABLE assignment (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id    uuid NOT NULL DEFAULT current_tenant() REFERENCES tenant(id),
    shift_id     uuid NOT NULL REFERENCES resource_shift(id) ON DELETE CASCADE,
    worker_id    uuid NOT NULL,
    status       text NOT NULL DEFAULT 'asked'
                 CHECK (status IN ('asked', 'accepted', 'declined', 'expired', 'cancelled', 'arrived')),
    -- the personal link's secret: kept so staff can send the link, cleared when the shift is over
    token        text,
    token_hash   text NOT NULL UNIQUE,
    message      text NOT NULL,
    asked_by     text NOT NULL,
    asked_at     timestamptz NOT NULL DEFAULT now(),
    answer_by    timestamptz NOT NULL,
    sent_at      timestamptz,
    answered_at  timestamptz,
    arrived_at   timestamptz,
    UNIQUE (shift_id, worker_id),
    FOREIGN KEY (tenant_id, worker_id) REFERENCES worker (tenant_id, id)
);

CREATE INDEX assignment_status_idx ON assignment (tenant_id, status, answer_by);
CREATE INDEX assignment_worker_idx ON assignment (tenant_id, worker_id);

CREATE TABLE dispatch_setting (
    tenant_id      uuid PRIMARY KEY DEFAULT current_tenant() REFERENCES tenant(id),
    mode           text NOT NULL DEFAULT 'approve' CHECK (mode IN ('off', 'approve', 'auto')),
    horizon_hours  smallint NOT NULL DEFAULT 24 CHECK (horizon_hours BETWEEN 2 AND 72),
    answer_minutes smallint NOT NULL DEFAULT 30 CHECK (answer_minutes BETWEEN 5 AND 240),
    updated_by     text,
    updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE dispatch_plan (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   uuid NOT NULL DEFAULT current_tenant() REFERENCES tenant(id),
    status      text NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed', 'approved', 'discarded')),
    items       jsonb NOT NULL,
    made_by     text NOT NULL,
    made_at     timestamptz NOT NULL DEFAULT now(),
    decided_by  text,
    decided_at  timestamptz
);

CREATE UNIQUE INDEX dispatch_plan_one_open ON dispatch_plan (tenant_id) WHERE status = 'proposed';

DO $$
DECLARE t text;
BEGIN
    FOREACH t IN ARRAY ARRAY['worker', 'assignment', 'dispatch_setting', 'dispatch_plan'] LOOP
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

-- A person is switched off, never deleted (their past assignments point at them).
GRANT SELECT, INSERT, UPDATE ON worker TO duyuf_app;
GRANT SELECT, INSERT, UPDATE ON assignment TO duyuf_app;
GRANT SELECT, INSERT, UPDATE ON dispatch_setting TO duyuf_app;
GRANT SELECT, INSERT, UPDATE ON dispatch_plan TO duyuf_app;
GRANT UPDATE (quantity) ON resource_shift TO duyuf_app;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA duyuf TO duyuf_app;

-- The AI helper that explains a dispatch plan is logged like the others (who, model, tokens; never content).
ALTER TABLE ai_call DROP CONSTRAINT ai_call_helper_check;
ALTER TABLE ai_call ADD CONSTRAINT ai_call_helper_check CHECK (helper IN ('brief', 'copilot', 'advisor', 'dispatch'));
