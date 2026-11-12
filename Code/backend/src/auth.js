import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { transaction } from './database.js';
import { email, HttpError, text } from './http.js';

const derive = promisify(scrypt);
const hashOptions = { N: 2 ** 15, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };
const tokenPattern = /^[\w-]{43}$/;
const cookieName = 'trinity_organizer';
const sessionAge = 8 * 60 * 60 * 1000;
const cookieOptions = config => ({ httpOnly: true, sameSite: 'strict', secure: config.production, path: '/api/organizer' });
const tokenHash = token => createHash('sha256').update(token).digest();
const throttle = () => rateLimit({ windowMs: 15 * 60_000, limit: 10, message: { error: 'Too many attempts. Try again later.' } });

export async function hashPassword(password) {
  if (typeof password !== 'string' || password.length < 12 || password.length > 128) {
    throw new HttpError(400, 'Choose a password between 12 and 128 characters.');
  }
  const salt = randomBytes(16);
  const hash = await derive(password, salt, 32, hashOptions);
  return `${salt.toString('hex')}:${hash.toString('hex')}`;
}

async function verifyPassword(password, stored) {
  if (typeof password !== 'string' || password.length > 128) return false;
  const valid = /^[0-9a-f]{32}:[0-9a-f]{64}$/.test(stored ?? '');
  const [salt, expected] = valid ? stored.split(':') : ['0'.repeat(32), '0'.repeat(64)];
  const candidate = await derive(password, Buffer.from(salt, 'hex'), 32, hashOptions);
  return timingSafeEqual(candidate, Buffer.from(expected, 'hex')) && valid;
}

function sessionToken(req) {
  const cookie = (req.get('Cookie') ?? '').split(';').map(pair => pair.trim()).find(pair => pair.startsWith(cookieName + '='));
  const token = cookie?.slice(cookieName.length + 1);
  return tokenPattern.test(token ?? '') ? token : null;
}

async function createSession(client, organizerId, previous) {
  const token = randomBytes(32).toString('base64url');
  if (previous) await client.query('DELETE FROM trinity.organizer_sessions WHERE token_hash = $1', [tokenHash(previous)]);
  await client.query(`DELETE FROM trinity.organizer_sessions
    WHERE organizer_id = $1 AND expires_at <= clock_timestamp()`, [organizerId]);
  await client.query(`INSERT INTO trinity.organizer_sessions (token_hash, organizer_id, expires_at)
    VALUES ($1, $2, clock_timestamp() + interval '8 hours')`, [tokenHash(token), organizerId]);
  return token;
}

export function authRoutes(db, config) {
  const router = Router();
  router.post('/login', throttle(), async (req, res) => {
    const body = req.body ?? {};
    const address = email(body.email);
    const { rows: [organizer] } = await db.query(`
      SELECT id, email, display_name, password_hash FROM trinity.organizers
      WHERE lower(btrim(email)) = $1 AND disabled_at IS NULL`, [address]);
    if (!(await verifyPassword(body.password, organizer?.password_hash))) {
      throw new HttpError(401, 'Email or password is incorrect.');
    }
    const token = await transaction(db, async client => {
      const { rows } = await client.query(`SELECT id FROM trinity.organizers WHERE id = $1
        AND disabled_at IS NULL AND password_hash = $2 FOR UPDATE`, [organizer.id, organizer.password_hash]);
      if (!rows.length) throw new HttpError(401, 'Email or password is incorrect.');
      return createSession(client, organizer.id, sessionToken(req));
    });
    res.cookie(cookieName, token, { ...cookieOptions(config), maxAge: sessionAge })
      .json({ name: organizer.display_name, email: organizer.email });
  });

  router.post('/accept-invite', throttle(), async (req, res) => {
    const { token, name, password } = req.body ?? {};
    if (!tokenPattern.test(typeof token === 'string' ? token : '')) throw new HttpError(400, 'This invitation is invalid or expired.');
    const displayName = text(name, 'Display name', 100);
    const passwordHash = await hashPassword(password);
    try {
      const result = await transaction(db, async client => {
        const { rows: [invite] } = await client.query(`SELECT id, email FROM trinity.organizer_invites
          WHERE token_hash = $1 AND accepted_at IS NULL AND expires_at > clock_timestamp() FOR UPDATE`, [tokenHash(token)]);
        if (!invite) throw new HttpError(400, 'This invitation is invalid or expired.');
        const { rows: [{ id }] } = await client.query(`INSERT INTO trinity.organizers (email, display_name, password_hash)
          VALUES ($1, $2, $3) RETURNING id`, [invite.email, displayName, passwordHash]);
        const accepted = await client.query(`UPDATE trinity.organizer_invites SET accepted_by = $1, accepted_at = clock_timestamp()
          WHERE id = $2 AND expires_at > clock_timestamp() RETURNING id`, [id, invite.id]);
        if (!accepted.rows.length) throw new HttpError(400, 'This invitation has expired.');
        await client.query(`INSERT INTO trinity.organizer_audit (organizer_id, action, subject_id)
          VALUES ($1, 'invite_accepted', $2)`, [id, invite.id]);
        return { token: await createSession(client, id, sessionToken(req)), email: invite.email };
      });
      res.cookie(cookieName, result.token, { ...cookieOptions(config), maxAge: sessionAge })
        .status(201).json({ name: displayName, email: result.email });
    } catch (error) {
      if (error.code === '23505') throw new HttpError(409, 'This email already has an organizer account.');
      throw error;
    }
  });

  router.post('/logout', async (req, res) => {
    const token = sessionToken(req);
    if (token) await db.query('DELETE FROM trinity.organizer_sessions WHERE token_hash = $1', [tokenHash(token)]);
    res.clearCookie(cookieName, cookieOptions(config)).sendStatus(204);
  });
  return router;
}

export function requireOrganizer(db) {
  return async (req, _res, next) => {
    const token = sessionToken(req);
    if (!token) throw new HttpError(401, 'Sign in to continue.');
    const { rows: [organizer] } = await db.query(`
      SELECT o.id, o.email, o.display_name AS name FROM trinity.organizer_sessions s
      JOIN trinity.organizers o ON o.id = s.organizer_id
      WHERE s.token_hash = $1 AND s.expires_at > clock_timestamp() AND o.disabled_at IS NULL`, [tokenHash(token)]);
    if (!organizer) throw new HttpError(401, 'Sign in to continue.');
    req.organizer = organizer;
    next();
  };
}

export async function issueInvite(db, organizerId, address) {
  const token = randomBytes(32).toString('base64url');
  await transaction(db, async client => {
    const { rows: [actor] } = await client.query('SELECT id FROM trinity.organizers WHERE id = $1 AND disabled_at IS NULL FOR SHARE', [organizerId]);
    if (!actor) throw new HttpError(401, 'Sign in to continue.');
    const { rows } = await client.query('SELECT id FROM trinity.organizers WHERE lower(btrim(email)) = $1', [address]);
    if (rows.length) throw new HttpError(409, 'This email already has an organizer account.');
    const { rows: [{ id }] } = await client.query(`INSERT INTO trinity.organizer_invites (invited_by, email, token_hash, expires_at)
      VALUES ($1, $2, $3, clock_timestamp() + interval '48 hours') RETURNING id`, [organizerId, address, tokenHash(token)]);
    await client.query(`INSERT INTO trinity.organizer_audit (organizer_id, action, subject_id)
      VALUES ($1, 'invite_issued', $2)`, [organizerId, id]);
  });
  return token;
}
