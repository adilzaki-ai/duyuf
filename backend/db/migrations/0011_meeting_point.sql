-- =====================================================================
-- Duyuf — Migration 0011: a group's meeting point
--
-- Where a group gathers (the hotel lobby, a gate of the Haram). Rafeeq's
-- "Find my way" guides a lost pilgrim there, or to where most of their group
-- is right now.
-- =====================================================================

SET search_path = duyuf, public;

ALTER TABLE pilgrim_group ADD COLUMN meeting_name text CHECK (length(meeting_name) BETWEEN 1 AND 80);
ALTER TABLE pilgrim_group ADD COLUMN meeting_lat double precision CHECK (meeting_lat BETWEEN -90 AND 90);
ALTER TABLE pilgrim_group ADD COLUMN meeting_lon double precision CHECK (meeting_lon BETWEEN -180 AND 180);
ALTER TABLE pilgrim_group ADD CONSTRAINT pilgrim_group_meeting_whole
    CHECK ((meeting_lat IS NULL) = (meeting_lon IS NULL) AND (meeting_lat IS NULL OR meeting_name IS NOT NULL));
