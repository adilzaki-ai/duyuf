-- =====================================================================
-- Duyuf — Migration 0014: where a flight comes in
--
-- The terminal and the arrival gate, as the airport gives them. Both are
-- empty until someone enters them: the gate often comes late, and the desk
-- sends wheelchairs, buses and interpreters there. A change is kept in the
-- flight's history like a change of time.
-- =====================================================================

SET search_path = duyuf, public;

-- "Hajj Terminal", "North Terminal", "Terminal 1": as the airport names it
ALTER TABLE flight ADD COLUMN terminal text CHECK (length(terminal) BETWEEN 1 AND 40);
-- "H12", "A4", "7": letters and digits, as on the airport's signs (the API upper-cases it)
ALTER TABLE flight ADD COLUMN gate text CHECK (gate ~ '^[A-Z0-9][A-Z0-9-]{0,7}$');

ALTER TABLE flight_event DROP CONSTRAINT flight_event_kind_check;
ALTER TABLE flight_event ADD CONSTRAINT flight_event_kind_check
    CHECK (kind IN ('created', 'expected', 'added', 'landed', 'gate'));
