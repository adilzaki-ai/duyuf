-- =====================================================================
-- Duyuf — Migration 0017: what kind of room, and help for those who need it
--
-- A hotel lists the room types it has and the accessibility it offers; a
-- pilgrim's booking asks for a room type, a bed size, how many rooms, any
-- accessibility needs and a few extras. The lists of allowed values are in
-- api/duyuf/bookings/flow.py (mirrored in the front end); the database keeps
-- them as text so a new option needs no migration.
-- =====================================================================

SET search_path = duyuf, public;

-- empty: the hotel has not said, and the page offers every room type
ALTER TABLE venue ADD COLUMN room_types text[] NOT NULL DEFAULT '{}';
ALTER TABLE venue ADD COLUMN accessibility text[] NOT NULL DEFAULT '{}';

ALTER TABLE booking ADD COLUMN rooms smallint CHECK (rooms BETWEEN 1 AND 20);
ALTER TABLE booking ADD COLUMN room_type text CHECK (room_type ~ '^[a-z_]{2,20}$');
ALTER TABLE booking ADD COLUMN bed text CHECK (bed ~ '^[a-z_]{2,20}$');
ALTER TABLE booking ADD COLUMN access_needs text[] NOT NULL DEFAULT '{}';
ALTER TABLE booking ADD COLUMN extras text[] NOT NULL DEFAULT '{}';
