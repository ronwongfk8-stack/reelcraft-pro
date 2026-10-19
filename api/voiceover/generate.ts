import type { VercelRequest, VercelResponse } from '@vercel/node';
import { synthesizeGeminiVoiceover } from '../../lib/geminiTts.js';

const MAX_TEXT_LENGTH = 5000;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { text, voiceId, gender, tone } = req.body || {};

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
    const result = await synthesizeGeminiVoiceover({
      text: text.trim(),
      voice: {
        id: voiceId || '',
        gender,
        tone: typeof tone === 'string' && tone ? tone : 'natural, clear',
      },
    });

    res.status(200).json({ success: true, audioBase64: result.audioBase64, mimeType: result.mimeType });
  } catch (err: any) {
    console.error('Voiceover generation failed:', err.message);
    const isConfigError = err.message?.includes('not configured');
    // Error details only reach the browser when DEBUG_TTS=1 is set in Vercel's environment variables
    // (turn it on temporarily when investigating, then remove it - stack traces shouldn't be public).
    const debug = process.env.DEBUG_TTS === '1';
    res.status(isConfigError ? 503 : 500).json({
      success: false,
      error: debug || isConfigError ? err.message || 'Unable to generate voiceover.' : 'Unable to generate voiceover right now. Please try again in a moment.',
      ...(debug ? { debugStack: err.stack } : {}),
    });
  }
}
