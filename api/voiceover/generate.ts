import type { VercelRequest, VercelResponse } from '@vercel/node';
import { synthesizeVoiceover } from '../../lib/googleTts.js';

const MAX_TEXT_LENGTH = 5000; // Google Cloud TTS's own per-request character limit

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { text, voiceId, gender, pitch, rate, languageCode } = req.body || {};

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
    const result = await synthesizeVoiceover({
      text: text.trim(),
      voice: {
        id: voiceId || '',
        gender,
        pitch: typeof pitch === 'number' ? pitch : 1.0,
        rate: typeof rate === 'number' ? rate : 1.0,
      },
      languageCode: languageCode || 'en-US',
    });

    res.status(200).json({ success: true, audioBase64: result.audioBase64, mimeType: result.mimeType });
  } catch (err: any) {
    console.error('Voiceover generation failed:', err.message);
    const isConfigError = err.message?.includes('not configured');
    res.status(isConfigError ? 503 : 500).json({
      success: false,
      error: isConfigError ? err.message : 'Unable to generate voiceover. Please try again.',
    });
  }
}
