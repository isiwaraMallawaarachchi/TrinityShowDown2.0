import { createHash } from 'node:crypto';
import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import multer from 'multer';
import sharp from 'sharp';
import { parseTownHallLevel, requiresTownHallLevel } from '../../shared/registration-rules.mjs';
import { transaction } from './database.js';
import { email, HttpError, isUuid, sendMedia, text } from './http.js';
import { bundledRulebook, bundledRulebookSettings } from './rulebooks.js';

const FORM_SELECT = `
  SELECT eg.id AS edition_game_id, g.slug, eg.registration_opens_at, eg.registration_closes_at,
         f.id AS form_id, f.min_starters, f.max_starters, f.min_substitutes, f.max_substitutes,
         f.fee_lkr, f.bank_instructions, f.rulebook_version, f.rulebook_key, f.field_definitions, n.version AS privacy_version,
         EXISTS (SELECT 1 FROM trinity.media m WHERE m.key = f.rulebook_key AND m.registration_id IS NULL) AS has_rulebook,
         clock_timestamp() >= eg.registration_opens_at AND clock_timestamp() < eg.registration_closes_at AS in_window
    FROM trinity.edition_games eg JOIN trinity.editions e ON e.id = eg.edition_id
    JOIN trinity.games g ON g.id = eg.game_id
`;

const FORM_NOTICE = 'LEFT JOIN trinity.privacy_notices n ON n.id = f.privacy_notice_id';
const FORM_SUPPORTED = 'f.min_starters = f.max_starters AND f.min_substitutes = 0';
const supported = form => form?.form_id && form.min_starters === form.max_starters &&
  form.max_starters >= 2 && form.max_starters <= 5 && form.min_substitutes === 0 && form.max_substitutes <= 2 &&
  Object.keys(form.field_definitions).length === 0;
const mediaTypes = { jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
const maxTextFields = 6 + 2 + 7 * 5; // Team fields, phone numbers and up to seven players with Town Hall levels.
const upload = multer({
  limits: { fileSize: 5 * 1024 * 1024, files: 17, fields: maxTextFields, fieldSize: 512, fieldNameSize: 42, fieldNestingDepth: 0 },
}).any();

function slots(form, values) {
  const result = [{ id: 'leader', role: 'starter', leader: true, phone: true }];
  for (let position = 2; position <= form.max_starters; position++) {
    result.push({ id: `player-${position}`, role: 'starter', phone: position === 2 });
  }
  for (let position = 1; position <= form.max_substitutes; position++) {
    const id = `sub-${position}`;
    if (Object.hasOwn(values, `${id}.name`)) result.push({ id, role: 'substitute' });
  }
  return result;
}

function phone(value, label) {
  const number = text(value, label, 25);
  if (!/^\+?[\d() .-]+$/.test(number) || number.replace(/\D/g, '').length < 7) {
    throw new HttpError(400, `Enter a valid ${label.toLowerCase()}.`);
  }
  return number;
}

async function readImage(file, field, requestId, displayLogo = false) {
  if (!file?.size) throw new HttpError(400, `Attach a JPEG, PNG or WebP for ${field}.`);
  const key = `entries/${requestId}/${field}-${createHash('sha256').update(file.buffer).digest('hex')}`;
  try {
    const header = file.buffer;
    const jpeg = header.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]));
    const png = header.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    const webp = header.toString('ascii', 0, 4) === 'RIFF' && header.toString('ascii', 8, 12) === 'WEBP';
    if (!jpeg && !png && !webp) throw Error();
    const image = sharp(file.buffer, { limitInputPixels: 4096 * 4096, failOn: 'warning' });
    const { format, width, height, pages } = await image.metadata();
    if (!Object.hasOwn(mediaTypes, format) || width > 4096 || height > 4096 || (pages ?? 1) > 1) throw Error();
    const media = [{ key, type: mediaTypes[format], buffer: file.buffer }];
    if (displayLogo) {
      const buffer = await image.rotate().resize(512, 512, { fit: 'inside', withoutEnlargement: true }).webp().toBuffer();
      media.push({ key: key + '-display', type: 'image/webp', buffer });
    } else {
      await image.stats();
    }
    return media;
  } catch {
    throw new HttpError(400, `Upload a readable, single-frame JPEG, PNG or WebP for ${field}, up to 4096 pixels per side.`);
  }
}

async function registrationPayload(values, files, form) {
  const { requestId, university } = values;
  const team = text(values.teamName, 'Team name', 100);
  const captainEmail = email(values['leader.email']);
  const uploadFields = new Set();
  const textFields = new Set(['requestId', 'formId', 'university', 'teamName', 'rulesAccepted', 'leader.email']);
  const needsTownHallLevel = requiresTownHallLevel(form.slug);
  const byField = new Map();
  for (const file of files) {
    if (byField.has(file.fieldname)) throw new HttpError(400, 'Attach only one image per field.');
    byField.set(file.fieldname, file);
  }
  const media = [];
  async function attachment(field, displayLogo) {
    uploadFields.add(field);
    const records = await readImage(byField.get(field), field, requestId, displayLogo);
    media.push(...records);
    return records.map(record => record.key);
  }
  const players = [];
  const studentIds = new Set();
  for (const { id, role, leader, phone: needsPhone } of slots(form, values)) {
    function field(name, label, max) {
      const key = `${id}.${name}`;
      textFields.add(key);
      return text(values[key], label, max);
    }
    const studentNumber = field('studentId', `${id} university ID`, 64);
    const normalized = studentNumber.toLowerCase();
    if (studentIds.has(normalized)) throw new HttpError(409, 'A player appears more than once on this team.');
    studentIds.add(normalized);
    const member = {
      full_name: field('name', `${id} full name`, 120), institution_id: university,
      student_number: studentNumber, role, is_captain: Boolean(leader),
      in_game_id: field('gameId', `${id} in-game ID`, 80),
      extra_fields: { gameName: field('gameName', `${id} in-game name`, 80) },
    };
    if (needsPhone) member.extra_fields.phone = phone(field('phone', `${id} contact number`, 25), `${id} contact number`);
    if (needsTownHallLevel) {
      const key = `${id}.townHallLevel`;
      const level = parseTownHallLevel(values[key]);
      if (level === null) {
        throw new HttpError(400, 'Enter a whole Town Hall level of 1 or higher for every Clash of Clans player.');
      }
      textFields.add(key);
      member.extra_fields.townHallLevel = level;
    }
    [member.extra_fields.idFront] = await attachment(`${id}.idFront`);
    [member.extra_fields.idBack] = await attachment(`${id}.idBack`);
    if (leader) [member.extra_fields.portrait] = await attachment(`${id}.portrait`);
    players.push(member);
  }
  const [logo, display] = await attachment('teamLogo', true);
  const [proof] = await attachment('paymentProof');
  if (Object.keys(values).some(field => !textFields.has(field)) || files.some(file => !uploadFields.has(file.fieldname))) {
    throw new HttpError(400, 'The submission contains fields outside this registration form.');
  }
  return { media, payload: {
    edition_game_id: form.edition_game_id, form_id: form.form_id, rules_accepted: true,
    team_name: team, captain_name: players[0].full_name, captain_email: captainEmail,
    captain_phone: players[0].extra_fields.phone, logo_key: logo, display_logo_key: display,
    payment_proof_key: proof, players,
  } };
}

function formRulebook(edition, form) {
  const file = bundledRulebook(edition, form.slug, form.rulebook_version);
  return file?.key === form.rulebook_key ? file : null;
}

function downloadRulebook(res, next, file) {
  res.download(file.path, file.name, error => {
    if (error) next(error.code === 'ENOENT' ? new HttpError(404, 'Rulebook unavailable.') : error);
  });
}

export function publicRoutes(db, config) {
  const router = Router();
  let activeUploads = 0;
  router.get('/event', async (_req, res) => {
    const [edition, forms, institutions, teams] = await Promise.all([
      db.query('SELECT event_starts_at AS "startsAt", venue FROM trinity.editions WHERE slug = $1', [config.edition]),
      db.query(`${FORM_SELECT} LEFT JOIN trinity.registration_forms f ON f.id = eg.active_form_id
        ${FORM_NOTICE} WHERE e.slug = $1 ORDER BY eg.display_order`, [config.edition]),
      db.query('SELECT id, name FROM trinity.institutions ORDER BY name'),
      db.query(`SELECT t.id, t.game_slug AS "gameId", t.team_name AS name FROM trinity.public_teams t
        JOIN trinity.editions e ON e.id = t.edition_id WHERE e.slug = $1 ORDER BY t.team_name`, [config.edition]),
    ]);
    const games = bundledRulebookSettings(config.edition);
    for (const form of forms.rows) {
      const hasRulebook = form.has_rulebook || formRulebook(config.edition, form);
      const rulebook = form.form_id ? {
        rulebookUrl: hasRulebook ? `/api/public/rulebooks/${form.form_id}` : null,
        rulebookVersion: form.rulebook_version,
      } : games.get(form.slug);
      games.set(form.slug, {
        open: Boolean(config.registrationEnabled && form.in_window && hasRulebook && supported(form) && institutions.rows.length),
        opensAt: form.registration_opens_at, closesAt: form.registration_closes_at,
        formId: form.form_id, starters: supported(form) ? form.max_starters : null, substitutes: supported(form) ? form.max_substitutes : null,
        fee: form.fee_lkr, bankInstructions: form.bank_instructions,
        rulebookUrl: rulebook?.rulebookUrl ?? null, rulebookVersion: rulebook?.rulebookVersion ?? null,
        privacyVersion: form.privacy_version,
        privacyUrl: form.form_id ? `/api/public/privacy/${form.form_id}` : null,
      });
    }
    res.json({
      edition: edition.rows[0] ?? null,
      institutions: institutions.rows,
      teams: teams.rows.map(team => ({ ...team, logoUrl: `/api/public/teams/${team.id}/logo` })),
      games: Object.fromEntries(games),
    });
  });

  router.get('/rulebooks/files/:game/:version', (req, res, next) => {
    const file = bundledRulebook(config.edition, req.params.game, req.params.version);
    if (!file) throw new HttpError(404, 'Rulebook unavailable.');
    downloadRulebook(res, next, file);
  });

  router.get('/rulebooks/:id', async (req, res, next) => {
    if (!isUuid(req.params.id)) throw new HttpError(404, 'File unavailable.');
    const { rows: [form] } = await db.query(`
      SELECT g.slug, f.rulebook_key, f.rulebook_version, m.content_type, m.bytes FROM trinity.registration_forms f
      JOIN trinity.edition_games eg ON eg.id = f.edition_game_id JOIN trinity.editions e ON e.id = eg.edition_id
      JOIN trinity.games g ON g.id = eg.game_id
      LEFT JOIN trinity.media m ON m.key = f.rulebook_key AND m.registration_id IS NULL
      WHERE f.id = $1 AND e.slug = $2`, [req.params.id, config.edition]);
    if (!form) throw new HttpError(404, 'Rulebook unavailable.');
    const file = formRulebook(config.edition, form);
    if (file) return downloadRulebook(res, next, file);
    if (form.bytes) res.attachment(`${form.slug}-rulebook.pdf`);
    sendMedia(res, form.bytes ? form : null);
  });

  router.get('/privacy/:id', async (req, res) => {
    if (!isUuid(req.params.id)) throw new HttpError(404, 'Privacy notice unavailable.');
    const { rows: [notice] } = await db.query(`
      SELECT n.version, n.body FROM trinity.registration_forms f
      JOIN trinity.edition_games eg ON eg.id = f.edition_game_id JOIN trinity.editions e ON e.id = eg.edition_id
      JOIN trinity.privacy_notices n ON n.id = f.privacy_notice_id
      WHERE f.id = $1 AND e.slug = $2`, [req.params.id, config.edition]);
    if (!notice) throw new HttpError(404, 'Privacy notice unavailable.');
    res.type('text/plain').send(`Trinity Showdown privacy notice · Version ${notice.version}\n\n${notice.body}\n`);
  });

  router.get('/teams/:id/logo', async (req, res) => {
    if (!isUuid(req.params.id)) throw new HttpError(404, 'File unavailable.');
    const { rows: [file] } = await db.query(`
      SELECT m.content_type, m.bytes FROM trinity.public_teams t
      JOIN trinity.editions e ON e.id = t.edition_id JOIN trinity.registrations r ON r.id = t.id
      JOIN trinity.media m ON m.key = r.display_logo_key AND m.registration_id = r.id
      WHERE t.id = $1 AND e.slug = $2`, [req.params.id, config.edition]);
    sendMedia(res, file);
  });

  router.post('/registrations/:game', rateLimit({ windowMs: 10 * 60_000, limit: 12,
    message: { error: 'Too many registration attempts. Try again in a few minutes.' } }), async (req, res) => {
    if (!config.registrationEnabled) throw new HttpError(409, 'Registration is currently closed.');
    if (activeUploads >= 2) throw new HttpError(503, 'The server is busy. Please retry this submission.');
    if (Number(req.get('Content-Length')) > 86 * 1024 * 1024) throw new HttpError(413, 'The upload is too large.');
    activeUploads++;
    try {
      await new Promise((resolve, reject) => upload(req, res, error => error ? reject(error) : resolve()));
      const values = req.body ?? {};
      if (!isUuid(values.requestId) || !isUuid(values.formId) || !isUuid(values.university) || values.rulesAccepted !== 'true') {
        throw new HttpError(400, 'Select a university and accept the rulebook and privacy notice before submitting.');
      }
      const { rows: [form] } = await db.query(`${FORM_SELECT}
        JOIN trinity.registration_forms f ON f.edition_game_id = eg.id ${FORM_NOTICE}
        WHERE e.slug = $1 AND g.slug = $2 AND f.id = $3 AND ${FORM_SUPPORTED}`, [config.edition, req.params.game, values.formId]);
      if (!supported(form) || !(form.has_rulebook || formRulebook(config.edition, form))) {
        throw new HttpError(409, 'This registration form is unavailable. Reopen registration for the current form.');
      }
      const { rowCount: institutionCount, rows } = await db.query('SELECT id FROM trinity.institutions WHERE id = $1', [values.university]);
      if (!(institutionCount ?? rows.length)) throw new HttpError(400, 'Select a university from the list.');
      const { media, payload } = await registrationPayload(values, req.files ?? [], form);
      const reference = await transaction(db, async client => {
        const { rows: [{ id }] } = await client.query('SELECT trinity.submit_registration($1, $2::jsonb) AS id',
          [values.requestId, JSON.stringify(payload)]);
        for (const file of media) {
          await client.query(`INSERT INTO trinity.media (key, registration_id, content_type, bytes)
            VALUES ($1, $2, $3, $4) ON CONFLICT (key) DO NOTHING`, [file.key, id, file.type, file.buffer]);
        }
        return id;
      });
      res.status(201).json({ reference });
    } catch (error) {
      if (error.code === '23505') throw new HttpError(409, 'One or more players already have an active registration for this edition.');
      if (error.code === '55000') throw new HttpError(409, 'Registration is closed for this game.');
      if (error.code === '22023') throw new HttpError(409, 'The form changed or this request was already used with different details.');
      if (error instanceof multer.MulterError) throw new HttpError(400, 'Check that each required upload is present and no larger than 5 MB.');
      throw error;
    } finally {
      activeUploads--;
    }
  });
  return router;
}
