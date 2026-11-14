-- =====================================================================
-- Duyuf — Migration 0013: a log of AI calls
--
-- Every call the staff helpers make to Claude (ai/: briefing, incident
-- co-pilot, arrival advisor): who asked, which helper, which model, how many
-- tokens, how it went. Never the content: what to watch here is cost and
-- failures. Kept 90 days (PROPOSED).
-- =====================================================================

SET search_path = duyuf, public;

CREATE TABLE ai_call (
    id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tenant_id      uuid NOT NULL DEFAULT current_tenant() REFERENCES tenant(id),
    helper         text NOT NULL CHECK (helper IN ('brief', 'copilot', 'advisor')),
    asked_by       text NOT NULL,
    outcome        text NOT NULL CHECK (outcome IN ('answered', 'declined', 'failed')),
    model          text,
    input_tokens   integer,
    output_tokens  integer,
    seconds        real,
    at             timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ai_call_idx ON ai_call (tenant_id, at DESC);

ALTER TABLE ai_call ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_call FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON ai_call TO duyuf_app
    USING (tenant_id = current_tenant()) WITH CHECK (tenant_id = current_tenant());
CREATE POLICY tenant_owner ON ai_call TO CURRENT_USER USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, DELETE ON ai_call TO duyuf_app;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA duyuf TO duyuf_app;
