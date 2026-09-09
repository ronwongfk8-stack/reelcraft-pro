import { NarrationVoice } from '../data/voiceData';

// Defensive no-op safety net: cancels any browser SpeechSynthesis utterance
// that might be running for any reason. The app no longer triggers browser
// TTS itself (voice preview and generation both use real Google Cloud TTS
// now), but this is cheap insurance to keep around.
export const stopSpeechSample = () => {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
};

// Generates a real voiceover audio track via the backend's Google Cloud TTS
// endpoint. Replaces the old approach (a raw oscillator faking the *rhythm*
// of speech, not actual words) with genuine synthesized speech, matching
// what the live preview and the exported video will both actually sound
// like — no more mismatch between what you hear while editing and what
// ends up in the download.
export const generateAiVoiceoverAudioBlob = async (
  text: string,
  voice: NarrationVoice,
  languageCode: string
): Promise<{ url: string; duration: number }> => {
  const res = await fetch('/api/voiceover/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text,
      voiceId: voice.id,
      gender: voice.gender,
      pitch: voice.pitch,
      rate: voice.rate,
      languageCode,
    }),
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Unable to generate voiceover. Please try again.');
  }

  // Convert the base64 MP3 the backend returns into a playable Blob URL.
  const byteChars = atob(data.audioBase64);
  const byteNumbers = new Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) {
    byteNumbers[i] = byteChars.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: data.mimeType || 'audio/mpeg' });
  const url = URL.createObjectURL(blob);

  // Decode once here to get the real duration — this also confirms the
  // audio decodes correctly up front, before it's relied on later during
  // live playback or export.
  const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  let duration = 0;
  try {
    const arrayBuffer = await blob.arrayBuffer();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    duration = audioBuffer.duration;
  } finally {
    audioCtx.close();
  }

  return { url, duration };
};
