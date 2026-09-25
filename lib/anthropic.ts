const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5';

export async function draftWithClaude(systemPrompt: string, userPrompt: string): Promise<string> {
  if (!ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not set but DRAFT_MODEL=claude');
  }

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });

  if (!res.ok) {
    throw new Error(`Claude drafting failed: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  const text = data.content?.[0]?.text;
  if (!text) {
    throw new Error(`Claude drafting returned no content: ${JSON.stringify(data)}`);
  }
  return text.trim();
}
