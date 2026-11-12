BEGIN;

CREATE SCHEMA trinity;
REVOKE ALL ON SCHEMA trinity FROM PUBLIC;

CREATE TYPE trinity.registration_status AS ENUM ('submitted', 'approved', 'rejected');
CREATE TYPE trinity.roster_role AS ENUM ('starter', 'substitute');

CREATE TABLE trinity.editions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
    title text NOT NULL CHECK (btrim(title) <> ''),
    public_launch_at timestamptz,
    event_starts_at timestamptz,
    event_ends_at timestamptz,
    venue text,
    CHECK (event_ends_at >= event_starts_at)
);

CREATE TABLE trinity.games (
    id smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    slug text NOT NULL UNIQUE,
    name text NOT NULL UNIQUE
);

INSERT INTO trinity.games (slug, name) VALUES
    ('pubg-mobile', 'PUBG Mobile'),
    ('cod-mobile', 'Call of Duty: Mobile'),
    ('mlbb', 'Mobile Legends: Bang Bang'),
    ('clash-of-clans', 'Clash of Clans');

CREATE TABLE trinity.edition_games (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    edition_id uuid NOT NULL REFERENCES trinity.editions,
    game_id smallint NOT NULL REFERENCES trinity.games,
    display_order smallint NOT NULL CHECK (display_order > 0),
    summary text,
    competition_format text,
    prize_description text,
    registration_opens_at timestamptz,
    registration_closes_at timestamptz,
    active_form_id uuid,
    UNIQUE (edition_id, game_id),
    UNIQUE (edition_id, display_order),
    UNIQUE (id, edition_id),
    CHECK (
        (registration_opens_at IS NULL AND registration_closes_at IS NULL)
        OR (registration_opens_at IS NOT NULL AND registration_closes_at IS NOT NULL
            AND registration_closes_at > registration_opens_at)
    )
);

CREATE TABLE trinity.privacy_notices (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    version text NOT NULL UNIQUE,
    body text NOT NULL CHECK (btrim(body) <> '')
);

CREATE TABLE trinity.registration_forms (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    edition_game_id uuid NOT NULL REFERENCES trinity.edition_games,
    version integer NOT NULL CHECK (version > 0),
    privacy_notice_id uuid NOT NULL REFERENCES trinity.privacy_notices,
    rulebook_version text NOT NULL CHECK (btrim(rulebook_version) <> ''),
    rulebook_key text NOT NULL CHECK (btrim(rulebook_key) <> ''),
    fee_lkr numeric(12, 2) NOT NULL CHECK (fee_lkr > 0),
    bank_instructions text NOT NULL CHECK (btrim(bank_instructions) <> ''),
    min_starters smallint NOT NULL CHECK (min_starters > 0),
    max_starters smallint NOT NULL CHECK (max_starters >= min_starters),
    min_substitutes smallint NOT NULL CHECK (min_substitutes >= 0),
    max_substitutes smallint NOT NULL CHECK (max_substitutes >= min_substitutes),
    field_definitions jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(field_definitions) = 'object'),
    UNIQUE (edition_game_id, version),
    UNIQUE (id, edition_game_id)
);

ALTER TABLE trinity.edition_games
    ADD FOREIGN KEY (active_form_id, id) REFERENCES trinity.registration_forms (id, edition_game_id);

CREATE FUNCTION trinity.keep_document_version() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'Create a new version instead of changing an existing version'
        USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER keep_form_version BEFORE UPDATE OR DELETE ON trinity.registration_forms
    FOR EACH ROW EXECUTE FUNCTION trinity.keep_document_version();
CREATE TRIGGER keep_notice_version BEFORE UPDATE OR DELETE ON trinity.privacy_notices
    FOR EACH ROW EXECUTE FUNCTION trinity.keep_document_version();

CREATE TABLE trinity.institutions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL CHECK (btrim(name) <> '')
);
CREATE UNIQUE INDEX institution_name_unique ON trinity.institutions (lower(btrim(name)));

CREATE TABLE trinity.organizers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email text NOT NULL CHECK (btrim(email) <> ''),
    display_name text NOT NULL CHECK (btrim(display_name) <> ''),
    password_hash text NOT NULL CHECK (btrim(password_hash) <> ''),
    created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    disabled_at timestamptz
);
CREATE UNIQUE INDEX organizer_email_unique ON trinity.organizers (lower(btrim(email)));

CREATE TABLE trinity.organizer_invites (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    invited_by uuid NOT NULL REFERENCES trinity.organizers,
    email text NOT NULL CHECK (btrim(email) <> ''),
    token_hash bytea NOT NULL UNIQUE CHECK (octet_length(token_hash) = 32),
    created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    expires_at timestamptz NOT NULL CHECK (expires_at > created_at),
    accepted_by uuid UNIQUE REFERENCES trinity.organizers,
    accepted_at timestamptz,
    CHECK ((accepted_at IS NULL) = (accepted_by IS NULL)),
    CHECK (accepted_at >= created_at AND accepted_at < expires_at)
);

CREATE TABLE trinity.organizer_sessions (
    token_hash bytea PRIMARY KEY CHECK (octet_length(token_hash) = 32),
    organizer_id uuid NOT NULL REFERENCES trinity.organizers,
    created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    expires_at timestamptz NOT NULL CHECK (expires_at > created_at)
);
CREATE INDEX organizer_sessions_by_organizer ON trinity.organizer_sessions (organizer_id);

CREATE TABLE trinity.registrations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    edition_id uuid NOT NULL,
    edition_game_id uuid NOT NULL,
    form_id uuid NOT NULL,
    request_id uuid NOT NULL UNIQUE,
    request_digest bytea NOT NULL CHECK (octet_length(request_digest) = 32),
    submitted_at timestamptz NOT NULL,
    status trinity.registration_status NOT NULL DEFAULT 'submitted',
    team_name text NOT NULL CHECK (btrim(team_name) <> ''),
    captain_name text NOT NULL CHECK (btrim(captain_name) <> ''),
    captain_email text NOT NULL CHECK (btrim(captain_email) <> ''),
    captain_phone text,
    logo_key text NOT NULL UNIQUE CHECK (btrim(logo_key) <> ''),
    display_logo_key text NOT NULL UNIQUE CHECK (btrim(display_logo_key) <> ''),
    payment_proof_key text NOT NULL UNIQUE CHECK (btrim(payment_proof_key) <> ''),
    extra_fields jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(extra_fields) = 'object'),
    FOREIGN KEY (edition_game_id, edition_id) REFERENCES trinity.edition_games (id, edition_id),
    FOREIGN KEY (form_id, edition_game_id) REFERENCES trinity.registration_forms (id, edition_game_id),
    UNIQUE (id, edition_id),
    CHECK (logo_key <> display_logo_key AND logo_key <> payment_proof_key
        AND display_logo_key <> payment_proof_key)
);
CREATE INDEX registration_review_queue ON trinity.registrations (edition_game_id, status, submitted_at);

CREATE TABLE trinity.roster_members (
    registration_id uuid NOT NULL REFERENCES trinity.registrations,
    position integer NOT NULL CHECK (position > 0),
    full_name text NOT NULL CHECK (btrim(full_name) <> ''),
    institution_id uuid NOT NULL REFERENCES trinity.institutions,
    student_number text NOT NULL CHECK (btrim(student_number) <> ''),
    student_key text GENERATED ALWAYS AS (lower(btrim(student_number))) STORED,
    role trinity.roster_role NOT NULL,
    is_captain boolean NOT NULL DEFAULT false,
    in_game_id text,
    extra_fields jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(extra_fields) = 'object'),
    PRIMARY KEY (registration_id, position),
    CONSTRAINT one_player_per_roster UNIQUE (registration_id, institution_id, student_key)
);
CREATE UNIQUE INDEX one_captain_in_roster ON trinity.roster_members (registration_id) WHERE is_captain;

CREATE TABLE trinity.active_roster_claims (
    edition_id uuid NOT NULL,
    institution_id uuid NOT NULL,
    student_key text NOT NULL,
    registration_id uuid NOT NULL,
    CONSTRAINT one_active_team_per_player PRIMARY KEY (edition_id, institution_id, student_key),
    FOREIGN KEY (registration_id, edition_id) REFERENCES trinity.registrations (id, edition_id),
    FOREIGN KEY (registration_id, institution_id, student_key)
        REFERENCES trinity.roster_members (registration_id, institution_id, student_key)
);
CREATE INDEX roster_claims_by_registration ON trinity.active_roster_claims (registration_id);

CREATE TABLE trinity.registration_decisions (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    registration_id uuid NOT NULL REFERENCES trinity.registrations,
    organizer_id uuid NOT NULL REFERENCES trinity.organizers,
    from_status trinity.registration_status NOT NULL,
    to_status trinity.registration_status NOT NULL,
    reason text,
    decided_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    CHECK (
        (from_status = 'submitted' AND to_status = 'approved' AND reason IS NULL)
        OR (from_status IN ('submitted', 'approved') AND to_status = 'rejected'
            AND reason IS NOT NULL AND btrim(reason) <> '')
    )
);
CREATE INDEX decisions_by_registration ON trinity.registration_decisions (registration_id, id);

CREATE TABLE trinity.receipt_outbox (
    registration_id uuid PRIMARY KEY REFERENCES trinity.registrations,
    next_attempt_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
    sent_at timestamptz
);

CREATE TABLE trinity.organizer_audit (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    organizer_id uuid NOT NULL REFERENCES trinity.organizers,
    action text NOT NULL CHECK (action IN ('invite_issued', 'invite_accepted', 'account_disabled', 'export')),
    subject_id uuid,
    occurred_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE VIEW trinity.public_teams AS
    SELECT r.id, r.edition_id, g.slug AS game_slug, g.name AS game_name, r.team_name
    FROM trinity.registrations AS r
    JOIN trinity.edition_games AS eg ON eg.id = r.edition_game_id
    JOIN trinity.games AS g ON g.id = eg.game_id
    WHERE r.status = 'approved';

-- The trusted API validates the versioned supplemental fields and stages durable media first.
CREATE FUNCTION trinity.submit_registration(p_request_id uuid, p_submission jsonb)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
DECLARE
    v_digest bytea;
    v_registration trinity.registrations%ROWTYPE;
    v_game trinity.edition_games%ROWTYPE;
    v_form trinity.registration_forms%ROWTYPE;
    v_now timestamptz;
    v_starters integer;
    v_substitutes integer;
BEGIN
    IF p_request_id IS NULL OR jsonb_typeof(p_submission) IS DISTINCT FROM 'object'
        OR jsonb_typeof(p_submission->'roster') IS DISTINCT FROM 'array' THEN
        RAISE EXCEPTION 'Invalid registration payload' USING ERRCODE = '22023';
    END IF;

    v_digest := sha256(convert_to(p_submission::text, 'UTF8'));
    PERFORM pg_advisory_xact_lock(hashtextextended(p_request_id::text, 2604));
    SELECT * INTO v_registration FROM trinity.registrations WHERE request_id = p_request_id;
    IF FOUND THEN
        IF v_registration.request_digest <> v_digest THEN
            RAISE EXCEPTION 'Registration retry does not match the original request' USING ERRCODE = '22023';
        END IF;
        RETURN v_registration.id;
    END IF;

    SELECT * INTO v_game FROM trinity.edition_games
        WHERE id = (p_submission->>'edition_game_id')::uuid FOR SHARE;
    v_now := clock_timestamp();
    IF NOT FOUND OR v_game.active_form_id IS NULL OR v_game.registration_opens_at IS NULL
        OR v_now < v_game.registration_opens_at OR v_now >= v_game.registration_closes_at THEN
        RAISE EXCEPTION 'Registration is closed' USING ERRCODE = '55000';
    END IF;
    IF (p_submission->>'form_id')::uuid IS DISTINCT FROM v_game.active_form_id
        OR (p_submission->'rules_accepted') IS DISTINCT FROM 'true'::jsonb THEN
        RAISE EXCEPTION 'The current form and rulebook must be accepted' USING ERRCODE = '22023';
    END IF;
    SELECT * INTO STRICT v_form FROM trinity.registration_forms WHERE id = v_game.active_form_id;

    INSERT INTO trinity.registrations (
        edition_id, edition_game_id, form_id, request_id, request_digest, submitted_at,
        team_name, captain_name, captain_email, captain_phone, logo_key, display_logo_key,
        payment_proof_key, extra_fields
    ) VALUES (
        v_game.edition_id, v_game.id, v_form.id, p_request_id, v_digest, v_now,
        p_submission->>'team_name', p_submission->>'captain_name',
        p_submission->>'captain_email', p_submission->>'captain_phone',
        p_submission->>'logo_key', p_submission->>'display_logo_key',
        p_submission->>'payment_proof_key', coalesce(p_submission->'extra_fields', '{}'::jsonb)
    ) RETURNING * INTO v_registration;

    INSERT INTO trinity.roster_members (
        registration_id, position, full_name, institution_id, student_number,
        role, is_captain, in_game_id, extra_fields
    )
    SELECT v_registration.id, player.ordinality, player.fields->>'full_name',
        (player.fields->>'institution_id')::uuid, player.fields->>'student_number',
        (player.fields->>'role')::trinity.roster_role,
        coalesce((player.fields->>'is_captain')::boolean, false), player.fields->>'in_game_id',
        coalesce(player.fields->'extra_fields', '{}'::jsonb)
    FROM jsonb_array_elements(p_submission->'roster') WITH ORDINALITY AS player(fields, ordinality);

    SELECT count(*) FILTER (WHERE role = 'starter'), count(*) FILTER (WHERE role = 'substitute')
        INTO v_starters, v_substitutes
        FROM trinity.roster_members WHERE registration_id = v_registration.id;
    IF v_starters NOT BETWEEN v_form.min_starters AND v_form.max_starters
        OR v_substitutes NOT BETWEEN v_form.min_substitutes AND v_form.max_substitutes THEN
        RAISE EXCEPTION 'Roster does not match the selected game requirements' USING ERRCODE = '22023';
    END IF;

    INSERT INTO trinity.active_roster_claims (edition_id, institution_id, student_key, registration_id)
        SELECT v_game.edition_id, institution_id, student_key, registration_id
        FROM trinity.roster_members WHERE registration_id = v_registration.id
        ORDER BY institution_id, student_key;
    INSERT INTO trinity.receipt_outbox (registration_id) VALUES (v_registration.id);
    RETURN v_registration.id;
END;
$$;

CREATE FUNCTION trinity.decide_registration(
    p_registration_id uuid, p_organizer_id uuid, p_expected_status trinity.registration_status,
    p_decision trinity.registration_status, p_payment_verified boolean, p_reason text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
DECLARE
    v_current trinity.registration_status;
BEGIN
    PERFORM 1 FROM trinity.organizers WHERE id = p_organizer_id AND disabled_at IS NULL FOR SHARE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Organizer access is required' USING ERRCODE = '42501';
    END IF;

    SELECT status INTO v_current FROM trinity.registrations WHERE id = p_registration_id FOR UPDATE;
    IF NOT FOUND OR v_current IS DISTINCT FROM p_expected_status THEN
        RAISE EXCEPTION 'Registration state changed before review' USING ERRCODE = '55000';
    END IF;
    IF NOT coalesce(
        (v_current = 'submitted' AND p_decision = 'approved' AND p_payment_verified IS TRUE AND p_reason IS NULL)
        OR (v_current IN ('submitted', 'approved') AND p_decision = 'rejected' AND btrim(p_reason) <> ''),
        false
    ) THEN
        RAISE EXCEPTION 'Invalid review decision' USING ERRCODE = '22023';
    END IF;

    INSERT INTO trinity.registration_decisions (registration_id, organizer_id, from_status, to_status, reason)
        VALUES (p_registration_id, p_organizer_id, v_current, p_decision, p_reason);
    UPDATE trinity.registrations SET status = p_decision WHERE id = p_registration_id;
    IF p_decision = 'rejected' THEN
        DELETE FROM trinity.active_roster_claims WHERE registration_id = p_registration_id;
    END IF;
END;
$$;

REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA trinity FROM PUBLIC;

COMMIT;
