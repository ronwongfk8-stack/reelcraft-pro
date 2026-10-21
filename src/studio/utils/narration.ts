import { CaptionSegment, MediaItem, TimelineClip } from '../types';
import { factsToPairs } from '../data/industryForms';

export const MAX_NARRATION_SCENES = 24;

/** Changes whenever the photos/clips are added, removed or reordered. */
export const clipSignature = (clips: TimelineClip[]): string => clips.map((c) => c.id).join('|');

const loadWithTimeout = <T,>(start: (resolve: (v: T) => void, reject: (e: any) => void) => void, ms: number): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    start(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      }
    );
  });

/** A small JPEG of what this scene shows (for the AI to look at). Returns null if it can't be read. */
export async function captureThumbnail(item: MediaItem, trimStart = 0, maxSide = 512): Promise<string | null> {
  try {
    let source: CanvasImageSource;
    let w = 0;
    let h = 0;

    if (item.type === 'video') {
      const video = document.createElement('video');
      video.muted = true;
      (video as any).playsInline = true;
      video.preload = 'auto';
      video.crossOrigin = 'anonymous';
      await loadWithTimeout<void>((res, rej) => {
        video.onloadeddata = () => res();
        video.onerror = () => rej(new Error('video'));
        video.src = item.url;
      }, 8000);
      const target = Math.min(Math.max(0, trimStart) + 0.5, Math.max(0, (video.duration || 1) - 0.1));
      await loadWithTimeout<void>((res, rej) => {
        video.onseeked = () => res();
        video.onerror = () => rej(new Error('seek'));
        video.currentTime = target;
      }, 5000);
      source = video;
      w = video.videoWidth;
      h = video.videoHeight;
    } else {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      await loadWithTimeout<void>((res, rej) => {
        img.onload = () => res();
        img.onerror = () => rej(new Error('image'));
        img.src = item.url;
      }, 10000);
      source = img;
      w = img.naturalWidth;
      h = img.naturalHeight;
    }

    if (!w || !h) return null;
    const scale = Math.min(1, maxSide / Math.max(w, h));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(w * scale));
    canvas.height = Math.max(1, Math.round(h * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.7);
  } catch {
    return null; // cross-origin image, unreadable video, timeout... the AI then relies on the facts and file name
  }
}

export interface NarrationRequestScene {
  id: string;
  name: string;
  image: string | null;
}

export interface WrittenScene {
  id: string;
  sees: string;
  line: string;
}

export async function requestNarration(params: {
  industry: string;
  facts: Record<string, string>;
  scenes: NarrationRequestScene[];
}): Promise<{ scenes: WrittenScene[]; source: 'gemini' | 'basic' }> {
  const res = await fetch('/api/generate-narration', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      industry: params.industry,
      facts: factsToPairs(params.industry, params.facts),
      scenes: params.scenes,
    }),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.success || !Array.isArray(json.scenes)) {
    throw new Error(json?.error || `The writing service returned ${res.status}.`);
  }
  return { scenes: json.scenes, source: json.source === 'gemini' ? 'gemini' : 'basic' };
}

/** Breaks one spoken line into short on-screen caption phrases, timed in proportion to their length. */
export function splitCaptionPhrases(line: string, start: number, duration: number, idPrefix: string): CaptionSegment[] {
  const words = line.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  if (words.length === 0) return [];

  const MAX_WORDS = 7;
  const phrases: string[] = [];
  let cur: string[] = [];
  for (const word of words) {
    cur.push(word);
    const endsClause = /[,;:.!?]$/.test(word);
    if (cur.length >= MAX_WORDS || (endsClause && cur.length >= 3)) {
      phrases.push(cur.join(' '));
      cur = [];
    }
  }
  if (cur.length) {
    // don't leave a one-word orphan at the end
    if (cur.length === 1 && phrases.length > 0) phrases[phrases.length - 1] += ' ' + cur[0];
    else phrases.push(cur.join(' '));
  }

  const totalChars = phrases.reduce((n, p) => n + p.length, 0) || 1;
  let t = start;
  return phrases.map((text, i) => {
    const span = (text.length / totalChars) * duration;
    const seg: CaptionSegment = {
      id: `${idPrefix}-${i}`,
      startTime: Number(t.toFixed(2)),
      endTime: Number((i === phrases.length - 1 ? start + duration : t + span).toFixed(2)),
      text,
    };
    t += span;
    return seg;
  });
}
