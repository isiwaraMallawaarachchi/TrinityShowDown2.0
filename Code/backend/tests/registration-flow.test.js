import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import sharp from 'sharp';
import { createApp } from '../src/app.js';
import { hashPassword } from '../src/auth.js';
import { startReceipts } from '../src/receipts.js';
import { bundledRulebook } from '../src/rulebooks.js';

async function localMailSink() {
  const messages = [];
  const server = createServer(socket => {
    let pending = '';
    let content = null;
    socket.setEncoding('utf8');
    socket.write('220 test SMTP\r\n');
    socket.on('data', chunk => {
      pending += chunk;
      let end;
      while ((end = pending.indexOf('\r\n')) >= 0) {
        const line = pending.slice(0, end);
        pending = pending.slice(end + 2);
        if (content !== null) {
          if (line === '.') {
            messages.push(content.join('\n'));
            content = null;
            socket.write('250 received\r\n');
          } else content.push(line);
        } else if (line === 'DATA') {
          content = [];
          socket.write('354 send message\r\n');
        } else if (line === 'QUIT') {
          socket.end('221 goodbye\r\n');
        } else socket.write('250 OK\r\n');
      }
    });
  }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  return { server, messages };
}

test('bundled rulebooks can be downloaded before registration is configured', async t => {
  const db = { query: async () => ({ rows: [] }) };
  const server = createApp(db, { edition: 'trinity-showdown', registrationEnabled: false }).listen(0, '127.0.0.1');
  t.after(() => new Promise(resolve => server.close(resolve)));
  await once(server, 'listening');
  const origin = 'http://127.0.0.1:' + server.address().port;
  const { games } = await (await fetch(origin + '/api/public/event')).json();
  assert.deepEqual(Object.keys(games).sort(), ['clash-of-clans', 'cod-mobile', 'mlbb', 'pubg-mobile']);
  for (const [game, settings] of Object.entries(games)) {
    assert.equal(settings.open, false);
    const pdf = await fetch(origin + settings.rulebookUrl, { headers: { Range: 'bytes=0-4' } });
    assert.equal(pdf.status, 206);
    assert.equal(pdf.headers.get('content-type'), 'application/pdf');
    assert.equal(pdf.headers.get('content-disposition').replaceAll('"', ''), `attachment; filename=${game}-v1.pdf`);
    assert.equal(await pdf.text(), '%PDF-');
  }
  const unavailable = await fetch(origin + '/api/public/rulebooks/files/cod-mobile/2');
  assert.equal(unavailable.status, 404);
  await unavailable.arrayBuffer();
});

test('captain and organizer APIs share durable, private submissions and publish only approved teams', async t => {
  const db = await PGlite.create();
  t.after(() => db.close());
  for (const file of ['001_initial.sql', '002_media.sql', '003_team_players.sql']) {
    await db.exec(await readFile(new URL('../../database/migrations/' + file, import.meta.url), 'utf8'));
  }
  const { rows: [{ id: university }] } = await db.query("INSERT INTO trinity.institutions(name) VALUES ('Test University') RETURNING id");
  const { rows: [{ id: organizer }] } = await db.query(`
    INSERT INTO trinity.organizers(email, display_name, password_hash)
    VALUES ('organizer@example.com', 'Test Organizer', $1) RETURNING id`, [await hashPassword('synthetic-password-1')]);
  await db.exec(`
    INSERT INTO trinity.editions(slug, title) VALUES ('trinity-showdown', 'Test edition');
    INSERT INTO trinity.privacy_notices(version, body) VALUES ('test', 'Synthetic notice');
    INSERT INTO trinity.media(key, content_type, bytes) VALUES ('rules/test', 'application/pdf', convert_to('%PDF-1.4', 'UTF8'));
    INSERT INTO trinity.edition_games(edition_id, game_id, display_order, registration_opens_at, registration_closes_at)
      SELECT e.id, g.id, g.id, now() - interval '1 hour', now() + interval '1 hour'
      FROM trinity.editions e CROSS JOIN trinity.games g;
  `);
  const bundled = bundledRulebook('trinity-showdown', 'clash-of-clans', '1');
  await db.query(`
    INSERT INTO trinity.registration_forms(edition_game_id, version, privacy_notice_id, rulebook_version, rulebook_key,
      fee_lkr, bank_instructions, min_starters, max_starters, min_substitutes, max_substitutes)
      SELECT eg.id, 1, n.id, CASE WHEN g.slug = 'clash-of-clans' THEN '1' ELSE 'test' END,
        CASE WHEN g.slug = 'clash-of-clans' THEN $1 ELSE 'rules/test' END, 100, 'Synthetic bank instructions', 5, 5, 0, 2
      FROM trinity.edition_games eg JOIN trinity.games g ON eg.game_id = g.id CROSS JOIN trinity.privacy_notices n;
  `, [bundled.key]);
  await db.exec(`
    UPDATE trinity.edition_games eg SET active_form_id = f.id FROM trinity.registration_forms f
      WHERE f.edition_game_id = eg.id;
    CREATE ROLE trinity_test_api;
  `);
  const grants = await readFile(new URL('../../database/grant_runtime.sql', import.meta.url), 'utf8');
  await db.exec(grants.replaceAll(':"runtime_role"', 'trinity_test_api'));
  await db.exec('SET ROLE trinity_test_api');
  const apiDb = { query: db.query.bind(db), connect: async () => ({ query: db.query.bind(db), release() {} }) };
  const config = { edition: 'trinity-showdown', registrationEnabled: true, allowedOrigins: [] };
  const server = createApp(apiDb, config).listen(0, '127.0.0.1');
  t.after(() => new Promise(resolve => server.close(resolve)));
  await once(server, 'listening');
  const origin = 'http://127.0.0.1:' + server.address().port;
  config.origin = origin;
  config.allowedOrigins.push(origin);
  await t.test('Express serves the organizer frontend and its assets', async () => {
    const page = await fetch(origin + '/organizer');
    assert.equal(page.status, 200);
    assert.equal(new URL(page.url).pathname, '/organizer/');
    assert.equal(page.headers.get('x-robots-tag'), 'noindex, nofollow');
    const html = await page.text();
    assert.match(html, /Organizer sign in/);
    const assets = [
      { file: './workspace.css', type: /^text\/css\b/ },
      { file: './workspace.js', type: /javascript/ },
    ];
    await Promise.all(assets.map(async ({ file, type }) => {
      assert.ok(html.includes('"' + file + '"'));
      const asset = await fetch(new URL(file, page.url));
      assert.equal(asset.status, 200);
      assert.match(asset.headers.get('content-type'), type);
      await asset.arrayBuffer();
    }));
  });
  let cookie;
  function request(path, options = {}) {
    const { json, body, authenticated = false } = options;
    const headers = { Origin: origin };
    if (authenticated) headers.Cookie = cookie;
    if (json) headers['Content-Type'] = 'application/json';
    return fetch(origin + '/api/' + path, {
      headers, method: json || body ? 'POST' : 'GET', body: json ? JSON.stringify(json) : body,
    });
  }

  const event = await (await request('public/event')).json();
  assert.equal(event.games['cod-mobile'].open, true);
  assert.equal(await (await fetch(origin + event.games['cod-mobile'].rulebookUrl)).text(), '%PDF-1.4');
  const cocRulebook = event.games['clash-of-clans'];
  assert.equal(cocRulebook.open, true);
  assert.equal(cocRulebook.rulebookUrl, `/api/public/rulebooks/${cocRulebook.formId}`);
  const bundledPdf = await fetch(origin + cocRulebook.rulebookUrl, { headers: { Range: 'bytes=0-4' } });
  assert.equal(bundledPdf.status, 206);
  assert.equal(bundledPdf.headers.get('content-disposition').replaceAll('"', ''), 'attachment; filename=clash-of-clans-v1.pdf');
  assert.equal(await bundledPdf.text(), '%PDF-');
  const png = await sharp({ create: { width: 8, height: 8, channels: 3, background: '#123456' } }).png().toBuffer();
  const photo = new Blob([png], { type: 'image/png' });
  function team(game, requestId = randomUUID(), duplicate = false) {
    const data = new FormData();
    for (const [key, value] of Object.entries({ formId: event.games[game].formId, requestId, university,
      rulesAccepted: 'true', teamName: '=Synthetic team', 'leader.email': 'captain@example.com',
      'leader.phone': '0771234567', 'player-2.phone': '0771234568' })) data.set(key, value);
    for (const field of ['teamLogo', 'paymentProof', 'leader.portrait']) data.set(field, photo, field + '.png');
    const slots = ['leader', 'player-2', 'player-3', 'player-4', 'player-5', 'sub-1', 'sub-2'];
    for (const [index, slot] of slots.entries()) {
      data.set(slot + '.name', 'Player ' + index);
      data.set(slot + '.studentId', duplicate && index === 1 ? '0000' : '000' + index);
      data.set(slot + '.gameName', 'Gamer ' + index);
      data.set(slot + '.gameId', 'game-id-' + index);
      for (const side of ['idFront', 'idBack']) data.set(slot + '.' + side, photo, side + '.png');
    }
    return data;
  }

  assert.equal((await request('organizer/registrations')).status, 401);
  const malformed = team('cod-mobile');
  malformed.set('teamLogo', new Blob(['not an image'], { type: 'image/png' }), 'invalid.png');
  assert.equal((await request('public/registrations/cod-mobile', { body: malformed })).status, 400);
  assert.equal((await request('public/registrations/cod-mobile', { body: team('cod-mobile', undefined, true) })).status, 409);
  const data = team('cod-mobile');
  const submitted = await request('public/registrations/cod-mobile', { body: data });
  assert.equal(submitted.status, 201, await submitted.clone().text());
  const { reference } = await submitted.json();
  const retry = await request('public/registrations/cod-mobile', { body: data });
  assert.equal((await retry.json()).reference, reference);
  assert.equal((await request('public/registrations/pubg-mobile', { body: team('pubg-mobile') })).status, 409);
  assert.equal((await request(`public/teams/${reference}/logo`)).status, 404);
  assert.equal((await request(`organizer/registrations/${reference}/images/proof`)).status, 401);
  assert.equal((await db.query('SELECT count(*)::int AS count FROM trinity.receipt_outbox')).rows[0].count, 1);
  assert.equal((await db.query('SELECT count(*)::int AS count FROM trinity.media WHERE registration_id = $1', [reference])).rows[0].count, 18);

  const login = await request('organizer/login', { json: { email: 'organizer@example.com', password: 'synthetic-password-1' } });
  assert.equal(login.status, 200, await login.clone().text());
  cookie = login.headers.get('set-cookie').split(';')[0];
  assert.match(login.headers.get('set-cookie'), /HttpOnly; SameSite=Strict/i);
  const detailsPath = `organizer/registrations/${reference}`;
  const details = await (await request(detailsPath, { authenticated: true })).json();
  assert.equal(details.players[0].student_number, '0000');
  assert.equal(details.players[0].images.front, '/api/' + detailsPath + '/images/player-1-front');
  assert.equal((await request(detailsPath + '/images/player-1-front', { authenticated: true })).headers.get('content-type'), 'image/png');
  const decide = json => request(detailsPath + '/decision', { authenticated: true, json });
  assert.equal((await decide({ expectedStatus: 'submitted', decision: 'approved' })).status, 400);
  assert.equal((await decide({ expectedStatus: 'submitted', decision: 'approved', paymentVerified: true })).status, 200);
  const published = (await (await request('public/event')).json()).teams;
  assert.deepEqual(Object.keys(published[0]).sort(), ['gameId', 'id', 'logoUrl', 'name']);
  assert.equal(published[0].id, reference);
  assert.equal((await request(`public/teams/${reference}/logo`)).headers.get('content-type'), 'image/webp');
  assert.equal((await decide({ expectedStatus: 'submitted', decision: 'rejected', reason: 'Test review' })).status, 409);
  assert.equal((await decide({ expectedStatus: 'approved', decision: 'rejected', reason: 'Test review' })).status, 200);
  assert.equal((await request(`public/teams/${reference}/logo`)).status, 404);
  assert.equal((await request(detailsPath + '/images/proof', { authenticated: true })).status, 200);
  assert.equal((await request('public/registrations/pubg-mobile', { body: team('pubg-mobile') })).status, 201);

  const coc = team('clash-of-clans');
  for (const key of coc.keys()) {
    if (key.endsWith('.studentId')) coc.set(key, 'coc-' + coc.get(key));
  }
  const levels = ['1', '19', '14', '15', '16', '9007199254740993', '21'];
  const cocSlots = ['leader', 'player-2', 'player-3', 'player-4', 'player-5', 'sub-1', 'sub-2'];
  for (const [index, slot] of cocSlots.entries()) coc.set(slot + '.townHallLevel', levels[index]);
  coc.delete('sub-2.townHallLevel');
  const missingLevel = await request('public/registrations/clash-of-clans', { body: coc });
  assert.equal(missingLevel.status, 400);
  assert.match((await missingLevel.json()).error, /Town Hall level of 1 or higher/);
  coc.set('sub-2.townHallLevel', '0');
  const invalidLevel = await request('public/registrations/clash-of-clans', { body: coc });
  assert.equal(invalidLevel.status, 400);
  assert.match((await invalidLevel.json()).error, /Town Hall level of 1 or higher/);
  coc.set('sub-2.townHallLevel', '021');
  const cocSubmission = await request('public/registrations/clash-of-clans', { body: coc });
  assert.equal(cocSubmission.status, 201, await cocSubmission.clone().text());
  const { reference: cocReference } = await cocSubmission.json();
  const cocDetails = await request('organizer/registrations/' + cocReference, { authenticated: true });
  assert.equal(cocDetails.status, 200);
  const cocEntry = await cocDetails.json();
  assert.deepEqual(cocEntry.entry_fields, {});
  assert.deepEqual(cocEntry.players.map(player => player.fields.townHallLevel), levels);
  assert.equal((await (await request('public/registrations/clash-of-clans', { body: coc })).json()).reference, cocReference);

  const exported = await request('organizer/registrations/export.csv', { authenticated: true });
  const csv = await exported.text();
  assert.match(csv, /"'=Synthetic team"/);
  const [csvHeader, ...csvRows] = csv.split('\r\n');
  assert.match(csvHeader, /,"Town Hall level"$/);
  assert.deepEqual(csvRows.filter(row => row.startsWith('"' + cocReference + '"'))
    .map(row => row.match(/,"(\d+)"$/)?.[1]), levels);

  const invitation = await request('organizer/invites', { authenticated: true, json: { email: 'second@example.com' } });
  assert.equal(invitation.status, 201, await invitation.clone().text());
  const token = new URL((await invitation.json()).url).hash.slice('#invite='.length);
  const accept = () => request('organizer/accept-invite', { json: { token, name: 'Second Organizer', password: 'synthetic-password-2' } });
  const newAccount = await accept();
  assert.equal(newAccount.status, 201, await newAccount.clone().text());
  assert.equal((await accept()).status, 400);
  cookie = newAccount.headers.get('set-cookie').split(';')[0];
  assert.equal((await request(detailsPath, { authenticated: true })).status, 200);
  assert.equal((await request('organizer/logout', { authenticated: true, json: {} })).status, 204);
  assert.equal((await request(detailsPath, { authenticated: true })).status, 401);
  await db.exec('RESET ROLE');
  await db.exec("UPDATE trinity.edition_games SET registration_opens_at = now() - interval '2 hours', registration_closes_at = now() - interval '1 hour'");
  await db.exec('SET ROLE trinity_test_api');
  assert.equal((await request('public/registrations/cod-mobile', { body: team('cod-mobile') })).status, 409);
  assert.equal((await (await request('public/registrations/cod-mobile', { body: data })).json()).reference, reference);
  assert.equal((await db.query("SELECT count(*)::int AS count FROM trinity.organizer_audit WHERE organizer_id = $1 AND action = 'export'", [organizer])).rows[0].count, 1);

  const sink = await localMailSink();
  const stop = startReceipts(apiDb, {
    origin, smtpUrl: 'smtp://127.0.0.1:' + sink.server.address().port, receiptFrom: 'receipts@example.com',
  });
  try {
    const deadline = Date.now() + 5000;
    let sent = 0;
    while (sent < 3 && Date.now() < deadline) {
      await delay(50);
      const result = await db.query('SELECT count(*)::int AS count FROM trinity.receipt_outbox WHERE sent_at IS NOT NULL');
      sent = result.rows[0].count;
    }
    assert.equal(sent, 3);
    assert.equal(sink.messages.filter(message => message.includes(reference)).length, 1);
    assert.ok(sink.messages.every(message => message.replace(/=\n/g, '').includes('awaiting organizer review')));
  } finally {
    await stop();
    await new Promise(resolve => sink.server.close(resolve));
  }
});
