import { GoogleGenAI } from '@google/genai';

export function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export const CANDIDATE_MODELS = ['gemini-3.5-flash', 'gemini-3.7-flash', 'gemini-3.5-pro', 'gemini-2.5-flash'];
