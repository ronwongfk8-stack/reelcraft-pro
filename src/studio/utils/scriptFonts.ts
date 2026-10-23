// On-video text in Chinese, Japanese, Korean, Arabic, Thai, Hindi or Tamil needs a font that actually contains
// those letters. Canvas text cannot wait for fonts, so we load the right Noto Sans family for whatever scripts are
// present *before* the frame is drawn, then redraw. Only the scripts in use are downloaded.

const FAMILIES: { name: string; google: string; test: RegExp }[] = [
  { name: 'Noto Sans SC', google: 'Noto+Sans+SC', test: /[\u3400-\u9FFF\uF900-\uFAFF]/ },
  { name: 'Noto Sans TC', google: 'Noto+Sans+TC', test: /[\u3400-\u9FFF\uF900-\uFAFF]/ },
  { name: 'Noto Sans JP', google: 'Noto+Sans+JP', test: /[\u3040-\u30FF]/ },
  { name: 'Noto Sans KR', google: 'Noto+Sans+KR', test: /[\uAC00-\uD7AF\u1100-\u11FF]/ },
  { name: 'Noto Sans Arabic', google: 'Noto+Sans+Arabic', test: /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/ },
  { name: 'Noto Sans Thai', google: 'Noto+Sans+Thai', test: /[\u0E00-\u0E7F]/ },
  { name: 'Noto Sans Devanagari', google: 'Noto+Sans+Devanagari', test: /[\u0900-\u097F]/ },
  { name: 'Noto Sans Tamil', google: 'Noto+Sans+Tamil', test: /[\u0B80-\u0BFF]/ },
];

/** Appended to every canvas font stack; fonts that are not loaded are simply skipped by the browser. */
export const SCRIPT_FALLBACK_STACK = FAMILIES.map((f) => `"${f.name}"`).join(', ');

const GENERIC = /^(serif|sans-serif|monospace|cursive|fantasy|system-ui)$/i;

/** Puts the script fonts before the final generic family, e.g. `Impact, sans-serif` -> `Impact, "Noto…", sans-serif`. */
export function withScriptFonts(stack: string): string {
  const parts = stack.split(',').map((s) => s.trim());
  const last = parts[parts.length - 1];
  if (GENERIC.test(last)) parts.splice(parts.length - 1, 0, SCRIPT_FALLBACK_STACK);
  else parts.push(SCRIPT_FALLBACK_STACK);
  return parts.join(', ');
}

export const isRtlText = (text: string) => /[\u0590-\u05FF\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/.test(text);

const linked = new Set<string>();

/** Which font families this text needs (empty for plain Latin / Cyrillic text). */
export function familiesForText(text: string): string[] {
  return FAMILIES.filter((f) => f.test.test(text)).map((f) => f.name);
}

/**
 * Loads the fonts needed to draw `text`. Resolves true if anything new was loaded (so the caller can redraw).
 * Never rejects: if a font can't be fetched the browser's own fallback font is used instead.
 */
export async function ensureFontsForText(text: string): Promise<boolean> {
  if (typeof document === 'undefined') return false;
  const needed = FAMILIES.filter((f) => f.test.test(text));
  if (needed.length === 0) return false;

  let loadedSomething = false;
  for (const fam of needed) {
    if (!linked.has(fam.name)) {
      linked.add(fam.name);
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = `https://fonts.googleapis.com/css2?family=${fam.google}:wght@700&display=swap`;
      document.head.appendChild(link);
      loadedSomething = true;
    }
  }

  const fontSet: any = (document as any).fonts;
  if (!fontSet?.load) return loadedSomething;
  try {
    await Promise.race([
      Promise.all(needed.map((f) => fontSet.load(`700 36px "${f.name}"`, text))),
      new Promise((resolve) => setTimeout(resolve, 8000)),
    ]);
    return true;
  } catch {
    return loadedSomething;
  }
}
