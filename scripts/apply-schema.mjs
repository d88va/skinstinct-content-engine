import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const { default: pg } = await import('pg');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.join(__dirname, '..', 'db', 'schema.sql');
const schemaSql = readFileSync(schemaPath, 'utf-8');

const connectionString = process.env.POSTGRES_URL;
if (!connectionString) {
  console.error('Set POSTGRES_URL in .env.local before applying the schema.');
  process.exit(1);
}

const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });
await client.connect();

try {
  await client.query(schemaSql);
  console.log('Schema applied.');

  const { rows } = await client.query(
    "select table_name from information_schema.tables where table_schema = 'public' and table_name in ('notes', 'drafts', 'voice_skill') order by table_name"
  );
  console.log(
    'Confirmed tables:',
    rows.map((r) => r.table_name).join(', ') || '(none found — something went wrong)'
  );
} finally {
  await client.end();
}
