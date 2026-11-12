import { createApp } from './app.js';
import { createDatabase } from './database.js';
import { startReceipts } from './receipts.js';

const production = process.env.NODE_ENV === 'production';
const port = Number(process.env.PORT ?? 3000);
const origin = new URL(process.env.TRINITY_ORIGIN ?? `http://127.0.0.1:${port}`).origin;
const config = {
  production, origin,
  edition: process.env.TRINITY_EDITION ?? 'trinity-showdown',
  allowedOrigins: [origin, ...(!production ? [process.env.TRINITY_DEV_ORIGIN ?? 'http://127.0.0.1:5174'] : [])],
  registrationEnabled: process.env.REGISTRATION_ENABLED === 'true',
  proxyHops: Number(process.env.TRUST_PROXY_HOPS ?? 0),
  smtpUrl: process.env.SMTP_URL,
  receiptFrom: process.env.RECEIPT_FROM,
};
if (!process.env.DATABASE_URL) throw new Error('Set DATABASE_URL before starting the backend.');
if (production && !origin.startsWith('https://')) throw new Error('Set TRINITY_ORIGIN to the public HTTPS origin.');
if (production && config.registrationEnabled && (!config.smtpUrl || !config.receiptFrom)) {
  throw new Error('Configure receipt email before opening production registration.');
}

const db = createDatabase(process.env.DATABASE_URL);
await db.query('SELECT 1 FROM trinity.media LIMIT 1');
const stopReceipts = startReceipts(db, config);
const server = createApp(db, config).listen(port, process.env.HOST ?? '127.0.0.1',
  () => console.log(`Trinity Showdown is listening on port ${port}.`));
server.requestTimeout = 180_000;

function shutdown() {
  server.close(async () => {
    await stopReceipts();
    await db.end();
  });
}
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
