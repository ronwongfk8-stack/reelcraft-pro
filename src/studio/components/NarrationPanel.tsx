import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X, Mic, ChevronDown, ChevronRight, Play, Square, Check, Loader2, RefreshCw, Sparkles, AlertTriangle } from 'lucide-react';
import { MALE_VOICES, FEMALE_VOICES } from '../../data/voiceData';
import { INDUSTRY_FORMS, getIndustryForm } from '../data/industryForms';
import { audioEngine } from '../utils/audioEngine';
import { captureThumbnail, clipSignature, requestNarration, MAX_NARRATION_SCENES } from '../utils/narration';
import { MediaItem, NarrationState, TimelineClip } from '../types';

export interface ApplyNarrationResult {
  scenes: { clipId: string; line: string; sceneDuration: number; lead: number; voiceDuration: number }[];
  audioUrl: string;
  audioDuration: number;
  voiceId: string;
  state: NarrationState;
}

interface NarrationPanelProps {
  isOpen: boolean;
  onClose: () => void;
  clips: TimelineClip[];
  mediaItems: MediaItem[];
  value: NarrationState | null;
  defaultIndustry: string;
  defaultVoiceId: string;
  onChange: (state: NarrationState) => void;
  onApply: (result: ApplyNarrationResult) => void;
}

// Voice samples are generated once per voice and kept for the rest of the session
const sampleCache = new Map<string, string>();

const ALL_VOICES = [...MALE_VOICES, ...FEMALE_VOICES];

export const NarrationPanel: React.FC<NarrationPanelProps> = ({
  isOpen,
  onClose,
  clips,
  mediaItems,
  value,
  defaultIndustry,
  defaultVoiceId,
  onChange,
  onApply,
}) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [industry, setIndustry] = useState(defaultIndustry);
  const [facts, setFacts] = useState<Record<string, string>>({});
  const [showMore, setShowMore] = useState(false);
  const [voiceId, setVoiceId] = useState(defaultVoiceId);
  const [lines, setLines] = useState<Record<string, { sees: string; line: string }>>({});
  const [lineSignature, setLineSignature] = useState('');
  const [voicedText, setVoicedText] = useState<string | undefined>(undefined);

  const [phase, setPhase] = useState<'idle' | 'writing' | 'voicing'>('idle');
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const [writeSource, setWriteSource] = useState<'gemini' | 'basic' | null>(null);

  const [sampleLoading, setSampleLoading] = useState<string | null>(null);
  const [samplePlaying, setSamplePlaying] = useState<string | null>(null);
  const [sampleError, setSampleError] = useState<string | null>(null);
  const sampleAudioRef = useRef<HTMLAudioElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const form = getIndustryForm(industry);

  // Scenes = clips (in timeline order) whose picture still exists
  const scenes = useMemo(
    () =>
      clips
        .map((clip) => ({ clip, media: mediaItems.find((m) => m.id === clip.mediaId) }))
        .filter((s): s is { clip: TimelineClip; media: MediaItem } => !!s.media),
    [clips, mediaItems]
  );
  const signature = clipSignature(clips);
  const hasLines = scenes.some((s) => lines[s.clip.id]?.line);
  const isStale = hasLines && lineSignature !== '' && lineSignature !== signature;
  const currentText = scenes.map((s) => (lines[s.clip.id]?.line || '').trim()).join('\n');
  const isVoiced = !!voicedText && voicedText === currentText && !isStale;

  // ---- Load saved state whenever the panel is opened ----
  useEffect(() => {
    if (!isOpen) return;
    if (value) {
      setIndustry(value.industry || defaultIndustry);
      setFacts(value.facts || {});
      setVoiceId(value.voiceId || defaultVoiceId);
      const map: Record<string, { sees: string; line: string }> = {};
      value.lines.forEach((l) => (map[l.clipId] = { sees: l.sees || '', line: l.line }));
      setLines(map);
      setLineSignature(value.signature || '');
      setVoicedText(value.voicedText);
      setStep(value.lines.length > 0 ? 3 : 1);
    } else {
      setIndustry(defaultIndustry);
      setVoiceId(defaultVoiceId);
      setStep(1);
    }
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // ---- Keep the saved copy up to date (debounced) so the form survives reloads ----
  useEffect(() => {
    if (!isOpen) return;
    const t = setTimeout(() => {
      onChange({
        industry,
        facts,
        voiceId,
        lines: scenes
          .filter((s) => lines[s.clip.id])
          .map((s) => ({ clipId: s.clip.id, sees: lines[s.clip.id].sees, line: lines[s.clip.id].line })),
        signature: lineSignature,
        voicedText,
      });
    }, 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [industry, facts, voiceId, lines, lineSignature, voicedText, isOpen]);

  // stop any sample / generation when the panel closes
  useEffect(() => {
    if (!isOpen) {
      sampleAudioRef.current?.pause();
      setSamplePlaying(null);
    }
  }, [isOpen]);

  // ---- Voice samples ----
  const playSample = async (id: string) => {
    setSampleError(null);
    if (samplePlaying === id) {
      sampleAudioRef.current?.pause();
      setSamplePlaying(null);
      return;
    }
    sampleAudioRef.current?.pause();
    setSamplePlaying(null);
    try {
      let url = sampleCache.get(`${id}|${form.id}`);
      if (!url) {
        setSampleLoading(id);
        const r = await audioEngine.generateVoiceoverAudio(form.sample, id);
        url = r.url;
        sampleCache.set(`${id}|${form.id}`, url);
      }
      const a = new Audio(url);
      sampleAudioRef.current = a;
      a.onended = () => setSamplePlaying(null);
      await a.play();
      setSamplePlaying(id);
    } catch (e: any) {
      setSampleError(e?.message || "Couldn't play the sample.");
    } finally {
      setSampleLoading(null);
    }
  };

  // ---- Step 2 -> 3: AI looks at the photos and writes one line per scene ----
  const writeNarration = async () => {
    if (scenes.length === 0) return;
    sampleAudioRef.current?.pause();
    setSamplePlaying(null);
    setStep(3);
    setPhase('writing');
    setError(null);
    try {
      const request = await Promise.all(
        scenes.map(async ({ clip, media }) => ({
          id: clip.id,
          name: media.name,
          image: await captureThumbnail(media, clip.trimStart || 0),
        }))
      );
      const result = await requestNarration({ industry, facts, scenes: request });
      const map: Record<string, { sees: string; line: string }> = {};
      result.scenes.forEach((s) => (map[s.id] = { sees: s.sees || '', line: s.line }));
      setLines(map);
      setLineSignature(signature);
      setVoicedText(undefined);
      setWriteSource(result.source);
    } catch (e: any) {
      setError(e?.message || "Couldn't write the narration.");
    } finally {
      setPhase('idle');
    }
  };

  // ---- Step 3: turn the lines into voice, one scene at a time ----
  const makeVoice = async () => {
    const texts = scenes.map((s) => (lines[s.clip.id]?.line || '').trim());
    if (texts.some((t) => !t)) {
      setError('Every scene needs a line. Use Rewrite to fill in any that are empty.');
      return;
    }
    setError(null);
    setPhase('voicing');
    setProgress({ done: 0, total: texts.length });
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const track = await audioEngine.generateNarrationTrack(texts, voiceId, {
        signal: controller.signal,
        onProgress: (done, total) => setProgress({ done, total }),
      });
      const text = texts.join('\n');
      const state: NarrationState = {
        industry,
        facts,
        voiceId,
        lines: scenes.map((s, i) => ({ clipId: s.clip.id, sees: lines[s.clip.id]?.sees, line: texts[i] })),
        signature,
        voicedText: text,
      };
      setLineSignature(signature);
      setVoicedText(text);
      onApply({
        scenes: scenes.map((s, i) => ({
          clipId: s.clip.id,
          line: texts[i],
          sceneDuration: track.scenes[i].sceneDuration,
          lead: track.scenes[i].voiceStart - track.scenes[i].sceneStart,
          voiceDuration: track.scenes[i].voiceDuration,
        })),
        audioUrl: track.url,
        audioDuration: track.duration,
        voiceId,
        state,
      });
    } catch (e: any) {
      if (e?.message !== 'Cancelled') setError(`${e?.message || 'Voice generation failed.'} Nothing was changed - try again.`);
    } finally {
      setPhase('idle');
      abortRef.current = null;
    }
  };

  if (!isOpen) return null;

  const busy = phase !== 'idle';
  const tooMany = scenes.length > MAX_NARRATION_SCENES;
  const stepLabels: [1 | 2 | 3, string][] = [
    [1, 'About'],
    [2, 'Voice'],
    [3, 'Scenes'],
  ];

  const mainFields = form.fields.filter((f) => !f.more);
  const moreFields = form.fields.filter((f) => f.more);

  const renderField = (f: (typeof form.fields)[number]) => {
    const common =
      'w-full bg-slate-950 border border-slate-800 focus:border-pink-500 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none transition-colors';
    return (
      <div key={f.key} className={f.wide ? 'col-span-2' : ''}>
        <label className="text-[10px] font-semibold text-slate-400 block mb-1">{f.label}</label>
        {f.type === 'select' ? (
          <select
            value={facts[f.key] || ''}
            onChange={(e) => setFacts({ ...facts, [f.key]: e.target.value })}
            className={common}
          >
            <option value="">—</option>
            {f.options?.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        ) : f.type === 'textarea' ? (
          <textarea
            rows={2}
            value={facts[f.key] || ''}
            onChange={(e) => setFacts({ ...facts, [f.key]: e.target.value })}
            placeholder={f.placeholder}
            className={`${common} resize-none`}
          />
        ) : (
          <input
            type={f.type === 'number' ? 'number' : 'text'}
            min={f.type === 'number' ? 0 : undefined}
            value={facts[f.key] || ''}
            onChange={(e) => setFacts({ ...facts, [f.key]: e.target.value })}
            placeholder={f.placeholder}
            className={common}
          />
        )}
      </div>
    );
  };

  return (
    <aside
      className="fixed top-14 right-0 bottom-0 z-40 w-full sm:w-96 bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col text-slate-100"
      aria-label="AI voiceover"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 shrink-0">
        <div className="flex items-center space-x-2">
          <div className="w-7 h-7 rounded-lg bg-pink-500/15 border border-pink-500/30 flex items-center justify-center">
            <Mic className="w-3.5 h-3.5 text-pink-400" />
          </div>
          <h3 className="text-sm font-bold text-white">AI Voiceover</h3>
        </div>
        <button
          onClick={onClose}
          aria-label="Close"
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Steps */}
      <div className="flex items-center px-4 py-2.5 border-b border-slate-800 shrink-0 gap-1.5">
        {stepLabels.map(([n, label], i) => (
          <React.Fragment key={n}>
            <button
              onClick={() => !busy && (n < 3 || hasLines) && setStep(n)}
              disabled={busy || (n === 3 && !hasLines)}
              className={`flex items-center space-x-1.5 px-2 py-1 rounded-full text-[11px] font-semibold transition-colors ${
                step === n ? 'bg-pink-500/20 text-pink-200' : 'text-slate-400 hover:text-slate-200 disabled:opacity-40'
              }`}
            >
              <span
                className={`w-4 h-4 rounded-full text-[10px] flex items-center justify-center ${
                  step === n ? 'bg-pink-500 text-white' : 'bg-slate-800 text-slate-300'
                }`}
              >
                {n}
              </span>
              <span>{label}</span>
            </button>
            {i < 2 && <ChevronRight className="w-3 h-3 text-slate-700" />}
          </React.Fragment>
        ))}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {/* STEP 1: ABOUT */}
        {step === 1 && (
          <>
            <div>
              <label className="text-[10px] font-semibold text-slate-400 block mb-1">Industry</label>
              <select
                value={industry}
                onChange={(e) => {
                  setIndustry(e.target.value);
                  setFacts({});
                }}
                className="w-full bg-slate-950 border border-slate-800 focus:border-pink-500 rounded-lg px-2.5 py-2 text-xs text-slate-100 focus:outline-none"
              >
                {INDUSTRY_FORMS.map((f) => (
                  <option key={f.id} value={f.name}>
                    {f.emoji} {f.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2.5">{mainFields.map(renderField)}</div>

            {moreFields.length > 0 && (
              <div>
                <button
                  onClick={() => setShowMore(!showMore)}
                  className="flex items-center space-x-1 text-[11px] font-semibold text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  {showMore ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                  <span>More details</span>
                </button>
                {showMore && <div className="grid grid-cols-2 gap-2.5 mt-2">{moreFields.map(renderField)}</div>}
              </div>
            )}
          </>
        )}

        {/* STEP 2: VOICE */}
        {step === 2 && (
          <div className="space-y-1.5">
            {ALL_VOICES.map((v) => {
              const selected = voiceId === v.id;
              return (
                <div
                  key={v.id}
                  onClick={() => setVoiceId(v.id)}
                  className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition-all ${
                    selected ? 'bg-pink-500/15 border-pink-500' : 'bg-slate-950 border-slate-800 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center space-x-2.5 min-w-0">
                    <div className={`w-8 h-8 rounded-full border flex items-center justify-center text-xs font-bold shrink-0 ${v.avatarBg}`}>
                      {v.name[0]}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-slate-100 flex items-center space-x-1.5">
                        <span>{v.name}</span>
                        {selected && <Check className="w-3.5 h-3.5 text-pink-400" />}
                      </div>
                      <div className="text-[10px] text-slate-500 truncate">{v.tone}</div>
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      playSample(v.id);
                    }}
                    aria-label={`Listen to ${v.name}`}
                    className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-200 shrink-0 cursor-pointer"
                  >
                    {sampleLoading === v.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : samplePlaying === v.id ? (
                      <Square className="w-3 h-3 fill-current" />
                    ) : (
                      <Play className="w-3.5 h-3.5 fill-current" />
                    )}
                  </button>
                </div>
              );
            })}
            {sampleError && <p className="text-[11px] text-amber-300">{sampleError}</p>}
          </div>
        )}

        {/* STEP 3: SCENES */}
        {step === 3 && (
          <>
            {tooMany && (
              <p className="text-[11px] text-amber-300 bg-amber-950/50 border border-amber-800/60 rounded-lg px-2.5 py-1.5">
                AI narration supports up to {MAX_NARRATION_SCENES} scenes. Remove a few photos first.
              </p>
            )}

            {phase === 'writing' && (
              <div className="flex flex-col items-center justify-center py-14 space-y-3 text-slate-300">
                <Loader2 className="w-6 h-6 animate-spin text-pink-400" />
                <span className="text-xs">Looking at your photos…</span>
              </div>
            )}

            {phase !== 'writing' && isStale && (
              <div className="flex items-center justify-between gap-2 text-[11px] text-amber-300 bg-amber-950/50 border border-amber-800/60 rounded-lg px-2.5 py-1.5">
                <span className="flex items-center space-x-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>Photos changed. Rewrite to match.</span>
                </span>
                <button onClick={writeNarration} disabled={busy} className="font-bold underline cursor-pointer">
                  Rewrite
                </button>
              </div>
            )}

            {phase !== 'writing' && writeSource === 'basic' && !isStale && (
              <p className="text-[11px] text-amber-300 bg-amber-950/50 border border-amber-800/60 rounded-lg px-2.5 py-1.5">
                Basic draft only. Please check every line against its photo.
              </p>
            )}

            {phase !== 'writing' &&
              scenes.map(({ clip, media }, i) => {
                const entry = lines[clip.id];
                return (
                  <div key={clip.id} className="flex gap-2.5">
                    <div className="relative w-24 shrink-0 self-start aspect-video rounded-lg overflow-hidden bg-black border border-slate-800">
                      {media.type === 'image' ? (
                        <img src={media.url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <video src={`${media.url}#t=0.1`} className="w-full h-full object-cover" muted playsInline preload="metadata" />
                      )}
                      <span className="absolute top-1 left-1 px-1 rounded bg-black/70 text-[9px] font-mono text-white">{i + 1}</span>
                      {entry?.sees && (
                        <span className="absolute bottom-0 inset-x-0 px-1 py-0.5 bg-black/70 text-[9px] text-pink-200 truncate">
                          {entry.sees}
                        </span>
                      )}
                    </div>
                    <textarea
                      rows={4}
                      value={entry?.line || ''}
                      disabled={busy}
                      onChange={(e) =>
                        setLines({ ...lines, [clip.id]: { sees: entry?.sees || '', line: e.target.value } })
                      }
                      placeholder="Narration for this scene…"
                      className="flex-1 min-w-0 bg-slate-950 border border-slate-800 focus:border-pink-500 rounded-lg p-2 text-[11px] leading-snug text-slate-100 placeholder-slate-600 focus:outline-none resize-none disabled:opacity-60"
                    />
                  </div>
                );
              })}
          </>
        )}

        {error && (
          <p className="text-[11px] text-amber-300 bg-amber-950/50 border border-amber-800/60 rounded-lg px-2.5 py-1.5">{error}</p>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-slate-800 px-4 py-3 shrink-0 space-y-2">
        {phase === 'voicing' && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px] text-slate-300">
              <span>
                Voicing scene {Math.min(progress.done + 1, progress.total)} of {progress.total}
              </span>
              <button onClick={() => abortRef.current?.abort()} className="text-slate-400 hover:text-white underline cursor-pointer">
                Cancel
              </button>
            </div>
            <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-pink-500 to-purple-500 transition-all"
                style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex items-center gap-2">
          {step > 1 && (
            <button
              onClick={() => setStep((step - 1) as 1 | 2)}
              disabled={busy}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold disabled:opacity-50 cursor-pointer"
            >
              Back
            </button>
          )}

          {step === 1 && (
            <button
              onClick={() => setStep(2)}
              className="flex-1 py-2 rounded-xl bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white text-xs font-bold cursor-pointer"
            >
              Next
            </button>
          )}

          {step === 2 && (
            <button
              onClick={writeNarration}
              disabled={busy || scenes.length === 0}
              className="flex-1 py-2 rounded-xl bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center space-x-1.5 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{scenes.length === 0 ? 'Add photos first' : 'Write narration'}</span>
            </button>
          )}

          {step === 3 && (
            <>
              <button
                onClick={writeNarration}
                disabled={busy || scenes.length === 0}
                aria-label="Rewrite narration"
                title="Rewrite"
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
              {isVoiced ? (
                <button
                  onClick={onClose}
                  className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center space-x-1.5 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Voiceover added — Done</span>
                </button>
              ) : (
                <button
                  onClick={makeVoice}
                  disabled={busy || !hasLines || tooMany}
                  className="flex-1 py-2 rounded-xl bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center space-x-1.5 cursor-pointer"
                >
                  {phase === 'voicing' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mic className="w-3.5 h-3.5" />}
                  <span>{voicedText ? 'Update voiceover' : 'Make voiceover'}</span>
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </aside>
  );
};
