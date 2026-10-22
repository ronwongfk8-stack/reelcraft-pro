import React, { useState, useRef } from 'react';
import { MALE_VOICES, FEMALE_VOICES } from '../../data/voiceData';
import { MUSIC_PRESETS as LIVE_MUSIC_PRESETS } from '../../data/sampleAssets';
import {
  X,
  Volume2,
  VolumeX,
  Zap,
  Film,
  Mic,
  Music,
  Palette,
  Sliders,
  ChevronDown,
  ChevronRight,
  Upload,
  Square,
  Sparkles,
  Smartphone,
  Tv,
  CheckCircle2,
  Radio,
  SlidersHorizontal,
  Type,
  MessageSquare,
  RotateCcw,
  ImagePlus,
  Trash2,
} from 'lucide-react';
import {
  AudioSettings,
  TransitionType,
  MotionType,
  ColorFilterType,
  AspectRatio,
  CaptionStyle,
  SubtitleConfig,
  CaptionAnimationStyle,
  CaptionFontStyle,
  TimelineClip,
  SceneTextOverlay,
  LogoSettings,
  LogoPosition,
} from '../types';
import { audioEngine } from '../utils/audioEngine';
import { MUSIC_PRESETS, TRANSITION_DESCRIPTIONS } from '../utils/sampleData';
import { DEFAULT_SUBTITLE_CONFIG } from '../utils/subtitleParser';

interface SideControlPanelProps {
  isOpen: boolean;
  onClose: () => void;
  audioSettings: AudioSettings;
  onUpdateAudio: (updated: Partial<AudioSettings>) => void;
  aspectRatio: AspectRatio;
  onAspectRatioChange: (ratio: AspectRatio) => void;
  colorFilter: ColorFilterType;
  onColorFilterChange: (filter: ColorFilterType) => void;
  captionStyle: CaptionStyle;
  onCaptionStyleChange: (style: CaptionStyle) => void;
  subtitleConfig?: SubtitleConfig;
  onSubtitleConfigChange?: (config: SubtitleConfig) => void;
  preferredTransition: TransitionType;
  onPreferredTransitionChange: (trans: TransitionType) => void;
  preferredMotion: MotionType;
  onPreferredMotionChange: (motion: MotionType) => void;
  voicePersona: string;
  onVoicePersonaChange: (persona: string) => void;
  onVoiceoverTranscribed?: (transcript: string) => void;
  onOpenNarration?: () => void;
  logo?: LogoSettings;
  onUpdateLogo?: (patch: Partial<LogoSettings>) => void;
  currentClip?: TimelineClip;
  currentClipIndex?: number;
  onUpdateCurrentClipTextOverlay?: (overlay: SceneTextOverlay | undefined) => void;
}

const SideControlPanelComponent: React.FC<SideControlPanelProps> = ({
  isOpen,
  onClose,
  audioSettings,
  onUpdateAudio,
  aspectRatio,
  onAspectRatioChange,
  colorFilter,
  onColorFilterChange,
  captionStyle,
  onCaptionStyleChange,
  subtitleConfig = DEFAULT_SUBTITLE_CONFIG,
  onSubtitleConfigChange,
  preferredTransition,
  onPreferredTransitionChange,
  preferredMotion,
  onPreferredMotionChange,
  voicePersona,
  onVoicePersonaChange,
  onVoiceoverTranscribed,
  onOpenNarration,
  logo,
  onUpdateLogo,
  currentClip,
  currentClipIndex = 0,
  onUpdateCurrentClipTextOverlay,
}) => {
  // Collapsible dropdown menu states
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    logo: false,
    audio: false,
    transitions: false,
    effects: false,
    voiceover: false,
    music: false,
    videostyle: false,
    titleOverlay: true,
    subtitles: true,
  });

  const toggleSection = (section: string) => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const logoFileInputRef = useRef<HTMLInputElement | null>(null);
  const [logoNotice, setLogoNotice] = useState<string | null>(null);

  const handleLogoFile = (file: File | undefined | null) => {
    if (!file || !onUpdateLogo) return;
    setLogoNotice(null);
    if (!/^image\/(png|jpe?g|webp|gif|svg\+xml)$/i.test(file.type)) {
      setLogoNotice('Please choose a PNG, JPG, WebP or SVG image.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setLogoNotice('That file is over 5 MB. Please use a smaller logo.');
      return;
    }
    onUpdateLogo({ url: URL.createObjectURL(file), name: file.name });
  };

  const voiceFileInputRef = useRef<HTMLInputElement | null>(null);
  const musicFileInputRef = useRef<HTMLInputElement | null>(null);

  const [isRecording, setIsRecording] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const [activeRecorder, setActiveRecorder] = useState<{ stop: () => void } | null>(null);
  const [isGeneratingTTS, setIsGeneratingTTS] = useState(false);
  const [voiceNotice, setVoiceNotice] = useState<{ kind: 'ok' | 'warn'; text: string } | null>(null);
  const recordStartRef = useRef<number>(0);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const [customScript, setCustomScript] = useState(audioSettings.voiceover.transcript || '');
  const [previewPlaying, setPreviewPlaying] = useState(false);

  const recordTimerRef = useRef<any>(null);

  // Sync custom script when audio settings change
  React.useEffect(() => {
    const text = audioSettings.voiceover.transcript;
    if (text) {
      setCustomScript((prev) => (prev === text ? prev : text));
    }
  }, [audioSettings.voiceover.transcript]);

  // Keep Title Overlay and Captions sections open and visible when panel opens or slide changes
  React.useEffect(() => {
    if (isOpen) {
      setOpenSections((prev) => {
        if (prev.titleOverlay && prev.subtitles) return prev;
        return { ...prev, titleOverlay: true, subtitles: true };
      });
    }
  }, [isOpen, currentClip?.id]);

  // Handle Voice Audio Upload
  const handleVoiceUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    const audio = new Audio(url);
    audio.onerror = () => setVoiceNotice({ kind: 'warn', text: "That audio file couldn't be read. Try MP3, WAV or M4A." });
    audio.onloadedmetadata = () => {
      onUpdateAudio({
        voiceover: {
          ...audioSettings.voiceover,
          url,
          name: file.name,
          duration: audio.duration || 12,
          useNativeSpeech: false,
        },
      });
    };
    if (voiceFileInputRef.current) voiceFileInputRef.current.value = '';
  };

  // Handle Music Upload
  const handleMusicUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    const audio = new Audio(url);
    audio.onloadedmetadata = () => {
      onUpdateAudio({
        music: {
          ...audioSettings.music,
          url,
          name: file.name,
          duration: audio.duration || 60,
          presetId: undefined,
        },
      });
    };
    if (musicFileInputRef.current) musicFileInputRef.current.value = '';
  };

  // Generate / Attach Voiceover (Gemini TTS via the existing /api/voiceover/generate)
  const handleGenerateVoiceover = async () => {
    if (!customScript.trim()) return;
    setIsGeneratingTTS(true);
    setVoiceNotice(null);
    try {
      const res = await audioEngine.generateVoiceoverAudio(customScript, voicePersona);
      const voiceName = [...MALE_VOICES, ...FEMALE_VOICES].find((v) => v.id === voicePersona)?.name || voicePersona;
      onUpdateAudio({
        voiceover: {
          ...audioSettings.voiceover,
          url: res.url,
          name: `AI Voice (${voiceName})`,
          duration: res.duration,
          transcript: customScript,
          useNativeSpeech: false,
          voicePersona,
          muted: false,
        },
      });
      if (onVoiceoverTranscribed) onVoiceoverTranscribed(customScript);
      setVoiceNotice({
        kind: 'ok',
        text: `Voiceover ready (${res.duration.toFixed(1)}s). Click "Auto-Cut Video" to re-time the scenes to the narration.`,
      });
    } catch (e: any) {
      console.warn('Voice generation failed:', e);
      setVoiceNotice({
        kind: 'warn',
        text: `${e?.message || 'Voice generation failed.'} Nothing was changed - please try again in a moment.`,
      });
    } finally {
      setIsGeneratingTTS(false);
    }
  };

  // Live Mic Recording
  const startRecording = async () => {
    try {
      setRecordDuration(0);
      recordStartRef.current = Date.now();
      setIsRecording(true);
      const recorder = await audioEngine.startMicrophoneRecording(async (blob) => {
        const url = URL.createObjectURL(blob);
        const duration = Math.max(1, (Date.now() - recordStartRef.current) / 1000);
        onUpdateAudio({
          voiceover: {
            ...audioSettings.voiceover,
            url,
            name: `Live Recording (${duration.toFixed(0)}s)`,
            duration,
            isRecorded: true,
            useNativeSpeech: false,
          },
        });
      });
      setActiveRecorder(recorder);
      recordTimerRef.current = setInterval(() => {
        setRecordDuration((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      setIsRecording(false);
      setVoiceNotice({ kind: 'warn', text: `Couldn't start the microphone: ${err?.message || 'permission denied or unsupported browser'}.` });
    }
  };

  const stopRecording = () => {
    if (activeRecorder) {
      activeRecorder.stop();
      setActiveRecorder(null);
    }
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    setIsRecording(false);
  };

  // Preview Voiceover (plays the generated/uploaded audio file only)
  const handleTogglePreviewVoice = () => {
    if (previewPlaying) {
      previewAudioRef.current?.pause();
      previewAudioRef.current = null;
      setPreviewPlaying(false);
      return;
    }
    if (!audioSettings.voiceover.url) {
      setVoiceNotice({ kind: 'warn', text: 'Generate, upload or record a voiceover first, then you can listen to it here.' });
      return;
    }
    const a = new Audio(audioSettings.voiceover.url);
    previewAudioRef.current = a;
    a.volume = Math.min(1, audioSettings.voiceover.volume);
    a.play().catch(() => {});
    setPreviewPlaying(true);
    a.onended = () => setPreviewPlaying(false);
  };

  if (!isOpen) return null;

  return (
    <aside
      className="fixed top-14 right-0 bottom-0 z-40 w-full sm:w-96 bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col overflow-hidden text-slate-100"
      aria-label="Settings and Control Panel"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3.5 border-b border-slate-800 bg-slate-950/90">
        <div className="flex items-center space-x-2">
          <Sliders className="w-4 h-4 text-indigo-400" />
          <div>
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Settings & Controls
            </h3>
            <span className="text-[10px] text-emerald-400 font-mono block">● Live video active</span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          title="Close Panel"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

        {/* Scrollable Accordion Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {/* 0. LOGO SECTION */}
          {onUpdateLogo && logo && (
            <div className="rounded-xl border border-slate-800 bg-slate-950/70 overflow-hidden">
              <button
                onClick={() => toggleSection('logo')}
                className="w-full flex items-center justify-between p-3.5 text-xs font-bold text-slate-200 hover:bg-slate-800/60 transition-colors cursor-pointer"
              >
                <div className="flex items-center space-x-2">
                  <ImagePlus className="w-4 h-4 text-amber-400" />
                  <span>Logo</span>
                  {logo.url && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-700/50 font-mono">
                      On
                    </span>
                  )}
                </div>
                {openSections.logo ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>

              {openSections.logo && (
                <div className="p-3.5 pt-3 border-t border-slate-800/80 space-y-3 text-xs">
                  <input
                    ref={logoFileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
                    className="hidden"
                    onChange={(e) => {
                      handleLogoFile((e.target as HTMLInputElement).files?.[0]);
                      if (logoFileInputRef.current) logoFileInputRef.current.value = '';
                    }}
                  />

                  {!logo.url ? (
                    <button
                      onClick={() => logoFileInputRef.current?.click()}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        handleLogoFile(e.dataTransfer.files?.[0]);
                      }}
                      className="w-full flex flex-col items-center justify-center space-y-1 py-5 rounded-xl border-2 border-dashed border-slate-700 hover:border-amber-500/70 bg-slate-900/60 text-slate-300 hover:text-amber-200 transition-colors cursor-pointer"
                    >
                      <Upload className="w-4 h-4" />
                      <span className="font-semibold">Upload your logo</span>
                      <span className="text-[10px] text-slate-500">PNG with a transparent background works best</span>
                    </button>
                  ) : (
                    <>
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-14 h-14 shrink-0 rounded-lg border border-slate-700 overflow-hidden flex items-center justify-center"
                          style={{
                            backgroundColor: '#0f172a',
                            backgroundImage:
                              'linear-gradient(45deg,#1e293b 25%,transparent 25%),linear-gradient(-45deg,#1e293b 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#1e293b 75%),linear-gradient(-45deg,transparent 75%,#1e293b 75%)',
                            backgroundSize: '10px 10px',
                            backgroundPosition: '0 0,0 5px,5px -5px,-5px 0',
                          }}
                        >
                          <img src={logo.url} alt="Your logo" className="max-w-full max-h-full object-contain" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[11px] text-slate-200 font-semibold truncate">{logo.name || 'Logo'}</div>
                          <div className="flex items-center gap-1.5 mt-1.5">
                            <button
                              onClick={() => logoFileInputRef.current?.click()}
                              className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold cursor-pointer"
                            >
                              Replace
                            </button>
                            <button
                              onClick={() => onUpdateLogo({ url: null, name: '' })}
                              aria-label="Remove logo"
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-red-600 text-slate-300 hover:text-white cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <span className="text-slate-400 block font-semibold">Position</span>
                        <div className="grid grid-cols-2 gap-1.5">
                          {(
                            [
                              ['top-left', 'Top left'],
                              ['top-right', 'Top right'],
                              ['bottom-left', 'Bottom left'],
                              ['bottom-right', 'Bottom right'],
                            ] as [LogoPosition, string][]
                          ).map(([pos, label]) => (
                            <button
                              key={pos}
                              onClick={() => onUpdateLogo({ position: pos })}
                              className={`py-1.5 rounded-lg border text-[11px] font-semibold transition-colors cursor-pointer ${
                                logo.position === pos
                                  ? 'bg-amber-500/20 border-amber-500 text-amber-200'
                                  : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-600'
                              }`}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="flex items-center justify-between text-slate-400 font-semibold">
                          <span>Size</span>
                          <span className="font-mono text-slate-300">{Math.round(logo.size)}%</span>
                        </label>
                        <input
                          type="range"
                          min={4}
                          max={40}
                          step={1}
                          value={logo.size}
                          onChange={(e) => onUpdateLogo({ size: Number(e.target.value) })}
                          className="w-full accent-amber-400 cursor-pointer"
                          aria-label="Logo size"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="flex items-center justify-between text-slate-400 font-semibold">
                          <span>Opacity</span>
                          <span className="font-mono text-slate-300">{Math.round(logo.opacity * 100)}%</span>
                        </label>
                        <input
                          type="range"
                          min={20}
                          max={100}
                          step={5}
                          value={Math.round(logo.opacity * 100)}
                          onChange={(e) => onUpdateLogo({ opacity: Number(e.target.value) / 100 })}
                          className="w-full accent-amber-400 cursor-pointer"
                          aria-label="Logo opacity"
                        />
                      </div>
                    </>
                  )}

                  {logoNotice && (
                    <p className="text-[11px] text-amber-300 bg-amber-950/50 border border-amber-800/60 rounded-lg px-2.5 py-1.5">
                      {logoNotice}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 1. AUDIO SECTION */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/70 overflow-hidden">
            <button
              onClick={() => toggleSection('audio')}
              className="w-full flex items-center justify-between p-3.5 text-xs font-bold text-slate-200 hover:bg-slate-800/60 transition-colors"
            >
              <div className="flex items-center space-x-2">
                <Volume2 className="w-4 h-4 text-purple-400" />
                <span>Audio (Music, Voiceover & Auto-Ducking)</span>
              </div>
              {openSections.audio ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>

            {openSections.audio && (
              <div className="p-3.5 pt-0 border-t border-slate-800/80 space-y-4 text-xs">
                {/* Voiceover Volume */}
                <div className="space-y-1.5 pt-2">
                  <div className="flex items-center justify-between text-slate-300">
                    <span className="font-semibold">Voiceover Volume</span>
                    <span className="font-mono text-pink-300">
                      {Math.round(audioSettings.voiceover.volume * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1.0}
                    step={0.05}
                    value={audioSettings.voiceover.volume}
                    onChange={(e) => {
                      const newVol = parseFloat(e.target.value);
                      audioEngine.setVoiceoverVolume(newVol, false);
                      onUpdateAudio({
                        voiceover: {
                          ...audioSettings.voiceover,
                          volume: newVol,
                          muted: false,
                        },
                      });
                    }}
                    className="w-full h-1.5 bg-slate-800 rounded appearance-none cursor-pointer accent-pink-500"
                  />
                </div>

                {/* Music Volume */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-slate-300">
                    <span className="font-semibold">Background Music Volume</span>
                    <span className="font-mono text-indigo-300">
                      {Math.round(audioSettings.music.volume * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={0.8}
                    step={0.05}
                    value={audioSettings.music.volume}
                    onChange={(e) => {
                      const newVol = parseFloat(e.target.value);
                      audioEngine.setMusicVolume(newVol, false);
                      onUpdateAudio({
                        music: {
                          ...audioSettings.music,
                          volume: newVol,
                          muted: false,
                        },
                      });
                    }}
                    className="w-full h-1.5 bg-slate-800 rounded appearance-none cursor-pointer accent-indigo-500"
                  />
                </div>

                {/* Auto Ducking */}
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                  <div>
                    <span className="font-semibold block text-slate-200">Lower Music on Voiceover</span>
                    <span className="text-[10px] text-slate-400">Dips music bed automatically while narrator speaks</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={audioSettings.music.autoDuck}
                    onChange={(e) =>
                      onUpdateAudio({
                        music: { ...audioSettings.music, autoDuck: e.target.checked },
                      })
                    }
                    className="w-4 h-4 rounded text-indigo-600 bg-slate-800 border-slate-700"
                  />
                </div>
              </div>
            )}
          </div>

          {/* 2. TRANSITIONS SECTION */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/70 overflow-hidden">
            <button
              onClick={() => toggleSection('transitions')}
              className="w-full flex items-center justify-between p-3.5 text-xs font-bold text-slate-200 hover:bg-slate-800/60 transition-colors"
            >
              <div className="flex items-center space-x-2">
                <Zap className="w-4 h-4 text-amber-400" />
                <span>Transitions Available ({TRANSITION_DESCRIPTIONS.length})</span>
              </div>
              {openSections.transitions ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>

            {openSections.transitions && (
              <div className="p-3.5 pt-0 border-t border-slate-800/80 space-y-2 text-xs">
                <p className="text-[11px] text-slate-400 pt-2">
                  Preferred cut style (AI applies transitions matching your prompt directives):
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {TRANSITION_DESCRIPTIONS.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => onPreferredTransitionChange(t.id as TransitionType)}
                      className={`text-left p-2 rounded-lg border transition-all ${
                        preferredTransition === t.id
                          ? 'bg-amber-500/20 border-amber-500 text-amber-200 font-semibold'
                          : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <span className="block font-medium">{t.name}</span>
                      <span className="block text-[10px] text-slate-500 truncate">{t.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 3. EFFECTS & MOTION SECTION */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/70 overflow-hidden">
            <button
              onClick={() => toggleSection('effects')}
              className="w-full flex items-center justify-between p-3.5 text-xs font-bold text-slate-200 hover:bg-slate-800/60 transition-colors"
            >
              <div className="flex items-center space-x-2">
                <Film className="w-4 h-4 text-cyan-400" />
                <span>Camera Effects & Motion</span>
              </div>
              {openSections.effects ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>

            {openSections.effects && (
              <div className="p-3.5 pt-0 border-t border-slate-800/80 space-y-2 text-xs">
                <p className="text-[11px] text-slate-400 pt-2">
                  Dynamic Ken Burns camera motion (e.g. Drone fly pass, walk-through):
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'push-in', label: 'Walk-through (Push In)', desc: 'Interior walk forward' },
                    { id: 'pan-left', label: 'Drone Fly Pass (Left)', desc: 'Wide aerial sweep' },
                    { id: 'pan-right', label: 'Drone Fly Pass (Right)', desc: 'Wide aerial sweep' },
                    { id: 'pull-out', label: 'Reveal (Pull Out)', desc: 'Spacious zoom out' },
                    { id: 'subtle-drift', label: 'Worm Eye / Drift', desc: 'Ground handheld drift' },
                    { id: 'none', label: 'Static (Hard Cut)', desc: 'No camera pan' },
                  ].map((m) => (
                    <button
                      key={m.id}
                      onClick={() => onPreferredMotionChange(m.id as MotionType)}
                      className={`text-left p-2 rounded-lg border transition-all ${
                        preferredMotion === m.id
                          ? 'bg-cyan-500/20 border-cyan-500 text-cyan-200 font-semibold'
                          : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <span className="block font-medium">{m.label}</span>
                      <span className="block text-[10px] text-slate-500">{m.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 4. VOICE OVER SECTION */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/70 overflow-hidden">
            <button
              onClick={() => toggleSection('voiceover')}
              className="w-full flex items-center justify-between p-3.5 text-xs font-bold text-slate-200 hover:bg-slate-800/60 transition-colors"
            >
              <div className="flex items-center space-x-2">
                <Mic className="w-4 h-4 text-pink-400" />
                <span>Voice Over (Choose Style / Upload)</span>
              </div>
              {openSections.voiceover ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>

            {openSections.voiceover && (
              <div className="p-3.5 pt-0 border-t border-slate-800/80 space-y-3 text-xs">
                {onOpenNarration && (
                  <button
                    onClick={onOpenNarration}
                    className="mt-3 w-full flex items-center justify-center space-x-1.5 py-2.5 rounded-xl bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-bold text-xs shadow cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Create AI voiceover from my photos</span>
                  </button>
                )}
                {/* Upload or Record Voice */}
                <div className="flex items-center space-x-2">
                  <input
                    ref={voiceFileInputRef}
                    type="file"
                    accept="audio/*"
                    onChange={handleVoiceUpload}
                    className="hidden"
                  />
                  <button
                    onClick={() => voiceFileInputRef.current?.click()}
                    className="flex-1 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition-colors flex items-center justify-center space-x-1"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload Voice Audio</span>
                  </button>

                  {isRecording ? (
                    <button
                      onClick={stopRecording}
                      className="flex-1 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-semibold animate-pulse flex items-center justify-center space-x-1"
                    >
                      <Square className="w-3.5 h-3.5 fill-white" />
                      <span>Stop ({recordDuration}s)</span>
                    </button>
                  ) : (
                    <button
                      onClick={startRecording}
                      className="flex-1 py-1.5 rounded-lg bg-pink-600/20 hover:bg-pink-600/30 text-pink-300 text-xs font-medium border border-pink-500/30 flex items-center justify-center space-x-1"
                    >
                      <Mic className="w-3.5 h-3.5" />
                      <span>Record Mic</span>
                    </button>
                  )}
                </div>
                {voiceNotice && (
                  <p
                    className={`text-[11px] leading-snug rounded-lg px-2.5 py-1.5 border ${
                      voiceNotice.kind === 'ok'
                        ? 'text-emerald-300 bg-emerald-950/50 border-emerald-800/60'
                        : 'text-amber-300 bg-amber-950/50 border-amber-800/60'
                    }`}
                  >
                    {voiceNotice.text}
                  </p>
                )}
                <details className="rounded-lg border border-slate-800 bg-slate-900/50">
                  <summary className="cursor-pointer select-none px-3 py-2 text-[11px] font-semibold text-slate-300 hover:text-white">
                    Or type my own script
                  </summary>
                  <div className="px-3 pb-3 space-y-3">
                <div className="pt-2 space-y-1.5">
                  <span className="text-slate-400 block font-semibold">Select Voice Persona:</span>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[...MALE_VOICES, ...FEMALE_VOICES].map((v) => ({ id: v.id, label: v.name, desc: v.tone })).concat([]).map((v) => (                      <button
                        key={v.id}
                        onClick={() => onVoicePersonaChange(v.id)}
                        className={`text-left p-2 rounded-lg border transition-all ${
                          voicePersona === v.id
                            ? 'bg-pink-500/20 border-pink-500 text-pink-200 font-semibold'
                            : 'bg-slate-900 border-slate-800 text-slate-300'
                        }`}
                      >
                        <span className="block">{v.label}</span>
                        <span className="block text-[10px] text-slate-500">{v.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Voice Script & Generate */}
                <div className="space-y-1.5">
                  <label className="text-slate-400 block font-semibold">Narration Script:</label>
                  <textarea
                    rows={2}
                    value={customScript}
                    onChange={(e) => setCustomScript(e.target.value)}
                    placeholder="Enter script to narrate..."
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 focus:outline-none focus:border-pink-500 font-mono"
                  />
                  <div className="flex items-center space-x-2 pt-1">
                    <button
                      onClick={handleGenerateVoiceover}
                      disabled={isGeneratingTTS || !customScript.trim()}
                      className="px-3 py-1.5 rounded-lg bg-pink-600 hover:bg-pink-500 text-white font-semibold text-xs transition-colors cursor-pointer"
                    >
                      {isGeneratingTTS ? 'Synthesizing...' : 'Generate Voiceover'}
                    </button>
                    <button
                      onClick={handleTogglePreviewVoice}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-colors cursor-pointer"
                    >
                      {previewPlaying ? 'Stop Test' : '▶ Listen'}
                    </button>
                  </div>
                </div>

                  </div>
                </details>
              </div>
            )}
          </div>

          {/* 5. MUSIC SECTION */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/70 overflow-hidden">
            <button
              onClick={() => toggleSection('music')}
              className="w-full flex items-center justify-between p-3.5 text-xs font-bold text-slate-200 hover:bg-slate-800/60 transition-colors"
            >
              <div className="flex items-center space-x-2">
                <Music className="w-4 h-4 text-indigo-400" />
                <span>Music (In-House or Upload)</span>
              </div>
              {openSections.music ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>

            {openSections.music && (
              <div className="p-3.5 pt-0 border-t border-slate-800/80 space-y-3 text-xs">
                <div className="pt-2 space-y-1.5">
                  <span className="text-slate-400 block font-semibold">Choose In-House Soundtrack:</span>
                  <div className="space-y-1.5">
                    <button
                      onClick={() =>
                        onUpdateAudio({ music: { ...audioSettings.music, url: null, presetId: undefined, name: 'No Music' } })
                      }
                      className={`w-full text-left p-2.5 rounded-lg border transition-all ${
                        !audioSettings.music.url && !audioSettings.music.presetId
                          ? 'bg-indigo-600/20 border-indigo-500 text-indigo-200 font-semibold'
                          : 'bg-slate-900 border-slate-800 text-slate-300'
                      }`}
                    >
                      <span className="font-semibold">No music</span>
                    </button>
                    {LIVE_MUSIC_PRESETS.map((m) => (
                      <button
                        key={m.id}
                        onClick={() =>
                          onUpdateAudio({
                            music: {
                              ...audioSettings.music,
                              url: m.fileUrl,
                              presetId: m.id,
                              name: m.name,
                            },
                          })
                        }
                        className={`w-full text-left p-2.5 rounded-lg border transition-all ${
                          audioSettings.music.presetId === m.id
                            ? 'bg-indigo-600/20 border-indigo-500 text-indigo-200 font-semibold'
                            : 'bg-slate-900 border-slate-800 text-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold">{m.name}</span>
                          <span className="text-[10px] font-mono text-indigo-400">{m.genre}</span>
                        </div>
                        <span className="text-[10px] text-slate-500 block">{m.description}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Upload Custom Music */}
                <div className="pt-2 border-t border-slate-800">
                  <input
                    ref={musicFileInputRef}
                    type="file"
                    accept="audio/*"
                    onChange={handleMusicUpload}
                    className="hidden"
                  />
                  <button
                    onClick={() => musicFileInputRef.current?.click()}
                    className="w-full py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload Custom Music File</span>
                  </button>
                  {audioSettings.music.url && (
                    <span className="text-[10px] text-emerald-400 mt-1 block truncate">
                      Active: {audioSettings.music.name}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 6. VIDEO STYLE SECTION */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/70 overflow-hidden">
            <button
              onClick={() => toggleSection('videostyle')}
              className="w-full flex items-center justify-between p-3.5 text-xs font-bold text-slate-200 hover:bg-slate-800/60 transition-colors"
            >
              <div className="flex items-center space-x-2">
                <Palette className="w-4 h-4 text-emerald-400" />
                <span>Video Style & Aspect Ratio</span>
              </div>
              {openSections.videostyle ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>

            {openSections.videostyle && (
              <div className="p-3.5 pt-0 border-t border-slate-800/80 space-y-3 text-xs">
                {/* Aspect Ratio */}
                <div className="pt-2 space-y-1.5">
                  <span className="text-slate-400 block font-semibold">Aspect Ratio:</span>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { id: '9:16', label: '9:16', sub: 'TikTok/Reels' },
                      { id: '16:9', label: '16:9', sub: 'YouTube' },
                      { id: '1:1', label: '1:1', sub: 'Square' },
                    ].map((r) => (
                      <button
                        key={r.id}
                        onClick={() => onAspectRatioChange(r.id as AspectRatio)}
                        className={`p-2 rounded-lg border text-center transition-all ${
                          aspectRatio === r.id
                            ? 'bg-emerald-500/20 border-emerald-500 text-emerald-200 font-bold'
                            : 'bg-slate-900 border-slate-800 text-slate-400'
                        }`}
                      >
                        <span className="block text-xs">{r.label}</span>
                        <span className="block text-[9px] text-slate-500">{r.sub}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Color Filter Style */}
                <div className="space-y-1.5">
                  <span className="text-slate-400 block font-semibold">Color Grading Grade:</span>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { id: 'teal-orange', label: 'Teal & Orange', sub: 'Cinematic Film' },
                      { id: 'natural', label: 'Minimalist Clean', sub: 'True Colors' },
                      { id: 'golden-hour', label: 'Golden Hour', sub: 'Warm Sunset' },
                      { id: 'moody-noir', label: 'Moody Noir', sub: 'High Contrast B&W' },
                      { id: 'cyberpunk', label: 'Cyberpunk Neon', sub: 'Electric Glow' },
                      { id: 'vintage', label: 'Vintage 35mm', sub: 'Classic Grain' },
                    ].map((f) => (
                      <button
                        key={f.id}
                        onClick={() => onColorFilterChange(f.id as ColorFilterType)}
                        className={`p-2 rounded-lg border text-left transition-all ${
                          colorFilter === f.id
                            ? 'bg-purple-500/20 border-purple-500 text-purple-200 font-semibold'
                            : 'bg-slate-900 border-slate-800 text-slate-300'
                        }`}
                      >
                        <span className="block font-medium">{f.label}</span>
                        <span className="block text-[10px] text-slate-500">{f.sub}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 7. SLIDE TITLE & TEXT OVERLAY SECTION (SEPARATE FROM CAPTIONS) */}
          <div className="rounded-xl border border-pink-500/30 bg-slate-950/70 overflow-hidden shadow-sm">
            <button
              onClick={() => toggleSection('titleOverlay')}
              className="w-full flex items-center justify-between p-3.5 text-xs font-bold text-slate-200 hover:bg-slate-800/60 transition-colors cursor-pointer"
            >
              <div className="flex items-center space-x-2">
                <Type className="w-4 h-4 text-pink-400" />
                <span className="font-bold text-white">Slide Title & Text Overlay</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-pink-950/80 text-pink-300 border border-pink-700/50 font-mono">
                  Slide #{currentClipIndex + 1}
                </span>
              </div>
              {openSections.titleOverlay ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>

            {openSections.titleOverlay && (
              <div className="p-3.5 pt-0 border-t border-slate-800/80 space-y-4 text-xs">
                {/* Current Slide Info Header */}
                <div className="pt-2">
                  <div className="p-3 bg-slate-900/90 rounded-xl border border-pink-500/30 space-y-2.5 shadow-md">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-pink-400" />
                        <span className="font-bold text-slate-200 text-xs">
                          Slide #{currentClipIndex + 1} Title
                        </span>
                        {currentClip?.duration && (
                          <span className="text-[10px] text-slate-400 font-mono">
                            ({currentClip.duration.toFixed(1)}s duration)
                          </span>
                        )}
                      </div>
                      {currentClip?.textOverlay?.enabled && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30">
                          Active on Footage
                        </span>
                      )}
                    </div>

                    {!currentClip?.textOverlay?.enabled ? (
                      <button
                        type="button"
                        onClick={() => {
                          onUpdateCurrentClipTextOverlay?.({
                            enabled: true,
                            text: 'TITLE HERE',
                            fontSize: 36,
                            fontStyle: 'impact',
                            textColor: '#FFFFFF',
                            effect: 'outline',
                            x: 0.5,
                            y: 0.2,
                            scale: 1.0,
                            rotation: 0,
                          });
                        }}
                        className="w-full py-2.5 px-3 rounded-lg bg-gradient-to-r from-pink-600 via-purple-600 to-indigo-600 hover:from-pink-500 hover:to-indigo-500 text-white font-bold text-xs flex items-center justify-center space-x-1.5 shadow-lg shadow-pink-900/30 transition-all cursor-pointer"
                      >
                        <Type className="w-3.5 h-3.5" />
                        <span>+ Click to Add Title on Slide #{currentClipIndex + 1}</span>
                      </button>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2">
                          <input
                            type="text"
                            value={currentClip.textOverlay.text}
                            onChange={(e) =>
                              onUpdateCurrentClipTextOverlay?.({
                                ...currentClip.textOverlay!,
                                text: e.target.value,
                              })
                            }
                            placeholder="Type title or text on this footage..."
                            className="flex-1 bg-slate-950 border border-slate-700 focus:border-pink-500 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => onUpdateCurrentClipTextOverlay?.(undefined)}
                            className="px-2 py-1.5 rounded-lg bg-red-950/60 hover:bg-red-900/80 text-red-300 text-[11px] font-semibold border border-red-800/60 transition-colors cursor-pointer"
                            title="Remove title from this slide"
                          >
                            Remove
                          </button>
                        </div>

                        <p className="text-[10px] text-pink-300 leading-tight">
                          ✨ <strong>Canva controls on footage:</strong> Drag to reposition, drag corners to scale, drag top handle to rotate!
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Only render Title styling controls if title is active */}
                {currentClip?.textOverlay?.enabled && (
                  <>
                    {/* TITLE FONT SIZE */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-slate-300">
                        <span className="font-semibold text-pink-200">Title Font Size:</span>
                        <span className="font-mono text-pink-300 font-bold">
                          {currentClip.textOverlay.fontSize || 36}px
                        </span>
                      </div>
                      <input
                        type="range"
                        min={16}
                        max={96}
                        step={2}
                        value={currentClip.textOverlay.fontSize || 36}
                        onChange={(e) => {
                          const newSize = parseInt(e.target.value, 10);
                          onUpdateCurrentClipTextOverlay?.({
                            ...currentClip.textOverlay!,
                            fontSize: newSize,
                          });
                        }}
                        className="w-full h-1.5 bg-slate-800 rounded appearance-none cursor-pointer accent-pink-500"
                      />
                      <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                        <span>Compact (16px)</span>
                        <span>Standard (36px)</span>
                        <span>Hero Huge (96px)</span>
                      </div>
                    </div>

                    {/* TITLE TYPEFACE / FONT */}
                    <div className="space-y-1.5">
                      <span className="text-slate-400 block font-semibold text-pink-200">Title Typeface / Font:</span>
                      <div className="grid grid-cols-3 gap-1.5">
                        {[
                          { id: 'impact', label: 'Impact Heavy' },
                          { id: 'modern-sans', label: 'Modern Sans' },
                          { id: 'serif', label: 'Classic Serif' },
                          { id: 'mono', label: 'Monospace' },
                          { id: 'rounded', label: 'Rounded' },
                        ].map((f) => (
                          <button
                            key={f.id}
                            type="button"
                            onClick={() => {
                              onUpdateCurrentClipTextOverlay?.({
                                ...currentClip.textOverlay!,
                                fontStyle: f.id as CaptionFontStyle,
                              });
                            }}
                            className={`p-2 rounded-lg border text-center transition-all cursor-pointer ${
                              (currentClip.textOverlay?.fontStyle || 'impact') === f.id
                                ? 'bg-pink-500/25 border-pink-500 text-pink-200 font-semibold shadow-sm'
                                : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                            }`}
                          >
                            <span className="block text-xs">{f.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* TITLE FONT COLOR */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-slate-300">
                        <span className="font-semibold text-pink-200">Title Color:</span>
                        <span className="font-mono text-[11px] text-slate-400">
                          {currentClip.textOverlay.textColor || '#FFFFFF'}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        {[
                          { color: '#FFFFFF', label: 'White' },
                          { color: '#FACC15', label: 'Yellow' },
                          { color: '#06B6D4', label: 'Cyan' },
                          { color: '#4ADE80', label: 'Lime' },
                          { color: '#F43F5E', label: 'Pink' },
                          { color: '#F59E0B', label: 'Gold' },
                          { color: '#A855F7', label: 'Purple' },
                          { color: '#EF4444', label: 'Red' },
                        ].map((swatch) => (
                          <button
                            key={swatch.color}
                            type="button"
                            onClick={() => {
                              onUpdateCurrentClipTextOverlay?.({
                                ...currentClip.textOverlay!,
                                textColor: swatch.color,
                              });
                            }}
                            className={`w-6 h-6 rounded-full border-2 transition-transform cursor-pointer ${
                              (currentClip.textOverlay?.textColor || '#FFFFFF') === swatch.color
                                ? 'scale-125 border-white shadow-md'
                                : 'border-slate-800 hover:scale-110'
                            }`}
                            style={{ backgroundColor: swatch.color }}
                            title={swatch.label}
                          />
                        ))}
                        <input
                          type="color"
                          value={currentClip.textOverlay.textColor || '#FFFFFF'}
                          onChange={(e) => {
                            onUpdateCurrentClipTextOverlay?.({
                              ...currentClip.textOverlay!,
                              textColor: e.target.value,
                            });
                          }}
                          className="w-6 h-6 rounded cursor-pointer border border-slate-700 bg-transparent"
                          title="Custom Title Color"
                        />
                      </div>
                    </div>

                    {/* TITLE FONT EFFECTS */}
                    <div className="space-y-1.5">
                      <span className="text-slate-400 block font-semibold text-pink-200">Title Effect (Outline, 3D Drop, Glitch, etc.):</span>
                      <div className="grid grid-cols-3 gap-1.5">
                        {[
                          { id: 'outline', label: 'Outline' },
                          { id: 'hollow', label: 'Hollow' },
                          { id: 'background', label: 'Background' },
                          { id: 'drop', label: '3D Drop' },
                          { id: 'curve', label: 'Curve' },
                          { id: 'rotate', label: 'Rotate' },
                          { id: 'glitch', label: 'Glitch' },
                          { id: 'splice', label: 'Splice' },
                          { id: 'none', label: 'Clean' },
                        ].map((eff) => (
                          <button
                            key={eff.id}
                            type="button"
                            onClick={() => {
                              onUpdateCurrentClipTextOverlay?.({
                                ...currentClip.textOverlay!,
                                effect: eff.id as any,
                              });
                            }}
                            className={`p-1.5 rounded-lg border text-center transition-all cursor-pointer ${
                              (currentClip.textOverlay?.effect || 'outline') === eff.id
                                ? 'bg-pink-500/25 border-pink-500 text-pink-200 font-semibold shadow-sm'
                                : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                            }`}
                          >
                            <span className="block text-xs">{eff.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Quick Reset Transform */}
                    <div className="pt-1 flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => {
                          onUpdateCurrentClipTextOverlay?.({
                            ...currentClip.textOverlay!,
                            x: 0.5,
                            y: 0.2,
                            scale: 1.0,
                            rotation: 0,
                          });
                        }}
                        className="flex items-center space-x-1.5 text-[11px] text-slate-400 hover:text-slate-200 bg-slate-900 hover:bg-slate-800 px-2.5 py-1.5 rounded-lg border border-slate-800 transition-colors cursor-pointer"
                      >
                        <RotateCcw className="w-3 h-3 text-indigo-400" />
                        <span>Reset Title Position &amp; Rotation</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* 8. VOICEOVER CAPTIONS & SUBTITLES SECTION (SEPARATE FROM TITLE OVERLAY) */}
          <div className="rounded-xl border border-amber-500/30 bg-slate-950/70 overflow-hidden shadow-sm">
            <button
              onClick={() => toggleSection('subtitles')}
              className="w-full flex items-center justify-between p-3.5 text-xs font-bold text-slate-200 hover:bg-slate-800/60 transition-colors cursor-pointer"
            >
              <div className="flex items-center space-x-2">
                <MessageSquare className="w-4 h-4 text-amber-400" />
                <span className="font-bold text-white">Voiceover Captions & Subtitles</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-950/80 text-amber-300 border border-amber-700/50 font-mono">
                  Synced Subtitles
                </span>
              </div>
              {openSections.subtitles ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>

            {openSections.subtitles && (
              <div className="p-3.5 pt-0 border-t border-slate-800/80 space-y-4 text-xs">
                {/* Subtitle Visibility Toggle */}
                {/* Subtitle Background Pill Toggle */}
                <div className="pt-2 flex items-center justify-between p-2.5 bg-slate-900/80 rounded-lg border border-slate-800">
                  <span className="text-slate-300 font-medium">Subtitle Background Pill:</span>
                  <button
                    type="button"
                    onClick={() => {
                      onSubtitleConfigChange?.({
                        ...subtitleConfig,
                        showBackgroundPill: !subtitleConfig.showBackgroundPill,
                      });
                    }}
                    className={`px-3 py-1 rounded-full text-[11px] font-bold border transition-colors cursor-pointer ${
                      subtitleConfig.showBackgroundPill
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}
                  >
                    {subtitleConfig.showBackgroundPill ? 'Pill Background ON' : 'Pill Background OFF'}
                  </button>
                </div>

                {/* CAPTION FONT SIZE */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-slate-300">
                    <span className="font-semibold text-amber-200">Caption Font Size:</span>
                    <span className="font-mono text-amber-300 font-bold">
                      {subtitleConfig.fontSize}px
                    </span>
                  </div>
                  <input
                    type="range"
                    min={14}
                    max={54}
                    step={2}
                    value={subtitleConfig.fontSize}
                    onChange={(e) => {
                      const newSize = parseInt(e.target.value, 10);
                      onSubtitleConfigChange?.({
                        ...subtitleConfig,
                        fontSize: newSize,
                      });
                    }}
                    className="w-full h-1.5 bg-slate-800 rounded appearance-none cursor-pointer accent-amber-500"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                    <span>Small (14px)</span>
                    <span>Standard (28px)</span>
                    <span>Large (54px)</span>
                  </div>
                </div>

                {/* CAPTION TYPEFACE / FONT */}
                <div className="space-y-1.5">
                  <span className="text-slate-400 block font-semibold text-amber-200">Caption Typeface / Font:</span>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { id: 'impact', label: 'Impact Heavy' },
                      { id: 'modern-sans', label: 'Modern Sans' },
                      { id: 'serif', label: 'Classic Serif' },
                      { id: 'mono', label: 'Monospace' },
                      { id: 'rounded', label: 'Rounded' },
                    ].map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => {
                          onSubtitleConfigChange?.({
                            ...subtitleConfig,
                            fontStyle: f.id as CaptionFontStyle,
                          });
                        }}
                        className={`p-2 rounded-lg border text-center transition-all cursor-pointer ${
                          subtitleConfig.fontStyle === f.id
                            ? 'bg-amber-500/25 border-amber-500 text-amber-200 font-semibold shadow-sm'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <span className="block text-xs">{f.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* CAPTION FONT COLOR */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-slate-300">
                    <span className="font-semibold text-amber-200">Caption Text Color:</span>
                    <span className="font-mono text-[11px] text-slate-400">{subtitleConfig.textColor}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    {[
                      { color: '#FACC15', label: 'Yellow' },
                      { color: '#FFFFFF', label: 'White' },
                      { color: '#06B6D4', label: 'Cyan' },
                      { color: '#4ADE80', label: 'Lime' },
                      { color: '#F43F5E', label: 'Pink' },
                      { color: '#F59E0B', label: 'Gold' },
                      { color: '#A855F7', label: 'Purple' },
                      { color: '#EF4444', label: 'Red' },
                    ].map((swatch) => (
                      <button
                        key={swatch.color}
                        type="button"
                        onClick={() => {
                          onSubtitleConfigChange?.({
                            ...subtitleConfig,
                            textColor: swatch.color,
                          });
                        }}
                        className={`w-6 h-6 rounded-full border-2 transition-transform cursor-pointer ${
                          subtitleConfig.textColor === swatch.color
                            ? 'scale-125 border-white shadow-md'
                            : 'border-slate-800 hover:scale-110'
                        }`}
                        style={{ backgroundColor: swatch.color }}
                        title={swatch.label}
                      />
                    ))}
                    <input
                      type="color"
                      value={subtitleConfig.textColor}
                      onChange={(e) => {
                        onSubtitleConfigChange?.({
                          ...subtitleConfig,
                          textColor: e.target.value,
                        });
                      }}
                      className="w-6 h-6 rounded cursor-pointer border border-slate-700 bg-transparent"
                      title="Custom Caption Color"
                    />
                  </div>
                </div>

                {/* CAPTION WORD HIGHLIGHT COLOR */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-slate-300">
                    <span className="font-semibold text-amber-200">Karaoke / Word Pop Color:</span>
                    <span className="font-mono text-[11px] text-slate-400">
                      {subtitleConfig.highlightColor || '#FFFFFF'}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    {[
                      { color: '#FFFFFF', label: 'White Pop' },
                      { color: '#22C55E', label: 'Neon Green' },
                      { color: '#38BDF8', label: 'Electric Blue' },
                      { color: '#F43F5E', label: 'Hot Pink' },
                      { color: '#FACC15', label: 'Vibrant Yellow' },
                    ].map((swatch) => (
                      <button
                        key={swatch.color}
                        type="button"
                        onClick={() => {
                          onSubtitleConfigChange?.({
                            ...subtitleConfig,
                            highlightColor: swatch.color,
                          });
                        }}
                        className={`w-6 h-6 rounded-full border-2 transition-transform cursor-pointer ${
                          (subtitleConfig.highlightColor || '#FFFFFF') === swatch.color
                            ? 'scale-125 border-white shadow-md'
                            : 'border-slate-800 hover:scale-110'
                        }`}
                        style={{ backgroundColor: swatch.color }}
                        title={swatch.label}
                      />
                    ))}
                  </div>
                </div>

                {/* CAPTION ANIMATION STYLE */}
                <div className="space-y-1.5 pt-1">
                  <span className="text-slate-400 block font-semibold text-amber-200">Subtitle Narration Animation:</span>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { id: 'beast-glow', label: 'Viral Pop Glow', desc: 'Bouncy energetic pop' },
                      { id: 'typewriter', label: 'Typewriter', desc: 'Typed letter by letter' },
                      { id: 'karaoke', label: 'Karaoke Sync', desc: 'Word-by-word highlight' },
                      { id: 'bounce', label: 'Kinetic Bounce', desc: 'Rhythmic spring pulse' },
                      { id: 'fade-up', label: 'Cinematic Float', desc: 'Smooth float upward' },
                      { id: 'minimal', label: 'Clean Lower-Third', desc: 'Understated caption' },
                    ].map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() =>
                          onSubtitleConfigChange?.({
                            ...subtitleConfig,
                            animationStyle: a.id as CaptionAnimationStyle,
                          })
                        }
                        className={`p-2 rounded-lg border text-left transition-all cursor-pointer ${
                          subtitleConfig.animationStyle === a.id
                            ? 'bg-amber-500/20 border-amber-500 text-amber-200 font-semibold shadow-sm'
                            : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <span className="block font-medium">{a.label}</span>
                        <span className="block text-[10px] text-slate-500">{a.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between">
          <span className="text-xs text-slate-400">Settings auto-apply to your video.</span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
    </aside>
  );
};
export const SideControlPanel = React.memo(SideControlPanelComponent);
