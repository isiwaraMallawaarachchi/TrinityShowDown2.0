import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { trinityBankInstructions } from '../../shared/registration-rules.mjs';
import { createDatabase, transaction } from '../src/database.js';
import { text } from '../src/http.js';
import { bundledRulebook } from '../src/rulebooks.js';

const path = process.argv[2];
if (!path || !process.env.DATABASE_URL) throw new Error('Set DATABASE_URL to the maintenance connection and pass an edition JSON file.');
const input = JSON.parse(await readFile(path, 'utf8'));
const db = createDatabase(process.env.DATABASE_URL);
const slug = text(input.slug, 'Edition slug', 80);
const title = text(input.title, 'Edition title', 120);

function date(value, label) {
  if (value == null) return null;
  if (typeof value !== 'string' || !/T\d\d:\d\d.*(?:Z|[+-]\d\d:\d\d)$/.test(value) || !Number.isFinite(Date.parse(value))) {
    throw new Error(`${label} must be an ISO timestamp with a time zone.`);
  }
  return value;
}

async function preparedGame(game) {
  const { formVersion, starters, substitutes, fee, rulebookFile } = game;
  const bankInstructions = game.bankInstructions ?? (slug === 'trinity-showdown' ? trinityBankInstructions : null);
  if (!Number.isSafeInteger(formVersion) || formVersion < 1 ||
    !Number.isInteger(starters) || starters < 2 || starters > 5 ||
    !Number.isInteger(substitutes) || substitutes < 0 || substitutes > 2 ||
    !/^[1-9]\d{0,9}(?:\.\d{1,2})?$/.test(String(fee))) {
    throw new Error(`Check formVersion, team size limits and the fee for ${game.game}.`);
  }
  const rulebookVersion = text(game.rulebookVersion, 'Rulebook version', 80);
  const bundled = rulebookFile == null ? bundledRulebook(slug, game.game, rulebookVersion) : null;
  if (!bundled && !rulebookFile) throw new Error(`Provide a rulebookFile for ${game.game} version ${rulebookVersion}.`);
  const pdf = await readFile(bundled?.path ?? resolve(dirname(path), rulebookFile));
  if (pdf.length > 10 * 1024 * 1024 || pdf.toString('ascii', 0, 5) !== '%PDF-') {
    throw new Error(`Provide a PDF rulebook under 10 MB for ${game.game}.`);
  }
  return { ...game, rulebookVersion, bankInstructions: text(bankInstructions, 'Bank instructions', 4000),
    rulebookKey: bundled?.key ?? `rulebooks/${slug}/${game.game}/${formVersion}`, pdf: bundled ? null : pdf };
}

try {
  const games = await Promise.all(input.games.map(preparedGame));
  const open = date(input.registrationOpensAt, 'Registration opening');
  const close = date(input.registrationClosesAt, 'Registration deadline');
  if (Boolean(open) !== Boolean(close) || (open && Date.parse(open) >= Date.parse(close))) {
    throw new Error('Provide both registration dates in order, or leave both blank to keep registration closed.');
  }
  if (games.length && !input.institutions.length) throw new Error('Provide the approved institution names.');
  if (new Set(games.map(game => game.game)).size !== games.length) throw new Error('List each game only once.');
  await transaction(db, async client => {
    const { rows: [{ id: edition }] } = await client.query(`
      INSERT INTO trinity.editions(slug, title, public_launch_at, event_starts_at, event_ends_at, venue)
      VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title,
      public_launch_at = EXCLUDED.public_launch_at, event_starts_at = EXCLUDED.event_starts_at,
      event_ends_at = EXCLUDED.event_ends_at, venue = EXCLUDED.venue RETURNING id`, [slug, title,
      date(input.publicLaunchAt, 'Public launch'), date(input.eventStartsAt, 'Event start'),
      date(input.eventEndsAt, 'Event end'), input.venue || null]);
    for (const name of input.institutions) {
      await client.query('INSERT INTO trinity.institutions(name) VALUES ($1) ON CONFLICT DO NOTHING', [text(name, 'Institution name', 120)]);
    }
    if (!games.length) return;
    const privacyVersion = text(input.privacy?.version, 'Privacy notice version', 80);
    const privacyBody = text(input.privacy?.body, 'Privacy notice', 16000);
    await client.query(`INSERT INTO trinity.privacy_notices(version, body) VALUES ($1, $2)
      ON CONFLICT (version) DO NOTHING`, [privacyVersion, privacyBody]);
    const { rows: [privacy] } = await client.query('SELECT id, body FROM trinity.privacy_notices WHERE version = $1', [privacyVersion]);
    if (privacy.body !== privacyBody) throw new Error('The privacy notice changed. Use a new privacy notice version.');
    const order = ['cod-mobile', 'pubg-mobile', 'mlbb', 'clash-of-clans'];
    for (const game of games) {
      const index = order.indexOf(game.game);
      if (index < 0) throw new Error('Unknown game: ' + game.game);
      const { rows: [{ id: editionGame }] } = await client.query(`
        INSERT INTO trinity.edition_games(edition_id, game_id, display_order, registration_opens_at, registration_closes_at)
        SELECT $1::uuid, id, $2::smallint, $3::timestamptz, $4::timestamptz FROM trinity.games WHERE slug = $5
        ON CONFLICT (edition_id, game_id) DO UPDATE SET registration_opens_at = EXCLUDED.registration_opens_at,
        registration_closes_at = EXCLUDED.registration_closes_at RETURNING id`, [edition, index + 1, open, close, game.game]);
      const parameters = [editionGame, game.formVersion, privacy.id, game.rulebookVersion, game.rulebookKey,
        game.fee, game.bankInstructions, game.starters, game.substitutes];
      await client.query(`
        INSERT INTO trinity.registration_forms(edition_game_id, version, privacy_notice_id, rulebook_version,
          rulebook_key, fee_lkr, bank_instructions, min_starters, max_starters, min_substitutes, max_substitutes)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8, 0, $9)
        ON CONFLICT (edition_game_id, version) DO NOTHING`, parameters);
      const { rows: [form] } = await client.query(`SELECT id FROM trinity.registration_forms
        WHERE edition_game_id = $1 AND version = $2 AND privacy_notice_id = $3 AND rulebook_version = $4
        AND rulebook_key = $5 AND fee_lkr = $6 AND bank_instructions = $7 AND min_starters = $8 AND max_starters = $8
        AND min_substitutes = 0 AND max_substitutes = $9 AND field_definitions = '{}'::jsonb`, parameters);
      if (!form) throw new Error(`The ${game.game} form changed. Use a new formVersion.`);
      if (game.pdf) {
        const fileParams = [game.rulebookKey, game.pdf];
        await client.query(`INSERT INTO trinity.media(key, content_type, bytes) VALUES ($1, 'application/pdf', $2)
          ON CONFLICT (key) DO NOTHING`, fileParams);
        const { rows: [file] } = await client.query('SELECT bytes = $2 AS matches FROM trinity.media WHERE key = $1', fileParams);
        if (!file.matches) throw new Error(`The ${game.game} rulebook changed. Use a new formVersion and rulebookVersion.`);
      }
      await client.query('UPDATE trinity.edition_games SET active_form_id = $2 WHERE id = $1', [editionGame, form.id]);
    }
  });
  console.log(`Configured edition ${slug}.`);
} finally {
  await db.end();
}
