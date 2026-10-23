import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Type } from '@google/genai';
import { getGeminiClient, CANDIDATE_MODELS } from '../lib/gemini.js';
import { getLanguage } from '../lib/languages.js';

// Translates the narration lines (and on-screen titles) of a video into another language. Every line keeps its id,
// so each translated line still belongs to the photo it was written for. There is deliberately NO fake fallback:
// if the AI is unavailable the caller gets an error and the user's existing text is left untouched.
export const config = { maxDuration: 60 };

const GEMINI_BUDGET_MS = 40_000;
const MAX_ITEMS = 24;

interface Item {
  id: string;
  text: string;
}

const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      }
    );
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const body = (req.body || {}) as { language?: string; lines?: Item[]; titles?: Item[] };
    const lang = getLanguage(body.language);

    const lines: Item[] = (Array.isArray(body.lines) ? body.lines : [])
      .slice(0, MAX_ITEMS)
      .map((l, i) => ({ id: clean(l?.id, 80) || `line-${i}`, text: clean(l?.text, 600) }))
      .filter((l) => l.text);
    const titles: Item[] = (Array.isArray(body.titles) ? body.titles : [])
      .slice(0, MAX_ITEMS)
      .map((t, i) => ({ id: clean(t?.id, 80) || `title-${i}`, text: clean(t?.text, 120) }))
      .filter((t) => t.text);

    if (lines.length === 0) {
      return res.status(400).json({ success: false, error: 'There is no narration to translate yet.' });
    }

    const ai = getGeminiClient();
    if (!ai) {
      return res.status(503).json({ success: false, error: 'Translation is temporarily unavailable. Please try again later.' });
    }

    const prompt = `Translate the voiceover lines and on-screen titles of a short marketing video into ${lang.ai}.

RULES:
- Translate the meaning naturally, the way a fluent native speaker would say it aloud in a marketing video. Do not translate word for word.
- Keep each line about the same spoken length as the original.
- Keep brand names, property or product names, numbers, prices, phone numbers and website addresses exactly. A website is spoken the way it is read in ${lang.ai}.
- Titles stay short (2-4 words), in a style suitable for on-screen text.
- No markdown, emojis, brackets or notes.
- For every item return its "id" exactly as given, the translation in "text", and "meaning": a plain English version of the translation so the business owner can check it.
- Return exactly ${lines.length} "lines" and ${titles.length} "titles", in the same order.

LINES:
${lines.map((l) => `[${l.id}] ${l.text}`).join('\n')}

TITLES:
${titles.length ? titles.map((t) => `[${t.id}] ${t.text}`).join('\n') : '(none)'}`;

    const itemSchema = {
      type: Type.OBJECT,
      properties: { id: { type: Type.STRING }, text: { type: Type.STRING }, meaning: { type: Type.STRING } },
      required: ['id', 'text', 'meaning'],
    };

    const started = Date.now();
    let responseText = '';
    for (const modelName of CANDIDATE_MODELS) {
      const remaining = GEMINI_BUDGET_MS - (Date.now() - started);
      if (remaining < 4000) break;
      try {
        const response = await withTimeout(
          ai.models.generateContent({
            model: modelName,
            contents: prompt,
            config: {
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  lines: { type: Type.ARRAY, items: itemSchema },
                  titles: { type: Type.ARRAY, items: itemSchema },
                },
                required: ['lines', 'titles'],
              },
            },
          }),
          remaining
        );
        if (response.text) {
          responseText = response.text;
          break;
        }
      } catch (e: any) {
        console.info(`Translation model ${modelName} unavailable (${String(e?.message || e).slice(0, 80)}), trying next...`);
      }
    }

    if (!responseText) {
      return res.status(503).json({ success: false, error: 'Translation is temporarily unavailable. Please try again later.' });
    }

    let parsed: any;
    try {
      parsed = JSON.parse(responseText.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim());
    } catch {
      return res.status(502).json({ success: false, error: 'The translation could not be read. Please try again.' });
    }

    // Match by id (falling back to position) and refuse a result that is missing any line: a half-translated video is worse than none
    const match = (src: Item[], got: any[], i: number) => got.find((g: any) => g?.id === src[i].id) ?? got[i];
    const outLines = lines.map((l, i) => {
      const hit = match(lines, Array.isArray(parsed?.lines) ? parsed.lines : [], i);
      return { id: l.id, line: clean(hit?.text, 700), meaning: clean(hit?.meaning, 700) };
    });
    if (outLines.some((l) => !l.line)) {
      return res.status(502).json({ success: false, error: 'The translation came back incomplete. Please try again.' });
    }
    const outTitles = titles.map((t, i) => {
      const hit = match(titles, Array.isArray(parsed?.titles) ? parsed.titles : [], i);
      return { id: t.id, text: clean(hit?.text, 140) || t.text };
    });

    return res.status(200).json({ success: true, language: lang.code, lines: outLines, titles: outTitles });
  } catch (err: any) {
    console.error('Translation error:', err);
    return res.status(500).json({ success: false, error: 'Could not translate. Please try again.' });
  }
}
