import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

// Debug/verification endpoint — this machine has no local psql or Node,
// so this is how we check pipeline state (notes/drafts) via curl instead.
export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-admin-secret');
  if (!process.env.ADMIN_SECRET || secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const { rows: notes } = await sql`
    select id, status, score, score_reason, keywords, error_message, left(raw_text, 80) as raw_text_preview, created_at
    from notes order by created_at desc limit 5
  `;
  const { rows: drafts } = await sql`
    select id, note_id, status, model, telegram_message_id, decided_at, left(content, 120) as content_preview, created_at
    from drafts order by created_at desc limit 5
  `;
  const { rows: voiceCount } = await sql`select count(*) from voice_skill`;

  return NextResponse.json({ ok: true, notes, drafts, voice_skill_rows: voiceCount[0]?.count });
}
