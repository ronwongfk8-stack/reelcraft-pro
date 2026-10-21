import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Type } from '@google/genai';
import { getGeminiClient, CANDIDATE_MODELS } from '../lib/gemini.js';

// Gemini looks at every scene's picture and writes ONE narration line per scene, so what is said always matches
// what is on screen. Time-boxed so the function always answers (with a basic draft) instead of timing out.
export const config = { maxDuration: 60 };

const GEMINI_BUDGET_MS = 40_000;
const MAX_SCENES = 24;
const MAX_IMAGE_CHARS = 450_000; // ~340 KB of JPEG per scene

interface SceneIn {
  id: string;
  name: string;
  image: string | null;
}
interface Fact {
  label: string;
  value: string;
}
interface SceneOut {
  id: string;
  sees: string;
  line: string;
}

const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then(
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
}

/** Used when there is no API key / Gemini fails: simple lines built only from the facts (no picture understanding). */
function basicNarration(scenes: SceneIn[], facts: Fact[]): SceneOut[] {
  const find = (re: RegExp) => facts.find((f) => re.test(f.label))?.value;
  const name = find(/name|model|title|product|piece|restaurant|hotel|tour/i);
  const place = find(/location|dealership|destination|boutique|brand|store/i);
  const price = find(/price|rate|offer/i);
  const website = find(/website/i);
  const contact = find(/contact/i);
  const details = facts.filter((f) => !/name|model|title|product|piece|restaurant|hotel|tour|location|dealership|destination|boutique|brand|store|price|rate|offer|website|contact/i.test(f.label));

  return scenes.map((s, i) => {
    let line: string;
    if (i === 0) {
      line = `Welcome to ${name || 'our showcase'}${place ? ` in ${place}` : ''}.`;
    } else if (i === scenes.length - 1) {
      line = `${price ? `Available at ${price}. ` : ''}${website ? `Visit ${website}. ` : ''}${contact ? `Contact ${contact} today.` : 'Contact us today to find out more.'}`;
    } else {
      const d = details[(i - 1) % Math.max(1, details.length)];
      line = d ? `${d.label}: ${d.value}.` : 'Take a closer look at the details.';
    }
    return { id: s.id, sees: '', line };
  });
}

// POST /api/generate-narration
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = (req.body || {}) as { industry?: string; facts?: Fact[]; scenes?: SceneIn[] };

    const industry = clean(body.industry, 60) || 'Marketing';
    const facts: Fact[] = (Array.isArray(body.facts) ? body.facts : [])
      .slice(0, 24)
      .map((f) => ({ label: clean(f?.label, 40), value: clean(f?.value, 300) }))
      .filter((f) => f.label && f.value);

    const rawScenes = Array.isArray(body.scenes) ? body.scenes : [];
    if (rawScenes.length === 0) {
      return res.status(400).json({ success: false, error: 'Add at least one photo or video first.' });
    }
    if (rawScenes.length > MAX_SCENES) {
      return res.status(400).json({ success: false, error: `Please use ${MAX_SCENES} scenes or fewer for AI narration.` });
    }

    const scenes: SceneIn[] = rawScenes.map((s, i) => ({
      id: clean(s?.id, 80) || `scene-${i}`,
      name: clean(s?.name, 120),
      image:
        typeof s?.image === 'string' && s.image.startsWith('data:image/jpeg;base64,') && s.image.length <= MAX_IMAGE_CHARS
          ? s.image
          : null,
    }));

    const ai = getGeminiClient();
    if (ai) {
      const factLines = facts.length ? facts.map((f) => `- ${f.label}: ${f.value}`).join('\n') : '- (no details were provided)';

      const instructions = `You write the voiceover for a short ${industry} marketing video.
You are given the business details and then the scenes (photos or video frames) in the exact order they appear on screen.

DETAILS PROVIDED BY THE USER:
${factLines}

For EACH scene return:
- "id": the scene id exactly as given.
- "sees": a 2-5 word label of what is VISIBLY shown in that scene's picture (for example "Master bathroom", "Front view", "Pool terrace").
- "line": the narration spoken while this scene is on screen: one or two natural sentences, about 14-28 words.

STRICT RULES:
1. Each line must describe ONLY what is visible in that scene's own picture. Never mention a room, object or feature that is not visible in that picture. A bathroom picture never talks about the living room, and the other way round. The same applies to every industry (a dashboard picture never talks about the engine bay, a dessert picture never talks about the dining hall).
2. Use the details above only where they naturally belong to what is visible: the number of bedrooms on a bedroom picture, the number of bathrooms on a bathroom picture, the size on a living room or exterior picture, engine details on an engine or exterior picture, and so on. Price, availability and contact belong in the closing scene.
3. Never invent facts, numbers, prices, names or features. If a picture is unclear or missing, write a neutral line using only the provided details.
4. Scene 1 opens with a warm welcome that names the property, product or business and its location when provided.
5. The last scene ends with a short call to action and includes the website and contact when provided. Write a website the way it is spoken (for example "example dot com").
6. Natural spoken style. No markdown, emojis, brackets, hashtags or stage directions. Do not start two lines in a row with the same words.
7. Return a JSON array with exactly ${scenes.length} items, in scene order.`;

      const parts: any[] = [{ text: instructions }];
      scenes.forEach((s, i) => {
        parts.push({
          text: `Scene ${i + 1} of ${scenes.length} (id: "${s.id}")${s.name ? `, file name hint: "${s.name}"` : ''}${
            s.image ? ':' : '. (picture unavailable)'
          }`,
        });
        if (s.image) {
          parts.push({ inlineData: { mimeType: 'image/jpeg', data: s.image.split(',')[1] } });
        }
      });

      const started = Date.now();
      let responseText = '';
      for (const modelName of CANDIDATE_MODELS) {
        const remaining = GEMINI_BUDGET_MS - (Date.now() - started);
        if (remaining < 4000) break;
        try {
          const response = await withTimeout(
            ai.models.generateContent({
              model: modelName,
              contents: [{ role: 'user', parts }],
              config: {
                responseMimeType: 'application/json',
                responseSchema: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      id: { type: Type.STRING },
                      sees: { type: Type.STRING },
                      line: { type: Type.STRING },
                    },
                    required: ['id', 'sees', 'line'],
                  },
                },
              },
            }),
            remaining
          );
          if (response.text) {
            responseText = response.text;
            break;
          }
        } catch (modelErr: any) {
          console.info(`Narration model ${modelName} unavailable (${String(modelErr?.message || modelErr).slice(0, 80)}), trying next...`);
        }
      }

      if (responseText) {
        try {
          const parsed = JSON.parse(responseText.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim());
          if (Array.isArray(parsed) && parsed.length > 0) {
            const basic = basicNarration(scenes, facts);
            const out: SceneOut[] = scenes.map((s, i) => {
              // match by id first, fall back to position
              const hit = parsed.find((p: any) => p?.id === s.id) ?? parsed[i];
              const line = clean(hit?.line, 400);
              return { id: s.id, sees: clean(hit?.sees, 60), line: line || basic[i].line };
            });
            return res.status(200).json({ success: true, scenes: out, source: 'gemini' });
          }
        } catch {
          console.info('Narration JSON from Gemini could not be parsed; using a basic draft.');
        }
      }
    }

    return res.status(200).json({ success: true, scenes: basicNarration(scenes, facts), source: 'basic' });
  } catch (err: any) {
    console.error('Narration generation error:', err);
    return res.status(500).json({ success: false, error: 'Could not write the narration. Please try again.' });
  }
}
