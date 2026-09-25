import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const { default: pg } = await import('pg');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const seedPath = path.join(__dirname, '..', 'db', 'voice-seed.json');
const seed = JSON.parse(readFileSync(seedPath, 'utf-8'));

const connectionString = process.env.POSTGRES_URL;
if (!connectionString) {
  console.error('Set POSTGRES_URL in .env.local before seeding.');
  process.exit(1);
}

const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });
await client.connect();

try {
  const { rows: existing } = await client.query('select id from voice_skill');
  if (existing.length > 0) {
    console.log(`voice_skill already has ${existing.length} rows — skipping seed to avoid duplicates.`);
    console.log('Delete existing rows first if you want to reseed.');
    process.exit(0);
  }

  for (const row of seed) {
    await client.query('insert into voice_skill (source, category, content) values ($1, $2, $3)', [
      row.source,
      row.category,
      row.content,
    ]);
  }

  console.log(`Seeded ${seed.length} voice_skill rows.`);
} finally {
  await client.end();
}
