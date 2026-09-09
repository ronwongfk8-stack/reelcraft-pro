import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Download,
  Maximize2,
  Repeat,
  Volume2,
  VolumeX,
  Sparkles,
  CheckCircle,
  Monitor,
  Smartphone,
  Square,
  Gauge,
  Move,
  Mic,
  Music,
  AlertTriangle,
  X
} from 'lucide-react';
import { SlideItem, SubtitleConfig, AspectRatio, AudioTrackConfig } from '../types';
import { renderVideoFrame, getTotalDuration, getCanvasDimensions, getSlideAtTime } from '../utils/videoRenderer';
import { audioEngine } from '../utils/audioSynthesizer';
import { stopSpeechSample } from '../utils/speechSynthesis';

export const SPEED_OPTIONS = [
  { value: 0.5, label: '0.5x Speed (Slow Motion)' },
  { value: 0.75, label: '0.75x Speed (Relaxed)' },
  { value: 1.0, label: '1.0x Speed (Normal)' },
  { value: 1.25, label: '1.25x Speed (Brisk)' },
  { value: 1.5, label: '1.5x Speed (Fast)' },
  { value: 2.0, label: '2.0x Speed (Turbo)' },
];

interface VideoPreviewProps {
  slides: SlideItem[];
  activeSlideId?: string | null;
  onSelectSlide?: (id: string) => void;
  subtitleConfig: SubtitleConfig;
  onUpdateSubtitleConfig?: (config: SubtitleConfig) => void;
  aspectRatio: AspectRatio;
  onUpdateAspectRatio: (ratio: AspectRatio) => void;
  musicTrack: AudioTrackConfig;
  voiceoverTrack: AudioTrackConfig;
  onUpdateMusicTrack?: (track: AudioTrackConfig) => void;
  onUpdateVoiceoverTrack?: (track: AudioTrackConfig) => void;
  logoUrl?: string | null;
  videoSpeed?: number;
  onUpdateVideoSpeed?: (speed: number) => void;
  totalAvailableCredits?: number;
  onDeductCredit?: () => Promise<{ success: boolean; remainingTotal: number; warningLow: boolean }>;
  onOpenPricing?: (isLowNotice?: boolean) => void;
}

export const VideoPreview: React.FC<VideoPreviewProps> = ({
  slides,
  activeSlideId,
  onSelectSlide,
  subtitleConfig,
  onUpdateSubtitleConfig,
  aspectRatio,
  onUpdateAspectRatio,
  musicTrack,
  voiceoverTrack,
  onUpdateMusicTrack,
  onUpdateVoiceoverTrack,
  logoUrl,
  videoSpeed = 1.0,
  onUpdateVideoSpeed,
  totalAvailableCredits = 1,
  onDeductCredit,
  onOpenPricing,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTimeState] = useState(0);
  const currentTimeRef = useRef<number>(0);

  const setCurrentTime = useCallback((time: number | ((prev: number) => number)) => {
    setCurrentTimeState((prev) => {
      const next = typeof time === 'function' ? time(prev) : time;
      currentTimeRef.current = next;
      return next;
    });
  }, []);

  const [isLooping, setIsLooping] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [internalSpeed, setInternalSpeed] = useState<number>(videoSpeed);

  const currentSpeed = videoSpeed !== undefined ? videoSpeed : internalSpeed;

  const handleSpeedChange = (newSpeed: number) => {
    setInternalSpeed(newSpeed);
    if (onUpdateVideoSpeed) {
      onUpdateVideoSpeed(newSpeed);
    }
  };

  // Images map cache
  const imagesMapRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const [imagesLoaded, setImagesLoaded] = useState(false);

  // Preload Logo Image
  const logoImgRef = useRef<HTMLImageElement | null>(null);
  useEffect(() => {
    if (!logoUrl) {
      logoImgRef.current = null;
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = logoUrl;
    img.onload = () => {
      logoImgRef.current = img;
    };
  }, [logoUrl]);

  // Draggable Logo Position State (Normalized xRatio, yRatio between 0 and 1)
  const [logoPosition, setLogoPosition] = useState<{ xRatio: number; yRatio: number }>({
    xRatio: 0.88,
    yRatio: 0.12,
  });
  const logoPositionRef = useRef(logoPosition);
  useEffect(() => {
    logoPositionRef.current = logoPosition;
  }, [logoPosition]);

  const subtitleConfigRef = useRef(subtitleConfig);
  useEffect(() => {
    subtitleConfigRef.current = subtitleConfig;
  }, [subtitleConfig]);

  const [isDraggingLogo, setIsDraggingLogo] = useState(false);
  const [isHoveringLogo, setIsHoveringLogo] = useState(false);

  // Draggable Text Overlay State
  const [isDraggingText, setIsDraggingText] = useState(false);
  const [isHoveringText, setIsHoveringText] = useState(false);
  const dragTargetRef = useRef<'none' | 'logo' | 'text'>('none');

  // Compute text overlay center ratio
  const getTextPositionRatio = useCallback((cfg: SubtitleConfig) => {
    const x = cfg.customXRatio !== undefined ? cfg.customXRatio : 0.5;
    let y = 0.82;
    if (cfg.position === 'custom' && cfg.customYRatio !== undefined) {
      y = cfg.customYRatio;
    } else if (cfg.position === 'center') {
      y = cfg.customYRatio !== undefined ? cfg.customYRatio : 0.5;
    } else if (cfg.position === 'top') {
      y = cfg.customYRatio !== undefined ? cfg.customYRatio : 0.18;
    } else if (cfg.position === 'lower-third') {
      y = cfg.customYRatio !== undefined ? cfg.customYRatio : 0.75;
    } else if (cfg.customYRatio !== undefined) {
      y = cfg.customYRatio;
    }
    return { xRatio: x, yRatio: y };
  }, []);

  // Convert Pointer Event on Canvas to Normalized Canvas Ratio (0..1)
  const getCanvasPointerNormalized = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { xRatio: 0.5, yRatio: 0.82 };
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    const xRatio = Math.max(0.05, Math.min(0.95, clickX / rect.width));
    const yRatio = Math.max(0.05, Math.min(0.95, clickY / rect.height));
    return { xRatio, yRatio };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const { xRatio, yRatio } = getCanvasPointerNormalized(e);

    // 1. Check if click is near logo position
    if (logoUrl && logoImgRef.current) {
      const currentPos = logoPositionRef.current;
      const dist = Math.hypot(xRatio - currentPos.xRatio, yRatio - currentPos.yRatio);
      if (dist < 0.22) {
        try {
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
        } catch (err) {}
        dragTargetRef.current = 'logo';
        setIsDraggingLogo(true);
        setLogoPosition({ xRatio, yRatio });
        return;
      }
    }

    // 2. Check if click is near text overlay
    const cfg = subtitleConfigRef.current;
    const curSlide = getSlideAtTime(slides, currentTimeRef.current).slide;
    const hasText = cfg.showCaptions && (curSlide?.title || curSlide?.subtitle);
    if (hasText) {
      const textPos = getTextPositionRatio(cfg);
      const dx = Math.abs(xRatio - textPos.xRatio);
      const dy = Math.abs(yRatio - textPos.yRatio);

      // Hit area for text overlay bounding box
      if (dx < 0.46 && dy < 0.24) {
        try {
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
        } catch (err) {}
        dragTargetRef.current = 'text';
        setIsDraggingText(true);
        const newX = Number(Math.max(0.08, Math.min(0.92, xRatio)).toFixed(3));
        const newY = Number(Math.max(0.06, Math.min(0.94, yRatio)).toFixed(3));
        if (onUpdateSubtitleConfig) {
          onUpdateSubtitleConfig({
            ...cfg,
            position: 'custom',
            customXRatio: newX,
            customYRatio: newY,
          });
        }
        return;
      }
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const { xRatio, yRatio } = getCanvasPointerNormalized(e);

    // Handle Active Logo Dragging
    if (dragTargetRef.current === 'logo' || isDraggingLogo) {
      setLogoPosition({ xRatio, yRatio });
      return;
    }

    // Handle Active Text Dragging (Left-to-Right & Up-to-Down)
    if (dragTargetRef.current === 'text' || isDraggingText) {
      const cfg = subtitleConfigRef.current;
      const newX = Number(Math.max(0.08, Math.min(0.92, xRatio)).toFixed(3));
      const newY = Number(Math.max(0.06, Math.min(0.94, yRatio)).toFixed(3));
      if (onUpdateSubtitleConfig) {
        onUpdateSubtitleConfig({
          ...cfg,
          position: 'custom',
          customXRatio: newX,
          customYRatio: newY,
        });
      }
      return;
    }

    // Handle Hover detection for cursor styling & highlight outline
    let hoveringLogo = false;
    if (logoUrl && logoImgRef.current) {
      const currentPos = logoPositionRef.current;
      const dist = Math.hypot(xRatio - currentPos.xRatio, yRatio - currentPos.yRatio);
      hoveringLogo = dist < 0.22;
    }
    setIsHoveringLogo(hoveringLogo);

    let hoveringText = false;
    const cfg = subtitleConfigRef.current;
    const curSlide = getSlideAtTime(slides, currentTimeRef.current).slide;
    const hasText = cfg.showCaptions && (curSlide?.title || curSlide?.subtitle);
    if (!hoveringLogo && hasText) {
      const textPos = getTextPositionRatio(cfg);
      const dx = Math.abs(xRatio - textPos.xRatio);
      const dy = Math.abs(yRatio - textPos.yRatio);
      hoveringText = dx < 0.46 && dy < 0.24;
    }
    setIsHoveringText(hoveringText);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (dragTargetRef.current !== 'none' || isDraggingLogo || isDraggingText) {
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch (err) {}
      dragTargetRef.current = 'none';
      setIsDraggingLogo(false);
      setIsDraggingText(false);
    }
  };

  // Export state
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportDone, setExportDone] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [isPreparingImages, setIsPreparingImages] = useState(false);

  const totalDuration = getTotalDuration(slides);

  // Preload Images
  useEffect(() => {
    let loadedCount = 0;
    const map = new Map<string, HTMLImageElement>();

    if (slides.length === 0) {
      imagesMapRef.current = map;
      setImagesLoaded(true);
      return;
    }

    slides.forEach((slide) => {
      // If we already have the image loaded in cache for this slide ID, re-use or load
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = slide.url;
      img.onload = () => {
        map.set(slide.id, img);
        imagesMapRef.current = new Map(map);
        loadedCount++;
        if (loadedCount === slides.length) {
          setImagesLoaded(true);
        }
      };
      img.onerror = () => {
        map.set(slide.id, img);
        imagesMapRef.current = new Map(map);
        loadedCount++;
        if (loadedCount === slides.length) {
          setImagesLoaded(true);
        }
      };
    });
  }, [slides]);

  const activeSlideIdRef = useRef<string | null>(activeSlideId || null);
  useEffect(() => {
    activeSlideIdRef.current = activeSlideId || null;
  }, [activeSlideId]);

  // Helper to jump preview directly to a specific slide by ID
  const jumpToSlide = useCallback((slideId: string) => {
    if (!slideId || slides.length === 0) return;
    if (onSelectSlide) {
      onSelectSlide(slideId);
    }
    let startTime = 0;
    for (let i = 0; i < slides.length; i++) {
      const s = slides[i];
      if (s.id === slideId) {
        // Offset past initial transition so photo is 100% visible and clear
        const offset = i === 0 ? 0.1 : Math.min(0.85, (s.duration || 4) * 0.4);
        setCurrentTime(startTime + offset);
        break;
      }
      startTime += s.duration || 4;
    }
  }, [slides, onSelectSlide]);

  const lastActiveSlideIdRef = useRef<string | null>(null);
  const lastActiveSlideTextRef = useRef<string>('');

  // Seek video currentTime when activeSlideId, the slide sequence, OR the
  // active slide's own caption text changes. The text-change case is what
  // makes typing/pasting a new caption show up immediately on the preview
  // instead of requiring a manual scrub of the timeline — it forces a jump
  // even mid-playback, since if you're actively editing you want to see it.
  useEffect(() => {
    if (!activeSlideId || slides.length === 0) return;
    let startTime = 0;
    let targetIndex = -1;
    let targetSlide: SlideItem | null = null;

    for (let i = 0; i < slides.length; i++) {
      if (slides[i].id === activeSlideId) {
        targetIndex = i;
        targetSlide = slides[i];
        break;
      }
      startTime += slides[i].duration || 4;
    }

    if (targetIndex !== -1 && targetSlide) {
      const offset = targetIndex === 0 ? 0.1 : Math.min(0.85, (targetSlide.duration || 4) * 0.4);
      const targetTime = startTime + offset;

      const currentSlideInfo = getSlideAtTime(slides, currentTimeRef.current);
      const isDifferentSlide = currentSlideInfo.index !== targetIndex;
      const isSelectionChanged = lastActiveSlideIdRef.current !== activeSlideId;

      const currentText = `${targetSlide.title}|${targetSlide.subtitle}`;
      const isTextEdited =
        lastActiveSlideIdRef.current === activeSlideId && lastActiveSlideTextRef.current !== currentText;

      if (isTextEdited) {
        setCurrentTime(targetTime);
        if (isPlaying) setIsPlaying(false);
      } else if (!isPlaying && (isDifferentSlide || isSelectionChanged)) {
        setCurrentTime(targetTime);
      }

      lastActiveSlideTextRef.current = currentText;
    }
    lastActiveSlideIdRef.current = activeSlideId;
  }, [activeSlideId, slides, isPlaying, setCurrentTime]);

  // Audio Playback Node setup
  const audioNodesRef = useRef<{
    ctx?: AudioContext;
    masterGain?: GainNode;
    musicSource?: AudioBufferSourceNode | HTMLAudioElement;
    voiceSource?: AudioBufferSourceNode | HTMLAudioElement;
    musicGain?: GainNode;
    voiceGain?: GainNode;
    musicStopTimeout?: number;
    voiceStopTimeout?: number;
  }>({});

  const isPlayingRef = useRef(false);
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  const stopAudioPlayback = useCallback(() => {
    stopSpeechSample();

    if (audioNodesRef.current.musicStopTimeout) {
      clearTimeout(audioNodesRef.current.musicStopTimeout);
    }
    if (audioNodesRef.current.voiceStopTimeout) {
      clearTimeout(audioNodesRef.current.voiceStopTimeout);
    }

    if (audioNodesRef.current.musicSource) {
      if ((audioNodesRef.current.musicSource as HTMLAudioElement).pause) {
        try {
          const el = audioNodesRef.current.musicSource as HTMLAudioElement;
          el.pause();
          el.currentTime = 0;
          el.src = '';
        } catch (e) {}
      } else {
        try {
          (audioNodesRef.current.musicSource as AudioBufferSourceNode).stop();
          (audioNodesRef.current.musicSource as AudioBufferSourceNode).disconnect();
        } catch (e) {}
      }
    }

    if (audioNodesRef.current.musicGain) {
      try {
        audioNodesRef.current.musicGain.gain.setValueAtTime(0, 0);
        audioNodesRef.current.musicGain.disconnect();
      } catch (e) {}
    }

    if (audioNodesRef.current.voiceSource) {
      if ((audioNodesRef.current.voiceSource as HTMLAudioElement).pause) {
        try {
          const el = audioNodesRef.current.voiceSource as HTMLAudioElement;
          el.pause();
          el.currentTime = 0;
          el.src = '';
        } catch (e) {}
      } else {
        try {
          (audioNodesRef.current.voiceSource as AudioBufferSourceNode).stop();
          (audioNodesRef.current.voiceSource as AudioBufferSourceNode).disconnect();
        } catch (e) {}
      }
    }

    if (audioNodesRef.current.voiceGain) {
      try {
        audioNodesRef.current.voiceGain.gain.setValueAtTime(0, 0);
        audioNodesRef.current.voiceGain.disconnect();
      } catch (e) {}
    }

    audioNodesRef.current = {};
  }, []);

  const startAudioPlayback = useCallback(async () => {
    // Clear any prior audio nodes before starting fresh playback
    stopAudioPlayback();

    const ctx = audioEngine.initContext();
    if (ctx.state === 'suspended') {
      await ctx.resume().catch(() => {});
    }
    const curTime = currentTimeRef.current;

    // Remaining video duration from the current playhead
    const remainingVideoTime = Math.max(0, (totalDuration - curTime) / currentSpeed);
    if (remainingVideoTime <= 0) {
      return;
    }

    // Master Gain Node
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(isMuted ? 0 : 1, ctx.currentTime);
    masterGain.connect(ctx.destination);
    audioNodesRef.current.masterGain = masterGain;
    audioNodesRef.current.ctx = ctx;

    // 1. Music Setup (Only run if explicitly enabled and a valid preset or file is selected)
    if (
      musicTrack.enabled &&
      !musicTrack.isMuted &&
      musicTrack.volume > 0 &&
      ((musicTrack.sourceType === 'preset' && musicTrack.presetId && musicTrack.presetId !== 'none') ||
        (musicTrack.sourceType === 'custom' && musicTrack.fileUrl))
    ) {
      try {
        const musicGain = ctx.createGain();
        musicGain.connect(masterGain);

        let buffer: AudioBuffer | null = null;
        if (musicTrack.sourceType === 'preset' && musicTrack.presetId && musicTrack.presetId !== 'none') {
          buffer = await audioEngine.resolvePresetMusicBuffer(
            musicTrack.presetId,
            Math.max(16, (totalDuration / currentSpeed) + 4)
          );
        } else if (musicTrack.fileUrl) {
          buffer = await audioEngine.decodeAudioUrl(musicTrack.fileUrl);
        }

        if (buffer) {
          const source = ctx.createBufferSource();
          source.buffer = buffer;
          source.loop = true;
          source.playbackRate.setValueAtTime(1.0, ctx.currentTime);
          source.connect(musicGain);
          
          const safeCurrentTime = Math.max(0, curTime);
          const rawOffset = buffer.duration > 0 ? (safeCurrentTime % buffer.duration) : 0;
          const safeOffset = Math.max(0, Math.min(buffer.duration - 0.001, rawOffset));
          source.start(0, safeOffset);

          // Hard hardware stop at video duration boundary if not looping
          if (!isLooping) {
            try {
              source.stop(ctx.currentTime + remainingVideoTime);
            } catch (e) {}
          }

          audioEngine.applyAudioEnvelope(
            musicGain,
            musicTrack.isMuted ? 0 : musicTrack.volume,
            musicTrack.fadeInDuration,
            musicTrack.fadeOutDuration,
            totalDuration,
            safeCurrentTime,
            isLooping,
            currentSpeed
          );

          audioNodesRef.current.musicSource = source;
          audioNodesRef.current.musicGain = musicGain;
        } else if (musicTrack.fileUrl) {
          const audioEl = new Audio(musicTrack.fileUrl);
          audioEl.currentTime = Math.max(0, curTime);
          audioEl.volume = (musicTrack.isMuted || isMuted) ? 0 : Math.min(1, Math.max(0, musicTrack.volume));
          audioEl.playbackRate = 1.0;
          audioEl.loop = true;
          audioEl.play().catch(() => {});
          audioNodesRef.current.musicSource = audioEl;

          if (!isLooping) {
            const timeout = window.setTimeout(() => {
              if (audioNodesRef.current.musicSource === audioEl) {
                try {
                  audioEl.pause();
                  audioEl.currentTime = 0;
                } catch (e) {}
              }
            }, remainingVideoTime * 1000);
            audioNodesRef.current.musicStopTimeout = timeout;
          }
        }
      } catch (e) {
        console.error('Music play error:', e);
      }
    }

    // 2. Voiceover Setup
    if (voiceoverTrack.enabled && voiceoverTrack.fileUrl) {
      try {
        const voiceGain = ctx.createGain();
        voiceGain.connect(masterGain);

        const voiceBuffer = await audioEngine.decodeAudioUrl(voiceoverTrack.fileUrl);
        if (voiceBuffer) {
          const source = ctx.createBufferSource();
          source.buffer = voiceBuffer;
          source.loop = isLooping;
          source.playbackRate.setValueAtTime(1.0, ctx.currentTime);
          source.connect(voiceGain);

          const safeCurrentTime = Math.max(0, curTime);
          if (safeCurrentTime < voiceBuffer.duration) {
            source.start(0, safeCurrentTime);
            if (!isLooping) {
              try {
                source.stop(ctx.currentTime + remainingVideoTime);
              } catch (e) {}
            }
          }

          audioEngine.applyAudioEnvelope(
            voiceGain,
            voiceoverTrack.isMuted ? 0 : voiceoverTrack.volume,
            voiceoverTrack.fadeInDuration,
            voiceoverTrack.fadeOutDuration,
            totalDuration,
            safeCurrentTime,
            isLooping,
            currentSpeed
          );

          audioNodesRef.current.voiceSource = source;
          audioNodesRef.current.voiceGain = voiceGain;
        } else {
          const audioEl = new Audio(voiceoverTrack.fileUrl);
          audioEl.currentTime = Math.max(0, curTime);
          audioEl.volume =
            voiceoverTrack.isMuted || isMuted
              ? 0
              : Math.min(1, Math.max(0, voiceoverTrack.volume));
          audioEl.playbackRate = 1.0;
          audioEl.loop = isLooping;
          audioEl.play().catch(() => {});
          audioNodesRef.current.voiceSource = audioEl;

          if (!isLooping) {
            const timeout = window.setTimeout(() => {
              if (audioNodesRef.current.voiceSource === audioEl) {
                try {
                  audioEl.pause();
                  audioEl.currentTime = 0;
                } catch (e) {}
              }
            }, remainingVideoTime * 1000);
            audioNodesRef.current.voiceStopTimeout = timeout;
          }
        }
      } catch (e) {
        console.error('Voiceover play error:', e);
      }
    }
  }, [isMuted, musicTrack, voiceoverTrack, totalDuration, currentSpeed, isLooping, stopAudioPlayback]);

  // Dynamically update master & track gains when volume/mute state changes during playback
  useEffect(() => {
    if (audioNodesRef.current.masterGain && audioNodesRef.current.ctx) {
      audioNodesRef.current.masterGain.gain.setValueAtTime(
        isMuted ? 0 : 1,
        audioNodesRef.current.ctx.currentTime
      );
    }
    if (audioNodesRef.current.musicGain) {
      audioEngine.setLiveGain(
        audioNodesRef.current.musicGain,
        musicTrack.volume,
        isMuted || musicTrack.isMuted || !musicTrack.enabled
      );
    } else if (audioNodesRef.current.musicSource instanceof HTMLAudioElement) {
      audioNodesRef.current.musicSource.volume = (isMuted || musicTrack.isMuted || !musicTrack.enabled)
        ? 0
        : Math.min(1, Math.max(0, musicTrack.volume));
    }

    if (audioNodesRef.current.voiceGain) {
      audioEngine.setLiveGain(
        audioNodesRef.current.voiceGain,
        voiceoverTrack.volume,
        isMuted || voiceoverTrack.isMuted || !voiceoverTrack.enabled
      );
    } else if (audioNodesRef.current.voiceSource instanceof HTMLAudioElement) {
      audioNodesRef.current.voiceSource.volume = (isMuted || voiceoverTrack.isMuted || !voiceoverTrack.enabled)
        ? 0
        : Math.min(1, Math.max(0, voiceoverTrack.volume));
    }
  }, [musicTrack.volume, musicTrack.isMuted, musicTrack.enabled, voiceoverTrack.volume, voiceoverTrack.isMuted, voiceoverTrack.enabled, isMuted]);

  // Dynamically update audio envelopes when currentSpeed or volume changes during playback
  useEffect(() => {
    if (audioNodesRef.current.ctx) {
      // Re-apply envelopes to adjust fade and hard cut timing to new speed without altering natural audio pitch/speed
      if (audioNodesRef.current.musicGain && musicTrack.enabled && !musicTrack.isMuted) {
        audioEngine.applyAudioEnvelope(
          audioNodesRef.current.musicGain,
          musicTrack.volume,
          musicTrack.fadeInDuration,
          musicTrack.fadeOutDuration,
          totalDuration,
          currentTimeRef.current,
          isLooping,
          currentSpeed
        );
      }
      if (audioNodesRef.current.voiceGain && voiceoverTrack.enabled && !voiceoverTrack.isMuted) {
        audioEngine.applyAudioEnvelope(
          audioNodesRef.current.voiceGain,
          voiceoverTrack.volume,
          voiceoverTrack.fadeInDuration,
          voiceoverTrack.fadeOutDuration,
          totalDuration,
          currentTimeRef.current,
          isLooping,
          currentSpeed
        );
      }
    }
  }, [currentSpeed, isLooping, totalDuration, musicTrack, voiceoverTrack]);

  // If track selection / file changes while playing, seamlessly restart playback
  useEffect(() => {
    if (isPlaying) {
      stopAudioPlayback();
      startAudioPlayback();
    }
  }, [
    musicTrack.presetId,
    musicTrack.sourceType,
    musicTrack.fileUrl,
    musicTrack.enabled,
    musicTrack.isMuted,
    voiceoverTrack.fileUrl,
    voiceoverTrack.enabled,
    voiceoverTrack.isMuted,
    voiceoverTrack.sourceType,
  ]);

  // Main Render & Animation Loop (High Performance 60 FPS RAF Loop)
  useEffect(() => {
    let animId: number;
    let lastTimestamp: number = performance.now();
    let lastUIUpdate: number = 0;

    const loop = (now: number) => {
      const delta = Math.min(0.1, (now - lastTimestamp) / 1000);
      lastTimestamp = now;

      if (isPlayingRef.current) {
        let next = currentTimeRef.current + delta * currentSpeed;
        if (next >= totalDuration) {
          if (isLooping) {
            next = 0;
            currentTimeRef.current = 0;
            stopAudioPlayback();
            startAudioPlayback();
          } else {
            next = totalDuration;
            currentTimeRef.current = totalDuration;
            isPlayingRef.current = false;
            setIsPlaying(false);
            stopAudioPlayback();
            setCurrentTimeState(totalDuration);
          }
        } else {
          currentTimeRef.current = next;

          // Synchronize active slide state with video playback progress
          const currentSlideInfo = getSlideAtTime(slides, next);
          if (
            currentSlideInfo.slide &&
            currentSlideInfo.slide.id !== activeSlideIdRef.current &&
            onSelectSlide
          ) {
            onSelectSlide(currentSlideInfo.slide.id);
          }

          // Throttle React UI state updates to ~20 FPS (50ms) to prevent re-render thrashing while keeping slider responsive
          if (now - lastUIUpdate > 50) {
            lastUIUpdate = now;
            setCurrentTimeState(next);
          }
        }
      }

      if (canvasRef.current) {
        renderVideoFrame({
          canvas: canvasRef.current,
          slides,
          currentTime: currentTimeRef.current,
          subtitleConfig,
          aspectRatio,
          imagesMap: imagesMapRef.current,
          logoImg: logoImgRef.current,
          logoPosition: logoPositionRef.current,
          isDraggingLogo,
          showLogoBorder: isHoveringLogo || isDraggingLogo,
          isDraggingText,
          showTextBorder: isHoveringText || isDraggingText,
        });
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [
    isPlaying,
    totalDuration,
    isLooping,
    slides,
    subtitleConfig,
    aspectRatio,
    stopAudioPlayback,
    startAudioPlayback,
    currentSpeed,
    isDraggingLogo,
    isHoveringLogo,
    isDraggingText,
    isHoveringText,
    onSelectSlide
  ]);

  // Handle Play/Pause
  const togglePlay = () => {
    if (!isPlaying) {
      if (currentTimeRef.current >= totalDuration) {
        setCurrentTime(0);
      }
      setIsPlaying(true);
      startAudioPlayback();
    } else {
      setIsPlaying(false);
      stopAudioPlayback();
    }
  };

  const handleRewind = () => {
    setCurrentTime(0);
    if (isPlaying) {
      stopAudioPlayback();
      startAudioPlayback();
    }
  };

  // Fullscreen Preview
  const handleFullscreen = () => {
    if (containerRef.current?.requestFullscreen) {
      containerRef.current.requestFullscreen();
    }
  };

  // Waits until every slide's image is actually decoded into imagesMapRef.
  // Without this, clicking Export before photos finish loading (very
  // plausible right after upload, or right after a restored project
  // re-triggers the preload effect) causes later slides to silently draw
  // nothing — since the canvas isn't cleared between frames, whatever was
  // last successfully drawn just stays frozen on screen for the rest of
  // the video, with only the audio actually running its full length.
  const waitForImagesReady = (targetSlides: SlideItem[]): Promise<void> => {
    return new Promise((resolve, reject) => {
      const timeoutMs = 20000;
      const startedAt = Date.now();

      const check = () => {
        const allLoaded = targetSlides.every((s) => imagesMapRef.current.has(s.id));
        if (allLoaded) {
          resolve();
          return;
        }
        if (Date.now() - startedAt > timeoutMs) {
          reject(new Error('Some photos took too long to load. Please wait a moment and try exporting again.'));
          return;
        }
        setTimeout(check, 150);
      };

      check();
    });
  };

  // Video Export (MP4 / WebM with Canvas Capture + Audio Mix Destination)
  const handleExportVideo = async () => {
    if (!canvasRef.current) return;

    // Defensive guard: this component has multiple instances mounted across
    // different wizard steps, and it's happened before that one of them was
    // wired up without the credit-handling props — which used to crash with
    // a cryptic "X is not a function" the moment export was clicked, instead
    // of a clear error. If that ever happens again, fail loudly and clearly.
    if (!onDeductCredit || !onOpenPricing) {
      setExportError(
        'Export is not available from this preview panel. Please use the video preview in the main "Preview Whole Video" step instead.'
      );
      return;
    }

    // 1. Check if user has available credits
    if (totalAvailableCredits <= 0) {
      onOpenPricing(false);
      return;
    }

    // 2. Attempt credit deduction
    const deductResult = await onDeductCredit();
    if (!deductResult.success) {
      onOpenPricing(false);
      return;
    }

    setIsExporting(true);
    setExportProgress(0);
    setExportDone(false);
    setExportError(null);

    setIsPlaying(false);
    stopAudioPlayback();

    // 3. Pop up low balance reminder if 3 or fewer credits remaining
    if (deductResult.warningLow || deductResult.remainingTotal <= 3) {
      setTimeout(() => {
        onOpenPricing(true);
      }, 1200);
    }

    // Whatever goes wrong below, this guarantees the Export button becomes
    // clickable again instead of getting stuck disabled forever — that was
    // the actual bug: nothing in this function used to reset isExporting on
    // failure, only on a fully successful completion.
    const handleExportFailure = (err: unknown) => {
      console.error('Video export failed:', err);
      setIsExporting(false);
      setIsPreparingImages(false);
      setExportProgress(0);
      setExportError(
        err instanceof Error && err.message
          ? err.message
          : 'Export failed unexpectedly. Please try again.'
      );
    };

    try {
      // Make sure every photo has actually finished loading before
      // recording a single frame — otherwise slides whose image isn't
      // ready yet silently draw nothing, and the last successfully-drawn
      // frame just stays frozen on screen for the rest of the video.
      const allImagesAlreadyLoaded = slides.every((s) => imagesMapRef.current.has(s.id));
      if (!allImagesAlreadyLoaded) {
        setIsPreparingImages(true);
        await waitForImagesReady(slides);
        setIsPreparingImages(false);
      }

      const canvas = canvasRef.current;
      const ctx = audioEngine.initContext();

      // Create WebAudio MediaStreamDestination to capture mixed audio with envelopes
      const dest = ctx.createMediaStreamDestination();

      // Prepare music buffer source if active
      let musicSourceNode: AudioBufferSourceNode | null = null;
      let musicGainNode: GainNode | null = null;

      if (
        musicTrack.enabled &&
        !musicTrack.isMuted &&
        musicTrack.volume > 0 &&
        ((musicTrack.sourceType === 'preset' && musicTrack.presetId && musicTrack.presetId !== 'none') ||
          (musicTrack.sourceType === 'custom' && musicTrack.fileUrl))
      ) {
        musicGainNode = ctx.createGain();
        musicGainNode.connect(dest);

        let buffer: AudioBuffer | null = null;
        if (musicTrack.sourceType === 'preset' && musicTrack.presetId && musicTrack.presetId !== 'none') {
          buffer = await audioEngine.resolvePresetMusicBuffer(
            musicTrack.presetId,
            Math.max(16, (totalDuration / currentSpeed) + 4)
          );
        } else if (musicTrack.fileUrl) {
          buffer = await audioEngine.decodeAudioUrl(musicTrack.fileUrl);
        }

        if (buffer) {
          musicSourceNode = ctx.createBufferSource();
          musicSourceNode.buffer = buffer;
          musicSourceNode.loop = true;
          musicSourceNode.playbackRate.value = 1.0;
          musicSourceNode.connect(musicGainNode);

          audioEngine.applyAudioEnvelope(
            musicGainNode,
            musicTrack.volume,
            musicTrack.fadeInDuration,
            musicTrack.fadeOutDuration,
            totalDuration,
            0,
            false,
            currentSpeed
          );
        }
      }

      // Prepare voiceover buffer source if active
      let voiceSourceNode: AudioBufferSourceNode | null = null;
      let voiceGainNode: GainNode | null = null;

      if (
        voiceoverTrack.enabled &&
        !voiceoverTrack.isMuted &&
        voiceoverTrack.volume > 0 &&
        voiceoverTrack.fileUrl
      ) {
        voiceGainNode = ctx.createGain();
        voiceGainNode.connect(dest);

        const voiceBuffer = await audioEngine.decodeAudioUrl(voiceoverTrack.fileUrl);
        if (voiceBuffer) {
          voiceSourceNode = ctx.createBufferSource();
          voiceSourceNode.buffer = voiceBuffer;
          voiceSourceNode.playbackRate.value = 1.0;
          voiceSourceNode.connect(voiceGainNode);

          audioEngine.applyAudioEnvelope(
            voiceGainNode,
            voiceoverTrack.volume,
            voiceoverTrack.fadeInDuration,
            voiceoverTrack.fadeOutDuration,
            totalDuration,
            0,
            false,
            currentSpeed
          );
        }
      }

      // Canvas Video Stream — manual capture mode (0 = "don't auto-sample,
      // I'll tell you exactly when each frame is ready"). Automatic mode
      // (captureStream(30)) samples on the browser's own independent
      // clock, decoupled from when our render loop actually finishes
      // drawing — when frame complexity varies (captions with shadows and
      // gradients take longer to draw than a plain image), those two
      // clocks drift apart, producing stale/duplicate frames and skips.
      // This showed up as measured ~20fps actual output despite requesting
      // 30fps, with gaps up to 270ms between frames. Manual capture via
      // requestFrame() ties each frame's timing directly to when it was
      // actually drawn, eliminating that mismatch entirely.
      const canvasStream = canvas.captureStream(0);
      const videoTrack = canvasStream.getVideoTracks()[0];
      const combinedTracks = [
        videoTrack,
        ...dest.stream.getAudioTracks(),
      ];
      const exportStream = new MediaStream(combinedTracks);

      // MediaRecorder Options
      let mimeType = 'video/webm;codecs=vp9,opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm';
      }
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        throw new Error('Your browser does not support video recording. Please try Chrome or Edge.');
      }

      const mediaRecorder = new MediaRecorder(exportStream, { mimeType });
      const chunks: Blob[] = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      mediaRecorder.onerror = (event) => {
        handleExportFailure(
          new Error((event as any)?.error?.message || 'Recording failed unexpectedly.')
        );
      };

      mediaRecorder.onstop = () => {
        try {
          if (chunks.length === 0) {
            throw new Error('No video data was recorded. Please try again.');
          }
          const blob = new Blob(chunks, { type: mimeType });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${slides[0]?.title?.replace(/[^a-z0-9]/gi, '_') || 'property_tour'}_video.webm`;
          a.click();

          setIsExporting(false);
          setExportDone(true);
          setTimeout(() => setExportDone(false), 5000);
        } catch (err) {
          handleExportFailure(err);
        }
      };

      // Start Recording Frame by Frame
      mediaRecorder.start();
      if (musicSourceNode) {
        try { musicSourceNode.start(0); } catch (e) {}
      }
      if (voiceSourceNode) {
        try { voiceSourceNode.start(0); } catch (e) {}
      }

      let renderTime = 0;
      // Tracks real elapsed wall-clock time rather than accumulating a
      // fixed per-iteration step — a naive `setTimeout(fn, 1000/30)` loop
      // schedules its next call 33ms after the CURRENT call finishes, not
      // at a fixed cadence, so any variance in how long a frame takes to
      // draw compounds into drift over the export. Computing renderTime
      // from actual elapsed time keeps video content correctly paced
      // regardless of per-frame rendering cost.
      const exportStartWallClock = performance.now();

      const renderExportStep = () => {
        try {
          if (renderTime <= totalDuration) {
            renderVideoFrame({
              canvas,
              slides,
              currentTime: renderTime,
              subtitleConfig,
              aspectRatio,
              imagesMap: imagesMapRef.current,
              logoImg: logoImgRef.current,
              logoPosition: logoPositionRef.current,
            });
            // Explicitly push exactly this frame into the recording now —
            // see the manual-capture-mode note above.
            videoTrack.requestFrame();

            const elapsedSeconds = (performance.now() - exportStartWallClock) / 1000;
            renderTime = elapsedSeconds * currentSpeed;
            setExportProgress(Math.min(100, Math.round((renderTime / totalDuration) * 100)));
            requestAnimationFrame(renderExportStep);
          } else {
            if (musicSourceNode) {
              try {
                musicSourceNode.stop();
              } catch (e) {}
            }
            if (voiceSourceNode) {
              try {
                voiceSourceNode.stop();
              } catch (e) {}
            }
            if (musicGainNode) {
              try { musicGainNode.gain.setValueAtTime(0, 0); } catch (e) {}
            }
            if (voiceGainNode) {
              try { voiceGainNode.gain.setValueAtTime(0, 0); } catch (e) {}
            }
            mediaRecorder.stop();
          }
        } catch (err) {
          // A failure mid-render (e.g. a corrupt image) would previously
          // just stop the setTimeout chain silently, leaving the recorder
          // running forever and the button stuck disabled.
          try {
            mediaRecorder.stop();
          } catch (e) {}
          handleExportFailure(err);
        }
      };

      renderExportStep();
    } catch (err) {
      handleExportFailure(err);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Video Monitor Player Box */}
      <div
        ref={containerRef}
        className="relative bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col items-center justify-center min-h-[380px] lg:min-h-[460px] group"
      >
        {/* Canvas Element */}
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          className={`max-w-full max-h-[500px] object-contain transition-all touch-none select-none ${
            isDraggingLogo || isDraggingText
              ? 'cursor-grabbing'
              : isHoveringLogo || isHoveringText
              ? 'cursor-grab'
              : logoUrl || subtitleConfig.showCaptions
              ? 'cursor-crosshair'
              : 'cursor-default'
          } ${
            aspectRatio === '9:16' ? 'aspect-[9/16] w-[280px]' : aspectRatio === '1:1' ? 'aspect-square w-[420px]' : 'aspect-video w-full'
          }`}
        />

        {/* Top Control Bar Overlay */}
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none z-10">
          <div className="flex flex-wrap items-center gap-2 pointer-events-auto">
            <span className="bg-slate-900/80 backdrop-blur-md text-slate-200 text-xs font-bold px-2.5 py-1 rounded-md border border-slate-700/50 flex items-center gap-1.5 shadow">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Real-Time Preview
            </span>
            <span className="bg-amber-500/20 backdrop-blur-md text-amber-300 text-xs font-semibold px-2 py-1 rounded-md border border-amber-500/30 flex items-center gap-1">
              <span>{slides.length} Photos</span>
              <span>&bull;</span>
              <span>{Math.round(totalDuration / currentSpeed)}s</span>
              {currentSpeed !== 1.0 && (
                <span className="bg-amber-500 text-slate-950 font-bold px-1 rounded text-[10px] ml-0.5">
                  {currentSpeed}x
                </span>
              )}
            </span>
            {slides.length > 0 && (
              <span className="bg-slate-900/90 backdrop-blur-md text-amber-400 text-[11px] font-bold px-2 py-1 rounded-md border border-slate-700/60 shadow flex items-center gap-1">
                <span>Photo #{getSlideAtTime(slides, currentTime).index + 1}:</span>
                <span className="text-white capitalize">
                  {getSlideAtTime(slides, currentTime).slide.transition.replace(/-/g, ' ')}
                </span>
              </span>
            )}
          </div>

          {/* Aspect Ratio Quick Toggles */}
          <div className="flex items-center gap-1 bg-slate-900/90 backdrop-blur-md p-1 rounded-lg border border-slate-700/60 pointer-events-auto shadow">
            <button
              onClick={() => onUpdateAspectRatio('16:9')}
              title="Landscape Widescreen (16:9) - YouTube / MLS"
              className={`p-1.5 rounded-md text-xs font-semibold flex items-center gap-1 transition-colors ${
                aspectRatio === '16:9' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Monitor className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">16:9</span>
            </button>
            <button
              onClick={() => onUpdateAspectRatio('9:16')}
              title="Vertical Reel (9:16) - TikTok / Instagram Shorts"
              className={`p-1.5 rounded-md text-xs font-semibold flex items-center gap-1 transition-colors ${
                aspectRatio === '9:16' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">9:16</span>
            </button>
            <button
              onClick={() => onUpdateAspectRatio('1:1')}
              title="Square (1:1) - Social Posts"
              className={`p-1.5 rounded-md text-xs font-semibold flex items-center gap-1 transition-colors ${
                aspectRatio === '1:1' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Square className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">1:1</span>
            </button>
          </div>
        </div>

        {/* Big Play Overlay Button when Paused */}
        {!isPlaying && (
          <button
            onClick={togglePlay}
            className="absolute inset-0 m-auto w-16 h-16 rounded-full bg-amber-500/90 hover:bg-amber-400 text-slate-950 flex items-center justify-center shadow-xl backdrop-blur-sm transition-all hover:scale-110 active:scale-95 z-20"
          >
            <Play className="w-8 h-8 fill-slate-950 ml-1" />
          </button>
        )}
      </div>

      {/* Draggable Logo Quick Presets & Status Bar */}
      {logoUrl && (
        <div className="bg-slate-900/90 border border-amber-500/30 rounded-xl px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 shadow-sm">
          <div className="flex items-center gap-1.5 text-xs text-amber-400 font-bold">
            <Sparkles className="w-4 h-4 fill-amber-400" />
            <span>Logo Placement:</span>
            <span className="text-[11px] font-normal text-slate-400 hidden sm:inline">
              (Drag logo directly on preview canvas or pick preset)
            </span>
          </div>

          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
            <button
              type="button"
              onClick={() => setLogoPosition({ xRatio: 0.12, yRatio: 0.12 })}
              className={`px-2 py-1 rounded text-[10px] font-bold transition-colors ${
                logoPosition.xRatio < 0.3 && logoPosition.yRatio < 0.3
                  ? 'bg-amber-500 text-slate-950'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Place Logo Top Left"
            >
              ↖ Top Left
            </button>
            <button
              type="button"
              onClick={() => setLogoPosition({ xRatio: 0.88, yRatio: 0.12 })}
              className={`px-2 py-1 rounded text-[10px] font-bold transition-colors ${
                logoPosition.xRatio > 0.7 && logoPosition.yRatio < 0.3
                  ? 'bg-amber-500 text-slate-950'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Place Logo Top Right"
            >
              ↗ Top Right
            </button>
            <button
              type="button"
              onClick={() => setLogoPosition({ xRatio: 0.12, yRatio: 0.88 })}
              className={`px-2 py-1 rounded text-[10px] font-bold transition-colors ${
                logoPosition.xRatio < 0.3 && logoPosition.yRatio > 0.7
                  ? 'bg-amber-500 text-slate-950'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Place Logo Bottom Left"
            >
              ↙ Bottom Left
            </button>
            <button
              type="button"
              onClick={() => setLogoPosition({ xRatio: 0.88, yRatio: 0.88 })}
              className={`px-2 py-1 rounded text-[10px] font-bold transition-colors ${
                logoPosition.xRatio > 0.7 && logoPosition.yRatio > 0.7
                  ? 'bg-amber-500 text-slate-950'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Place Logo Bottom Right"
            >
              ↘ Bottom Right
            </button>
            <button
              type="button"
              onClick={() => setLogoPosition({ xRatio: 0.5, yRatio: 0.5 })}
              className={`px-2 py-1 rounded text-[10px] font-bold transition-colors ${
                Math.abs(logoPosition.xRatio - 0.5) < 0.15 && Math.abs(logoPosition.yRatio - 0.5) < 0.15
                  ? 'bg-amber-500 text-slate-950'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Center Logo"
            >
              ❖ Center
            </button>
          </div>
        </div>
      )}

      {/* Draggable Text Overlay Quick Position Bar */}
      {subtitleConfig.showCaptions && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 shadow-sm">
          <div className="flex items-center gap-1.5 text-xs text-amber-300 font-bold">
            <Move className="w-4 h-4 text-amber-400" />
            <span>Text Overlay Placement:</span>
            <span className="text-[11px] font-normal text-slate-400 hidden sm:inline">
              (Drag text directly anywhere on preview canvas)
            </span>
            {subtitleConfig.customXRatio !== undefined && subtitleConfig.customYRatio !== undefined && (
              <span className="text-[10px] font-mono bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800 text-amber-400">
                X:{Math.round(subtitleConfig.customXRatio * 100)}% Y:{Math.round(subtitleConfig.customYRatio * 100)}%
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
            <button
              type="button"
              onClick={() => {
                if (onUpdateSubtitleConfig) {
                  onUpdateSubtitleConfig({
                    ...subtitleConfig,
                    position: 'top',
                    customXRatio: 0.5,
                    customYRatio: 0.18,
                  });
                }
              }}
              className={`px-2 py-1 rounded text-[10px] font-bold transition-colors ${
                subtitleConfig.position === 'top' || (subtitleConfig.customYRatio !== undefined && subtitleConfig.customYRatio < 0.3)
                  ? 'bg-amber-500 text-slate-950'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Snap Text to Top"
            >
              ⬆ Top
            </button>
            <button
              type="button"
              onClick={() => {
                if (onUpdateSubtitleConfig) {
                  onUpdateSubtitleConfig({
                    ...subtitleConfig,
                    position: 'center',
                    customXRatio: 0.5,
                    customYRatio: 0.5,
                  });
                }
              }}
              className={`px-2 py-1 rounded text-[10px] font-bold transition-colors ${
                subtitleConfig.position === 'center' || (subtitleConfig.customYRatio !== undefined && Math.abs(subtitleConfig.customYRatio - 0.5) < 0.15)
                  ? 'bg-amber-500 text-slate-950'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Snap Text to Center"
            >
              ✛ Center
            </button>
            <button
              type="button"
              onClick={() => {
                if (onUpdateSubtitleConfig) {
                  onUpdateSubtitleConfig({
                    ...subtitleConfig,
                    position: 'lower-third',
                    customXRatio: 0.5,
                    customYRatio: 0.75,
                  });
                }
              }}
              className={`px-2 py-1 rounded text-[10px] font-bold transition-colors ${
                subtitleConfig.position === 'lower-third' || (subtitleConfig.customYRatio !== undefined && Math.abs(subtitleConfig.customYRatio - 0.75) < 0.06)
                  ? 'bg-amber-500 text-slate-950'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Snap Text to Lower Third"
            >
              ⬇ Lower Third
            </button>
            <button
              type="button"
              onClick={() => {
                if (onUpdateSubtitleConfig) {
                  onUpdateSubtitleConfig({
                    ...subtitleConfig,
                    position: 'bottom',
                    customXRatio: 0.5,
                    customYRatio: 0.82,
                  });
                }
              }}
              className={`px-2 py-1 rounded text-[10px] font-bold transition-colors ${
                subtitleConfig.position === 'bottom' || (!subtitleConfig.position && !subtitleConfig.customYRatio) || (subtitleConfig.customYRatio !== undefined && subtitleConfig.customYRatio >= 0.8)
                  ? 'bg-amber-500 text-slate-950'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Snap Text to Bottom (Default)"
            >
              ⤓ Bottom
            </button>
            {(subtitleConfig.customXRatio !== undefined || subtitleConfig.customYRatio !== undefined) && (
              <button
                type="button"
                onClick={() => {
                  if (onUpdateSubtitleConfig) {
                    onUpdateSubtitleConfig({
                      ...subtitleConfig,
                      position: 'bottom',
                      customXRatio: 0.5,
                      customYRatio: 0.82,
                    });
                  }
                }}
                className="px-2 py-1 rounded text-[10px] font-bold text-red-400 hover:text-red-300 hover:bg-red-950/40 transition-colors ml-1"
                title="Reset to default center-bottom position"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      )}

      {/* Video Control Bar & Timeline Slider */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 flex flex-col gap-3 shadow-lg">
        {/* Timeline Slider */}
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono font-medium text-slate-400 w-12 text-right">
            {formatTime(currentTime)}
          </span>
          <input
            type="range"
            min={0}
            max={totalDuration || 1}
            step={0.05}
            value={currentTime}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              setCurrentTime(val);
              if (isPlaying) {
                stopAudioPlayback();
                startAudioPlayback();
              }
            }}
            className="flex-1 accent-amber-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
          />
          <span className="text-xs font-mono font-medium text-slate-400 w-12">
            {formatTime(totalDuration)}
          </span>
        </div>

        {/* Slide Quick Jump Navigation Bar */}
        {slides.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pr-1 flex-shrink-0">
              Jump to Slide:
            </span>
            {slides.map((s, idx) => {
              const isSelected = s.id === activeSlideId;
              return (
                <button
                  key={s.id}
                  onClick={() => jumpToSlide(s.id)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all flex-shrink-0 border cursor-pointer ${
                    isSelected
                      ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold shadow'
                      : 'bg-slate-950/80 text-slate-300 border-slate-800 hover:border-slate-700 hover:bg-slate-800'
                  }`}
                >
                  <span className="text-[10px] opacity-80">#{idx + 1}</span>
                  <span className="max-w-[100px] truncate">{s.title || `Slide ${idx + 1}`}</span>
                </button>
              );
            })}
          </div>
        )}

        {exportError && (
          <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2.5 text-xs text-red-300">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-semibold">Export failed:</span> {exportError}
            </div>
            <button
              onClick={() => setExportError(null)}
              className="text-red-400 hover:text-red-200 shrink-0"
              title="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Action Controls Row */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={togglePlay}
              className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs px-4 py-2 rounded-lg shadow transition-colors"
            >
              {isPlaying ? (
                <>
                  <Pause className="w-4 h-4 fill-slate-950" />
                  <span>Pause</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-slate-950 ml-0.5" />
                  <span>Play Preview</span>
                </>
              )}
            </button>

            <button
              onClick={handleRewind}
              title="Restart from beginning"
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <button
              onClick={() => setIsLooping(!isLooping)}
              title={isLooping ? 'Looping enabled' : 'Looping disabled'}
              className={`p-2 rounded-lg transition-colors ${
                isLooping ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-slate-800 text-slate-400'
              }`}
            >
              <Repeat className="w-4 h-4" />
            </button>

            {/* Quick Live Music Volume & Mute Bar */}
            <div className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 shadow-sm">
              <Music className="w-3.5 h-3.5 text-amber-400" />
              <button
                type="button"
                onClick={() => {
                  const nextMuted = !isMuted;
                  setIsMuted(nextMuted);
                  if (onUpdateMusicTrack) {
                    onUpdateMusicTrack({ ...musicTrack, isMuted: nextMuted });
                  }
                }}
                title={
                  !musicTrack.enabled || isMuted || musicTrack.isMuted
                    ? 'Music is Muted / Off'
                    : 'Mute Music'
                }
                className={`p-0.5 rounded transition-colors ${
                  !musicTrack.enabled || isMuted || musicTrack.isMuted
                    ? 'text-red-400 hover:text-red-300'
                    : 'text-amber-400 hover:text-amber-300'
                }`}
              >
                {!musicTrack.enabled || isMuted || musicTrack.isMuted ? (
                  <VolumeX className="w-3.5 h-3.5" />
                ) : (
                  <Volume2 className="w-3.5 h-3.5" />
                )}
              </button>

              <input
                type="range"
                min={0}
                max={1.5}
                step={0.05}
                value={!musicTrack.enabled || isMuted || musicTrack.isMuted ? 0 : musicTrack.volume}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  if (isMuted) setIsMuted(false);
                  if (onUpdateMusicTrack) {
                    onUpdateMusicTrack({
                      ...musicTrack,
                      volume: val,
                      isMuted: false,
                      enabled: val > 0 ? (musicTrack.presetId || musicTrack.fileUrl ? true : false) : musicTrack.enabled,
                    });
                  }
                }}
                title={
                  !musicTrack.enabled
                    ? 'Music is disabled (No sound)'
                    : `Live Music Volume: ${Math.round(musicTrack.volume * 100)}%`
                }
                className="w-14 sm:w-20 accent-amber-500 h-1.5 bg-slate-900 rounded cursor-pointer"
              />
              <span className="text-[10px] font-mono font-bold text-amber-300 min-w-[28px] text-right">
                {!musicTrack.enabled || isMuted || musicTrack.isMuted
                  ? 'Off'
                  : `${Math.round(musicTrack.volume * 100)}%`}
              </span>
            </div>

            {/* Quick Live Voiceover Volume & Mute Bar */}
            {voiceoverTrack.fileUrl && (
              <div className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 shadow-sm">
                <Mic className="w-3.5 h-3.5 text-emerald-400" />
                <button
                  type="button"
                  onClick={() => {
                    if (onUpdateVoiceoverTrack) {
                      onUpdateVoiceoverTrack({
                        ...voiceoverTrack,
                        isMuted: !voiceoverTrack.isMuted,
                      });
                    }
                  }}
                  title={
                    !voiceoverTrack.enabled || voiceoverTrack.isMuted || isMuted
                      ? 'Voiceover is Muted / Off'
                      : 'Mute Voiceover'
                  }
                  className={`p-0.5 rounded transition-colors ${
                    !voiceoverTrack.enabled || voiceoverTrack.isMuted || isMuted
                      ? 'text-red-400 hover:text-red-300'
                      : 'text-emerald-400 hover:text-emerald-300'
                  }`}
                >
                  {!voiceoverTrack.enabled || voiceoverTrack.isMuted || isMuted ? (
                    <VolumeX className="w-3.5 h-3.5" />
                  ) : (
                    <Volume2 className="w-3.5 h-3.5" />
                  )}
                </button>

                <input
                  type="range"
                  min={0}
                  max={1.5}
                  step={0.05}
                  value={
                    !voiceoverTrack.enabled || voiceoverTrack.isMuted || isMuted
                      ? 0
                      : voiceoverTrack.volume
                  }
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    if (onUpdateVoiceoverTrack) {
                      onUpdateVoiceoverTrack({
                        ...voiceoverTrack,
                        volume: val,
                        isMuted: false,
                        enabled: val > 0,
                      });
                    }
                  }}
                  title={`Live Voiceover Volume: ${Math.round(voiceoverTrack.volume * 100)}%`}
                  className="w-14 sm:w-20 accent-emerald-500 h-1.5 bg-slate-900 rounded cursor-pointer"
                />
                <span className="text-[10px] font-mono font-bold text-emerald-300 min-w-[28px] text-right">
                  {!voiceoverTrack.enabled || voiceoverTrack.isMuted || isMuted
                    ? 'Off'
                    : `${Math.round(voiceoverTrack.volume * 100)}%`}
                </span>
              </div>
            )}

            {/* Speed Selection Dropdown */}
            <div className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700/80 border border-slate-700 rounded-lg px-2.5 py-1.5 transition-colors shadow-sm">
              <Gauge className="w-4 h-4 text-amber-400 flex-shrink-0" />
              <select
                value={currentSpeed}
                onChange={(e) => handleSpeedChange(parseFloat(e.target.value))}
                className="bg-transparent text-xs font-bold text-amber-300 focus:outline-none cursor-pointer pr-1"
                title="Select Video Speed"
              >
                {SPEED_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value} className="bg-slate-900 text-slate-200 font-medium">
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleFullscreen}
              title="Fullscreen Mode"
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            >
              <Maximize2 className="w-4 h-4" />
            </button>

            <button
              onClick={handleExportVideo}
              disabled={isExporting || slides.length === 0}
              className="flex items-center gap-2 bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-extrabold text-xs px-4 py-2 rounded-lg shadow-md transition-all disabled:opacity-50"
            >
              {isPreparingImages ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
                  <span>Preparing Photos...</span>
                </>
              ) : isExporting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
                  <span>Rendering ({exportProgress}%)</span>
                </>
              ) : exportDone ? (
                <>
                  <CheckCircle className="w-4 h-4 text-slate-950" />
                  <span>Downloaded!</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Export & Download Video</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
