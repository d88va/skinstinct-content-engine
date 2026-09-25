import { NextRequest, NextResponse } from 'next/server';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { sql } from '@/lib/db';

export const maxDuration = 60;

// One-off setup endpoint: applies db/schema.sql and seeds voice_skill if empty.
// Gated by ADMIN_SECRET since this runs schema DDL — not meant to stay
// reachable long-term; fine to delete once setup is done.
export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-admin-secret');
  if (!process.env.ADMIN_SECRET || secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const results: Record<string, unknown> = {};

  try {
    const schemaPath = path.join(process.cwd(), 'db', 'schema.sql');
    const schemaSql = readFileSync(schemaPath, 'utf-8');
    const statements = schemaSql
      .split(';')
      .map((s) => s.trim())
      .filter(Boolean);

    for (const statement of statements) {
      await sql.query(statement);
    }
    results.schema = 'applied';
  } catch (err) {
    return NextResponse.json({ ok: false, step: 'schema', error: String(err) }, { status: 500 });
  }

  try {
    const { rows: existing } = await sql`select id from voice_skill limit 1`;
    if (existing.length > 0) {
      results.voiceSeed = 'skipped (already seeded)';
    } else {
      const seedPath = path.join(process.cwd(), 'db', 'voice-seed.json');
      const seed = JSON.parse(readFileSync(seedPath, 'utf-8')) as Array<{
        source: string;
        category: string;
        content: string;
      }>;

      for (const row of seed) {
        await sql`insert into voice_skill (source, category, content) values (${row.source}, ${row.category}, ${row.content})`;
      }
      results.voiceSeed = `inserted ${seed.length} rows`;
    }
  } catch (err) {
    return NextResponse.json({ ok: false, step: 'voiceSeed', error: String(err) }, { status: 500 });
  }

  return NextResponse.json({ ok: true, ...results });
}
