import { GoogleGenAI } from '@google/genai';

// Gemini's native TTS model only offers 5 prebuilt voices, so our 7
// personas map onto them (2 of the 4 male voices and 2 of the 3 female
// voices share an underlying Gemini voice, differentiated instead by the
// style instruction below).
const GEMINI_VOICE_MAP: Record<string, string> = {
  'male-marcus': 'Puck',
  'male-james': 'Charon',
  'male-ethan': 'Fenrir',
  'male-david': 'Puck',
  'female-sophia': 'Aoede',
  'female-emma': 'Kore',
  'female-victoria': 'Kore',
};

const DEFAULT_MALE_VOICE = 'Puck';
const DEFAULT_FEMALE_VOICE = 'Aoede';

export interface GeminiVoicePersona {
  id: string;
  gender: 'male' | 'female';
  tone: string; // e.g. "Warm Mid Baritone" — used as a style instruction, since
  // Gemini's native TTS doesn't expose numeric pitch/rate controls the way
  // Cloud TTS does. Instead, style is steered through a short natural-
  // language instruction prepended to the text, which the model uses to
  // shape delivery without speaking the instruction itself out loud.
}

interface SynthesizeParams {
  text: string;
  voice: GeminiVoicePersona;
  /** e.g. "Simplified Chinese (Mandarin, simplified characters)". Left out for English, so English output is unchanged. */
  language?: string;
}

interface SynthesizeResult {
  audioBase64: string; // WAV, base64-encoded
  mimeType: string;
}

// Wraps raw PCM bytes (as returned by Gemini's audio model) in a standard
// 44-byte WAV header, since raw PCM has no self-describing format info and
// isn't directly playable by <audio>/AudioContext.decodeAudioData without
// one. Gemini's TTS output is 24kHz, 16-bit signed, mono.
function pcmToWav(pcmData: Buffer, sampleRate = 24000, channels = 1, bitsPerSample = 16): Buffer {
  const byteRate = (sampleRate * channels * bitsPerSample) / 8;
  const blockAlign = (channels * bitsPerSample) / 8;
  const dataSize = pcmData.length;
  const header = Buffer.alloc(44);

  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16); // fmt chunk size
  header.writeUInt16LE(1, 20); // PCM format
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcmData]);
}

const DEFAULT_TTS_MODEL = 'models/gemini-2.5-flash-preview-tts';

// Remembered for the lifetime of a warm server instance
let workingModel: string | null = null;
let discoveredModels: string[] | null = null;

// Messages Google uses when a model name does not exist / is retired / is not supported for this call
const MODEL_MISSING = /\b404\b|NOT_FOUND|not found|is not supported|no longer available|deprecated|retired|unsupported model/i;

/** Asks Google which models this API key can use and keeps the text-to-speech ones (flash first, stable before preview). */
async function discoverTtsModels(ai: GoogleGenAI): Promise<string[]> {
  if (discoveredModels) return discoveredModels;
  const found: string[] = [];
  try {
    const pager: any = await (ai.models as any).list({ config: { pageSize: 100 } });
    for await (const m of pager) {
      const name: string = m?.name || '';
      if (/tts/i.test(name) && !/live|native-audio|dialog/i.test(name)) found.push(name);
    }
  } catch (e: any) {
    console.error('Could not list Gemini models:', String(e?.message || e).slice(0, 200));
  }
  const score = (n: string) => (/flash/i.test(n) ? 0 : 2) + (/preview/i.test(n) ? 1 : 0);
  found.sort((x, y) => score(x) - score(y));
  console.info('Discovered TTS models:', found.join(', ') || '(none)');
  discoveredModels = found;
  return found;
}

export async function synthesizeGeminiVoiceover({ text, voice, language }: SynthesizeParams): Promise<SynthesizeResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Voiceover generation is not configured on this server (missing GEMINI_API_KEY).');
  }

  const voiceName =
    GEMINI_VOICE_MAP[voice.id] || (voice.gender === 'male' ? DEFAULT_MALE_VOICE : DEFAULT_FEMALE_VOICE);

  const ai = new GoogleGenAI({ apiKey });

  // Style instruction as a natural-language prefix — this is Gemini's
  // documented mechanism for steering delivery (tone, pace, energy) since
  // there's no separate numeric pitch/rate parameter. The model performs
  // only the instructed speech, it doesn't read the instruction aloud.
  // For other languages the language is named too, which keeps pronunciation and script (e.g. Simplified vs
  // Traditional Chinese) right even when the text alone is ambiguous.
  const styledText = language
    ? `Say the following in ${language}, in a ${voice.tone.toLowerCase()} voice: ${text}`
    : `Say the following in a ${voice.tone.toLowerCase()} voice: ${text}`;

  // Which TTS model to use: an override from the environment (GEMINI_TTS_MODEL), then the model this app was built
  // with. Preview models get renamed or retired over time, so if Google reports the model as missing we look up
  // which TTS models this API key can actually use and try those instead (and remember the one that works).
  const configured = [process.env.GEMINI_TTS_MODEL, DEFAULT_TTS_MODEL].filter((m): m is string => !!m);
  const tried = new Set<string>();
  let inlineData: { data?: string; mimeType?: string } | undefined;
  let lastError: Error | null = null;

  const attemptModel = async (model: string): Promise<'ok' | 'missing' | 'failed'> => {
    tried.add(model);
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: [{ parts: [{ text: styledText }] }],
          config: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName },
              },
            },
          },
        } as any);

        const parts: any[] = (response as any)?.candidates?.[0]?.content?.parts || [];
        inlineData = parts.find((p) => p?.inlineData?.data)?.inlineData;
        if (inlineData?.data) {
          workingModel = model;
          return 'ok';
        }
        const reason = (response as any)?.candidates?.[0]?.finishReason;
        lastError = new Error(`Gemini TTS returned no audio data${reason ? ` (finishReason: ${reason})` : ''}.`);
      } catch (err: any) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (MODEL_MISSING.test(lastError.message)) return 'missing';
        // 429 means "slow down": waiting a few hundred ms won't help, so don't burn the request budget on it
        if (/429|RESOURCE_EXHAUSTED/i.test(lastError.message)) return 'failed';
        if (!/500|503|UNAVAILABLE|INTERNAL|fetch failed|timeout/i.test(lastError.message)) return 'failed';
      }
      if (attempt < 3) await new Promise((r) => setTimeout(r, 600 * attempt));
    }
    return 'failed';
  };

  const order = workingModel ? [workingModel, ...configured.filter((m) => m !== workingModel)] : configured;
  let needDiscovery = false;
  for (const model of order) {
    const outcome = await attemptModel(model);
    if (outcome === 'ok') break;
    if (outcome === 'missing') needDiscovery = true;
    if (outcome === 'failed') break; // a real error (quota, key, outage): another model won't fix that
  }

  if (!inlineData?.data && needDiscovery) {
    for (const model of await discoverTtsModels(ai)) {
      if (tried.has(model)) continue;
      const outcome = await attemptModel(model);
      if (outcome === 'ok' || outcome === 'failed') break;
    }
  }

  const base64Pcm = inlineData?.data;

  if (!base64Pcm) {
    throw lastError || new Error('Gemini TTS returned no audio data.');
  }

  const pcmBuffer = Buffer.from(base64Pcm, 'base64');
  const rateMatch = /rate=(\d+)/i.exec(inlineData?.mimeType || '');
  const wavBuffer = pcmToWav(pcmBuffer, rateMatch ? parseInt(rateMatch[1], 10) : 24000);

  return {
    audioBase64: wavBuffer.toString('base64'),
    mimeType: 'audio/wav',
  };
}
