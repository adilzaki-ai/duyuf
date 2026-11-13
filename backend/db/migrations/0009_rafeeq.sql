-- =====================================================================
-- Duyuf — Migration 0009: Rafeeq cards
--
-- Rafeeq is the pilgrim's own phone page. A card is a printed QR code with
-- a secret link in it, handed to one pilgrim; it opens their page and lets
-- them call for help. Only the SHA-256 of the secret is stored, and the app
-- role cannot read even that: a card is looked up before any operator is
-- known, like an API key (core/auth.py). A new card for a pilgrim stops the
-- old one.
--
-- A call for help from a card is an ordinary incident, marked with the card
-- it came from, so the feed shows it and the pilgrim's page can follow it.
-- =====================================================================

SET search_path = duyuf, public;

CREATE TABLE rafeeq_card (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     uuid NOT NULL DEFAULT current_tenant() REFERENCES tenant(id),
    pilgrim_id    uuid NOT NULL,
    token_hash    text NOT NULL UNIQUE,
    -- the language the page opens in; the pilgrim can change it on the page
    language      text NOT NULL CHECK (language IN ('en', 'ar', 'id', 'ur', 'tr', 'fr')),
    issued_by     text NOT NULL,
    issued_at     timestamptz NOT NULL DEFAULT now(),
    last_used_at  timestamptz,
    revoked_at    timestamptz,
    FOREIGN KEY (tenant_id, pilgrim_id) REFERENCES pilgrim (tenant_id, id) ON DELETE CASCADE
);

-- One card in use per pilgrim.
CREATE UNIQUE INDEX rafeeq_card_live_key ON rafeeq_card (tenant_id, pilgrim_id) WHERE revoked_at IS NULL;

ALTER TABLE rafeeq_card ENABLE ROW LEVEL SECURITY;
ALTER TABLE rafeeq_card FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON rafeeq_card TO duyuf_app
    USING (tenant_id = current_tenant()) WITH CHECK (tenant_id = current_tenant());
CREATE POLICY tenant_owner ON rafeeq_card TO CURRENT_USER USING (true) WITH CHECK (true);

-- Staff issue and stop cards within their operator; nobody reads a hash back.
GRANT SELECT (id, tenant_id, pilgrim_id, language, issued_by, issued_at, last_used_at, revoked_at)
    ON rafeeq_card TO duyuf_app;
GRANT INSERT (tenant_id, pilgrim_id, token_hash, language, issued_by) ON rafeeq_card TO duyuf_app;
GRANT UPDATE (revoked_at) ON rafeeq_card TO duyuf_app;

-- The card a call for help came from (none: raised by staff), and when the
-- pilgrim said on their page that they are fine. Saying so does not close
-- the incident: staff still resolve it.
ALTER TABLE incident ADD COLUMN rafeeq_card_id uuid REFERENCES rafeeq_card (id);
ALTER TABLE incident ADD COLUMN pilgrim_ok_at timestamptz;
CREATE INDEX incident_rafeeq_idx ON incident (tenant_id, rafeeq_card_id, opened_at DESC)
    WHERE rafeeq_card_id IS NOT NULL;
