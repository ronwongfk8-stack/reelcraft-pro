import type { VercelRequest, VercelResponse } from '@vercel/node';
import { synthesizeGeminiVoiceover } from '../../lib/geminiTts.js';
import { getLanguage, isEnglish } from '../../lib/languages.js';

// Gemini speech can take a few seconds per request; allow time for a retry
export const config = { maxDuration: 60 };

const MAX_TEXT_LENGTH = 5000;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { text, voiceId, gender, tone, language } = req.body || {};

  if (!text || typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ success: false, error: 'text is required' });
  }
  if (text.length > MAX_TEXT_LENGTH) {
    return res.status(400).json({
      success: false,
      error: `Script is too long (${text.length} characters). Please keep it under ${MAX_TEXT_LENGTH} characters.`,
    });
  }
  if (gender !== 'male' && gender !== 'female') {
    return res.status(400).json({ success: false, error: 'gender must be "male" or "female"' });
  }

  try {
    // Only languages on our own list are used (anything else is ignored), so nothing from the browser reaches the prompt
    const lang = getLanguage(language);
    const result = await synthesizeGeminiVoiceover({
      language: isEnglish(lang.code) ? undefined : lang.ai,
      text: text.trim(),
      voice: {
        id: voiceId || '',
        gender,
        tone: typeof tone === 'string' && tone ? tone : 'natural, clear',
      },
    });

    res.status(200).json({ success: true, audioBase64: result.audioBase64, mimeType: result.mimeType });
  } catch (err: any) {
    // The full error always goes to the Vercel function logs...
    console.error('Voiceover generation failed:', err?.message);
    // ...while the browser gets a short, specific, safe reason (details only with DEBUG_TTS=1).
    const { status, code, message } = classifyTtsError(String(err?.message || ''));
    const debug = process.env.DEBUG_TTS === '1';
    res.status(status).json({
      success: false,
      code,
      error: message,
      ...(debug ? { debugMessage: err?.message, debugStack: err?.stack } : {}),
    });
  }
}

const UNAVAILABLE = 'AI voiceover is temporarily unavailable. Please try again later.';

// Customers only ever see short, safe messages. Billing / key / model problems are the owner's to fix, so they get
// a neutral line here and the full detail in the Vercel logs (or in the response when DEBUG_TTS=1).
function classifyTtsError(msg: string): { status: number; code: string; message: string } {
  if (/not configured|missing GEMINI_API_KEY/i.test(msg)) {
    return { status: 503, code: 'no_key', message: UNAVAILABLE };
  }
  if (/spending cap|spend cap|billing/i.test(msg)) {
    // a monthly cap does not clear by waiting a minute, so tell the client not to keep retrying
    return { status: 503, code: 'spend_cap', message: UNAVAILABLE };
  }
  if (/429|RESOURCE_EXHAUSTED|quota|rate.?limit/i.test(msg)) {
    return { status: 429, code: 'quota', message: 'The voice service is busy right now. Please wait a minute and try again.' };
  }
  if (/API key|API_KEY_INVALID|PERMISSION_DENIED|\b401\b|\b403\b|UNAUTHENTICATED/i.test(msg)) {
    return { status: 503, code: 'key', message: UNAVAILABLE };
  }
  if (/\b404\b|NOT_FOUND|not found|is not supported|deprecated|retired/i.test(msg)) {
    return { status: 503, code: 'model', message: UNAVAILABLE };
  }
  if (/no audio data/i.test(msg)) {
    return { status: 502, code: 'no_audio', message: 'The voice service returned no audio for this text. Try again, or reword the line.' };
  }
  if (/\b400\b|INVALID_ARGUMENT/i.test(msg)) {
    return { status: 502, code: 'rejected', message: 'The voice service rejected this text or voice setting.' };
  }
  return { status: 500, code: 'unknown', message: 'Unable to generate voiceover right now. Please try again in a moment.' };
}
