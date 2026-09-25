import { Pool } from 'pg';

// @vercel/postgres only auto-enables SSL for its own vercel-storage.com hosts.
// This project's Postgres is a Supabase-backed store connected via Vercel's
// marketplace integration, and Supabase's Postgres requires SSL — so we talk
// to it directly with `pg` and force SSL explicitly instead.
const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false },
});

type SqlResult<T = any> = { rows: T[] };

// Minimal tagged-template helper mirroring @vercel/postgres's `sql` API, so
// call sites can keep writing sql`select ... where id = ${id}`.
async function sqlTag<T = any>(strings: TemplateStringsArray, ...values: unknown[]): Promise<SqlResult<T>> {
  let text = strings[0];
  const params: unknown[] = [];
  values.forEach((value, i) => {
    params.push(value);
    text += `$${i + 1}${strings[i + 1]}`;
  });
  const result = await pool.query(text, params);
  return { rows: result.rows as T[] };
}

sqlTag.query = async <T = any>(text: string): Promise<SqlResult<T>> => {
  const result = await pool.query(text);
  return { rows: result.rows as T[] };
};

export const sql = sqlTag;
