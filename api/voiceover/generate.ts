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
    // TEMPORARY: surfacing the real error message to the client for
    // debugging, since Vercel's log dashboard hasn't been showing it
    // reliably. Revert this to the generic message once the root cause is
    // found — error details shouldn't normally reach the client.
    res.status(isConfigError ? 503 : 500).json({
      success: false,
      error: err.message || 'Unable to generate voiceover. Please try again.',
      debugStack: err.stack,
    });
  }
}
