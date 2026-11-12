import { hashPassword } from '../src/auth.js';
import { createDatabase, transaction } from '../src/database.js';
import { email, text } from '../src/http.js';

const [action, address, nameOrActor] = process.argv.slice(2);
if (!process.env.DATABASE_URL) throw new Error('Set DATABASE_URL before running this command.');
const db = createDatabase(process.env.DATABASE_URL);
try {
  if (action === 'bootstrap') {
    const passwordHash = await hashPassword(process.env.TRINITY_BOOTSTRAP_PASSWORD);
    await transaction(db, async client => {
      await client.query('SELECT pg_advisory_xact_lock(2604001)');
      const { rows } = await client.query('SELECT id FROM trinity.organizers LIMIT 1');
      if (rows.length) throw new Error('An organizer account already exists. Use the invitation flow.');
      await client.query(`INSERT INTO trinity.organizers (email, display_name, password_hash)
        VALUES ($1, $2, $3)`, [email(address), text(nameOrActor, 'Display name', 100), passwordHash]);
    });
    console.log('First organizer created.');
  } else if (action === 'disable') {
    const target = email(address);
    const actor = email(nameOrActor);
    if (actor === target) throw new Error('Use another active organizer as the audit actor.');
    await transaction(db, async client => {
      const { rows: [organizer] } = await client.query(`
        SELECT id FROM trinity.organizers WHERE lower(btrim(email)) = $1 AND disabled_at IS NULL FOR SHARE`, [actor]);
      if (!organizer) throw new Error('The audit actor must be an active organizer.');
      const { rows: [disabled] } = await client.query(`UPDATE trinity.organizers SET disabled_at = clock_timestamp()
        WHERE lower(btrim(email)) = $1 AND disabled_at IS NULL RETURNING id`, [target]);
      if (!disabled) throw new Error('The target organizer is unavailable.');
      await client.query('DELETE FROM trinity.organizer_sessions WHERE organizer_id = $1', [disabled.id]);
      await client.query(`INSERT INTO trinity.organizer_audit (organizer_id, action, subject_id)
        VALUES ($1, 'account_disabled', $2)`, [organizer.id, disabled.id]);
    });
    console.log('Organizer disabled and sessions revoked.');
  } else {
    throw new Error('Use bootstrap EMAIL NAME or disable TARGET_EMAIL ACTOR_EMAIL.');
  }
} catch (error) {
  console.error(error.code ? `Organizer operation failed (${error.code}).` : error.message);
  process.exitCode = 1;
} finally {
  await db.end();
}
