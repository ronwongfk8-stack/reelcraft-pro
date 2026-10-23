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
  /** English version of `line`, for checking a language you may not read */
  meaning?: string;
}

export async function requestNarration(params: {
  industry: string;
  facts: Record<string, string>;
  scenes: NarrationRequestScene[];
  language?: string;
}): Promise<{ scenes: WrittenScene[]; source: 'gemini' | 'basic' }> {
  const res = await fetch('/api/generate-narration', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      industry: params.industry,
      facts: factsToPairs(params.industry, params.facts),
      scenes: params.scenes,
      language: params.language,
    }),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.success || !Array.isArray(json.scenes)) {
    throw new Error(json?.error || `The writing service returned ${res.status}.`);
  }
  return { scenes: json.scenes, source: json.source === 'gemini' ? 'gemini' : 'basic' };
}

export async function requestTranslation(params: {
  language: string;
  lines: { id: string; text: string }[];
  titles: { id: string; text: string }[];
}): Promise<{ lines: { id: string; line: string; meaning: string }[]; titles: { id: string; text: string }[] }> {
  const res = await fetch('/api/translate-narration', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.success || !Array.isArray(json.lines)) {
    throw new Error(json?.error || `The translation service returned ${res.status}.`);
  }
  return { lines: json.lines, titles: Array.isArray(json.titles) ? json.titles : [] };
}

const CLAUSE_END = /[,;:.!?，。！？；：、]$/;

/**
 * Breaks one spoken line into short on-screen caption phrases, timed in proportion to their length.
 * Works for languages written with spaces (English, Malay, Korean, Arabic...) and without (Chinese, Japanese, Thai).
 */
export function splitCaptionPhrases(line: string, start: number, duration: number, idPrefix: string): CaptionSegment[] {
  const text = line.replace(/\s+/g, ' ').trim();
  if (!text) return [];

  let phrases: string[] = [];
  // Chinese / Japanese / Thai have no spaces between words (a "word" is a whole clause), so they are cut by length
  const needsCharBudget = /[\u3040-\u30FF\u3400-\u9FFF\u0E00-\u0E7F]/.test(text);

  if (!needsCharBudget) {
    // Latin, Cyrillic, Arabic, Hindi, Tamil, Korean... : words are separated by spaces
    const MAX_WORDS = /[\uAC00-\uD7AF]/.test(text) ? 5 : 7;
    let cur: string[] = [];
    for (const word of text.split(' ')) {
      cur.push(word);
      if (cur.length >= MAX_WORDS || (CLAUSE_END.test(word) && cur.length >= 3)) {
        phrases.push(cur.join(' '));
        cur = [];
      }
    }
    if (cur.length) {
      // don't leave a one-word orphan at the end
      if (cur.length === 1 && phrases.length > 0) phrases[phrases.length - 1] += ' ' + cur[0];
      else phrases.push(cur.join(' '));
    }
  } else {
    const MAX_CHARS = /[\u0E00-\u0E7F]/.test(text) ? 26 : 14;
    const SLACK = 4; // a phrase may run a little long to end on punctuation instead of mid-sentence
    const Seg: any = typeof Intl !== 'undefined' ? (Intl as any).Segmenter : undefined;
    const hasScript = (c: string) => /[\u3040-\u30FF\u3400-\u9FFF\u0E00-\u0E7F]/.test(c);

    // tokens: whole chunks for spaced words, dictionary words for unspaced scripts, spaces kept so the text is preserved
    const tokens: string[] = [];
    text.split(/(\s+)/).forEach((chunk) => {
      if (!chunk) return;
      if (!/\s/.test(chunk) && hasScript(chunk) && chunk.length > 1) {
        let parts: string[] = Array.from(chunk);
        if (Seg) {
          try {
            const segs = Array.from(new Seg(undefined, { granularity: 'word' }).segment(chunk)).map((x: any) => x.segment as string);
            if (segs.length > 0) parts = segs;
          } catch {
            /* single characters */
          }
        }
        tokens.push(...parts);
      } else {
        tokens.push(chunk);
      }
    });

    let cur = '';
    for (let i = 0; i < tokens.length; i++) {
      const tok = tokens[i];
      cur += tok;
      const trimmed = cur.trim();
      if (CLAUSE_END.test(tok.trim()) && trimmed.length >= 4) {
        phrases.push(trimmed);
        cur = '';
      } else if (trimmed.length >= MAX_CHARS) {
        let look = '';
        let found = false;
        for (let j = i + 1; j < tokens.length && look.length + tokens[j].length <= SLACK; j++) {
          look += tokens[j];
          if (CLAUSE_END.test(tokens[j].trim())) {
            found = true;
            break;
          }
        }
        if (!found) {
          phrases.push(trimmed);
          cur = '';
        }
      }
    }
    const rest = cur.trim();
    if (rest) {
      if (rest.length <= 2 && phrases.length > 0) phrases[phrases.length - 1] += rest;
      else phrases.push(rest);
    }
  }

  const totalChars = phrases.reduce((n, p) => n + p.length, 0) || 1;
  let t = start;
  return phrases.map((p, i) => {
    const span = (p.length / totalChars) * duration;
    const seg: CaptionSegment = {
      id: `${idPrefix}-${i}`,
      startTime: Number(t.toFixed(2)),
      endTime: Number((i === phrases.length - 1 ? start + duration : t + span).toFixed(2)),
      text: p,
    };
    t += span;
    return seg;
  });
}
