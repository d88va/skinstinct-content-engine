import { Pool } from 'pg';

// @vercel/postgres only auto-enables SSL for its own vercel-storage.com hosts.
// This project's Postgres is a Supabase-backed store connected via Vercel's
// marketplace integration, and Supabase's Postgres requires SSL — so we talk
// to it directly with `pg` instead.
//
// pg's connection-string parser reads any sslmode query param in the URL and
// that overrides an explicit `ssl` option passed alongside `connectionString`
// (a known pg gotcha), so a plain `ssl: { rejectUnauthorized: false }` object
// gets silently ignored when the URL already carries sslmode=require and
// still fails on Supabase's self-signed chain. Forcing sslmode=no-verify
// directly into the URL sidesteps that override entirely.
function connectionStringWithNoVerifySsl(urlStr: string | undefined): string | undefined {
  if (!urlStr) return urlStr;
  const url = new URL(urlStr);
  url.searchParams.set('sslmode', 'no-verify');
  return url.toString();
}

const pool = new Pool({
  connectionString: connectionStringWithNoVerifySsl(process.env.POSTGRES_URL),
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
