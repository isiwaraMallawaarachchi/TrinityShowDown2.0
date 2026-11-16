BEGIN;
SET LOCAL search_path = pg_catalog;

DO $upgrade$
DECLARE
    previous_players regclass;
    previous_claims regclass;
    previous_role regtype;
    previous_players_name text;
    previous_claims_name text;
    previous_player_key text;
    constraint_record record;
    new_constraint_name text;
BEGIN
    IF to_regclass('trinity.team_players') IS NOT NULL THEN
        ALTER TABLE trinity.registrations
            ADD COLUMN IF NOT EXISTS request_player_key text NOT NULL DEFAULT 'players';
        RETURN;
    END IF;

    -- Find the original player table by its captain column and the claims table by its foreign key.
    SELECT player_table.oid, player_table.relname, player_role.atttypid
        INTO STRICT previous_players, previous_players_name, previous_role
    FROM pg_class AS player_table
    JOIN pg_attribute AS captain ON captain.attrelid = player_table.oid AND captain.attname = 'is_captain'
    JOIN pg_attribute AS player_role ON player_role.attrelid = player_table.oid AND player_role.attname = 'role'
    WHERE player_table.relnamespace = 'trinity'::regnamespace AND player_table.relkind = 'r';

    SELECT claims.oid, claims.relname INTO STRICT previous_claims, previous_claims_name
    FROM pg_class AS claims
    JOIN pg_constraint AS reference ON reference.conrelid = claims.oid
    WHERE reference.contype = 'f' AND reference.confrelid = previous_players;
    previous_player_key := regexp_replace(previous_players_name, '_members$', '');

    -- The original table prefix was also the player-list key in stored request hashes.
    EXECUTE format('ALTER TABLE trinity.registrations ADD COLUMN request_player_key text NOT NULL DEFAULT %L',
        previous_player_key);
    ALTER TABLE trinity.registrations ALTER COLUMN request_player_key SET DEFAULT 'players';

    EXECUTE format('ALTER TABLE %s RENAME TO team_players', previous_players);
    EXECUTE format('ALTER TABLE %s RENAME TO active_player_claims', previous_claims);
    EXECUTE format('ALTER TYPE %s RENAME TO player_role', previous_role);
    EXECUTE format('ALTER INDEX trinity.%I RENAME TO one_captain_per_team', 'one_captain_in_' || previous_player_key);
    EXECUTE format('ALTER INDEX trinity.%I RENAME TO player_claims_by_registration', previous_player_key || '_claims_by_registration');

    FOR constraint_record IN
        SELECT conrelid::regclass AS relation, conname FROM pg_constraint
        WHERE conrelid IN (previous_players, previous_claims)
    LOOP
        new_constraint_name := replace(constraint_record.conname, previous_players_name, 'team_players');
        new_constraint_name := replace(new_constraint_name, previous_claims_name, 'active_player_claims');
        new_constraint_name := replace(new_constraint_name, 'one_player_per_' || previous_player_key, 'one_player_per_team');
        IF new_constraint_name <> constraint_record.conname THEN
            EXECUTE format('ALTER TABLE %s RENAME CONSTRAINT %I TO %I',
                constraint_record.relation, constraint_record.conname, new_constraint_name);
        END IF;
    END LOOP;
END;
$upgrade$;

-- The trusted API validates the versioned supplemental fields and stages durable media first.
CREATE OR REPLACE FUNCTION trinity.submit_registration(p_request_id uuid, p_submission jsonb)
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
        OR jsonb_typeof(p_submission->'players') IS DISTINCT FROM 'array' THEN
        RAISE EXCEPTION 'Invalid registration payload' USING ERRCODE = '22023';
    END IF;

    v_digest := sha256(convert_to(p_submission::text, 'UTF8'));
    PERFORM pg_advisory_xact_lock(hashtextextended(p_request_id::text, 2604));
    SELECT * INTO v_registration FROM trinity.registrations WHERE request_id = p_request_id;
    IF FOUND THEN
        -- Older submissions were hashed with a different key for the player list.
        IF v_registration.request_player_key <> 'players' THEN
            v_digest := sha256(convert_to(((p_submission - 'players') ||
                jsonb_build_object(v_registration.request_player_key, p_submission->'players'))::text, 'UTF8'));
        END IF;
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

    INSERT INTO trinity.team_players (
        registration_id, position, full_name, institution_id, student_number,
        role, is_captain, in_game_id, extra_fields
    )
    SELECT v_registration.id, player.ordinality, player.fields->>'full_name',
        (player.fields->>'institution_id')::uuid, player.fields->>'student_number',
        (player.fields->>'role')::trinity.player_role,
        coalesce((player.fields->>'is_captain')::boolean, false), player.fields->>'in_game_id',
        coalesce(player.fields->'extra_fields', '{}'::jsonb)
    FROM jsonb_array_elements(p_submission->'players') WITH ORDINALITY AS player(fields, ordinality);

    SELECT count(*) FILTER (WHERE role = 'starter'), count(*) FILTER (WHERE role = 'substitute')
        INTO v_starters, v_substitutes
        FROM trinity.team_players WHERE registration_id = v_registration.id;
    IF v_starters NOT BETWEEN v_form.min_starters AND v_form.max_starters
        OR v_substitutes NOT BETWEEN v_form.min_substitutes AND v_form.max_substitutes THEN
        RAISE EXCEPTION 'Team size does not match the selected game requirements' USING ERRCODE = '22023';
    END IF;

    INSERT INTO trinity.active_player_claims (edition_id, institution_id, student_key, registration_id)
        SELECT v_game.edition_id, institution_id, student_key, registration_id
        FROM trinity.team_players WHERE registration_id = v_registration.id
        ORDER BY institution_id, student_key;
    INSERT INTO trinity.receipt_outbox (registration_id) VALUES (v_registration.id);
    RETURN v_registration.id;
END;
$$;

CREATE OR REPLACE FUNCTION trinity.decide_registration(
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
        DELETE FROM trinity.active_player_claims WHERE registration_id = p_registration_id;
    END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION trinity.submit_registration(uuid, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION trinity.decide_registration(uuid, uuid, trinity.registration_status,
    trinity.registration_status, boolean, text) FROM PUBLIC;

COMMIT;
