-- =====================================================================
-- Duyuf — Migration 0015: when a pilgrim's visa ends
--
-- The date printed on the visa, entered by staff or brought in from the
-- spreadsheet. Empty until someone enters it: the platform never guesses it
-- from the kind of visa, because the rules change from season to season.
-- Rafeeq counts the days left on the pilgrim's own page.
-- =====================================================================

SET search_path = duyuf, public;

ALTER TABLE pilgrim ADD COLUMN visa_expires_on date
    CHECK (visa_expires_on IS NULL OR visa_expires_on >= DATE '2000-01-01');
