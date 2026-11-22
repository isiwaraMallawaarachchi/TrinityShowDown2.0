-- Run as the database owner after the Azure release serves the version 2 PDF.
BEGIN;

DO $$
DECLARE
    edition_game trinity.edition_games%ROWTYPE;
    current_form trinity.registration_forms%ROWTYPE;
    new_form_id uuid;
BEGIN
    SELECT eg.* INTO edition_game
    FROM trinity.edition_games eg
    JOIN trinity.editions e ON e.id = eg.edition_id
    JOIN trinity.games g ON g.id = eg.game_id
    WHERE e.slug = 'trinity-showdown' AND g.slug = 'cod-mobile'
    FOR UPDATE OF eg;

    IF edition_game.active_form_id IS NULL THEN
        RAISE EXCEPTION 'Configure the COD Mobile registration form before publishing its rulebook';
    END IF;

    SELECT * INTO STRICT current_form
    FROM trinity.registration_forms
    WHERE id = edition_game.active_form_id;

    IF current_form.rulebook_version = '2'
        AND current_form.rulebook_key = 'bundled-rulebooks/trinity-showdown/cod-mobile/2' THEN
        RETURN;
    END IF;

    IF current_form.rulebook_version <> '1' THEN
        RAISE EXCEPTION 'Expected COD Mobile rulebook version 1, found %', current_form.rulebook_version;
    END IF;

    INSERT INTO trinity.registration_forms (
        edition_game_id, version, privacy_notice_id, rulebook_version, rulebook_key,
        fee_lkr, bank_instructions, min_starters, max_starters, min_substitutes, max_substitutes,
        field_definitions
    )
    SELECT
        edition_game.id, max(version) + 1, current_form.privacy_notice_id, '2',
        'bundled-rulebooks/trinity-showdown/cod-mobile/2',
        current_form.fee_lkr, current_form.bank_instructions, current_form.min_starters, current_form.max_starters,
        current_form.min_substitutes, current_form.max_substitutes, current_form.field_definitions
    FROM trinity.registration_forms
    WHERE edition_game_id = edition_game.id
    RETURNING id INTO new_form_id;

    UPDATE trinity.edition_games
    SET active_form_id = new_form_id
    WHERE id = edition_game.id;
END;
$$;

COMMIT;
