-- =====================================================================
-- Duyuf — Migration 0016: the flights home, and places to eat, stay and visit
--
-- return_leg: a group's flights home, leg by leg (Madinah → Jeddah → Jakarta),
-- entered by staff. Rafeeq shows them beside the visa date and reminds the
-- pilgrim as the day comes.
--
-- venue: the hotels, restaurants and bookable attractions an operator offers
-- its pilgrims. The operator enters them (or a partner feed does), with the
-- rating's source named: the platform never makes a rating up. Hotel stars are
-- the official classification, 1 to 5.
--
-- booking: a pilgrim's request from Rafeeq. Staff check with the place and
-- confirm (pay at the place), ask for payment online, or decline. Online
-- payment needs a payment provider the operator has signed with; until then
-- only demonstration operators can try a test payment, where no money moves.
-- =====================================================================

SET search_path = duyuf, public;

CREATE TABLE return_leg (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id      uuid NOT NULL DEFAULT current_tenant() REFERENCES tenant(id),
    group_id       uuid NOT NULL,
    seq            smallint NOT NULL CHECK (seq BETWEEN 1 AND 6),
    flight_number  text NOT NULL CHECK (flight_number ~ '^[A-Z0-9]{2}[A-Z]? [0-9]{1,4}[A-Z]?$'),
    from_airport   char(3) NOT NULL CHECK (from_airport ~ '^[A-Z]{3}$'),
    to_airport     char(3) NOT NULL CHECK (to_airport ~ '^[A-Z]{3}$'),
    departs_at     timestamptz NOT NULL,
    arrives_at     timestamptz CHECK (arrives_at IS NULL OR arrives_at > departs_at),
    UNIQUE (tenant_id, group_id, seq),
    FOREIGN KEY (tenant_id, group_id) REFERENCES pilgrim_group (tenant_id, id) ON DELETE CASCADE
);

CREATE TABLE venue (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id      uuid NOT NULL DEFAULT current_tenant() REFERENCES tenant(id),
    kind           text NOT NULL CHECK (kind IN ('hotel', 'restaurant', 'attraction')),
    city           text NOT NULL CHECK (city IN ('makkah', 'madinah')),
    name           text NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
    name_ar        text CHECK (length(name_ar) <= 120),
    -- hotels: the official classification
    stars          smallint CHECK (stars BETWEEN 1 AND 5),
    -- 1 simple, 2 casual, 3 fine, 4 upscale
    price_level    smallint CHECK (price_level BETWEEN 1 AND 4),
    cuisine        text CHECK (length(cuisine) <= 60),
    rating         numeric(2, 1) CHECK (rating BETWEEN 0 AND 5),
    rating_count   integer CHECK (rating_count >= 0),
    -- where the rating comes from: "Google", "Booking.com", "Operator survey", …
    rating_source  text CHECK (length(rating_source) <= 40),
    CHECK (rating IS NULL OR rating_source IS NOT NULL),
    -- attractions: the Rafeeq guide's place (frontend/src/rafeeq/guide/sites.ts)
    site_id        text CHECK (site_id ~ '^[a-z_]{2,30}$'),
    phone          text CHECK (length(phone) <= 30),
    whatsapp       text CHECK (whatsapp ~ '^\+?[0-9 ]{6,20}$'),
    email          text CHECK (length(email) <= 120),
    website        text CHECK (website ~ '^https://'),
    address        text CHECK (length(address) <= 200),
    lat            double precision CHECK (lat BETWEEN -90 AND 90),
    lon            double precision CHECK (lon BETWEEN -180 AND 180),
    -- SAR: a night (hotel), a person (restaurant, attraction); a guide for the pilgrim
    price_from     numeric(10, 2) CHECK (price_from >= 0),
    bookable       boolean NOT NULL DEFAULT true,
    active         boolean NOT NULL DEFAULT true,
    created_at     timestamptz NOT NULL DEFAULT now(),
    updated_at     timestamptz NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, id)
);

CREATE INDEX venue_list_idx ON venue (tenant_id, kind, city) WHERE active;

CREATE TABLE booking (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id        uuid NOT NULL DEFAULT current_tenant() REFERENCES tenant(id),
    ref              bigint GENERATED ALWAYS AS IDENTITY,   -- "#3012" on screen and on the phone
    pilgrim_id       uuid NOT NULL,
    venue_id         uuid NOT NULL,
    card_id          uuid REFERENCES rafeeq_card(id),
    for_date         date NOT NULL,
    at_time          time,
    nights           smallint CHECK (nights BETWEEN 1 AND 60),
    people           smallint NOT NULL CHECK (people BETWEEN 1 AND 50),
    note             text CHECK (length(note) <= 500),
    -- the moves are in api/duyuf/bookings/flow.py
    status           text NOT NULL DEFAULT 'requested'
                     CHECK (status IN ('requested', 'awaiting_payment', 'confirmed', 'declined', 'cancelled')),
    amount           numeric(10, 2) CHECK (amount >= 0),
    currency         char(3) NOT NULL DEFAULT 'SAR',
    -- online: through the payment provider; venue: at the place itself
    pay_at           text CHECK (pay_at IN ('online', 'venue')),
    payment_status   text NOT NULL DEFAULT 'none' CHECK (payment_status IN ('none', 'paid', 'refund_due', 'refunded')),
    payment_provider text,
    payment_ref      text,
    paid_at          timestamptz,
    staff_note       text CHECK (length(staff_note) <= 500),
    requested_at     timestamptz NOT NULL DEFAULT now(),
    updated_at       timestamptz NOT NULL DEFAULT now(),
    CHECK (status <> 'awaiting_payment' OR (amount > 0 AND pay_at = 'online')),
    FOREIGN KEY (tenant_id, pilgrim_id) REFERENCES pilgrim (tenant_id, id) ON DELETE CASCADE,
    FOREIGN KEY (tenant_id, venue_id) REFERENCES venue (tenant_id, id)
);

CREATE INDEX booking_status_idx ON booking (tenant_id, status, requested_at DESC);
CREATE INDEX booking_pilgrim_idx ON booking (tenant_id, pilgrim_id);

-- Every step, who took it and when. Append-only for the app.
CREATE TABLE booking_event (
    id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tenant_id   uuid NOT NULL DEFAULT current_tenant() REFERENCES tenant(id),
    booking_id  uuid NOT NULL REFERENCES booking(id) ON DELETE CASCADE,
    kind        text NOT NULL CHECK (kind IN ('requested', 'confirmed', 'awaiting_payment', 'paid', 'declined',
                                              'cancelled', 'note')),
    note        text,
    actor       text NOT NULL,
    at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX booking_event_idx ON booking_event (tenant_id, booking_id, at);

DO $$
DECLARE t text;
BEGIN
    FOREACH t IN ARRAY ARRAY['return_leg', 'venue', 'booking', 'booking_event'] LOOP
        EXECUTE format('ALTER TABLE duyuf.%I ENABLE ROW LEVEL SECURITY', t);
        EXECUTE format('ALTER TABLE duyuf.%I FORCE ROW LEVEL SECURITY', t);
        EXECUTE format($f$
            CREATE POLICY tenant_isolation ON duyuf.%I TO duyuf_app
            USING (tenant_id = duyuf.current_tenant())
            WITH CHECK (tenant_id = duyuf.current_tenant())
        $f$, t);
        EXECUTE format('CREATE POLICY tenant_owner ON duyuf.%I TO CURRENT_USER USING (true) WITH CHECK (true)', t);
    END LOOP;
END $$;

-- Legs are replaced as a set; a place is switched off, never deleted (bookings point at it).
GRANT SELECT, INSERT, UPDATE, DELETE ON return_leg TO duyuf_app;
GRANT SELECT, INSERT, UPDATE ON venue TO duyuf_app;
GRANT SELECT, INSERT, UPDATE ON booking TO duyuf_app;
GRANT SELECT, INSERT ON booking_event TO duyuf_app;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA duyuf TO duyuf_app;
