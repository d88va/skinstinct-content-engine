const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-flash-latest';

function endpoint(model: string) {
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
}

export type ScoreResult = {
  pass: boolean;
  score: number;
  reason: string;
  keywords: string[];
};

const SCORING_SYSTEM_PROMPT = `You are the content-scoring gate for Skinstinct, a formulation-science-led skincare brand founded by Meera Pillai, a former pharmaceutical formulation professional. Notes arrive as raw, unpolished ideas the founder sends herself via Telegram.

PASS a note if it contains at least one of: a specific technical detail (an ingredient, mechanism, pH value, concentration, study, or formulation fact), a concrete number or data point, a specific anecdote or customer/industry example, or a clear contrarian/transparency angle about the skincare industry.

REJECT a note if it is: vague or generic ("skincare is important", "our products work"), pure marketing language with no substance, too short to extract a real angle from, or unrelated to skincare/formulation/the brand.

Score from 0-10 on substance and specificity. Notes scoring 6 or higher should pass. Keep the reason to one sentence.`;

export async function scoreNote(rawText: string): Promise<ScoreResult> {
  const body = {
    systemInstruction: { parts: [{ text: SCORING_SYSTEM_PROMPT }] },
    contents: [{ role: 'user', parts: [{ text: rawText }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: {
          pass: { type: 'BOOLEAN' },
          score: { type: 'NUMBER' },
          reason: { type: 'STRING' },
          keywords: { type: 'ARRAY', items: { type: 'STRING' } },
        },
        required: ['pass', 'score', 'reason', 'keywords'],
      },
    },
  };

  const res = await fetch(endpoint(GEMINI_MODEL), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`Gemini scoring failed: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error(`Gemini scoring returned no content: ${JSON.stringify(data)}`);
  }
  return JSON.parse(text) as ScoreResult;
}

// Uses Gemini's built-in google_search grounding tool — no separate news API key needed.
// Gated by ENABLE_NEWS_ANGLE so it's easy to switch off.
export async function findNewsAngle(rawText: string, keywords: string[]): Promise<string | null> {
  if (process.env.ENABLE_NEWS_ANGLE !== 'true') return null;

  const body = {
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: `Find one recent, real news story, study, or industry development relevant to this skincare note and its topic keywords. If nothing genuinely relevant and recent exists, respond with exactly "NONE". Otherwise respond with 2-3 sentences describing the angle and why it connects.\n\nNote: ${rawText}\n\nKeywords: ${keywords.join(', ')}`,
          },
        ],
      },
    ],
    tools: [{ google_search: {} }],
  };

  try {
    const res = await fetch(endpoint(GEMINI_MODEL), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      console.error(`Gemini news angle failed: ${res.status} ${await res.text()}`);
      return null;
    }

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!text || text === 'NONE') return null;
    return text;
  } catch (err) {
    console.error('Gemini news angle lookup threw', err);
    return null;
  }
}

export async function draftWithGemini(systemPrompt: string, userPrompt: string): Promise<string> {
  const body = {
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
  };

  const res = await fetch(endpoint(GEMINI_MODEL), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`Gemini drafting failed: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error(`Gemini drafting returned no content: ${JSON.stringify(data)}`);
  }
  return text.trim();
}
