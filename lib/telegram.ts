const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

function apiUrl(method: string) {
  return `https://api.telegram.org/bot${BOT_TOKEN}/${method}`;
}

export type TelegramMessage = {
  message_id: number;
  chat: { id: number };
  text?: string;
  reply_to_message?: { message_id: number };
};

export type TelegramUpdate = {
  update_id: number;
  message?: TelegramMessage;
  channel_post?: TelegramMessage;
};

// Channel posts arrive as update.channel_post, not update.message.
// A webhook that only checks update.message silently ignores every real note.
export function extractMessage(update: TelegramUpdate): TelegramMessage | undefined {
  return update.channel_post || update.message;
}

export async function sendTelegramMessage(
  chatId: number | string,
  text: string,
  replyToMessageId?: number
): Promise<{ message_id: number }> {
  const res = await fetch(apiUrl('sendMessage'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      reply_to_message_id: replyToMessageId,
    }),
  });

  const data = await res.json();
  if (!data.ok) {
    throw new Error(`Telegram sendMessage failed: ${JSON.stringify(data)}`);
  }
  return data.result as { message_id: number };
}
