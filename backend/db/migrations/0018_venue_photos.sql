-- =====================================================================
-- Duyuf — Migration 0018: photos of a place
--
-- Links to the place's own photos (its website, or the operator's), shown on
-- Rafeeq as a gallery. Links only, https only: the operator must have the
-- right to show them. A place with none shows an example photo on the page,
-- marked as one.
-- =====================================================================

SET search_path = duyuf, public;

ALTER TABLE venue ADD COLUMN photos text[] NOT NULL DEFAULT '{}'
    CHECK (cardinality(photos) <= 8);
