import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  Sparkles,
  Sliders,
  Play,
  RotateCcw,
  Download,
  Film,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Settings,
  Wand2,
  ChevronRight,
  Layers,
  LifeBuoy,
  Home,
  Mic,
} from 'lucide-react';
import {
  VideoProject,
  MediaItem,
  AudioSettings,
  AspectRatio,
  ColorFilterType,
  CaptionStyle,
  TransitionType,
  MotionType,
  SubtitleConfig,
  TimelineClip,
  CaptionSegment,
  SceneTextOverlay,
  NarrationState,
  LogoSettings,
  DEFAULT_LOGO,
} from './types';
import { VideoCanvasPlayer } from './components/VideoCanvasPlayer';
import { MediaUploader } from './components/MediaUploader';
import { SideControlPanel } from './components/SideControlPanel';
import { TimelineInspector } from './components/TimelineInspector';
import { audioEngine } from './utils/audioEngine';
import { parseSubtitleFromPrompt, DEFAULT_SUBTITLE_CONFIG } from './utils/subtitleParser';
import { saveStudioProject, loadStudioProject, clearStudioProject } from './utils/studioStorage';
import { CreditBadge } from '../components/CreditBadge';
import { NarrationPanel, ApplyNarrationResult } from './components/NarrationPanel';
import { clipSignature, splitCaptionPhrases } from './utils/narration';
import { DEFAULT_INDUSTRY, PRESET_INDUSTRY } from './data/industryForms';
import { MALE_VOICES, FEMALE_VOICES } from '../data/voiceData';
import { MUSIC_PRESETS as LIVE_MUSIC_PRESETS } from '../data/sampleAssets';
import type { PropertyPreset, UserCreditAccount } from '../types';

export interface StudioProps {
  key?: string | number;
  /** Set when the user picked an industry on the landing page; replaces any saved project. */
  initialPreset?: PropertyPreset | null;
  currentAccount: UserCreditAccount | null;
  totalAvailableCredits: number;
  onDeductCredit: () => Promise<{ success: boolean; remainingTotal: number; warningLow: boolean }>;
  onOpenPricing: (isLowNotice?: boolean) => void;
  onOpenHelp: (tab: 'help' | 'terms' | 'privacy') => void;
  onReturnToWelcome: () => void;
  /** Lets the parent flush the latest project to storage right before redirecting to Stripe. */
  registerSaveNow?: (fn: () => Promise<void>) => void;
}

const EMPTY_PROJECT = (aspectRatio: AspectRatio = '16:9'): VideoProject => ({
  title: 'My Video',
  prompt: '',
  aspectRatio,
  colorFilter: 'natural',
  captionStyle: 'beast-glow',
  subtitleConfig: DEFAULT_SUBTITLE_CONFIG,
  clips: [],
  captions: [],
  totalDuration: 0,
});

const DEFAULT_AUDIO = (): AudioSettings => ({
  // Voiceover and music are OFF until the user chooses them - no unexpected sound.
  voiceover: { url: null, name: 'No voiceover', volume: 0.9, muted: false, duration: 0, transcript: '', useNativeSpeech: false, voicePersona: 'male-marcus' },
  music: { url: null, name: 'No Music', volume: 0.35, muted: false, duration: 60, autoDuck: true, duckAmount: 0.2, presetId: undefined },
  sfx: { enabled: true, volume: 0.25, preset: 'cinematic' },
});

const PRESET_MOTIONS: MotionType[] = ['push-in', 'pan-left', 'pull-out', 'pan-right'];

/** Turns a landing-page industry preset (photos + titles + subtitles) into a ready-to-play studio project. */
function buildFromPreset(preset: PropertyPreset) {
  const stamp = Date.now();
  const mediaItems: MediaItem[] = preset.slides.map((sl, i) => ({
    id: `preset-${stamp}-${i}`,
    name: sl.title || `Scene ${i + 1}`,
    type: 'image',
    url: (sl.imageUrl || '').replace('w=1600', 'w=2400').replace('w=800', 'w=2400'),
    duration: sl.duration || 4,
  }));
  let t = 0;
  const clips: TimelineClip[] = preset.slides.map((sl, i) => {
    const dur = sl.duration || 4;
    const clip: TimelineClip = {
      id: `clip-preset-${stamp}-${i}`,
      mediaId: mediaItems[i].id,
      startTime: Number(t.toFixed(2)),
      duration: dur,
      transitionIn: i === 0 ? 'none' : 'crossfade',
      transitionDuration: 0.5,
      motionEffect: PRESET_MOTIONS[i % PRESET_MOTIONS.length],
      caption: sl.subtitle || undefined,
      textOverlay: sl.title
        ? { enabled: true, text: sl.title.toUpperCase(), fontStyle: 'impact', fontSize: 34, textColor: '#FFFFFF', effect: 'outline', x: 0.5, y: 0.2, scale: 1.0, rotation: 0 }
        : undefined,
    };
    t += dur;
    return clip;
  });
  const captions: CaptionSegment[] = clips
    .filter((c) => c.caption)
    .map((c, i) => ({ id: `cap-preset-${stamp}-${i}`, startTime: c.startTime, endTime: Number((c.startTime + c.duration - 0.2).toFixed(2)), text: c.caption as string }));
  const musicPreset = LIVE_MUSIC_PRESETS.find((m) => m.id === preset.musicPresetId);
  return { mediaItems, clips, captions, totalDuration: Number(t.toFixed(2)), musicPreset };
}


export function Studio({
  initialPreset,
  currentAccount,
  totalAvailableCredits,
  onDeductCredit,
  onOpenPricing,
  onOpenHelp,
  onReturnToWelcome,
  registerSaveNow,
}: StudioProps) {
  // Master Prompt - The user's creative directive
  const [prompt, setPrompt] = useState<string>('');

  // Footage Media Items
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);

  // Audio Configuration
  const [audioSettings, setAudioSettings] = useState<AudioSettings>(DEFAULT_AUDIO());

  // Settings & Fine-Tune Controls (Tucked into Side Panel)
  const [isSidePanelOpen, setIsSidePanelOpen] = useState<boolean>(false);
  const [isNarrationOpen, setIsNarrationOpen] = useState<boolean>(false);
  const [narration, setNarration] = useState<NarrationState | null>(null);
  const [logo, setLogo] = useState<LogoSettings>(DEFAULT_LOGO);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('16:9');
  const [colorFilter, setColorFilter] = useState<ColorFilterType>('natural');
  const [captionStyle, setCaptionStyle] = useState<CaptionStyle>('beast-glow');
  const [preferredTransition, setPreferredTransition] = useState<TransitionType>('crossfade');
  const [preferredMotion, setPreferredMotion] = useState<MotionType>('push-in');
  const [voicePersona, setVoicePersona] = useState<string>('male-marcus');
  const [subtitleConfig, setSubtitleConfig] = useState<SubtitleConfig>(DEFAULT_SUBTITLE_CONFIG);

  const [project, setProject] = useState<VideoProject>(EMPTY_PROJECT());

  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generationStep, setGenerationStep] = useState<string>('');
  const [selectedClipId, setSelectedClipId] = useState<string | undefined>(undefined);
  const [showStoryboard, setShowStoryboard] = useState<boolean>(true);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);

  // Active clip: tracks current playback time, or falls back to selected clip
  const currentClip = project.clips.find(
    (c) => currentTime >= c.startTime && currentTime < c.startTime + c.duration
  ) || project.clips.find((c) => selectedClipId && c.id === selectedClipId) || project.clips[0];
  const currentClipIndex = project.clips.findIndex((c) => c.id === currentClip?.id);

  // ---- Restore a saved project (or start from the chosen industry preset) ----
  const [hasRestoreChecked, setHasRestoreChecked] = useState(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (initialPreset) {
        const built = buildFromPreset(initialPreset);
        if (cancelled) return;
        setMediaItems(built.mediaItems);
        setAspectRatio(initialPreset.aspectRatio);
        setPrompt(`${initialPreset.name}: ${initialPreset.description}`);
        setProject({
          ...EMPTY_PROJECT(initialPreset.aspectRatio),
          title: initialPreset.name,
          prompt: initialPreset.description,
          clips: built.clips,
          captions: built.captions,
          totalDuration: built.totalDuration,
        });
        setSelectedClipId(built.clips[0]?.id);
        if (built.musicPreset) {
          setAudioSettings((prev) => ({
            ...prev,
            music: { ...prev.music, url: built.musicPreset!.fileUrl, presetId: built.musicPreset!.id, name: built.musicPreset!.name },
          }));
        }
      } else {
        const saved = await loadStudioProject();
        if (cancelled) return;
        if (saved) {
          setPrompt(saved.prompt);
          setMediaItems(saved.mediaItems);
          setAudioSettings(saved.audioSettings);
          setAspectRatio(saved.aspectRatio);
          setColorFilter(saved.colorFilter);
          setCaptionStyle(saved.captionStyle);
          setPreferredTransition(saved.preferredTransition);
          setPreferredMotion(saved.preferredMotion);
          setVoicePersona(saved.voicePersona);
          setSubtitleConfig(saved.subtitleConfig);
          setNarration(saved.narration || null);
          setLogo(saved.logo || DEFAULT_LOGO);
          setProject(saved.project);
          setSelectedClipId(saved.project.clips[0]?.id);
          if (saved.droppedLargeMedia) {
            showToast(`${saved.droppedLargeMedia} large video(s) were too big to keep while you were away - please add them again.`, 'info');
          }
        }
      }
      if (!cancelled) setHasRestoreChecked(true);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Autosave (debounced) so a reload or the Stripe round-trip never loses the user's work ----
  const snapshotRef = useRef<any>(null);
  snapshotRef.current = { prompt, project, mediaItems, audioSettings, aspectRatio, colorFilter, captionStyle, preferredTransition, preferredMotion, voicePersona, subtitleConfig, narration, logo };

  const saveNow = useCallback(async () => {
    const snap = snapshotRef.current;
    if (!snap || snap.project.clips.length === 0) return;
    await saveStudioProject(snap);
  }, []);

  useEffect(() => {
    registerSaveNow?.(saveNow);
  }, [registerSaveNow, saveNow]);

  useEffect(() => {
    if (!hasRestoreChecked) return;
    if (project.clips.length === 0 && mediaItems.length === 0) {
      clearStudioProject();
      return;
    }
    const timeout = setTimeout(saveNow, 1500);
    return () => clearTimeout(timeout);
  }, [hasRestoreChecked, prompt, project, mediaItems, audioSettings, aspectRatio, colorFilter, captionStyle, preferredTransition, preferredMotion, voicePersona, subtitleConfig, narration, logo, saveNow]);

  // ---- Credit gate: one credit per export, same rule as before ----
  const handleBeforeExport = async (): Promise<boolean> => {
    if (totalAvailableCredits <= 0) {
      onOpenPricing(false);
      return false;
    }
    const result = await onDeductCredit();
    if (!result.success) {
      onOpenPricing(false);
      return false;
    }
    if (result.warningLow || result.remainingTotal <= 3) {
      setTimeout(() => onOpenPricing(true), 1200);
    }
    return true;
  };

  // ---- AI voiceover: each scene becomes exactly as long as its spoken line, so picture and words always match ----
  const defaultIndustry = (initialPreset && PRESET_INDUSTRY[initialPreset.id]) || DEFAULT_INDUSTRY;

  const handleApplyNarration = (r: ApplyNarrationResult) => {
    const byId = new Map(r.scenes.map((sc) => [sc.clipId, sc]));
    setProject((prev) => {
      let t = 0;
      const captions: CaptionSegment[] = [];
      const clips = prev.clips.map((c) => {
        const sc = byId.get(c.id);
        const duration = sc ? Number(sc.sceneDuration.toFixed(2)) : c.duration;
        const out: TimelineClip = {
          ...c,
          startTime: Number(t.toFixed(2)),
          duration,
          transitionDuration: Math.min(c.transitionDuration, duration * 0.45),
          caption: sc ? sc.line : c.caption,
        };
        if (sc) captions.push(...splitCaptionPhrases(sc.line, t + sc.lead, sc.voiceDuration, `cap-nar-${c.id}`));
        t += duration;
        return out;
      });
      return { ...prev, clips, captions, totalDuration: Number(t.toFixed(2)) };
    });

    const voiceName = [...MALE_VOICES, ...FEMALE_VOICES].find((v) => v.id === r.voiceId)?.name || 'AI';
    setAudioSettings((prev) => ({
      ...prev,
      voiceover: {
        ...prev.voiceover,
        url: r.audioUrl,
        name: `AI Voice (${voiceName})`,
        duration: r.audioDuration,
        transcript: r.scenes.map((sc) => sc.line).join(' '),
        useNativeSpeech: false,
        voicePersona: r.voiceId,
        muted: false,
      },
    }));
    setVoicePersona(r.voiceId);
    setNarration(r.state);
    showToast('Voiceover added. Press play to watch it.', 'success');
  };

  // Auto-Cut re-plans every scene, which would break the line-by-line match of an existing AI voiceover
  const handleAutoCutClick = () => {
    const voiced = !!narration?.voicedText && narration.signature === clipSignature(project.clips);
    if (voiced && !window.confirm('Auto-Cut will re-time your scenes and the AI voiceover will no longer match each photo. Continue?')) return;
    handleGenerateVideo(prompt, mediaItems, audioSettings);
  };

  const handleUpdateLogo = (patch: Partial<LogoSettings>) => {
    setLogo((prev) => {
      // free the memory of the previous file when it is replaced or removed
      if (patch.url !== undefined && prev.url && prev.url !== patch.url && prev.url.startsWith('blob:')) {
        URL.revokeObjectURL(prev.url);
      }
      return { ...prev, ...patch };
    });
  };

  const openNarration = () => {
    if (mediaItems.length === 0 || project.clips.length === 0) {
      showToast('Add your photos or videos first, then create the voiceover.', 'info');
      return;
    }
    setIsSidePanelOpen(false);
    setIsNarrationOpen(true);
  };

  const narrationStale = !!narration && narration.lines.length > 0 && narration.signature !== '' && narration.signature !== clipSignature(project.clips);

  const showToast = (message: string, type: 'success' | 'info' | 'error' = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3500);
  };

  // Stable time update handler with scene-boundary check to prevent UI re-render lag
  const handleTimeUpdate = useCallback((time: number) => {
    setCurrentTime((prev) => {
      const prevClip = project.clips.find((c) => prev >= c.startTime && prev < c.startTime + c.duration);
      const nextClip = project.clips.find((c) => time >= c.startTime && time < c.startTime + c.duration);
      if (prevClip?.id !== nextClip?.id || Math.abs(prev - time) > 0.8) {
        return time;
      }
      return prev;
    });
  }, [project.clips]);

  const handleOpenSettings = useCallback(() => {
    setIsSidePanelOpen(true);
  }, []);

  // MASTER AI VIDEO GENERATOR: Only triggers when the user clicks "Auto-Cut Video"
  const handleGenerateVideo = async (
    currentPrompt = prompt,
    items = mediaItems,
    currentAudio = audioSettings
  ) => {
    if (items.length === 0) {
      showToast('Please upload at least one image or video clip first.', 'info');
      return;
    }

    setIsGenerating(true);
    setGenerationStep('Analyzing prompt instructions & camera directives...');

    try {
      const pLower = currentPrompt.toLowerCase();

      // Check if user requested lowering music volume
      const lowerMusic =
        pLower.includes('lower') ||
        pLower.includes('duck') ||
        pLower.includes('quiet') ||
        pLower.includes('voice over');

      const updatedAudio: AudioSettings = {
        ...currentAudio,
        music: {
          ...currentAudio.music,
          autoDuck: lowerMusic || currentAudio.music.autoDuck,
          duckAmount: lowerMusic ? 0.15 : 0.25,
        },
      };
      setAudioSettings(updatedAudio);

      const hasVoice = !!updatedAudio.voiceover.url;
      const voiceoverDuration = hasVoice ? updatedAudio.voiceover.duration || 0 : 0;

      const response = await fetch('/api/generate-timeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: currentPrompt,
          items: items.map((it) => ({
            id: it.id,
            name: it.name,
            type: it.type,
            duration: it.duration,
          })),
          hasVoiceover: hasVoice,
          voiceoverDuration,
          voiceoverTranscript: updatedAudio.voiceover.transcript,
          aspectRatio,
        }),
      });

      const resData = await response.json();
      if (!resData.success || !resData.data) {
        throw new Error(resData.error || 'Failed to generate timeline');
      }

      const editData = resData.data;

      // Calculate start times (preserve per-scene title overlays from the director)
      const rawClips = editData.clips as any[];
      const rawTotal = rawClips.reduce((sum, c) => sum + (c.duration || 3.5), 0);
      // If a voiceover exists, stretch/shrink cuts so the video matches the narration length
      const scale =
        hasVoice && voiceoverDuration > 2 && rawTotal > 0 && Math.abs(rawTotal - voiceoverDuration) / voiceoverDuration > 0.1
          ? voiceoverDuration / rawTotal
          : 1;

      let currentT = 0;
      const timedClips: TimelineClip[] = rawClips.map((c: any, i: number) => {
        const dur = Number(((c.duration || 3.5) * scale).toFixed(2));
        const titleText: string | undefined = c.textOverlay?.text || c.title;
        const clipObj: TimelineClip = {
          id: `clip-${i}-${Date.now()}`,
          mediaId: c.mediaId || items[i % items.length].id,
          startTime: Number(currentT.toFixed(2)),
          duration: dur,
          transitionIn: (c.transitionIn as TransitionType) || (i === 0 ? 'none' : 'crossfade'),
          transitionDuration: Math.min(c.transitionDuration || 0.5, dur * 0.45),
          motionEffect: (c.motionEffect as MotionType) || 'push-in',
          trimStart: items.find((it) => it.id === (c.mediaId || items[i % items.length].id))?.type === 'video' ? 0 : undefined,
          caption: c.caption || `Scene ${i + 1}`,
          textOverlay: titleText
            ? {
                enabled: true,
                fontStyle: 'impact',
                fontSize: 34,
                textColor: '#FFFFFF',
                effect: 'outline',
                x: 0.5,
                y: 0.2,
                scale: 1.0,
                rotation: 0,
                ...(c.textOverlay || {}),
                text: String(titleText).toUpperCase(),
              }
            : undefined,
        };
        currentT += dur;
        return clipObj;
      });

      const timedCaptions = (editData.captions || []).map((cap: any) => ({
        ...cap,
        startTime: cap.startTime * scale,
        endTime: cap.endTime * scale,
      }));

      // Extract subtitle configuration from prompt directives
      const promptSubtitleConfig = parseSubtitleFromPrompt(currentPrompt, subtitleConfig);
      const finalSubtitleConfig = editData.subtitleConfig || promptSubtitleConfig;
      setSubtitleConfig(finalSubtitleConfig);

      setProject({
        title: editData.title || 'AI Director Cut',
        prompt: currentPrompt,
        aspectRatio,
        colorFilter: editData.colorFilter || colorFilter,
        captionStyle,
        subtitleConfig: finalSubtitleConfig,
        clips: timedClips,
        captions: timedCaptions.map((cap: any, idx: number) => ({
          id: `cap-${idx}`,
          startTime: cap.startTime,
          endTime: cap.endTime,
          text: cap.text,
          emphasis: cap.emphasis,
        })),
        totalDuration: currentT,
        styleSummary: editData.styleSummary,
      });

      showToast(
        resData.source === 'gemini'
          ? 'Auto-cut generated by Gemini from your prompt.'
          : 'Gemini was unavailable (check API key/model) - used the built-in local director instead.',
        resData.source === 'gemini' ? 'success' : 'info'
      );
    } catch (err: any) {
      console.error('Error generating video:', err);
      showToast("Couldn't reach the editing service. Your project is unchanged - please try again.", 'error');
    } finally {
      setIsGenerating(false);
      setGenerationStep('');
    }
  };

  // Footage Management: new media is APPENDED to the timeline so manual edits are never overwritten.
  // (Use the Auto-Cut button to re-direct the whole timeline on purpose.)
  const handleAddMedia = (newItems: MediaItem[]) => {
    setMediaItems([...mediaItems, ...newItems]);
    setProject((prev) => {
      let t = prev.clips.reduce((end, c) => Math.max(end, c.startTime + c.duration), 0);
      const added: TimelineClip[] = newItems.map((it, i) => {
        // A phone video can be minutes long: start with up to 10s of it (the Length / Start-at sliders adjust this)
        const dur = it.type === 'video' ? Math.min(it.duration || 5, 10) : it.duration || 3.5;
        const clip: TimelineClip = {
          id: `clip-add-${Date.now()}-${i}`,
          mediaId: it.id,
          startTime: Number(t.toFixed(2)),
          duration: dur,
          transitionIn: prev.clips.length === 0 && i === 0 ? 'none' : preferredTransition,
          transitionDuration: 0.5,
          motionEffect: it.type === 'image' ? preferredMotion : 'none',
          trimStart: it.type === 'video' ? 0 : undefined,
        };
        t += dur;
        return clip;
      });
      return { ...prev, clips: [...prev.clips, ...added], totalDuration: Number(t.toFixed(2)) };
    });
    showToast(`Added ${newItems.length} file(s) to the end of the timeline. Click Auto-Cut to re-direct everything.`, 'success');
  };

  const handleRemoveMedia = (id: string) => {
    const removed = mediaItems.find((it) => it.id === id);
    if (removed?.url.startsWith('blob:')) URL.revokeObjectURL(removed.url);
    setMediaItems(mediaItems.filter((it) => it.id !== id));
    setProject((prev) => {
      // Close the gap: re-pack start times and drop captions that belonged to removed clips
      let t = 0;
      const removedClipRanges = prev.clips.filter((c) => c.mediaId === id).map((c) => [c.startTime, c.startTime + c.duration]);
      const clips = prev.clips
        .filter((c) => c.mediaId !== id)
        .map((c, i) => {
          const nc = { ...c, startTime: Number(t.toFixed(2)), transitionIn: i === 0 ? ('none' as TransitionType) : c.transitionIn };
          t += c.duration;
          return nc;
        });
      const captions = prev.captions
        .filter((cap) => !removedClipRanges.some(([a, b]) => cap.startTime >= a - 0.01 && cap.startTime < b))
        .map((cap) => {
          // shift left by the total length of removed clips that came before this caption
          const shift = removedClipRanges.reduce((sum, [a, b]) => (b <= cap.startTime + 0.01 ? sum + (b - a) : sum), 0);
          return { ...cap, startTime: cap.startTime - shift, endTime: cap.endTime - shift };
        });
      return { ...prev, clips, captions, totalDuration: Number(t.toFixed(2)) };
    });
  };

  // Length / trim / original-sound edits on one clip. Later clips and captions move with it.
  const handleUpdateClipTiming = (clipId: string, patch: { duration?: number; trimStart?: number; keepAudio?: boolean }) => {
    setProject((prev) => {
      const idx = prev.clips.findIndex((c) => c.id === clipId);
      if (idx < 0) return prev;
      const old = prev.clips[idx];
      const media = mediaItems.find((m) => m.id === old.mediaId);
      const isVideo = media?.type === 'video';
      const srcDur = isVideo ? media?.duration || 0 : 0;

      let duration = Math.max(0.5, Math.min(120, Number((patch.duration ?? old.duration).toFixed(2))));
      let trimStart = patch.trimStart ?? old.trimStart ?? 0;
      if (isVideo && srcDur > 0) {
        trimStart = Math.max(0, Math.min(trimStart, Math.max(0, srcDur - 0.5)));
        // Moving the start point later leaves less video: shorten the clip instead of looping the last frames
        if (patch.trimStart !== undefined && patch.duration === undefined && duration > srcDur - trimStart) {
          duration = Math.max(0.5, Number((srcDur - trimStart).toFixed(2)));
        }
      }

      const updated: TimelineClip = {
        ...old,
        duration,
        transitionDuration: Math.min(old.transitionDuration, duration * 0.45),
        trimStart: isVideo ? trimStart : old.trimStart,
        keepAudio: patch.keepAudio ?? old.keepAudio,
      };

      const delta = duration - old.duration;
      const oldEnd = old.startTime + old.duration;
      let t = 0;
      const clips = prev.clips.map((c) => {
        const cc = c.id === clipId ? updated : c;
        const out = { ...cc, startTime: Number(t.toFixed(2)) };
        t += cc.duration;
        return out;
      });
      const captions = prev.captions.map((cap) => {
        if (cap.startTime >= oldEnd - 0.01) return { ...cap, startTime: cap.startTime + delta, endTime: cap.endTime + delta };
        if (cap.startTime >= old.startTime - 0.01 && cap.endTime > old.startTime + duration) {
          return { ...cap, endTime: Math.max(cap.startTime + 0.3, old.startTime + duration - 0.05) };
        }
        return cap;
      });
      return { ...prev, clips, captions, totalDuration: Number(t.toFixed(2)) };
    });
  };

  const handleUpdateClipTextOverlay = (clipId: string, overlay: SceneTextOverlay | undefined) => {
    setProject((prev) => ({
      ...prev,
      clips: prev.clips.map((c) => (c.id === clipId ? { ...c, textOverlay: overlay } : c)),
    }));
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white pb-16">
      {/* Toast Notification */}
      {notification && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center space-x-2 px-4 py-3 rounded-xl shadow-2xl backdrop-blur-md border text-xs transition-all ${
            notification.type === 'success'
              ? 'bg-emerald-950/90 border-emerald-500 text-emerald-200'
              : notification.type === 'error'
              ? 'bg-red-950/90 border-red-500 text-red-200'
              : 'bg-indigo-950/90 border-indigo-500 text-indigo-200'
          }`}
        >
          <Sparkles className="w-4 h-4 text-emerald-400" />
          <span>{notification.message}</span>
        </div>
      )}

      {/* Clean Top Navigation Bar */}
      <header className="border-b border-slate-800/80 bg-slate-900/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-2">
          <div
            className="flex items-center space-x-2.5 cursor-pointer"
            onClick={onReturnToWelcome}
            title="Back to the ReelCraft home page"
          >
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 p-0.5 flex items-center justify-center shadow-md">
              <div className="w-full h-full bg-slate-950 rounded-[7px] flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-indigo-400" />
              </div>
            </div>
            <div>
              <span className="text-base font-extrabold tracking-tight text-white">ReelCraft PRO</span>
              <span className="text-[10px] text-slate-400 ml-2 hidden sm:inline">Zero-Edit Video Creator</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <CreditBadge
              currentAccount={currentAccount}
              totalAvailable={totalAvailableCredits}
              onOpenPricing={() => onOpenPricing(false)}
            />
            <button
              onClick={onReturnToWelcome}
              className="hidden sm:flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700 transition-all cursor-pointer"
              title="Choose an industry template"
            >
              <Home className="w-3.5 h-3.5 text-indigo-300" />
              <span>Templates</span>
            </button>
            <button
              onClick={() => onOpenHelp('help')}
              title="Help & Support"
              className="flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-indigo-300 p-2 rounded-lg border border-slate-700 transition-colors cursor-pointer"
            >
              <LifeBuoy className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                setIsNarrationOpen(false);
                setIsSidePanelOpen(!isSidePanelOpen);
              }}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                isSidePanelOpen
                  ? 'bg-indigo-600 text-white border-indigo-500 shadow-md'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700 hover:border-indigo-500/50'
              }`}
              title="Toggle Settings & Controls"
            >
              <Sliders className="w-3.5 h-3.5 text-indigo-300" />
              <span className="hidden sm:inline">Settings & Controls</span>
              {isSidePanelOpen && <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse ml-1" />}
            </button>
          </div>
        </div>
      </header>

      {/* Main Streamlined Workspace */}
      <main
        className={`max-w-5xl mx-auto px-4 pt-6 w-full space-y-6 flex-1 transition-all duration-200 ${
          isSidePanelOpen || isNarrationOpen ? 'xl:mr-[400px] xl:max-w-4xl' : ''
        }`}
      >
        {/* 1. MASTER PROMPT DIRECTIVE BAR */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center space-x-1.5">
              <Wand2 className="w-4 h-4 text-purple-400" />
              <span>How do you want the video edited? (Prompt Directive)</span>
            </label>
            <span className="text-[11px] text-slate-400 hidden sm:inline">
              Controls pacing, camera motions, transitions & audio ducking
            </span>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <textarea
              rows={2}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g., Make a fast, energetic promo with whip transitions and punchy titles. Lower the music when the voiceover speaks..."
              className="flex-1 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl p-3 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all resize-none"
            />

            <div className="flex sm:flex-col gap-2 sm:w-44 shrink-0">
              <button
                onClick={handleAutoCutClick}
                disabled={isGenerating || mediaItems.length === 0}
                className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:via-purple-500 hover:to-pink-500 disabled:opacity-50 text-white font-bold text-xs shadow-lg shadow-indigo-900/30 transition-all flex items-center justify-center space-x-1.5 cursor-pointer active:scale-95"
              >
                <Sparkles className="w-4 h-4" />
                <span>{isGenerating ? 'Editing Video...' : '✨ Auto-Cut Video'}</span>
              </button>
              <button
                onClick={openNarration}
                className="relative flex-1 py-2 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-pink-500/60 text-slate-100 font-semibold text-xs transition-all flex items-center justify-center space-x-1.5 cursor-pointer active:scale-95"
                title="Write and voice a narration that matches your photos"
              >
                <Mic className="w-4 h-4 text-pink-400" />
                <span>AI Voiceover</span>
                {narrationStale && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-400 border-2 border-slate-900" />}
              </button>
            </div>
          </div>

          {/* Director Treatment Note */}
          {project.styleSummary && (
            <div className="text-[11px] text-slate-400 flex items-center space-x-1.5 pt-1">
              <span className="font-semibold text-slate-300">Active Directive:</span>
              <span className="italic truncate">{project.styleSummary}</span>
            </div>
          )}
        </div>

        {/* 2. VIDEO CANVAS PLAYER (Center Stage) */}
        <div className="w-full">
          <VideoCanvasPlayer
            project={project}
            mediaItems={mediaItems}
            audioSettings={audioSettings}
            selectedClipId={selectedClipId}
            onTimeUpdate={handleTimeUpdate}
            onClipSelect={setSelectedClipId}
            onUpdateClipTextOverlay={handleUpdateClipTextOverlay}
            onOpenSettings={handleOpenSettings}
            isGenerating={isGenerating}
            generationStep={generationStep}
            onBeforeExport={handleBeforeExport}
            logo={logo}
          />
        </div>

        {/* 3. MEDIA FOOTAGE (Minimal Dropzone) */}
        <div className="w-full">
          <MediaUploader
            mediaItems={mediaItems}
            onAddMedia={handleAddMedia}
            onRemoveMedia={handleRemoveMedia}
          />
        </div>

        {/* Optional Collapsible Storyboard Inspector */}
        <div className="w-full pt-1">
          <button
            onClick={() => setShowStoryboard(!showStoryboard)}
            className="text-xs text-slate-300 hover:text-white flex items-center space-x-1.5 transition-colors cursor-pointer bg-slate-900/80 px-3 py-1.5 rounded-xl border border-slate-800"
          >
            <Layers className="w-3.5 h-3.5 text-indigo-400" />
            <span className="font-semibold">
              {showStoryboard ? 'Hide Storyboard' : 'AI Director Cut Storyboard & Text Overlay Controls'}
            </span>
            <ChevronRight className={`w-3.5 h-3.5 transition-transform ${showStoryboard ? 'rotate-90' : ''}`} />
          </button>

          {showStoryboard && (
            <div className="mt-3">
              <TimelineInspector
                clips={project.clips}
                mediaItems={mediaItems}
                selectedClipId={selectedClipId}
                onSelectClip={(id) => {
                  setSelectedClipId(id);
                  const cl = project.clips.find((c) => c.id === id);
                  if (cl) setCurrentTime(cl.startTime + 0.05);
                }}
                onUpdateClipTransition={(clipId, trans) => {
                  setProject((prev) => ({
                    ...prev,
                    clips: prev.clips.map((c) =>
                      c.id === clipId ? { ...c, transitionIn: trans } : c
                    ),
                  }));
                }}
                onUpdateClipMotion={(clipId, motion) => {
                  setProject((prev) => ({
                    ...prev,
                    clips: prev.clips.map((c) =>
                      c.id === clipId ? { ...c, motionEffect: motion } : c
                    ),
                  }));
                }}
                onUpdateClipTextOverlay={handleUpdateClipTextOverlay}
                onOpenSettings={() => setIsSidePanelOpen(true)}
                onUpdateClipTiming={handleUpdateClipTiming}
              />
            </div>
          )}
        </div>
      </main>

      {/* FLYOUT / DROPDOWN SIDE PANEL CONTROLS */}
      <NarrationPanel
        isOpen={isNarrationOpen}
        onClose={() => setIsNarrationOpen(false)}
        clips={project.clips}
        mediaItems={mediaItems}
        value={narration}
        defaultIndustry={defaultIndustry}
        defaultVoiceId={voicePersona}
        onChange={setNarration}
        onApply={handleApplyNarration}
      />

      <SideControlPanel
        isOpen={isSidePanelOpen}
        onClose={() => setIsSidePanelOpen(false)}
        onOpenNarration={openNarration}
        logo={logo}
        onUpdateLogo={handleUpdateLogo}
        audioSettings={audioSettings}
        onUpdateAudio={(updated) => setAudioSettings((prev) => ({ ...prev, ...updated }))}
        aspectRatio={aspectRatio}
        onAspectRatioChange={(r) => {
          setAspectRatio(r);
          setProject((prev) => ({ ...prev, aspectRatio: r }));
        }}
        colorFilter={colorFilter}
        onColorFilterChange={(f) => {
          setColorFilter(f);
          setProject((prev) => ({ ...prev, colorFilter: f }));
        }}
        captionStyle={captionStyle}
        onCaptionStyleChange={(s) => {
          setCaptionStyle(s);
          setProject((prev) => ({ ...prev, captionStyle: s }));
        }}
        subtitleConfig={subtitleConfig}
        onSubtitleConfigChange={(newCfg) => {
          setSubtitleConfig(newCfg);
          setProject((prev) => ({ ...prev, subtitleConfig: newCfg }));
        }}
        preferredTransition={preferredTransition}
        onPreferredTransitionChange={(t) => {
          setPreferredTransition(t);
          setProject((prev) => ({
            ...prev,
            clips: prev.clips.map((c, idx) => (idx === 0 ? c : { ...c, transitionIn: t })),
          }));
        }}
        preferredMotion={preferredMotion}
        onPreferredMotionChange={(m) => {
          setPreferredMotion(m);
          setProject((prev) => ({
            ...prev,
            clips: prev.clips.map((c) => ({ ...c, motionEffect: m })),
          }));
        }}
        voicePersona={voicePersona}
        onVoicePersonaChange={setVoicePersona}
        currentClip={currentClip}
        currentClipIndex={currentClipIndex}
        onUpdateCurrentClipTextOverlay={(overlay) => {
          if (currentClip) {
            handleUpdateClipTextOverlay(currentClip.id, overlay);
          }
        }}
      />
    </div>
  );
}
