import nodemailer from 'nodemailer';
import { transaction } from './database.js';

export function startReceipts(db, { smtpUrl, receiptFrom, origin, production }) {
  if (!smtpUrl || !receiptFrom) return async () => {};
  const server = new URL(smtpUrl);
  if (!['smtp:', 'smtps:'].includes(server.protocol)) throw new Error('SMTP_URL must use smtp:// or smtps://.');
  const secure = server.protocol === 'smtps:';
  const transport = nodemailer.createTransport({
    host: server.hostname, port: Number(server.port || (secure ? 465 : 587)), secure,
    requireTLS: production && !secure,
    auth: server.username ? { user: decodeURIComponent(server.username), pass: decodeURIComponent(server.password) } : undefined,
    disableFileAccess: true, disableUrlAccess: true,
    connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 20_000,
  });
  let stopped = false;
  let timer;
  let pending = Promise.resolve();
  const domain = new URL(origin).hostname;

  function tick() {
    pending = transaction(db, async client => {
      const { rows: [job] } = await client.query(`
        SELECT o.registration_id, o.attempt_count, r.captain_email, g.name AS game
        FROM trinity.receipt_outbox o JOIN trinity.registrations r ON r.id = o.registration_id
        JOIN trinity.edition_games eg ON eg.id = r.edition_game_id JOIN trinity.games g ON g.id = eg.game_id
        WHERE o.sent_at IS NULL AND o.next_attempt_at <= clock_timestamp()
        ORDER BY o.next_attempt_at LIMIT 1 FOR UPDATE OF o SKIP LOCKED`);
      if (!job) return false;
      try {
        await transport.sendMail({
          from: receiptFrom, to: { address: job.captain_email, name: '' },
          messageId: `<registration-${job.registration_id}@${domain}>`,
          subject: 'Trinity Showdown registration received',
          text: `Your ${job.game} registration was received and is awaiting organizer review.\n\nReference: ${job.registration_id}\n`,
        });
      } catch {
        const delay = Math.min(3600, 30 * 2 ** Math.min(job.attempt_count, 7));
        await client.query(`UPDATE trinity.receipt_outbox SET attempt_count = attempt_count + 1,
          next_attempt_at = clock_timestamp() + make_interval(secs => $2::integer) WHERE registration_id = $1`,
        [job.registration_id, delay]);
        return true;
      }
      await client.query(`UPDATE trinity.receipt_outbox SET attempt_count = attempt_count + 1,
        sent_at = clock_timestamp() WHERE registration_id = $1`, [job.registration_id]);
      return true;
    }).catch(error => {
      console.error('Receipt processing failed', error.code ?? error.name);
      return false;
    }).then(worked => {
      if (!stopped) timer = setTimeout(tick, worked ? 250 : 5000);
    });
  }
  tick();
  return async () => {
    stopped = true;
    clearTimeout(timer);
    await pending;
    transport.close();
  };
}
