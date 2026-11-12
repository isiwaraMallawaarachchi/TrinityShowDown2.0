import pg from 'pg';

export function createDatabase(connectionString) {
  return new pg.Pool({ connectionString, max: 10, connectionTimeoutMillis: 5000 });
}

export async function transaction(db, work) {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}
