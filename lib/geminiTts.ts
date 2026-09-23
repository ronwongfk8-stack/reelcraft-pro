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

export async function synthesizeGeminiVoiceover({ text, voice }: SynthesizeParams): Promise<SynthesizeResult> {
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
  const styledText = `Say the following in a ${voice.tone.toLowerCase()} voice: ${text}`;

  const response = await ai.models.generateContent({
    model: 'models/gemini-2.5-flash-preview-tts',
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

  const inlineData = (response as any)?.candidates?.[0]?.content?.parts?.[0]?.inlineData;
  const base64Pcm = inlineData?.data;

  if (!base64Pcm) {
    throw new Error('Gemini TTS returned no audio data.');
  }

  const pcmBuffer = Buffer.from(base64Pcm, 'base64');
  const wavBuffer = pcmToWav(pcmBuffer);

  return {
    audioBase64: wavBuffer.toString('base64'),
    mimeType: 'audio/wav',
  };
}
