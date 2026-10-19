import { MALE_VOICES, FEMALE_VOICES } from '../../data/voiceData';
/**
 * Web Audio Engine with Studio-Grade Dynamics Limiter, Anti-Distortion Gain Staging,
 * Native Natural Speech Narration, and Procedural Sound Design.
 */

function splitForTts(text: string, max = 500): string[] {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return [];
  const sentences = clean.match(/[^.!?]+[.!?]+["')\]]*|[^.!?]+$/g) || [clean];
  const out: string[] = [];
  let cur = '';
  const push = () => {
    if (cur.trim()) out.push(cur.trim());
    cur = '';
  };
  for (const raw of sentences) {
    let sentence = raw.trim();
    while (sentence.length > max) {
      // very long sentence: break on the last space before the limit
      let cut = sentence.lastIndexOf(' ', max);
      if (cut < max * 0.5) cut = max;
      if (cur) push();
      out.push(sentence.slice(0, cut).trim());
      sentence = sentence.slice(cut).trim();
    }
    if ((cur + ' ' + sentence).trim().length > max) push();
    cur = (cur + ' ' + sentence).trim();
  }
  push();
  return out;
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function readWav(bytes: Uint8Array): { pcm: Uint8Array; sampleRate: number } {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let sampleRate = 24000;
  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const id = String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]);
    const size = dv.getUint32(offset + 4, true);
    if (id === 'fmt ') sampleRate = dv.getUint32(offset + 12, true);
    if (id === 'data') return { pcm: bytes.subarray(offset + 8, Math.min(bytes.length, offset + 8 + size)), sampleRate };
    offset += 8 + size + (size % 2);
  }
  throw new Error('The voice service returned audio in an unexpected format.');
}

function buildWav(pcm: Uint8Array, sampleRate: number): ArrayBuffer {
  const header = new ArrayBuffer(44);
  const dv = new DataView(header);
  const writeStr = (o: number, str: string) => [...str].forEach((c, i) => dv.setUint8(o + i, c.charCodeAt(0)));
  writeStr(0, 'RIFF');
  dv.setUint32(4, 36 + pcm.length, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  dv.setUint32(16, 16, true);
  dv.setUint16(20, 1, true);
  dv.setUint16(22, 1, true);
  dv.setUint32(24, sampleRate, true);
  dv.setUint32(28, sampleRate * 2, true);
  dv.setUint16(32, 2, true);
  dv.setUint16(34, 16, true);
  writeStr(36, 'data');
  dv.setUint32(40, pcm.length, true);
  const out = new Uint8Array(44 + pcm.length);
  out.set(new Uint8Array(header), 0);
  out.set(pcm, 44);
  return out.buffer;
}

class WebAudioEngine {
  private ctx: AudioContext | null = null;
  private musicAudioEl: HTMLAudioElement | null = null;
  private voiceAudioEl: HTMLAudioElement | null = null;

  private musicSourceNode: MediaElementAudioSourceNode | null = null;
  private voiceSourceNode: MediaElementAudioSourceNode | null = null;

  private musicGainNode: GainNode | null = null;
  private voiceGainNode: GainNode | null = null;
  private sfxGainNode: GainNode | null = null;
  private masterGainNode: GainNode | null = null;
  private compressorNode: DynamicsCompressorNode | null = null;

  private destinationStreamNode: MediaStreamAudioDestinationNode | null = null;

  // Procedural BGM generator state
  private isProceduralPlaying = false;
  private proceduralIntervalId: any = null;
  private activeProceduralOscillators: OscillatorNode[] = [];

  // Native Speech Synthesis Narration State
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private isNativeSpeechSpeaking = false;
  private activeScriptText = '';
  private activeVoicePersona = 'Puck';

  // Volume state tracking
  private currentVoiceVolume = 0.85;
  private currentVoiceMuted = false;
  private currentMusicVolume = 0.35;
  private currentMusicMuted = false;

  // Active synchronized caption tracking for voiceover
  private lastSpokenCaptionId: string | null = null;

  public init() {
    if (this.ctx) return;
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    this.ctx = new AudioContextClass();

    // Headroom-calibrated master bus (0.82 to avoid inter-sample peaks)
    this.masterGainNode = this.ctx.createGain();
    this.masterGainNode.gain.value = 0.82;

    this.musicGainNode = this.ctx.createGain();
    this.musicGainNode.gain.value = 0.35; // Bed volume

    this.voiceGainNode = this.ctx.createGain();
    this.voiceGainNode.gain.value = 0.85;

    this.sfxGainNode = this.ctx.createGain();
    this.sfxGainNode.gain.value = 0.25;

    this.musicGainNode.connect(this.masterGainNode);
    this.voiceGainNode.connect(this.masterGainNode);
    this.sfxGainNode.connect(this.masterGainNode);

    // Studio-grade Brickwall Dynamics Limiter / Compressor to guarantee ZERO digital clipping
    this.compressorNode = this.ctx.createDynamicsCompressor();
    this.compressorNode.threshold.setValueAtTime(-6, this.ctx.currentTime); // Gentle ceiling at -6dB
    this.compressorNode.knee.setValueAtTime(10, this.ctx.currentTime);
    this.compressorNode.ratio.setValueAtTime(12, this.ctx.currentTime);
    this.compressorNode.attack.setValueAtTime(0.003, this.ctx.currentTime);
    this.compressorNode.release.setValueAtTime(0.08, this.ctx.currentTime);

    this.destinationStreamNode = this.ctx.createMediaStreamDestination();

    this.masterGainNode.connect(this.compressorNode);
    this.compressorNode.connect(this.ctx.destination);
    this.compressorNode.connect(this.destinationStreamNode);
  }

  public getAudioStreamDestination(): MediaStreamAudioDestinationNode | null {
    this.init();
    return this.destinationStreamNode;
  }

  public ensureResume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // --- Voiceover Track ---
  public setVoiceoverAudio(url: string | null, volume = 0.85, muted = false) {
    this.init();
    if (!url) {
      if (this.voiceAudioEl) {
        this.voiceAudioEl.pause();
        this.voiceAudioEl.src = '';
      }
      return;
    }

    if (!this.voiceAudioEl) {
      this.voiceAudioEl = new Audio();
      this.voiceAudioEl.preload = 'auto';

      if (this.ctx && this.voiceGainNode) {
        try {
          this.voiceSourceNode = this.ctx.createMediaElementSource(this.voiceAudioEl);
          this.voiceSourceNode.connect(this.voiceGainNode);
        } catch (e) {
          // If already connected
        }
      }
    }

    if (this.voiceAudioEl.src !== url) {
      this.voiceAudioEl.src = url;
      this.voiceAudioEl.load();
    }

    this.setVoiceoverVolume(volume, muted);
  }

  public setVoiceoverVolume(volume: number, muted = false) {
    this.currentVoiceVolume = volume;
    this.currentVoiceMuted = muted;
    const vol = muted ? 0 : Math.max(0, Math.min(1.0, volume));
    if (this.voiceGainNode && this.ctx) {
      this.voiceGainNode.gain.setValueAtTime(vol, this.ctx.currentTime);
    }
    if (this.voiceAudioEl) {
      // level is controlled by voiceGainNode; setting element.volume too would square the attenuation
      this.voiceAudioEl.volume = 1;
      this.voiceAudioEl.muted = muted;
    }
  }

  // --- Music Track ---
  public setMusicAudio(url: string | null, volume = 0.35, muted = false) {
    this.init();
    if (!this.ctx) return;

    if (!url) {
      if (this.musicAudioEl) {
        this.musicAudioEl.pause();
        this.musicAudioEl.src = '';
      }
      return;
    }

    if (!this.musicAudioEl) {
      this.musicAudioEl = new Audio();
      this.musicAudioEl.loop = true;
      this.musicSourceNode = this.ctx.createMediaElementSource(this.musicAudioEl);
      this.musicSourceNode.connect(this.musicGainNode!);
    }

    const absolute = new URL(url, window.location.href).href;
    if (this.musicAudioEl.src !== absolute) {
      this.musicAudioEl.src = url;
    }
    this.setMusicVolume(volume, muted);
  }

  public setMusicVolume(volume: number, muted = false) {
    // syncPlayback calls this every tick; only touch the gain when the setting really changed,
    // otherwise it keeps overriding the ducking ramp and the music "pumps".
    const changed = volume !== this.currentMusicVolume || muted !== this.currentMusicMuted;
    this.currentMusicVolume = volume;
    this.currentMusicMuted = muted;
    const vol = muted ? 0 : Math.max(0, Math.min(1.0, volume));
    if (changed && this.musicGainNode && this.ctx) {
      this.musicGainNode.gain.setValueAtTime(vol, this.ctx.currentTime);
    }
    if (this.musicAudioEl) {
      this.musicAudioEl.volume = 1;
      this.musicAudioEl.muted = muted;
    }
  }

  // --- Dynamic Auto Ducking (Anti-Collision) ---
  public applyAutoDucking(isVoiceActive: boolean, baseVolume?: number, duckAmount = 0.25) {
    if (!this.musicGainNode || !this.ctx) return;
    const effectiveBase = baseVolume !== undefined ? baseVolume : this.currentMusicVolume;
    if (this.currentMusicMuted) {
      this.musicGainNode.gain.setValueAtTime(0, this.ctx.currentTime);
      return;
    }
    const target = isVoiceActive ? Math.max(0.03, effectiveBase * duckAmount) : effectiveBase;
    this.musicGainNode.gain.setTargetAtTime(target, this.ctx.currentTime, 0.12);
  }

  public isVoiceSpeaking(): boolean {
    return this.isNativeSpeechSpeaking || (!!this.voiceAudioEl && !this.voiceAudioEl.paused && !this.voiceAudioEl.ended);
  }

  // --- Native Human Speech Synthesis Integration ---
  public setSpeechNarrationScript(script: string, persona = 'Puck') {
    this.activeScriptText = script;
    this.activeVoicePersona = persona;
  }

  private getBestVoiceForPersona(persona: string): SpeechSynthesisVoice | null {
    if (typeof window === 'undefined' || !window.speechSynthesis) return null;
    const voices = window.speechSynthesis.getVoices();
    if (!voices || voices.length === 0) {
      // Voices load asynchronously in Chrome/Safari - warm the list for next time
      window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
      return null;
    }

    const p = persona.toLowerCase();
    const enVoices = voices.filter((v) => v.lang.startsWith('en'));

    if (p === 'kore') {
      return (
        enVoices.find((v) => v.name.includes('Female') || v.name.includes('Samantha') || v.name.includes('Zira') || v.name.includes('Victoria')) ||
        enVoices[0] ||
        voices[0]
      );
    }
    if (p === 'charon') {
      return (
        enVoices.find((v) => v.name.includes('David') || v.name.includes('Daniel') || v.name.includes('Alex') || v.name.includes('Male')) ||
        enVoices[0] ||
        voices[0]
      );
    }
    // Puck / Zephyr / Fenrir: prefer neural/online voices, which sound far less robotic
    return (
      enVoices.find((v) => /natural|neural|premium|enhanced/i.test(v.name)) ||
      enVoices.find((v) => v.name.includes('Google') || v.name.includes('Online')) ||
      enVoices[0] ||
      voices[0]
    );
  }

  public playNativeSpeech(text: string, persona = 'Puck', volume?: number, windowSeconds?: number) {
    if (typeof window === 'undefined' || !window.speechSynthesis || !text) return;
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    const voice = this.getBestVoiceForPersona(persona);
    if (voice) utterance.voice = voice;

    const p = persona.toLowerCase();
    if (p === 'charon') {
      utterance.pitch = 0.82;
      utterance.rate = 0.92;
    } else if (p === 'kore') {
      utterance.pitch = 1.05;
      utterance.rate = 0.96;
    } else if (p === 'fenrir') {
      utterance.pitch = 0.85;
      utterance.rate = 0.94;
    } else {
      utterance.pitch = 1.0;
      utterance.rate = 1.02;
    }

    if (windowSeconds && windowSeconds > 0.5) {
      // Fit the line into its caption window so the next line doesn't cut it off
      const est = (text.split(/\s+/).length * 0.4) / utterance.rate;
      utterance.rate = Math.max(0.85, Math.min(1.35, utterance.rate * (est / windowSeconds)));
    }

    const effectiveVol = this.currentVoiceMuted
      ? 0
      : volume !== undefined
      ? volume
      : this.currentVoiceVolume;
    utterance.volume = Math.max(0, Math.min(1.0, effectiveVol));

    utterance.onstart = () => {
      this.isNativeSpeechSpeaking = true;
      this.applyAutoDucking(true, this.currentMusicVolume, 0.25);
    };

    utterance.onend = () => {
      this.isNativeSpeechSpeaking = false;
      this.applyAutoDucking(false, this.currentMusicVolume, 0.25);
    };

    utterance.onerror = () => {
      this.isNativeSpeechSpeaking = false;
      this.applyAutoDucking(false, this.currentMusicVolume, 0.25);
    };

    this.currentUtterance = utterance;
    window.speechSynthesis.speak(utterance);
  }

  public stopNativeSpeech() {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      this.isNativeSpeechSpeaking = false;
      this.applyAutoDucking(false, this.currentMusicVolume, 0.25);
    }
  }

  // --- Synchronized Playback Seek & Play/Pause ---
  public syncPlayback(
    time: number,
    isPlaying: boolean,
    voiceoverUrl: string | null,
    musicUrl: string | null,
    proceduralPreset?: string,
    useNativeSpeech = false,
    transcriptText?: string,
    voicePersona = 'Puck',
    voiceVolume = 0.85,
    voiceMuted = false,
    musicVolume = 0.35,
    musicMuted = false,
    autoDuck = true,
    duckAmount = 0.25,
    activeCaptionId?: string | null,
    activeCaptionText?: string | null,
    activeCaptionDuration?: number
  ) {
    this.ensureResume();

    // Reset spoken state if scrubbed back to beginning
    if (time < 0.2) {
      if (this.lastSpokenCaptionId && this.lastSpokenCaptionId !== activeCaptionId) {
        this.lastSpokenCaptionId = null;
      }
    }

    // Sync volume settings immediately
    this.setVoiceoverVolume(voiceVolume, voiceMuted);
    this.setMusicVolume(musicVolume, musicMuted);

    // 1. Audio File Voiceover (Uploaded or Gemini Studio WAV)
    if (voiceoverUrl) {
      this.stopNativeSpeech();
      if (!this.voiceAudioEl || this.voiceAudioEl.src !== voiceoverUrl) {
        this.setVoiceoverAudio(voiceoverUrl, voiceVolume, voiceMuted);
      }

      if (this.voiceAudioEl) {
        const dur = this.voiceAudioEl.duration || 999;
        if (Math.abs(this.voiceAudioEl.currentTime - time) > 0.35) {
          if (this.voiceAudioEl.readyState >= 1) {
            try {
              this.voiceAudioEl.currentTime = Math.max(0, Math.min(dur - 0.05, time));
            } catch (e) {}
          }
        }

        if (isPlaying && this.voiceAudioEl.paused && time < dur) {
          this.voiceAudioEl.play().catch(() => {});
        } else if ((!isPlaying || time >= dur) && !this.voiceAudioEl.paused) {
          this.voiceAudioEl.pause();
        }

        // Apply auto-ducking based on voice playback
        if (autoDuck) {
          const isVoicePlaying = !this.voiceAudioEl.paused && !this.voiceAudioEl.ended && time < dur;
          this.applyAutoDucking(isVoicePlaying && isPlaying, musicVolume, duckAmount);
        }
      }
    } else {
      if (this.voiceAudioEl && !this.voiceAudioEl.paused) {
        this.voiceAudioEl.pause();
      }
      this.stopNativeSpeech();
      this.lastSpokenCaptionId = null;
    }

    // 3. Music Track
    if (musicUrl && this.musicAudioEl) {
      if (Math.abs(this.musicAudioEl.currentTime - (time % (this.musicAudioEl.duration || 60))) > 0.4) {
        this.musicAudioEl.currentTime = time % (this.musicAudioEl.duration || 60);
      }
      if (isPlaying && this.musicAudioEl.paused) {
        this.musicAudioEl.play().catch(() => {});
      } else if (!isPlaying && !this.musicAudioEl.paused) {
        this.musicAudioEl.pause();
      }
    } else if (!musicUrl && proceduralPreset) {
      if (isPlaying && !this.isProceduralPlaying) {
        this.startProceduralMusic(proceduralPreset);
      } else if (!isPlaying && this.isProceduralPlaying) {
        this.stopProceduralMusic();
      }
    }
  }

  // --- Voiceover Generator: your existing /api/voiceover/generate (Gemini TTS) ---
  // Long scripts are split into short chunks so each response stays well under Vercel's ~4.5 MB response limit,
  // then the WAV pieces are stitched together in the browser. If Gemini fails this THROWS - there is deliberately
  // no robotic browser-voice fallback.
  public async generateVoiceoverAudio(
    text: string,
    voiceId = 'male-marcus'
  ): Promise<{ url: string; duration: number; blob: Blob }> {
    const voice = [...MALE_VOICES, ...FEMALE_VOICES].find((v) => v.id === voiceId) || MALE_VOICES[1];
    const chunks = splitForTts(text, 500);
    if (chunks.length === 0) throw new Error('Please enter a narration script first.');

    const pcmParts: Uint8Array[] = [];
    let sampleRate = 24000;

    for (const chunk of chunks) {
      let data: any = null;
      let lastError = '';
      for (let attempt = 0; attempt < 2 && !data; attempt++) {
        try {
          const res = await fetch('/api/voiceover/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: chunk, voiceId: voice.id, gender: voice.gender, tone: voice.tone }),
          });
          const json = await res.json().catch(() => null);
          if (res.ok && json?.success && json.audioBase64) {
            data = json;
          } else {
            lastError = json?.error || `Voice service returned ${res.status}`;
            if (res.status < 500 && res.status !== 429) break; // not worth retrying (bad request etc.)
          }
        } catch (e: any) {
          lastError = e?.message || 'Network error while generating the voiceover.';
        }
      }
      if (!data) throw new Error(lastError || 'Voice generation failed.');
      const parsed = readWav(base64ToBytes(data.audioBase64));
      sampleRate = parsed.sampleRate;
      pcmParts.push(parsed.pcm);
    }

    const total = pcmParts.reduce((n, p) => n + p.length, 0);
    const pcm = new Uint8Array(total);
    let offset = 0;
    for (const p of pcmParts) {
      pcm.set(p, offset);
      offset += p.length;
    }
    const blob = new Blob([buildWav(pcm, sampleRate)], { type: 'audio/wav' });
    return { url: URL.createObjectURL(blob), duration: total / (sampleRate * 2), blob };
  }

  public pauseAll() {
    if (this.voiceAudioEl) this.voiceAudioEl.pause();
    if (this.musicAudioEl) this.musicAudioEl.pause();
    this.stopNativeSpeech();
    this.stopProceduralMusic();
    this.lastSpokenCaptionId = null;
  }

  // --- Anti-Distortion Clean Sound Effects ---
  public playTransitionSfx(type: string, volume = 0.25) {
    this.init();
    if (!this.ctx || !this.sfxGainNode) return;
    this.ensureResume();

    const t = this.ctx.currentTime;
    const safeVol = Math.max(0.05, Math.min(0.35, volume));
    const sfxGain = this.ctx.createGain();
    sfxGain.gain.setValueAtTime(safeVol, t);
    sfxGain.connect(this.sfxGainNode);

    if (type.includes('whip') || type.includes('slide')) {
      this.playCleanWhoosh(t, sfxGain);
    } else if (type.includes('glitch')) {
      this.playCleanChirp(t, sfxGain);
    } else if (type.includes('zoom')) {
      this.playCleanRiser(t, sfxGain);
    } else {
      this.playCleanChime(t, sfxGain);
    }
  }

  private playCleanWhoosh(t: number, outGain: GainNode) {
    if (!this.ctx) return;
    const bufferSize = Math.floor(this.ctx.sampleRate * 0.35);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    // Highpass filter to eliminate mud and distortion
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 1.8;
    filter.frequency.setValueAtTime(400, t);
    filter.frequency.exponentialRampToValueAtTime(2200, t + 0.15);
    filter.frequency.exponentialRampToValueAtTime(300, t + 0.35);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.25, t + 0.15);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(outGain);

    noise.start(t);
    noise.stop(t + 0.35);
  }

  private playCleanChirp(t: number, outGain: GainNode) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine'; // Pure sine, zero harsh sawtooth clipping
    osc.frequency.setValueAtTime(650, t);
    osc.frequency.exponentialRampToValueAtTime(1400, t + 0.08);
    osc.frequency.exponentialRampToValueAtTime(800, t + 0.16);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.15, t + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);

    osc.connect(gain);
    gain.connect(outGain);
    osc.start(t);
    osc.stop(t + 0.16);
  }

  private playCleanRiser(t: number, outGain: GainNode) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(90, t);
    osc.frequency.exponentialRampToValueAtTime(280, t + 0.2);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.2, t + 0.15);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);

    osc.connect(gain);
    gain.connect(outGain);
    osc.start(t);
    osc.stop(t + 0.25);
  }

  private playCleanChime(t: number, outGain: GainNode) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, t);
    osc.frequency.exponentialRampToValueAtTime(330, t + 0.15);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.12, t + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);

    osc.connect(gain);
    gain.connect(outGain);
    osc.start(t);
    osc.stop(t + 0.15);
  }

  // --- Clean Ambient Procedural Background Music ---
  public startProceduralMusic(preset = 'cinematic-epic') {
    this.stopProceduralMusic();
    this.init();
    if (!this.ctx || !this.musicGainNode) return;
    this.isProceduralPlaying = true;

    const chordsMap: Record<string, number[][]> = {
      'cinematic-epic': [
        [130.81, 164.81, 196.00], // C major
        [110.00, 146.83, 174.61], // A minor
        [87.31, 130.81, 174.61],  // F major
        [98.00, 146.83, 196.00],  // G major
      ],
      'lofi-chill': [
        [146.83, 174.61, 220.00], // Dm
        [196.00, 246.94, 293.66], // G
        [130.81, 164.81, 196.00], // C
        [110.00, 130.81, 164.81], // Am
      ],
      'upbeat-tech': [
        [130.81, 196.00, 261.63],
        [146.83, 220.00, 293.66],
        [174.61, 261.63, 349.23],
        [196.00, 293.66, 392.00],
      ],
    };

    const chords = chordsMap[preset] || chordsMap['cinematic-epic'];
    let chordIdx = 0;

    const playChordStep = () => {
      if (!this.isProceduralPlaying || !this.ctx || !this.musicGainNode) return;
      const t = this.ctx.currentTime;
      const notes = chords[chordIdx % chords.length];
      chordIdx++;

      notes.forEach((freq, i) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        osc.type = 'sine'; // Pure smooth sines, no harsh triangle harmonics
        osc.frequency.setValueAtTime(freq, t);

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(900, t);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.linearRampToValueAtTime(0.04 / (i + 1), t + 0.5); // Soft gentle level
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 2.7);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.musicGainNode!);

        osc.start(t);
        osc.stop(t + 2.75);

        this.activeProceduralOscillators.push(osc);
        osc.onended = () => {
          this.activeProceduralOscillators = this.activeProceduralOscillators.filter((o) => o !== osc);
        };
      });
    };

    playChordStep();
    this.proceduralIntervalId = setInterval(playChordStep, 2600);
  }

  public stopProceduralMusic() {
    this.isProceduralPlaying = false;
    if (this.proceduralIntervalId) {
      clearInterval(this.proceduralIntervalId);
      this.proceduralIntervalId = null;
    }
    // Immediately stop all lingering oscillators to prevent audio accumulation distortion
    this.activeProceduralOscillators.forEach((osc) => {
      try {
        osc.stop();
      } catch (e) {}
    });
    this.activeProceduralOscillators = [];
  }

  // --- Voiceover Microphone Recorder ---
  public async startMicrophoneRecording(
    onDataAvailable: (blob: Blob) => void,
    onAudioLevel?: (level: number) => void
  ): Promise<{ stop: () => void }> {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recMime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find((m) => MediaRecorder.isTypeSupported(m));
    const mediaRecorder = new MediaRecorder(stream, recMime ? { mimeType: recMime } : undefined);
    const chunks: Blob[] = [];

    let meterInterval: any = null;
    if (onAudioLevel) {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      meterInterval = setInterval(() => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
        const avg = sum / dataArray.length;
        onAudioLevel(Math.min(1, avg / 80));
      }, 50);
    }

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    mediaRecorder.start(250);

    return {
      stop: () => {
        if (meterInterval) clearInterval(meterInterval);
        mediaRecorder.onstop = () => {
          const finalBlob = new Blob(chunks, { type: mediaRecorder.mimeType || 'audio/webm' });
          stream.getTracks().forEach((track) => track.stop());
          onDataAvailable(finalBlob);
        };
        if (mediaRecorder.state !== 'inactive') {
          mediaRecorder.stop();
        }
      },
    };
  }
}

export const audioEngine = new WebAudioEngine();
