-- =====================================================================
-- Duyuf — Migration 0008: staff sign in
--
-- Each person on an operator's staff signs in with their own email and
-- password, so every step in every history names a real person. The web
-- app no longer needs an API key; keys stay for integrations.
--
-- Passwords are stored as scrypt hashes, and the app role cannot read
-- them: column grants below. Sessions are looked up before an operator
-- is known, like API keys, so only the owner reads them.
-- =====================================================================

SET search_path = duyuf, public;

ALTER TABLE principal ADD COLUMN email text CHECK (email = lower(email) AND email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$');
ALTER TABLE principal ADD COLUMN password_hash text;
-- set by an administrator's new or reset password: changed at the next sign in
ALTER TABLE principal ADD COLUMN must_change_password boolean NOT NULL DEFAULT false;
ALTER TABLE principal ADD COLUMN disabled_at timestamptz;
ALTER TABLE principal ADD COLUMN last_signed_in_at timestamptz;
-- sessions started before this no longer count: set when an administrator
-- disables someone or resets their password, which signs them out everywhere
ALTER TABLE principal ADD COLUMN sessions_valid_from timestamptz;
-- One email signs in to one operator: the email alone finds the person.
CREATE UNIQUE INDEX principal_email_key ON principal (email) WHERE email IS NOT NULL;

-- The app reads people (not their password hashes) and administrators manage
-- them within their own operator; row-level security (0002) keeps it there.
REVOKE SELECT ON principal FROM duyuf_app;
GRANT SELECT (id, tenant_id, external_id, display_name, role, email, must_change_password,
              disabled_at, last_signed_in_at, created_at) ON principal TO duyuf_app;
GRANT INSERT (tenant_id, external_id, display_name, role, email, password_hash, must_change_password)
    ON principal TO duyuf_app;
GRANT UPDATE (display_name, role, password_hash, must_change_password, disabled_at, sessions_valid_from)
    ON principal TO duyuf_app;

CREATE TABLE staff_session (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     uuid NOT NULL REFERENCES tenant(id),
    principal_id  uuid NOT NULL,
    token_hash    text NOT NULL UNIQUE,
    created_at    timestamptz NOT NULL DEFAULT now(),
    expires_at    timestamptz NOT NULL,
    last_seen_at  timestamptz NOT NULL DEFAULT now(),
    revoked_at    timestamptz,
    user_agent    text,
    FOREIGN KEY (tenant_id, principal_id) REFERENCES principal (tenant_id, id)
);
CREATE INDEX staff_session_principal_idx ON staff_session (principal_id) WHERE revoked_at IS NULL;

-- Sign-in attempts by email, to slow down guessing. Owner only.
CREATE TABLE signin_attempt (
    id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email      text NOT NULL,
    ok         boolean NOT NULL,
    at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX signin_attempt_idx ON signin_attempt (email, at DESC);

-- Neither table is the app's: sessions are found before any operator is known.
REVOKE ALL ON staff_session FROM duyuf_app;
REVOKE ALL ON signin_attempt FROM duyuf_app;
