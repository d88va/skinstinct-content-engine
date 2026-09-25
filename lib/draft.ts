import { sql } from './db';
import { draftWithGemini } from './gemini';
import { draftWithClaude } from './anthropic';

async function buildVoicePrompt(): Promise<string> {
  const { rows } = await sql`select source, category, content from voice_skill`;

  const examples = rows
    .map((row) => `--- ${row.source} (${row.category ?? 'uncategorized'}) ---\n${row.content}`)
    .join('\n\n');

  return `You are writing a LinkedIn post draft in the voice of Meera Pillai, founder of Skinstinct, a formulation-science-led skincare brand. Match her voice exactly based on the examples below: direct, first-person, precise, evidence-led, comfortable admitting uncertainty or things the brand hasn't solved yet, structured argumentation that builds to a specific practical point, no hype language, no exclamation points, no generic skincare marketing phrases ("skin-loving", "glow up", etc). She opens directly on the substance with no greeting, and closes with a concrete, actionable takeaway or an honest reflection rather than a call-to-action or sales pitch.

VOICE EXAMPLES:
${examples}

Write ONE new LinkedIn post based on the founder's raw note below. Do not use hashtags or emojis. Keep it in the same register and length range as the examples (roughly 300-600 words). Output only the post text, nothing else — no preamble, no title.`;
}

export async function generateDraft(
  rawText: string,
  newsAngle: string | null
): Promise<{ content: string; model: string }> {
  const systemPrompt = await buildVoicePrompt();
  const draftModel = (process.env.DRAFT_MODEL || 'gemini').toLowerCase();

  let userPrompt = `Founder's raw note:\n${rawText}`;
  if (newsAngle) {
    userPrompt += `\n\nRelevant current angle to optionally weave in if it fits naturally (skip it if it would feel forced):\n${newsAngle}`;
  }

  const content =
    draftModel === 'claude'
      ? await draftWithClaude(systemPrompt, userPrompt)
      : await draftWithGemini(systemPrompt, userPrompt);

  return { content, model: draftModel };
}
