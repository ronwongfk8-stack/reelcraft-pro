/**
 * Web Audio API Synth & Audio Envelope Manager
 * Generates ambient music, applies Volume + Fade In / Fade Out curves, and routes to Canvas MediaRecorder.
 */

import { MUSIC_PRESETS } from '../data/sampleAssets';

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private bufferCache: Map<string, AudioBuffer> = new Map();

  public initContext(): AudioContext {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public getContext(): AudioContext | null {
    return this.ctx;
  }

  /**
   * Decode an audio file from an Object URL or remote URL into an AudioBuffer
   */
  public async decodeAudioUrl(url: string): Promise<AudioBuffer | null> {
    try {
      const ctx = this.initContext();
      if (this.bufferCache.has(url)) {
        return this.bufferCache.get(url)!;
      }
      const resp = await fetch(url);
      const arrayBuffer = await resp.arrayBuffer();
      const decodedBuffer = await ctx.decodeAudioData(arrayBuffer);
      this.bufferCache.set(url, decodedBuffer);
      return decodedBuffer;
    } catch (e) {
      console.warn('Failed to decode audio URL:', e);
      return null;
    }
  }

  /**
   * Resolves a music preset to its real bundled audio file. All current
   * presets have a fileUrl; this returns null if a preset somehow has none,
   * rather than falling back to a synth generator (removed — every track in
   * the app is now a real recording, not a procedurally generated one).
   */
  public async resolvePresetMusicBuffer(presetId: string, _durationSeconds: number): Promise<AudioBuffer | null> {
    const preset = MUSIC_PRESETS.find((p) => p.id === presetId);
    if (preset?.fileUrl) {
      return this.decodeAudioUrl(preset.fileUrl);
    }
    console.warn(`Music preset "${presetId}" has no fileUrl — no audio available.`);
    return null;
  }

  /**
   * Apply real-time volume immediately to a GainNode with smooth micro-ramp to eliminate audio clicks
   */
  public setLiveGain(gainNode: GainNode, targetVolume: number, isMuted: boolean = false) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const val = isMuted ? 0 : Math.max(0, Math.min(targetVolume, 1.5));
    gainNode.gain.cancelScheduledValues(now);
    gainNode.gain.setTargetAtTime(val, now, 0.03);
  }

  /**
   * Schedule precise Volume and Fade In / Fade Out gain envelopes
   * Guarantees total silence at video completion when not looping
   * Synchronizes precisely with video speed adjustments (e.g. 0.5x slow motion)
   */
  public applyAudioEnvelope(
    gainNode: GainNode,
    targetVolume: number, // 0 to 1.5
    fadeInSeconds: number,
    fadeOutSeconds: number,
    totalDurationSeconds: number,
    currentTimeSeconds: number = 0,
    isLooping: boolean = false,
    speedMultiplier: number = 1.0
  ) {
    if (!this.ctx) return;
    
    const now = this.ctx.currentTime;
    const gain = gainNode.gain;

    gain.cancelScheduledValues(now);

    const safeSpeed = Math.max(0.1, speedMultiplier || 1.0);
    const safeTargetVol = Math.max(0, Math.min(targetVolume, 1.5));
    const safeFadeIn = Math.min(fadeInSeconds, totalDurationSeconds / 2);
    const safeFadeOut = Math.min(fadeOutSeconds, totalDurationSeconds / 2);

    // Initial value at current playback moment
    if (currentTimeSeconds <= safeFadeIn && safeFadeIn > 0) {
      // We are in fade-in zone
      const initialVal = (currentTimeSeconds / safeFadeIn) * safeTargetVol;
      gain.setValueAtTime(initialVal, now);
      const remainingFadeIn = (safeFadeIn - currentTimeSeconds) / safeSpeed;
      gain.linearRampToValueAtTime(safeTargetVol, now + remainingFadeIn);
    } else {
      gain.setValueAtTime(safeTargetVol, now);
    }

    // Schedule Fade-out & Hard Video End Sync in real-time seconds
    const remainingVideoTime = Math.max(0, (totalDurationSeconds - currentTimeSeconds) / safeSpeed);
    const videoEndTime = now + remainingVideoTime;
    const fadeOutDurationReal = Math.min(safeFadeOut, remainingVideoTime / 2);

    if (!isLooping) {
      if (fadeOutDurationReal > 0 && remainingVideoTime > 0.1) {
        const fadeOutStartTime = now + Math.max(0, remainingVideoTime - fadeOutDurationReal);
        gain.setValueAtTime(safeTargetVol, fadeOutStartTime);
        gain.linearRampToValueAtTime(0.00001, videoEndTime);
      }
      // Guarantee zero sound immediately when video ends
      gain.setValueAtTime(0, videoEndTime);
    } else if (fadeOutDurationReal > 0 && remainingVideoTime > 0.1) {
      const fadeOutStartTime = now + Math.max(0, remainingVideoTime - fadeOutDurationReal);
      gain.setValueAtTime(safeTargetVol, fadeOutStartTime);
      gain.linearRampToValueAtTime(0.0001, videoEndTime);
    }
  }
}

export const audioEngine = new AudioEngine();
