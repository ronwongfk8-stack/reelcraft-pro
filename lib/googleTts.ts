// Maps our 7 internal narration personas to real Google Cloud TTS voices.
//
// For en-US specifically, we use named Neural2 voices to give each persona a
// genuinely distinct character. Google's exact voice catalog can change over
// time and isn't something we can verify live from this server, so every
// named-voice request has a graceful fallback baked in below: if Google
// rejects a specific voice name (e.g. it's been renamed/retired), we
// automatically retry using just gender + language, which Google always
// accepts. The feature can't hard-fail because of a stale voice name.
const EN_US_VOICE_NAMES: Record<string, string> = {
  'male-marcus': 'en-US-Neural2-A',
  'male-james': 'en-US-Neural2-D',
  'male-ethan': 'en-US-Neural2-I',
  'male-david': 'en-US-Neural2-J',
  'female-victoria': 'en-US-Neural2-C',
  'female-emma': 'en-US-Neural2-F',
  'female-sophia': 'en-US-Neural2-G',
};

export interface VoicePersona {
  id: string;
  gender: 'male' | 'female';
  pitch: number; // our internal 0.5–2.0 scale, tuned originally for browser SpeechSynthesis
  rate: number; // our internal 0.5–2.0 scale
}

interface SynthesizeParams {
  text: string;
  voice: VoicePersona;
  languageCode: string;
}

interface SynthesizeResult {
  audioBase64: string;
  mimeType: string;
}

// Converts our internal 0.5–2.0 pitch scale to Google's semitone scale
// (-20.0 to 20.0), centered so 1.0 → 0 semitones (no shift).
function toGooglePitch(internalPitch: number): number {
  const semitones = Math.log2(internalPitch) * 12;
  return Math.max(-20, Math.min(20, semitones));
}

// Google's speakingRate range is 0.25–4.0, close enough to our 0.5–2.0 scale
// that we can pass it through directly with clamping.
function toGoogleRate(internalRate: number): number {
  return Math.max(0.25, Math.min(4.0, internalRate));
}

type GoogleTtsCallResult =
  | { ok: true; audioBase64: string }
  | { ok: false; status: number; message: string };

async function callGoogleTts(
  apiKey: string,
  languageCode: string,
  voiceSelector: { name?: string; ssmlGender: 'MALE' | 'FEMALE' },
  text: string,
  pitch: number,
  speakingRate: number
): Promise<GoogleTtsCallResult> {
  const res = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      input: { text },
      voice: {
        languageCode,
        ...(voiceSelector.name ? { name: voiceSelector.name } : {}),
        ssmlGender: voiceSelector.ssmlGender,
      },
      audioConfig: {
        audioEncoding: 'MP3',
        pitch,
        speakingRate,
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    return { ok: false, status: res.status, message: body };
  }

  const data = (await res.json()) as { audioContent?: string };
  if (!data.audioContent) {
    return { ok: false, status: 502, message: 'Google TTS returned no audio content.' };
  }
  return { ok: true, audioBase64: data.audioContent };
}

export async function synthesizeVoiceover({
  text,
  voice,
  languageCode,
}: SynthesizeParams): Promise<SynthesizeResult> {
  const apiKey = process.env.GOOGLE_CLOUD_TTS_API_KEY;
  if (!apiKey) {
    throw new Error('Voiceover generation is not configured on this server (missing GOOGLE_CLOUD_TTS_API_KEY).');
  }

  const ssmlGender = voice.gender === 'male' ? 'MALE' : 'FEMALE';
  const pitch = toGooglePitch(voice.pitch);
  const speakingRate = toGoogleRate(voice.rate);
  const namedVoice = languageCode === 'en-US' ? EN_US_VOICE_NAMES[voice.id] : undefined;

  // First attempt: named voice for extra character (en-US personas only).
  if (namedVoice) {
    const attempt = await callGoogleTts(apiKey, languageCode, { name: namedVoice, ssmlGender }, text, pitch, speakingRate);
    if (attempt.ok) {
      return { audioBase64: attempt.audioBase64, mimeType: 'audio/mpeg' };
    }
    // Explicit cast: this project's tsconfig doesn't have `strict` enabled,
    // which weakens TypeScript's discriminated-union narrowing here even
    // after the early return above — the runtime logic is correct (attempt
    // can only be the failure variant at this point), TS just needs help.
    const failedAttempt = attempt as { ok: false; status: number; message: string };
    console.warn(
      `Google TTS rejected named voice "${namedVoice}" (${failedAttempt.status}): ${failedAttempt.message.slice(0, 200)}. Falling back to gender-only selection.`
    );
  }

  // Fallback (and default path for every non-en-US language): let Google
  // pick an appropriate voice for the language + gender. This always works
  // as long as the language code itself is one Google supports.
  const fallback = await callGoogleTts(apiKey, languageCode, { ssmlGender }, text, pitch, speakingRate);
  if (fallback.ok) {
    return { audioBase64: fallback.audioBase64, mimeType: 'audio/mpeg' };
  }
  const failedFallback = fallback as { ok: false; status: number; message: string };
  throw new Error(`Google TTS request failed (${failedFallback.status}): ${failedFallback.message.slice(0, 300)}`);
}
