import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { extractMessage, sendTelegramMessage, TelegramUpdate } from '@/lib/telegram';
import { scoreNote, findNewsAngle } from '@/lib/gemini';
import { generateDraft } from '@/lib/draft';

// Scoring + news lookup + drafting are separate model calls and can genuinely
// take 60-100s end to end. Extend beyond the default serverless timeout.
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-telegram-bot-api-secret-token');
  if (secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return NextResponse.json({ ok: false, error: 'bad secret' }, { status: 401 });
  }

  const update = (await req.json()) as TelegramUpdate;
  const message = extractMessage(update);

  if (!message || !message.text) {
    return NextResponse.json({ ok: true });
  }

  const decision = message.text.trim().toUpperCase();
  if ((decision === 'APPROVE' || decision === 'REJECT') && message.reply_to_message) {
    await handleDecision(message.reply_to_message.message_id, decision);
    return NextResponse.json({ ok: true });
  }

  await handleNewNote(message.chat.id, message.message_id, message.text);
  return NextResponse.json({ ok: true });
}

async function handleDecision(draftMessageId: number, decision: 'APPROVE' | 'REJECT') {
  const { rows } = await sql`
    select id from drafts where telegram_message_id = ${draftMessageId} limit 1
  `;
  if (rows.length === 0) return;

  await sql`
    update drafts
    set status = ${decision === 'APPROVE' ? 'approved' : 'rejected'}, decided_at = now()
    where id = ${rows[0].id}
  `;
}

async function handleNewNote(chatId: number, telegramMessageId: number, rawText: string) {
  const { rows: noteRows } = await sql`
    insert into notes (telegram_chat_id, telegram_message_id, raw_text)
    values (${chatId}, ${telegramMessageId}, ${rawText})
    returning id
  `;
  const noteId = noteRows[0]?.id;
  if (!noteId) {
    console.error('Failed to insert note');
    return;
  }

  const scoreResult = await scoreNote(rawText);

  await sql`
    update notes
    set status = ${scoreResult.pass ? 'scored' : 'rejected'},
        score = ${scoreResult.score},
        score_reason = ${scoreResult.reason},
        keywords = ${JSON.stringify(scoreResult.keywords)}::jsonb
    where id = ${noteId}
  `;

  if (!scoreResult.pass) {
    await sendTelegramMessage(
      chatId,
      `Rejected (${scoreResult.score}/10): ${scoreResult.reason}`,
      telegramMessageId
    );
    return;
  }

  const newsAngle = await findNewsAngle(rawText, scoreResult.keywords);
  const { content, model } = await generateDraft(rawText, newsAngle);

  const sent = await sendTelegramMessage(
    chatId,
    `${content}\n\n—\nReply APPROVE or REJECT to this message.`,
    telegramMessageId
  );

  await sql`
    insert into drafts (note_id, content, news_angle, model, telegram_message_id, status)
    values (${noteId}, ${content}, ${newsAngle}, ${model}, ${sent.message_id}, 'pending')
  `;

  await sql`update notes set status = 'drafted' where id = ${noteId}`;
}
