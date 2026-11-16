import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { authRoutes, issueInvite, requireOrganizer } from './auth.js';
import { email, HttpError, isUuid, sendMedia, statuses, text } from './http.js';

const REGISTRATIONS = `
  FROM trinity.registrations r JOIN trinity.edition_games eg ON eg.id = r.edition_game_id
  JOIN trinity.editions e ON e.id = eg.edition_id JOIN trinity.games g ON g.id = eg.game_id
  JOIN trinity.registration_forms f ON f.id = r.form_id
  JOIN trinity.privacy_notices n ON n.id = f.privacy_notice_id
`;
const ENTRY = `r.id, r.team_name, r.captain_name, r.captain_email, r.captain_phone,
  r.status, r.submitted_at, r.extra_fields AS entry_fields, g.slug AS game, g.name AS game_name,
  r.logo_key, r.payment_proof_key, f.version AS form_version, f.rulebook_version, n.version AS privacy_version`;
const PLAYER_COLUMNS = `p.position, p.full_name, p.student_number, p.role, p.is_captain,
  p.in_game_id, p.extra_fields AS player_fields, i.name AS university`;
const PLAYER_JOINS = 'JOIN trinity.team_players p ON p.registration_id = r.id JOIN trinity.institutions i ON i.id = p.institution_id';
const playerImages = { front: 'idFront', back: 'idBack', portrait: 'portrait' };
const imageUrl = (id, slot) => `/api/organizer/registrations/${id}/images/${slot}`;

async function loadEntry(db, edition, id) {
  if (!isUuid(id)) throw new HttpError(404, 'Registration unavailable.');
  const { rows: [entry] } = await db.query(`SELECT ${ENTRY} ${REGISTRATIONS} WHERE e.slug = $1 AND r.id = $2`, [edition, id]);
  if (!entry) throw new HttpError(404, 'Registration unavailable.');
  return entry;
}

function playerData(player, id) {
  const { player_fields: { idFront, idBack, portrait, ...fields }, ...rest } = player;
  const images = {};
  if (idFront) images.front = imageUrl(id, `player-${player.position}-front`);
  if (idBack) images.back = imageUrl(id, `player-${player.position}-back`);
  if (portrait) images.portrait = imageUrl(id, `player-${player.position}-portrait`);
  return { ...rest, fields, images };
}

function csvCell(value) {
  let cell = String(value ?? '');
  if (/^[\s\uFEFF]*[=+\-@]|^[\t\r\n]/.test(cell)) cell = "'" + cell;
  return '"' + cell.replaceAll('"', '""') + '"';
}

export function organizerRoutes(db, config) {
  const router = Router();
  router.use(authRoutes(db, config));
  router.use(requireOrganizer(db));
  router.get('/me', (req, res) => res.json({ name: req.organizer.name, email: req.organizer.email }));
  router.post('/invites', rateLimit({ windowMs: 60 * 60_000, limit: 20 }), async (req, res) => {
    const token = await issueInvite(db, req.organizer.id, email(req.body?.email));
    res.status(201).json({ url: `${config.origin}/organizer/#invite=${token}` });
  });

  router.get('/registrations', async (req, res) => {
    const { game = '', status = '', page = '1' } = req.query;
    if (typeof game !== 'string' || typeof status !== 'string' || (status && !statuses.includes(status)) ||
      typeof page !== 'string' || !/^\d{1,5}$/.test(page) || Number(page) < 1) {
      throw new HttpError(400, 'Invalid review filters.');
    }
    const { rows } = await db.query(`SELECT r.id, r.team_name, r.status, r.submitted_at, g.name AS game_name
      ${REGISTRATIONS} WHERE e.slug = $1 AND ($2 = '' OR g.slug = $2)
      AND ($3 = '' OR r.status::text = $3) ORDER BY r.submitted_at DESC, r.id LIMIT 51 OFFSET $4`,
    [config.edition, game, status, (Number(page) - 1) * 50]);
    res.json({ entries: rows.slice(0, 50), hasNext: rows.length > 50 });
  });

  router.get('/registrations/export.csv', async (req, res) => {
    const { rows } = await db.query(`SELECT ${ENTRY}, ${PLAYER_COLUMNS} ${REGISTRATIONS} ${PLAYER_JOINS}
      WHERE e.slug = $1 ORDER BY r.submitted_at DESC, r.id, p.position`, [config.edition]);
    await db.query("INSERT INTO trinity.organizer_audit (organizer_id, action) VALUES ($1, 'export')", [req.organizer.id]);
    const headers = ['Reference', 'Game', 'Team', 'Status', 'Submitted at', 'Captain', 'Captain email', 'Captain phone',
      'Form version', 'Rulebook version', 'Privacy version', 'Team fields', 'Logo', 'Payment proof', 'Position',
      'Player', 'University', 'University ID', 'Role', 'Is captain', 'In-game ID', 'In-game name', 'Player phone',
      'ID front', 'ID back', 'Portrait', 'Player fields', 'Town Hall level'];
    const link = path => path ? config.origin + path : '';
    const records = rows.map(row => {
      const player = playerData({
        position: row.position, player_fields: row.player_fields,
      }, row.id);
      return [row.id, row.game_name, row.team_name, row.status, new Date(row.submitted_at).toISOString(),
        row.captain_name, row.captain_email, row.captain_phone, row.form_version, row.rulebook_version,
        row.privacy_version, JSON.stringify(row.entry_fields), link(imageUrl(row.id, 'logo')),
        link(imageUrl(row.id, 'proof')), row.position, row.full_name, row.university, row.student_number,
        row.role, row.is_captain, row.in_game_id, player.fields.gameName, player.fields.phone,
        link(player.images.front), link(player.images.back), link(player.images.portrait), JSON.stringify(player.fields),
        player.fields.townHallLevel];
    });
    res.attachment('trinity-registrations.csv').type('text/csv').send(
      '\uFEFF' + [headers, ...records].map(record => record.map(csvCell).join(',')).join('\r\n') + '\r\n');
  });

  router.get('/registrations/:id', async (req, res) => {
    const { logo_key, payment_proof_key, ...entry } = await loadEntry(db, config.edition, req.params.id);
    const [players, decisions] = await Promise.all([
      db.query(`SELECT ${PLAYER_COLUMNS} FROM trinity.team_players p JOIN trinity.institutions i ON i.id = p.institution_id
        WHERE p.registration_id = $1 ORDER BY p.position`, [entry.id]),
      db.query(`SELECT d.from_status, d.to_status, d.reason, d.decided_at, o.display_name AS organizer
        FROM trinity.registration_decisions d JOIN trinity.organizers o ON o.id = d.organizer_id
        WHERE d.registration_id = $1 ORDER BY d.id DESC`, [entry.id]),
    ]);
    res.json({
      ...entry, images: { logo: imageUrl(entry.id, 'logo'), proof: imageUrl(entry.id, 'proof') },
      players: players.rows.map(player => playerData(player, entry.id)), decisions: decisions.rows,
    });
  });

  router.get('/registrations/:id/images/:slot', async (req, res) => {
    const entry = await loadEntry(db, config.edition, req.params.id);
    const { slot } = req.params;
    let key;
    if (slot === 'logo') key = entry.logo_key;
    else if (slot === 'proof') key = entry.payment_proof_key;
    else {
      const match = /^player-(\d{1,2})-(front|back|portrait)$/.exec(slot);
      if (match) {
        const { rows: [row] } = await db.query(`SELECT extra_fields ->> $3::text AS key
          FROM trinity.team_players WHERE registration_id = $1 AND position = $2`,
        [entry.id, Number(match[1]), playerImages[match[2]]]);
        key = row?.key;
      }
    }
    if (!key) throw new HttpError(404, 'File unavailable.');
    const { rows: [file] } = await db.query('SELECT content_type, bytes FROM trinity.media WHERE key = $1 AND registration_id = $2', [key, entry.id]);
    sendMedia(res, file);
  });

  router.post('/registrations/:id/decision', async (req, res) => {
    const { expectedStatus, decision, paymentVerified } = req.body ?? {};
    if (!statuses.includes(expectedStatus) || !['approved', 'rejected'].includes(decision)) {
      throw new HttpError(400, 'Choose a valid review decision.');
    }
    const reason = decision === 'rejected' ? text(req.body.reason, 'Rejection reason', 1000) : null;
    if (decision === 'approved' && paymentVerified !== true) throw new HttpError(400, 'Verify the bank transfer proof before approving.');
    await loadEntry(db, config.edition, req.params.id);
    try {
      await db.query('SELECT trinity.decide_registration($1, $2, $3, $4, $5, $6)',
        [req.params.id, req.organizer.id, expectedStatus, decision, paymentVerified === true, reason]);
    } catch (error) {
      if (error.code === '55000') throw new HttpError(409, 'Another organizer changed this entry. Reload it before reviewing.');
      if (error.code === '22023') throw new HttpError(400, 'This review decision is unavailable for the current status.');
      if (error.code === '42501') throw new HttpError(401, 'Sign in to continue.');
      throw error;
    }
    res.json({ status: decision });
  });
  return router;
}
