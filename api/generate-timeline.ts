import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getGeminiClient, CANDIDATE_MODELS } from '../lib/gemini.js';

// Vercel: allow up to 60s (Hobby plans cap at their own limit). The Gemini call below is additionally
// time-boxed so the function always answers with the built-in local director instead of timing out.
export const config = { maxDuration: 60 };

const GEMINI_BUDGET_MS = 25_000;

interface TimelineItemInput {
  id: string;
  name: string;
  type: 'image' | 'video';
  duration?: number;
  width?: number;
  height?: number;
}

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

// POST /api/generate-timeline
// Turns the prompt + media inventory (+ optional voiceover details) into an edit timeline.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      prompt: rawPrompt,
      items,
      hasVoiceover,
      voiceoverDuration,
      voiceoverTranscript,
      aspectRatio = '16:9',
    } = (req.body || {}) as {
      prompt?: string;
      items?: TimelineItemInput[];
      hasVoiceover?: boolean;
      voiceoverDuration?: number;
      voiceoverTranscript?: string;
      aspectRatio?: '9:16' | '16:9' | '1:1';
    };

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, error: 'At least one image or video item is required.' });
    }
    if (items.length > 60) {
      return res.status(400).json({ success: false, error: 'Please use 60 clips or fewer per video.' });
    }

    const prompt = typeof rawPrompt === 'string' ? rawPrompt.slice(0, 2000) : '';

    // Target total duration
    let targetTotalDuration = 15;
    if (hasVoiceover && voiceoverDuration && voiceoverDuration > 2) {
      targetTotalDuration = Math.round(voiceoverDuration);
    } else {
      const fast = prompt.toLowerCase().includes('fast') || prompt.toLowerCase().includes('quick');
      targetTotalDuration = Math.max(8, Math.min(120, Math.round(items.length * (fast ? 2.2 : 3.5))));
    }

    const ai = getGeminiClient();
    if (ai) {
      const systemPrompt = `You are an elite Hollywood & social media viral video editor and director.
      The user wants to generate an automatic video timeline WITHOUT requiring manual video editing.
      The user has provided media files (images/videos) and a directive prompt describing the desired flow, style, and transitions.
      ${hasVoiceover ? `CRITICAL: The user provided a Voice Over narration (duration: ${targetTotalDuration}s). The clips and captions MUST be rhythmically synchronized to this narration.` : ''}
      ${voiceoverTranscript ? `VOICEOVER TRANSCRIPT:\n"${voiceoverTranscript}"` : ''}
      
      USER PROMPT & CREATIVE DIRECTION:
      "${prompt || 'Create a captivating, seamless video edit with smooth cinematic transitions and kinetic pacing.'}"
      
      MEDIA INVENTORY:
      ${items.map((it, idx) => `[Item ${idx + 1}] ID: "${it.id}", Name: "${it.name}", Type: ${it.type}${it.duration ? `, NativeDuration: ${it.duration}s` : ''}`).join('\n')}
      
      ASPECT RATIO: ${aspectRatio}
      TARGET TOTAL DURATION: ~${targetTotalDuration} seconds.
      
      TRANSITION OPTIONS AVAILABLE IN ENGINE:
      - "crossfade" (smooth dissolve)
      - "zoom-in" (punchy zoom burst)
      - "zoom-out" (snap back)
      - "whip-left" (high-speed camera whip pan left)
      - "whip-right" (high-speed camera whip pan right)
      - "glitch" (chromatic aberration and digital splice)
      - "flash-white" (high-exposure strobe cut)
      - "slide-up" (energetic vertical push)
      - "lens-blur" (dreamy bokeh blur transition)
      - "film-roll" (retro film reel vertical roll)
      - "none" (hard cut)
      
      MOTION OPTIONS (Ken Burns effect for still images & subtle camera moves):
      - "push-in" (slow dramatic zoom in)
      - "pull-out" (revealing zoom out)
      - "pan-left" (camera travels left)
      - "pan-right" (camera travels right)
      - "subtle-drift" (organic handheld float)
      - "none"
      
      COLOR FILTER PRESETS:
      - "natural", "teal-orange", "vintage", "moody-noir", "cyberpunk", "golden-hour", "pastel"
      
      OUTPUT INSTRUCTIONS:
      Respond with ONLY valid JSON strictly adhering to this schema (no markdown fences, no explanatory text):
      {
        "title": "Creative project title",
        "styleSummary": "Short explanation of the editing choices and pacing",
        "colorFilter": "teal-orange | natural | vintage | moody-noir | cyberpunk | golden-hour | pastel",
        "captionStyle": "beast-glow | minimal | cinematic | retro-glitch | karaoke",
        "subtitleConfig": {
          "fontSize": 28,
          "fontStyle": "impact | modern-sans | serif | mono | rounded",
          "animationStyle": "beast-glow | typewriter | karaoke | bounce | fade-up | minimal",
          "textColor": "#FACC15",
          "showBackgroundPill": true
        },
        "clips": [
          {
            "mediaId": "string matching an item ID",
            "duration": number (duration of this cut in seconds, e.g. 2.5),
            "transitionIn": "whip-left | zoom-in | crossfade | glitch | flash-white | slide-up | lens-blur | film-roll | none",
            "transitionDuration": number (between 0.3 and 0.8 seconds, first clip should have 'none' or 'crossfade' with 0.4s),
            "motionEffect": "push-in | pull-out | pan-left | pan-right | subtle-drift | none",
            "caption": "Short punchy on-screen subtitle or voice line for this scene",
            "title": "2-4 word on-screen title for this scene (e.g. 'Gourmet Kitchen')"
          }
        ],
        "captions": [
          {
            "startTime": number (seconds from start),
            "endTime": number (seconds from start),
            "text": "Timed narration phrase or kinetic caption line",
            "emphasis": "keyword to highlight"
          }
        ],
        "soundDesign": {
          "recommendedBgmStyle": "cinematic-epic | lofi-chill | upbeat-tech | ambient-nature | acoustic-warm",
          "bgmDucking": true,
          "duckAmount": 0.25,
          "transitionSfx": true
        }
      }
      
      Guidelines:
      1. Make sure all items are utilized effectively. If there are fewer items than needed for the target duration, loop or revisit items with fresh motions.
      2. Sum of clip durations should closely match ~${targetTotalDuration}s.
      3. Obey any transition effect explicitly requested in the user prompt (e.g. if user said "use whip transitions and glitch", make sure 'whip-left'/'whip-right' and 'glitch' are featured prominently).
      4. Captions should be punchy, viral, and synchronized to the clip timestamps.`;
      

      const started = Date.now();
      let responseText = '';
      for (const modelName of CANDIDATE_MODELS) {
        const remaining = GEMINI_BUDGET_MS - (Date.now() - started);
        if (remaining < 3000) break;
        try {
          const response = await withTimeout(
            ai.models.generateContent({
              model: modelName,
              contents: systemPrompt,
              config: { responseMimeType: 'application/json' },
            }),
            remaining
          );
          if (response.text) {
            responseText = response.text;
            break;
          }
        } catch (modelErr: any) {
          console.info(`Timeline model ${modelName} unavailable (${String(modelErr?.message || modelErr).slice(0, 80)}), trying next...`);
        }
      }

      if (responseText) {
        try {
          const cleaned = responseText.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
          const parsed = JSON.parse(cleaned);
          if (parsed && Array.isArray(parsed.clips) && parsed.clips.length > 0) {
            return res.status(200).json({ success: true, data: parsed, source: 'gemini' });
          }
        } catch (parseErr) {
          console.info('Timeline JSON from Gemini could not be parsed; using the local director.');
        }
      }
    }

    // Local director fallback (no API key, quota, timeout or bad JSON)
    const localTimeline = generateHeuristicTimeline(prompt, items, targetTotalDuration, voiceoverTranscript, hasVoiceover);
    return res.status(200).json({ success: true, data: localTimeline, source: 'local-heuristic' });
  } catch (err: any) {
    console.error('Timeline generation error:', err);
    return res.status(500).json({ success: false, error: 'Failed to generate timeline. Please try again.' });
  }
}

function generateHeuristicTimeline(
  prompt: string,
  items: TimelineItemInput[],
  totalDuration: number,
  transcript?: string,
  hasVoiceover?: boolean
) {
  const pLower = (prompt || '').toLowerCase();

  // Detect transition preferences from prompt
  const requestedTransitions: string[] = [];
  if (pLower.includes('whip')) requestedTransitions.push('whip-left', 'whip-right');
  if (pLower.includes('zoom')) requestedTransitions.push('zoom-in', 'zoom-out');
  if (pLower.includes('glitch')) requestedTransitions.push('glitch');
  if (pLower.includes('flash') || pLower.includes('white')) requestedTransitions.push('flash-white');
  if (pLower.includes('fade') || pLower.includes('dissolve') || pLower.includes('smooth')) requestedTransitions.push('crossfade');
  if (pLower.includes('slide') || pLower.includes('push')) requestedTransitions.push('slide-up');
  if (pLower.includes('blur')) requestedTransitions.push('lens-blur');
  if (pLower.includes('film') || pLower.includes('roll')) requestedTransitions.push('film-roll');

  const defaultTransitions = requestedTransitions.length > 0
    ? requestedTransitions
    : ['zoom-in', 'whip-left', 'crossfade', 'glitch', 'slide-up', 'flash-white'];

  // Detect color filter preference
  let colorFilter = 'teal-orange';
  if (pLower.includes('noir') || pLower.includes('black and white') || pLower.includes('b&w')) colorFilter = 'moody-noir';
  else if (pLower.includes('cyber') || pLower.includes('neon') || pLower.includes('futuristic')) colorFilter = 'cyberpunk';
  else if (pLower.includes('vintage') || pLower.includes('retro') || pLower.includes('film')) colorFilter = 'vintage';
  else if (pLower.includes('warm') || pLower.includes('sunset') || pLower.includes('golden')) colorFilter = 'golden-hour';
  else if (pLower.includes('natural') || pLower.includes('clean') || pLower.includes('minimal')) colorFilter = 'natural';

  // Motions derived directly from prompt directives (e.g. walk-through interior, drone fly-pass, worm eye view)
  const promptMotions: string[] = [];
  if (pLower.includes('walk') || pLower.includes('interior') || pLower.includes('thru')) {
    promptMotions.push('push-in');
  }
  if (pLower.includes('drone') || pLower.includes('fly pass') || pLower.includes('fly-pass') || pLower.includes('flyby')) {
    promptMotions.push('pan-right', 'pan-left');
  }
  if (pLower.includes('worm') || pLower.includes('low angle') || pLower.includes('ground')) {
    promptMotions.push('subtle-drift');
  }

  const motions = promptMotions.length > 0
    ? promptMotions
    : ['push-in', 'pull-out', 'pan-left', 'pan-right', 'subtle-drift'];

  // Audio ducking directive from prompt
  const lowerMusicRequested = pLower.includes('lower') || pLower.includes('duck') || pLower.includes('quiet') || pLower.includes('voice over');
  const duckAmount = lowerMusicRequested ? 0.15 : 0.25;

  // Parse transcript sentences for narration-synced cuts
  const rawSentences: string[] = [];
  if (transcript) {
    const fullSentences = transcript
      .split(/(?<=[.?!])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    // If there are many items (e.g. 17 images), split into clauses/phrases so each scene gets its own narration
    if (items.length > fullSentences.length * 1.3) {
      const phrases = transcript
        .split(/(?<=[.?!,;—])\s+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      rawSentences.push(...phrases);
    } else {
      rawSentences.push(...fullSentences);
    }
  }

  // Fallback phrases if no transcript
  const fallbackCaptions = [
    'The Journey Begins',
    'Unveiling the Vision',
    'Precision in Every Detail',
    'A Bold New Perspective',
    'Atmosphere & Energy',
    'Elevated Craftsmanship',
    'Architectural Harmony',
    'Light & Shadow Play',
    'Natural Seamless Flow',
    'Modern Elegant Living',
    'Expansive Panoramic View',
    'Refined Form & Texture',
    'Dynamic Spatial Rhythm',
    'Vibrant Ambient Character',
    'Timeless Aesthetic Balance',
    'The Climax of the Story',
    'A Lasting Impression',
  ];

  // Calculate clip count and durations matching speech rhythm
  const clipDuration = Math.max(2.2, totalDuration / items.length);
  const clips = items.map((item, idx) => {
    const isFirst = idx === 0;
    const transitionIn = isFirst ? 'none' : defaultTransitions[idx % defaultTransitions.length];
    const motion = item.type === 'image' ? motions[idx % motions.length] : 'none';

    let sceneCaption = '';
    if (idx < rawSentences.length) {
      sceneCaption = rawSentences[idx];
    } else if (rawSentences.length > 0) {
      sceneCaption = `Visual Interlude ${idx + 1}: ${item.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ')}`;
    } else {
      sceneCaption = fallbackCaptions[idx % fallbackCaptions.length] || `Scene ${idx + 1}: ${item.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ')}`;
    }

    return {
      mediaId: item.id,
      duration: Number(clipDuration.toFixed(1)),
      transitionIn,
      transitionDuration: 0.5,
      motionEffect: motion,
      caption: sceneCaption,
      textOverlay: {
        enabled: true,
        text: sceneCaption.toUpperCase(),
        fontStyle: 'impact',
        fontSize: 34,
        textColor: '#FFFFFF',
        effect: 'outline',
        x: 0.5,
        y: 0.2,
        scale: 1.0,
        rotation: 0,
      },
    };
  });

  // Generate captions synchronized to timestamps
  const captions = [];
  let currentTime = 0;
  for (let i = 0; i < clips.length; i++) {
    const dur = clips[i].duration;
    captions.push({
      startTime: Number(currentTime.toFixed(1)),
      endTime: Number((currentTime + dur - 0.2).toFixed(1)),
      text: clips[i].caption,
      emphasis: clips[i].caption.split(' ')[0] || '',
    });
    currentTime += dur;
  }

  // Subtitle styling parsed from prompt directives
  let subFontSize = 28;
  if (pLower.includes('huge') || pLower.includes('giant') || pLower.includes('extra large')) subFontSize = 44;
  else if (pLower.includes('large font') || pLower.includes('large text') || pLower.includes('big font')) subFontSize = 36;
  else if (pLower.includes('small font') || pLower.includes('small text') || pLower.includes('small subtitle')) subFontSize = 20;

  let subTextColor = '#FACC15';
  if (pLower.includes('white text') || pLower.includes('white font')) subTextColor = '#FFFFFF';
  else if (pLower.includes('cyan') || pLower.includes('blue font') || pLower.includes('blue text')) subTextColor = '#06B6D4';
  else if (pLower.includes('green') || pLower.includes('lime')) subTextColor = '#4ADE80';
  else if (pLower.includes('pink') || pLower.includes('rose')) subTextColor = '#F43F5E';
  else if (pLower.includes('gold')) subTextColor = '#F59E0B';
  else if (pLower.includes('purple')) subTextColor = '#A855F7';

  let subAnimation = 'beast-glow';
  if (pLower.includes('typewriter') || pLower.includes('typing')) subAnimation = 'typewriter';
  else if (pLower.includes('karaoke') || pLower.includes('word by word')) subAnimation = 'karaoke';
  else if (pLower.includes('bounce') || pLower.includes('pop')) subAnimation = 'bounce';
  else if (pLower.includes('fade up') || pLower.includes('floating')) subAnimation = 'fade-up';
  else if (pLower.includes('minimal')) subAnimation = 'minimal';

  let subFont = 'impact';
  if (pLower.includes('serif') || pLower.includes('classic')) subFont = 'serif';
  else if (pLower.includes('mono') || pLower.includes('code')) subFont = 'mono';
  else if (pLower.includes('sans') || pLower.includes('modern font')) subFont = 'modern-sans';
  else if (pLower.includes('rounded')) subFont = 'rounded';

  return {
    title: prompt ? `AutoCut: ${prompt.slice(0, 32)}` : 'AI Generated Story',
    styleSummary: `Auto-cut with prompt-driven ${requestedTransitions.join(', ') || 'cinematic'} transitions synced to narration.`,
    colorFilter,
    captionStyle: 'beast-glow',
    subtitleConfig: {
      fontSize: subFontSize,
      fontStyle: subFont,
      animationStyle: subAnimation,
      textColor: subTextColor,
      showBackgroundPill: true,
    },
    clips,
    captions,
    soundDesign: {
      recommendedBgmStyle: pLower.includes('chill') ? 'lofi-chill' : 'cinematic-epic',
      bgmDucking: !!hasVoiceover,
      duckAmount: 0.25,
      transitionSfx: true,
    },
  };
}
