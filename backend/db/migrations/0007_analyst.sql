-- =====================================================================
-- Duyuf — Migration 0007: the analyst's record
--
-- Every question put to the AI analyst, who asked it, what it answered,
-- and the data it answered from (the tool calls and their results). The
-- analyst works from totals only, so these rows hold counts, never a
-- pilgrim's name or passport; they are kept so any answer can be checked.
-- =====================================================================

SET search_path = duyuf, public;

CREATE TABLE analyst_question (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id      uuid NOT NULL DEFAULT current_tenant() REFERENCES tenant(id),
    asked_by       text NOT NULL,
    question       text NOT NULL CHECK (length(question) BETWEEN 1 AND 2000),
    outcome        text NOT NULL CHECK (outcome IN ('answered', 'declined', 'cut_short', 'failed')),
    answer         text,
    sources        jsonb NOT NULL DEFAULT '[]',
    charts         jsonb NOT NULL DEFAULT '[]',
    model          text,
    input_tokens   integer,
    output_tokens  integer,
    seconds        numeric(6, 1),
    asked_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX analyst_question_idx ON analyst_question (tenant_id, asked_at DESC);

ALTER TABLE analyst_question ENABLE ROW LEVEL SECURITY;
ALTER TABLE analyst_question FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON analyst_question TO duyuf_app
    USING (tenant_id = current_tenant()) WITH CHECK (tenant_id = current_tenant());
CREATE POLICY tenant_owner ON analyst_question TO CURRENT_USER USING (true) WITH CHECK (true);

-- Append-only for the app.
GRANT SELECT, INSERT ON analyst_question TO duyuf_app;
