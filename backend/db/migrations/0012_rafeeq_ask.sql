-- =====================================================================
-- Duyuf — Migration 0012: Ask Rafeeq
--
-- A pilgrim asks Rafeeq a question by voice or text, in their language,
-- and Claude answers from their own page (group, meeting point, readings)
-- with one suggested button (SOS, Find my way, call the leader...). The
-- pilgrim presses it; Rafeeq never calls anyone itself.
--
-- Questions and answers are kept 7 days (PROPOSED), so a bad answer can be
-- found and the rules fixed, and to count the hourly limit per card.
-- =====================================================================

SET search_path = duyuf, public;

CREATE TABLE rafeeq_question (
    id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tenant_id      uuid NOT NULL DEFAULT current_tenant() REFERENCES tenant(id),
    pilgrim_id     uuid NOT NULL,
    card_id        uuid NOT NULL REFERENCES rafeeq_card (id) ON DELETE CASCADE,
    language       text NOT NULL,
    question       text NOT NULL CHECK (length(question) BETWEEN 1 AND 500),
    -- answered | declined (the model would not) | failed (no answer came back)
    outcome        text NOT NULL CHECK (outcome IN ('answered', 'declined', 'failed')),
    answer         text,
    action         text,
    model          text,
    input_tokens   integer,
    output_tokens  integer,
    asked_at       timestamptz NOT NULL DEFAULT now(),
    FOREIGN KEY (tenant_id, pilgrim_id) REFERENCES pilgrim (tenant_id, id) ON DELETE CASCADE
);
CREATE INDEX rafeeq_question_card_idx ON rafeeq_question (tenant_id, card_id, asked_at DESC);

ALTER TABLE rafeeq_question ENABLE ROW LEVEL SECURITY;
ALTER TABLE rafeeq_question FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON rafeeq_question TO duyuf_app
    USING (tenant_id = current_tenant()) WITH CHECK (tenant_id = current_tenant());
CREATE POLICY tenant_owner ON rafeeq_question TO CURRENT_USER USING (true) WITH CHECK (true);

-- DELETE only for the 7-day retention rule.
GRANT SELECT, INSERT, DELETE ON rafeeq_question TO duyuf_app;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA duyuf TO duyuf_app;
