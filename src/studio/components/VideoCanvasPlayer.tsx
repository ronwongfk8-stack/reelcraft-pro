import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Maximize2,
  Download,
  Sparkles,
  Smartphone,
  Tv,
  Square,
  Sliders,
  CheckCircle2,
  Loader2,
  Type,
  RotateCw,
  Trash2,
  Plus,
} from 'lucide-react';
import { VideoProject, MediaItem, AudioSettings, TransitionType, MotionType, ColorFilterType, SceneTextOverlay, TimelineClip,
  LogoSettings,
} from '../types';
import { audioEngine } from '../utils/audioEngine';

interface VideoCanvasPlayerProps {
  project: VideoProject;
  mediaItems: MediaItem[];
  audioSettings: AudioSettings;
  selectedClipId?: string;
  onTimeUpdate?: (time: number) => void;
  onClipSelect?: (clipId: string) => void;
  onUpdateClipTextOverlay?: (clipId: string, overlay: SceneTextOverlay | undefined) => void;
  onOpenSettings?: () => void;
  isGenerating?: boolean;
  generationStep?: string;
  /** Called right before an export starts. Return false to cancel (e.g. no credits left). */
  onBeforeExport?: () => Promise<boolean>;
  logo?: LogoSettings;
}

// Branded ReelCraftpro.com Loading Spinner
export const ReelCraftSpinner: React.FC<{ size?: 'sm' | 'md' | 'lg'; className?: string }> = ({
  size = 'md',
  className = '',
}) => {
  const dim = size === 'lg' ? 'w-16 h-16' : size === 'sm' ? 'w-8 h-8' : 'w-12 h-12';
  const iconDim = size === 'lg' ? 'w-8 h-8' : size === 'sm' ? 'w-4 h-4' : 'w-6 h-6';
  const innerRound = size === 'lg' ? 'rounded-2xl' : size === 'sm' ? 'rounded-md' : 'rounded-xl';

  return (
    <div className={`relative flex items-center justify-center ${dim} ${className}`}>
      {/* Outer spinning gradient glow ring */}
      <div className="absolute -inset-1.5 rounded-2xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 animate-spin opacity-85 blur-[3px]" />
      <div
        className={`relative ${dim} ${innerRound} bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 p-0.5 flex items-center justify-center shadow-2xl`}
      >
        <div className={`w-full h-full bg-slate-950 ${innerRound} flex items-center justify-center`}>
          <Sparkles className={`${iconDim} text-indigo-400 animate-pulse`} />
        </div>
      </div>
    </div>
  );
};

// Helper to convert hex and opacity to RGBA color string
function hexToRgba(hex: string, alpha: number): string {
  let c = hex.replace('#', '');
  if (c.length === 3) {
    c = c.split('').map((char) => char + char).join('');
  }
  const num = parseInt(c, 16);
  if (isNaN(num)) return `rgba(0, 0, 0, ${alpha})`;
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha))})`;
}

function getFontFamily(fontStyle?: string): string {
  if (fontStyle === 'serif') return '"Playfair Display", Georgia, serif';
  if (fontStyle === 'mono') return '"JetBrains Mono", "Courier New", monospace';
  if (fontStyle === 'impact') return 'Impact, "Arial Black", sans-serif';
  if (fontStyle === 'rounded') return '"Comic Sans MS", "Plus Jakarta Sans", cursive, sans-serif';
  return '"Plus Jakarta Sans", -apple-system, sans-serif';
}

function getTextEffectStyles(effect?: string, color: string = '#FFFFFF'): React.CSSProperties {
  switch (effect) {
    case 'hollow':
      return {
        WebkitTextStroke: '2px ' + color,
        color: 'transparent',
        textShadow: 'none',
      };
    case 'outline':
      return {
        WebkitTextStroke: '3px #000000',
        color: color,
        textShadow: '0 2px 6px rgba(0,0,0,0.9)',
      };
    case 'background':
      return {
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        padding: '6px 16px',
        borderRadius: '8px',
        color: color,
        textShadow: 'none',
      };
    case 'drop':
      return {
        color: color,
        textShadow: '4px 4px 0px #000000, 0 0 8px rgba(0,0,0,0.8)',
      };
    case 'glitch':
      return {
        color: color,
        textShadow: '-3px -1px 0px rgba(6, 182, 212, 0.95), 3px 1px 0px rgba(239, 68, 68, 0.95), 0 0 6px #000',
      };
    case 'splice':
      return {
        color: color,
        textShadow: '0 2px 8px rgba(0,0,0,0.95)',
        letterSpacing: '1px',
      };
    case 'rotate':
      return {
        color: color,
        transform: 'rotate(-4deg)',
        display: 'inline-block',
        textShadow: '0 2px 6px #000000',
      };
    case 'curve':
      return {
        color: color,
        letterSpacing: '2px',
        textShadow: '0 2px 6px #000000',
      };
    case 'none':
    default:
      return {
        color: color,
        textShadow: '0 2px 6px rgba(0,0,0,0.9)',
      };
  }
}

// Helper for color filter CSS (applied per-asset via ctx.filter so export includes the grade)
function getColorFilterCSS(type: ColorFilterType): string {
  switch (type) {
    case 'teal-orange':
      return 'contrast(1.15) saturate(1.25) hue-rotate(-8deg)';
    case 'cyberpunk':
      return 'contrast(1.25) saturate(1.35) hue-rotate(25deg)';
    case 'vintage':
      return 'sepia(0.35) contrast(1.1) brightness(0.95)';
    case 'moody-noir':
      return 'grayscale(1) contrast(1.3) brightness(0.95)';
    case 'golden-hour':
      return 'sepia(0.2) saturate(1.3) brightness(1.06) hue-rotate(-12deg)';
    case 'pastel':
      return 'contrast(0.95) brightness(1.08) saturate(1.15)';
    case 'natural':
    default:
      return 'none';
  }
}

/** Step-wise downscale of very large photos so drawImage doesn't alias/shimmer. */
function prepareImage(img: HTMLImageElement, maxLongSide: number): HTMLImageElement | HTMLCanvasElement {
  let w = img.naturalWidth;
  let h = img.naturalHeight;
  const target = maxLongSide;
  if (Math.max(w, h) <= target * 1.5) return img;
  let src: CanvasImageSource = img;
  while (Math.max(w, h) > target * 1.5) {
    const nw = Math.max(1, Math.round(w / 2));
    const nh = Math.max(1, Math.round(h / 2));
    const c = document.createElement('canvas');
    c.width = nw;
    c.height = nh;
    const cx = c.getContext('2d')!;
    cx.imageSmoothingEnabled = true;
    cx.imageSmoothingQuality = 'high';
    cx.drawImage(src, 0, 0, nw, nh);
    src = c;
    w = nw;
    h = nh;
  }
  return src as HTMLCanvasElement;
}

export const VideoCanvasPlayer: React.FC<VideoCanvasPlayerProps> = ({
  project,
  mediaItems,
  audioSettings,
  selectedClipId,
  onTimeUpdate,
  onClipSelect,
  onUpdateClipTextOverlay,
  onOpenSettings,
  isGenerating,
  generationStep,
  onBeforeExport,
  logo,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const onTimeUpdateRef = useRef(onTimeUpdate);
  useEffect(() => {
    onTimeUpdateRef.current = onTimeUpdate;
  }, [onTimeUpdate]);

  const [currentTime, setCurrentTime] = useState<number>(0);
  const currentTimeRef = useRef(currentTime);
  currentTimeRef.current = currentTime;
  const lastUiSyncRef = useRef(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportProgress, setExportProgress] = useState<number>(0);
  const [exportedVideoUrl, setExportedVideoUrl] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [assetTick, setAssetTick] = useState(0); // bump to force a redraw when images/videos/fonts become ready
  const [brokenVideoNames, setBrokenVideoNames] = useState<string[]>([]);
  const [exportExt, setExportExt] = useState<'webm' | 'mp4'>('webm');
  const [viewW, setViewW] = useState(720); // rendered CSS width of the preview (for WYSIWYG text sizing)
  const isPlayingRef = useRef(false);
  const isExportingRef = useRef(false);
  const isPreparingExportRef = useRef(false);
  const logoImgRef = useRef<HTMLImageElement | HTMLCanvasElement | null>(null);
  const overlayDomVisibleRef = useRef(false);
  const activeOverlayRef = useRef<SceneTextOverlay | undefined>(undefined);

  // Canva drag & transform states
  const [isDraggingText, setIsDraggingText] = useState(false);
  const [isResizingText, setIsResizingText] = useState(false);
  const [isRotatingText, setIsRotatingText] = useState(false);
  const [isEditingInlineText, setIsEditingInlineText] = useState(false);
  const [isEditingTextOnFootage, setIsEditingTextOnFootage] = useState(false);

  // Active clip at current playback time
  const currentClip = project.clips.find(
    (c) => currentTime >= c.startTime && currentTime < c.startTime + c.duration
  ) || project.clips[0];
  const currentClipIndex = project.clips.findIndex((c) => c.id === currentClip?.id);
  const activeOverlay = currentClip?.textOverlay;
  activeOverlayRef.current = activeOverlay;
  isPlayingRef.current = isPlaying;
  isExportingRef.current = isExporting;
  const showOverlayEditor = !isPlaying && !isExporting && !isGenerating && !!activeOverlay?.enabled && !!activeOverlay?.text;
  overlayDomVisibleRef.current = showOverlayEditor;

  // Sync canvas player to selected clip when user clicks a scene
  const prevSelectedClipIdRef = useRef<string | undefined>(selectedClipId);
  useEffect(() => {
    if (!selectedClipId) return;
    if (prevSelectedClipIdRef.current !== selectedClipId) {
      prevSelectedClipIdRef.current = selectedClipId;
      const clip = project.clips.find((c) => c.id === selectedClipId);
      if (clip) {
        const targetTime = clip.startTime + 0.05;
        setCurrentTime(targetTime);
        setIsPlaying(false);
      }
    }
  }, [selectedClipId, project.clips]);

  // Canva: Drag to move text up-down, left-right
  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    if (!currentClip || !activeOverlay) return;

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const initialX = activeOverlay.x ?? 0.5;
    const initialY = activeOverlay.y ?? 0.2;

    const bounds = containerRef.current?.getBoundingClientRect();
    if (!bounds) return;

    const handlePointerMove = (moveEvent: MouseEvent | TouchEvent) => {
      if ('touches' in moveEvent) moveEvent.preventDefault();
      const curX = 'touches' in moveEvent ? moveEvent.touches[0].clientX : moveEvent.clientX;
      const curY = 'touches' in moveEvent ? moveEvent.touches[0].clientY : moveEvent.clientY;
      const deltaX = (curX - clientX) / bounds.width;
      const deltaY = (curY - clientY) / bounds.height;
      const newX = Math.max(0.06, Math.min(0.94, initialX + deltaX));
      const newY = Math.max(0.06, Math.min(0.94, initialY + deltaY));

      if (onUpdateClipTextOverlay) {
        onUpdateClipTextOverlay(currentClip.id, {
          ...(activeOverlayRef.current ?? activeOverlay),
          x: newX,
          y: newY,
        });
      }
    };

    const handlePointerUp = () => {
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseup', handlePointerUp);
      window.removeEventListener('touchmove', handlePointerMove);
      window.removeEventListener('touchend', handlePointerUp);
      setIsDraggingText(false);
    };

    setIsDraggingText(true);
    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', handlePointerUp);
    window.addEventListener('touchmove', handlePointerMove, { passive: false } as any);
    window.addEventListener('touchend', handlePointerUp);
  };

  // Canva: Corner resize to expand / shrink text scale
  const handleResizeStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    if (!currentClip || !activeOverlay) return;

    const bounds = containerRef.current?.getBoundingClientRect();
    if (!bounds) return;

    const centerX = bounds.left + (activeOverlay.x ?? 0.5) * bounds.width;
    const centerY = bounds.top + (activeOverlay.y ?? 0.2) * bounds.height;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const initialDist = Math.hypot(clientX - centerX, clientY - centerY) || 1;
    const initialScale = activeOverlay.scale ?? 1.0;

    const handlePointerMove = (moveEvent: MouseEvent | TouchEvent) => {
      if ('touches' in moveEvent) moveEvent.preventDefault();
      const curX = 'touches' in moveEvent ? moveEvent.touches[0].clientX : moveEvent.clientX;
      const curY = 'touches' in moveEvent ? moveEvent.touches[0].clientY : moveEvent.clientY;
      const curDist = Math.hypot(curX - centerX, curY - centerY);
      const ratio = curDist / initialDist;
      const newScale = Math.max(0.4, Math.min(3.5, Number((initialScale * ratio).toFixed(2))));

      if (onUpdateClipTextOverlay) {
        onUpdateClipTextOverlay(currentClip.id, {
          ...(activeOverlayRef.current ?? activeOverlay),
          scale: newScale,
        });
      }
    };

    const handlePointerUp = () => {
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseup', handlePointerUp);
      window.removeEventListener('touchmove', handlePointerMove);
      window.removeEventListener('touchend', handlePointerUp);
      setIsResizingText(false);
    };

    setIsResizingText(true);
    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', handlePointerUp);
    window.addEventListener('touchmove', handlePointerMove, { passive: false } as any);
    window.addEventListener('touchend', handlePointerUp);
  };

  // Canva: Top stalk rotation
  const handleRotateStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    if (!currentClip || !activeOverlay) return;

    const bounds = containerRef.current?.getBoundingClientRect();
    if (!bounds) return;

    const centerX = bounds.left + (activeOverlay.x ?? 0.5) * bounds.width;
    const centerY = bounds.top + (activeOverlay.y ?? 0.2) * bounds.height;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const initialAngle = Math.atan2(clientY - centerY, clientX - centerX);
    const initialRot = activeOverlay.rotation ?? 0;

    const handlePointerMove = (moveEvent: MouseEvent | TouchEvent) => {
      if ('touches' in moveEvent) moveEvent.preventDefault();
      const curX = 'touches' in moveEvent ? moveEvent.touches[0].clientX : moveEvent.clientX;
      const curY = 'touches' in moveEvent ? moveEvent.touches[0].clientY : moveEvent.clientY;
      const curAngle = Math.atan2(curY - centerY, curX - centerX);
      let angleDeg = ((curAngle - initialAngle) * 180) / Math.PI;
      let newRot = Math.round(initialRot + angleDeg);
      if (newRot > 180) newRot -= 360;
      if (newRot < -180) newRot += 360;
      if (Math.abs(newRot) < 3) newRot = 0;

      if (onUpdateClipTextOverlay) {
        onUpdateClipTextOverlay(currentClip.id, {
          ...(activeOverlayRef.current ?? activeOverlay),
          rotation: newRot,
        });
      }
    };

    const handlePointerUp = () => {
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseup', handlePointerUp);
      window.removeEventListener('touchmove', handlePointerMove);
      window.removeEventListener('touchend', handlePointerUp);
      setIsRotatingText(false);
    };

    setIsRotatingText(true);
    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', handlePointerUp);
    window.addEventListener('touchmove', handlePointerMove, { passive: false } as any);
    window.addEventListener('touchend', handlePointerUp);
  };

  // Cache loaded Image and HTMLVideoElement instances
  const assetCache = useRef<Map<string, HTMLImageElement | HTMLVideoElement | HTMLCanvasElement>>(new Map());
  const prevTransitionIndex = useRef<number>(-1);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  // Resolution dimensions based on aspect ratio
  const getCanvasDimensions = () => {
    switch (project.aspectRatio) {
      case '9:16':
        return { width: 1080, height: 1920 };
      case '16:9':
        return { width: 1920, height: 1080 };
      case '1:1':
      default:
        return { width: 1080, height: 1080 };
    }
  };

  const { width: targetWidth, height: targetHeight } = getCanvasDimensions();

  // Preload all media assets (large photos are pre-downscaled; every load triggers a redraw)
  useEffect(() => {
    const maxSide = Math.max(targetWidth, targetHeight);
    mediaItems.forEach((item) => {
      if (assetCache.current.has(item.id)) return;

      if (item.type === 'image') {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.decoding = 'async';
        img.onload = () => {
          assetCache.current.set(item.id, prepareImage(img, maxSide * 1.25));
          setAssetTick((t) => t + 1);
        };
        img.onerror = () => console.warn('Could not load image', item.name);
        img.src = item.url;
      } else if (item.type === 'video') {
        const vid = document.createElement('video');
        vid.crossOrigin = 'anonymous';
        vid.src = item.url;
        vid.muted = true;
        vid.loop = true;
        vid.playsInline = true;
        vid.preload = 'auto';
        vid.onloadeddata = () => setAssetTick((t) => t + 1);
        vid.onerror = () => setBrokenVideoNames((prev) => (prev.includes(item.name) ? prev : [...prev, item.name]));
        vid.onseeked = () => setAssetTick((t) => t + 1);
        vid.load();
        assetCache.current.set(item.id, vid);
      }
    });
  }, [mediaItems, targetWidth, targetHeight]);

  // Load the logo (re-runs when a different file is chosen); redraw as soon as it is ready
  useEffect(() => {
    if (!logo?.url) {
      logoImgRef.current = null;
      setAssetTick((t) => t + 1);
      return;
    }
    let cancelled = false;
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      if (cancelled) return;
      logoImgRef.current = prepareImage(img, 1024);
      setAssetTick((t) => t + 1);
    };
    img.onerror = () => {
      if (!cancelled) logoImgRef.current = null;
    };
    img.src = logo.url;
    return () => {
      cancelled = true;
    };
  }, [logo?.url]);

  // Redraw once web fonts are ready (canvas text otherwise renders with a fallback font)
  useEffect(() => {
    (document as any).fonts?.ready?.then(() => setAssetTick((t) => t + 1));
  }, []);

  // Track the rendered width of the preview so on-screen text matches canvas text size
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setViewW(el.getBoundingClientRect().width || 720));
    ro.observe(el);
    setViewW(el.getBoundingClientRect().width || 720);
    return () => ro.disconnect();
  }, []);

  // Sync Audio Settings with AudioEngine
  useEffect(() => {
    audioEngine.setVoiceoverAudio(
      audioSettings.voiceover.url,
      audioSettings.voiceover.volume,
      audioSettings.voiceover.muted || isMuted
    );
  }, [audioSettings.voiceover.url, audioSettings.voiceover.volume, audioSettings.voiceover.muted, isMuted]);

  useEffect(() => {
    audioEngine.setMusicAudio(
      audioSettings.music.url,
      audioSettings.music.volume,
      audioSettings.music.muted || isMuted
    );
  }, [audioSettings.music.url, audioSettings.music.volume, audioSettings.music.muted, isMuted]);

  // Draw Frame to Canvas
  const drawLogo = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const img = logoImgRef.current;
    if (!img || !logo?.url) return;
    // SVGs without a fixed size report 0x0, so fall back to a square
    const iw = (img as HTMLImageElement).naturalWidth || img.width || 300;
    const ih = (img as HTMLImageElement).naturalHeight || img.height || 300;

    let dw = (width * Math.min(40, Math.max(3, logo.size))) / 100;
    let dh = dw * (ih / iw);
    const maxH = height * 0.3; // very tall logos never take over the frame
    if (dh > maxH) {
      dh = maxH;
      dw = dh * (iw / ih);
    }
    const margin = Math.round(width * 0.035);
    const x = logo.position.endsWith('left') ? margin : width - dw - margin;
    const y = logo.position.startsWith('top') ? margin : height - dh - margin;

    ctx.save();
    ctx.globalAlpha = Math.min(1, Math.max(0.2, logo.opacity));
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, x, y, dw, dh);
    ctx.restore();
  };

  const drawFrame = useCallback(
    (time: number, ctx: CanvasRenderingContext2D, width: number, height: number) => {
      const clips = project.clips;
      if (!clips || clips.length === 0) {
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = '#94a3b8';
        ctx.font = '24px Plus Jakarta Sans, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('No clips in timeline. Upload media or choose a preset.', width / 2, height / 2);
        return;
      }

      // Find current active clip
      let currentClipIndex = 0;
      for (let i = 0; i < clips.length; i++) {
        if (time >= clips[i].startTime && time < clips[i].startTime + clips[i].duration) {
          currentClipIndex = i;
          break;
        }
        if (time >= clips[clips.length - 1].startTime) {
          currentClipIndex = clips.length - 1;
        }
      }

      const activeClip = clips[currentClipIndex];
      const prevClip = currentClipIndex > 0 ? clips[currentClipIndex - 1] : null;

      const clipRelativeTime = Math.max(0, time - activeClip.startTime);
      const isTransitioning =
        prevClip &&
        activeClip.transitionIn !== 'none' &&
        clipRelativeTime < activeClip.transitionDuration;

      const transitionProgress = isTransitioning
        ? clipRelativeTime / activeClip.transitionDuration
        : 1;

      // Trigger SFX on transition edge
      if (isTransitioning && prevTransitionIndex.current !== currentClipIndex) {
        prevTransitionIndex.current = currentClipIndex;
        if (audioSettings.sfx.enabled && !isMuted) {
          audioEngine.playTransitionSfx(activeClip.transitionIn, audioSettings.sfx.volume);
        }
      } else if (!isTransitioning && prevTransitionIndex.current === currentClipIndex) {
        prevTransitionIndex.current = -1;
      }

      // Check voiceover auto-ducking is handled dynamically by audioEngine

      // Clear Canvas
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, width, height);

      // Helper to draw single asset with motion & filter
      const drawAsset = (
        clip: typeof activeClip,
        clipTime: number,
        opacity = 1,
        offsetX = 0,
        offsetY = 0,
        scaleMultiplier = 1
      ) => {
        const asset = assetCache.current.get(clip.mediaId);
        if (!asset) return;

        ctx.save();
        ctx.globalAlpha = Math.max(0, Math.min(1, opacity));
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        // Colour grade (ctx.filter is unsupported on Safari; there it is simply skipped)
        const gradeCss = getColorFilterCSS(project.colorFilter);
        if (gradeCss !== 'none' && 'filter' in ctx) (ctx as any).filter = gradeCss;

        // Constrain strictly within viewport bounds to eliminate boundary seams and bleed lines
        ctx.beginPath();
        ctx.rect(0, 0, width, height);
        ctx.clip();

        // Calculate motion (Ken Burns effect)
        const progress = Math.min(1, Math.max(0, clipTime / clip.duration));
        let scale = 1.0;
        let panX = 0;
        let panY = 0;

        switch (clip.motionEffect) {
          case 'push-in':
            scale = 1.0 + progress * 0.15;
            break;
          case 'pull-out':
            scale = 1.15 - progress * 0.15;
            break;
          case 'pan-left':
            scale = 1.1;
            panX = (0.5 - progress) * (width * 0.08);
            break;
          case 'pan-right':
            scale = 1.1;
            panX = (progress - 0.5) * (width * 0.08);
            break;
          case 'subtle-drift':
            scale = 1.06 + Math.sin(progress * Math.PI) * 0.04;
            panX = Math.sin(progress * Math.PI * 2) * (width * 0.02);
            panY = Math.cos(progress * Math.PI * 2) * (height * 0.02);
            break;
          case 'none':
          default:
            scale = 1.0;
            break;
        }

        scale *= scaleMultiplier;

        // Apply transformations centered
        ctx.translate(width / 2 + offsetX + panX, height / 2 + offsetY + panY);
        ctx.scale(scale, scale);

        // Aspect ratio cover calculation
        const assetW =
          (asset as HTMLImageElement).naturalWidth ||
          (asset as HTMLVideoElement).videoWidth ||
          (asset as HTMLCanvasElement).width ||
          800;
        const assetH =
          (asset as HTMLImageElement).naturalHeight ||
          (asset as HTMLVideoElement).videoHeight ||
          (asset as HTMLCanvasElement).height ||
          600;
        const targetAspect = width / height;
        const assetAspect = assetW / assetH;

        let drawW = width;
        let drawH = height;
        if (assetAspect > targetAspect) {
          drawH = height;
          drawW = height * assetAspect;
        } else {
          drawW = width;
          drawH = width / assetAspect;
        }

        // Draw image or video frame
        if (asset instanceof HTMLVideoElement) {
          // Keep the video frame locked to this clip's timeline position (respecting the trim start)
          const vDur = isFinite(asset.duration) && asset.duration > 0 ? asset.duration : 0;
          const trimStart = vDur ? Math.min(Math.max(0, clip.trimStart || 0), Math.max(0, vDur - 0.1)) : 0;
          const span = vDur ? Math.max(0.1, vDur - trimStart) : 0;
          const wanted = vDur ? trimStart + (clipTime % span) : clipTime;

          // Original sound: off unless this clip asks for it (and the preview isn't muted)
          const wantSound = !!clip.keepAudio && !isMuted;
          if (clip.keepAudio) audioEngine.attachMediaElement(asset);
          asset.muted = !wantSound;

          if (isPlayingRef.current) {
            if (asset.paused) asset.play().catch(() => {});
            if (vDur && Math.abs(asset.currentTime - wanted) > 0.4) asset.currentTime = wanted;
          } else {
            if (!asset.paused) asset.pause();
            if (vDur && Math.abs(asset.currentTime - wanted) > 0.05) asset.currentTime = wanted; // 'seeked' triggers a redraw
          }
          if (asset.readyState >= 2) ctx.drawImage(asset, -drawW / 2, -drawH / 2, drawW, drawH);
        } else {
          ctx.drawImage(asset, -drawW / 2, -drawH / 2, drawW, drawH);
        }

        ctx.restore();
      };

      // Draw active clip with transition logic
      if (!isTransitioning || !prevClip) {
        // Normal single clip rendering
        drawAsset(activeClip, clipRelativeTime);
      } else {
        // Transition rendering
        const tType = activeClip.transitionIn;
        const p = transitionProgress;
        const prevClipRelativeTime = prevClip.duration - (activeClip.transitionDuration - clipRelativeTime);

        switch (tType) {
          case 'crossfade':
            drawAsset(prevClip, prevClipRelativeTime, 1);
            drawAsset(activeClip, clipRelativeTime, p);
            break;

          case 'whip-left': {
            const easeP = p * p * (3 - 2 * p); // smooth ease
            const splitX = Math.round((1 - easeP) * width);
            ctx.save();
            ctx.beginPath();
            ctx.rect(0, 0, splitX, height);
            ctx.clip();
            drawAsset(prevClip, prevClipRelativeTime, 1, -easeP * width * 0.4, 0);
            ctx.restore();

            ctx.save();
            ctx.beginPath();
            ctx.rect(splitX, 0, width - splitX, height);
            ctx.clip();
            drawAsset(activeClip, clipRelativeTime, 1, (1 - easeP) * width * 0.4, 0);
            ctx.restore();
            break;
          }

          case 'whip-right': {
            const easeP = p * p * (3 - 2 * p);
            const splitX = Math.round(easeP * width);
            ctx.save();
            ctx.beginPath();
            ctx.rect(splitX, 0, width - splitX, height);
            ctx.clip();
            drawAsset(prevClip, prevClipRelativeTime, 1, easeP * width * 0.4, 0);
            ctx.restore();

            ctx.save();
            ctx.beginPath();
            ctx.rect(0, 0, splitX, height);
            ctx.clip();
            drawAsset(activeClip, clipRelativeTime, 1, -(1 - easeP) * width * 0.4, 0);
            ctx.restore();
            break;
          }

          case 'zoom-in': {
            drawAsset(prevClip, prevClipRelativeTime, 1 - p, 0, 0, 1 + p * 0.35);
            drawAsset(activeClip, clipRelativeTime, p, 0, 0, 0.7 + p * 0.3);
            break;
          }

          case 'zoom-out': {
            drawAsset(prevClip, prevClipRelativeTime, 1 - p, 0, 0, 1 - p * 0.3);
            drawAsset(activeClip, clipRelativeTime, p, 0, 0, 1.35 - p * 0.35);
            break;
          }

          case 'glitch': {
            // Clean seamless cut without distorted slice lines
            if (p < 0.5) {
              drawAsset(prevClip, prevClipRelativeTime, 1);
            } else {
              drawAsset(activeClip, clipRelativeTime, 1);
            }
            break;
          }

          case 'flash-white': {
            const flashPeak = Math.sin(p * Math.PI);
            if (p < 0.5) {
              drawAsset(prevClip, prevClipRelativeTime, 1);
            } else {
              drawAsset(activeClip, clipRelativeTime, 1);
            }
            if (flashPeak > 0.05) {
              ctx.fillStyle = `rgba(255, 255, 255, ${flashPeak * 0.4})`;
              ctx.fillRect(0, 0, width, height);
            }
            break;
          }

          case 'slide-up': {
            const easeP = p * p * (3 - 2 * p);
            const splitY = Math.round((1 - easeP) * height);
            ctx.save();
            ctx.beginPath();
            ctx.rect(0, 0, width, splitY);
            ctx.clip();
            drawAsset(prevClip, prevClipRelativeTime, 1, 0, -easeP * height * 0.4);
            ctx.restore();

            ctx.save();
            ctx.beginPath();
            ctx.rect(0, splitY, width, height - splitY);
            ctx.clip();
            drawAsset(activeClip, clipRelativeTime, 1, 0, (1 - easeP) * height * 0.4);
            ctx.restore();
            break;
          }

          case 'lens-blur': {
            // High-speed optical zoom dissolve without slow CPU ctx.filter blur
            const scalePrev = 1 + p * 0.1;
            const scaleNext = 1.1 - p * 0.1;
            drawAsset(prevClip, prevClipRelativeTime, 1 - p, 0, 0, scalePrev);
            drawAsset(activeClip, clipRelativeTime, p, 0, 0, scaleNext);
            break;
          }

          case 'film-roll': {
            const rollY = Math.round((p * height) % height);
            ctx.save();
            ctx.beginPath();
            ctx.rect(0, rollY, width, height - rollY);
            ctx.clip();
            drawAsset(prevClip, prevClipRelativeTime, 1, 0, rollY);
            ctx.restore();

            ctx.save();
            ctx.beginPath();
            ctx.rect(0, 0, width, rollY);
            ctx.clip();
            drawAsset(activeClip, clipRelativeTime, 1, 0, rollY - height);
            ctx.restore();
            break;
          }

          case 'none':
          default:
            drawAsset(activeClip, clipRelativeTime);
            break;
        }
      }

      // 1. Render Chosen Scene's Title / Text Overlay (Header / Hero callout on image)
      if (activeClip) {
        renderSceneTextOverlay(time, activeClip, ctx, width, height);
      }

      // 2. Render Synchronized Narration Captions (Subtitles)
      renderCaptions(time, ctx, width, height, project);

      // 3. Brand logo / watermark - always on top, part of every frame so it is also in the exported file
      drawLogo(ctx, width, height);
    },
    [project, mediaItems, audioSettings, isMuted, isPlaying, assetTick, showOverlayEditor, logo]
  );

  // Render Chosen Scene's Title / Text Overlay (separate from narration captions)
  const renderSceneTextOverlay = (
    time: number,
    clip: TimelineClip,
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number
  ) => {
    if (!clip.textOverlay || !clip.textOverlay.enabled || !clip.textOverlay.text) return;

    // When actively editing on footage, the interactive Canva overlay handles the live editing bounding box.
    // When playing, exporting, or viewing paused footage, render directly on canvas cleanly!
    if (overlayDomVisibleRef.current) {
      return;
    }

    const overlay = clip.textOverlay;
    const text = overlay.text.trim();
    if (!text) return;

    ctx.save();

    // Scale font size relative to 720p base
    const scaleFactor = width / 720;
    const baseFontSize = overlay.fontSize || 34;
    const fontSize = Math.max(16, Math.round(baseFontSize * scaleFactor));

    const fontFamily = getFontFamily(overlay.fontStyle);
    let fontWeight = '800';
    if (overlay.fontStyle === 'serif') fontWeight = '700 italic';
    else if (overlay.fontStyle === 'impact') fontWeight = '900';
    else if (overlay.fontStyle === 'mono') fontWeight = '700';

    ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.miterLimit = 2;

    // Canva transforms: Position (x, y), scale, and rotation
    const posX = overlay.x !== undefined ? overlay.x * width : width / 2;
    const posY = overlay.y !== undefined
      ? overlay.y * height
      : (overlay.location === 'center' ? height * 0.50 : overlay.location === 'bottom' ? height * 0.82 : height * 0.20);
    const scale = overlay.scale || 1.0;
    const rotationDeg = overlay.rotation || 0;

    // Apply Canva transforms
    ctx.translate(posX, posY);
    if (rotationDeg !== 0) {
      ctx.rotate((rotationDeg * Math.PI) / 180);
    }
    if (scale !== 1.0) {
      ctx.scale(scale, scale);
    }

    // Entrance pop animation on cut edge (during playback)
    const clipTime = time - clip.startTime;
    if (isPlayingRef.current && clipTime < 0.25) {
      const pop = 1.0 + (0.25 - clipTime) * 0.35;
      ctx.scale(pop, pop);
    }

    const textColor = overlay.textColor || '#FFFFFF';
    const effect = overlay.effect || 'outline';

    // Render based on chosen font effect around (0, 0)
    switch (effect) {
      case 'hollow': {
        ctx.lineWidth = Math.max(2, Math.round(fontSize * 0.09));
        ctx.strokeStyle = textColor;
        ctx.strokeText(text, 0, 0);
        break;
      }

      case 'outline': {
        ctx.lineWidth = Math.max(3, Math.round(fontSize * 0.16));
        ctx.strokeStyle = '#000000';
        ctx.strokeText(text, 0, 0);
        ctx.fillStyle = textColor;
        ctx.fillText(text, 0, 0);
        break;
      }

      case 'background': {
        const m = ctx.measureText(text);
        const pX = Math.round(fontSize * 0.45);
        const pY = Math.round(fontSize * 0.25);
        const bW = m.width + pX * 2;
        const bH = fontSize + pY * 2;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.82)';
        ctx.roundRect(-bW / 2, -bH / 2, bW, bH, 8);
        ctx.fill();
        ctx.fillStyle = textColor;
        ctx.fillText(text, 0, 0);
        break;
      }

      case 'drop': {
        ctx.save();
        ctx.fillStyle = '#000000';
        ctx.fillText(text, 4, 4);
        ctx.fillStyle = textColor;
        ctx.fillText(text, 0, 0);
        ctx.restore();
        break;
      }

      case 'curve': {
        const chars = text.split('');
        const totalW = ctx.measureText(text).width;
        let curX = -totalW / 2;
        chars.forEach((ch: string, i: number) => {
          const chW = ctx.measureText(ch).width;
          const norm = chars.length > 1 ? (i / (chars.length - 1)) * 2 - 1 : 0;
          const arcY = (1 - norm * norm) * -(fontSize * 0.35);
          ctx.lineWidth = Math.max(2, Math.round(fontSize * 0.08));
          ctx.strokeStyle = '#000000';
          ctx.strokeText(ch, curX + chW / 2, arcY);
          ctx.fillStyle = textColor;
          ctx.fillText(ch, curX + chW / 2, arcY);
          curX += chW;
        });
        break;
      }

      case 'rotate': {
        ctx.save();
        ctx.rotate((-6 * Math.PI) / 180);
        ctx.lineWidth = Math.max(2, Math.round(fontSize * 0.08));
        ctx.strokeStyle = '#000000';
        ctx.strokeText(text, 0, 0);
        ctx.fillStyle = textColor;
        ctx.fillText(text, 0, 0);
        ctx.restore();
        break;
      }

      case 'glitch': {
        ctx.save();
        ctx.fillStyle = 'rgba(6, 182, 212, 0.9)'; // Cyan
        ctx.fillText(text, -3, -1);
        ctx.fillStyle = 'rgba(239, 68, 68, 0.9)'; // Red
        ctx.fillText(text, 3, 1);
        ctx.fillStyle = textColor;
        ctx.fillText(text, 0, 0);
        ctx.restore();
        break;
      }

      case 'splice': {
        ctx.save();
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.lineWidth = Math.max(3, Math.round(fontSize * 0.14));
        ctx.strokeStyle = '#000000';
        ctx.strokeText(text, 0, 0);
        ctx.fillStyle = textColor;
        ctx.fillText(text, 0, 0);
        ctx.restore();
        break;
      }

      case 'none':
      default: {
        ctx.lineWidth = Math.max(2, Math.round(fontSize * 0.08));
        ctx.strokeStyle = '#000000';
        ctx.strokeText(text, 0, 0);
        ctx.fillStyle = textColor;
        ctx.fillText(text, 0, 0);
        break;
      }
    }

    ctx.restore();
  };

  // Render Animated Customizable Captions (Typewriter, Karaoke, Bounce, Beast Glow, etc.)
  const renderCaptions = (
    time: number,
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    proj: VideoProject
  ) => {
    const activeCaption = proj.captions?.find(
      (c) => time >= c.startTime && time <= c.endTime
    );

    if (!activeCaption || !activeCaption.text) return;

    ctx.save();

    const subConfig = proj.subtitleConfig || {
      fontSize: 28,
      fontStyle: 'impact',
      animationStyle: 'beast-glow',
      textColor: '#FACC15',
      showBackgroundPill: true,
    };

    const text = activeCaption.text;
    const captionDuration = Math.max(0.5, activeCaption.endTime - activeCaption.startTime);
    const progress = Math.min(1, Math.max(0, (time - activeCaption.startTime) / captionDuration));

    // Responsive font size calculation scaled to canvas viewport
    const scaleFactor = width / 720;
    const baseFontSize = subConfig.fontSize || 28;
    const fontSize = Math.max(16, Math.round(baseFontSize * scaleFactor));

    // Font Family Selection
    let fontFamily = '"Plus Jakarta Sans", sans-serif';
    let fontWeight = '800';
    if (subConfig.fontStyle === 'serif') {
      fontFamily = '"Playfair Display", Georgia, serif';
      fontWeight = '700 italic';
    } else if (subConfig.fontStyle === 'mono') {
      fontFamily = '"Courier New", Courier, monospace';
      fontWeight = '700';
    } else if (subConfig.fontStyle === 'impact') {
      fontFamily = 'Impact, "Arial Black", "Plus Jakarta Sans", sans-serif';
      fontWeight = '900';
    } else if (subConfig.fontStyle === 'rounded') {
      fontFamily = '"Comic Sans MS", "Plus Jakarta Sans", cursive, sans-serif';
      fontWeight = '800';
    } else {
      fontFamily = '"Plus Jakarta Sans", -apple-system, sans-serif';
      fontWeight = '700';
    }

    ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.miterLimit = 2;

    // Location calculation (Top, Center, Bottom)
    const loc = subConfig.location || 'bottom';
    let captionY = height * 0.82;
    if (loc === 'top') {
      captionY = height * 0.16;
    } else if (loc === 'center') {
      captionY = height * 0.50;
    } else {
      captionY = height * 0.82;
    }

    const animStyle = subConfig.animationStyle || 'beast-glow';
    const textColor = subConfig.textColor || '#FACC15';
    const effect = subConfig.effect || 'none';

    // Caption Padding & Opacity Controls
    const pillColor = subConfig.pillColor || '#000000';
    const pillOpacity = subConfig.pillOpacity !== undefined
      ? subConfig.pillOpacity
      : (subConfig.showBackgroundPill !== false ? 0.75 : 0);
    const padX = Math.round(fontSize * 0.45);
    const padY = Math.round(fontSize * 0.28);
    const backgroundFill = hexToRgba(pillColor, pillOpacity);
    const shouldDrawPill = (pillOpacity > 0.01 && subConfig.showBackgroundPill !== false) || effect === 'background';

    // Helper to render text with the chosen font effect (hollow, outline, background, drop, curve, rotate, glitch, splice)
    const renderEffectText = (txt: string, cx: number, cy: number) => {
      switch (effect) {
        case 'hollow': {
          // Transparent interior, bold vibrant colored outline
          ctx.lineWidth = Math.max(2, Math.round(fontSize * 0.09));
          ctx.strokeStyle = textColor;
          ctx.strokeText(txt, cx, cy);
          break;
        }

        case 'outline': {
          // High-contrast heavy outline stroke border with solid fill
          ctx.lineWidth = Math.max(3, Math.round(fontSize * 0.16));
          ctx.strokeStyle = '#000000';
          ctx.strokeText(txt, cx, cy);
          ctx.fillStyle = textColor;
          ctx.fillText(txt, cx, cy);
          break;
        }

        case 'background': {
          // Backdrop badge pill banner
          const m = ctx.measureText(txt);
          const pX = Math.round(fontSize * 0.45);
          const pY = Math.round(fontSize * 0.25);
          const bW = m.width + pX * 2;
          const bH = fontSize + pY * 2;
          ctx.fillStyle = 'rgba(0, 0, 0, 0.82)';
          ctx.roundRect(cx - bW / 2, cy - bH / 2, bW, bH, 8);
          ctx.fill();
          ctx.fillStyle = textColor;
          ctx.fillText(txt, cx, cy);
          break;
        }

        case 'drop': {
          // 3D heavy drop shadow
          ctx.save();
          ctx.fillStyle = '#000000';
          ctx.fillText(txt, cx + 4, cy + 4);
          ctx.fillStyle = textColor;
          ctx.fillText(txt, cx, cy);
          ctx.restore();
          break;
        }

        case 'curve': {
          // Curved / arched parabolic letter wave
          const chars = txt.split('');
          const totalW = ctx.measureText(txt).width;
          let curX = cx - totalW / 2;
          chars.forEach((ch, i) => {
            const chW = ctx.measureText(ch).width;
            const norm = chars.length > 1 ? (i / (chars.length - 1)) * 2 - 1 : 0;
            const arcY = (1 - norm * norm) * -(fontSize * 0.35);
            ctx.lineWidth = Math.max(2, Math.round(fontSize * 0.08));
            ctx.strokeStyle = '#000000';
            ctx.strokeText(ch, curX + chW / 2, cy + arcY);
            ctx.fillStyle = textColor;
            ctx.fillText(ch, curX + chW / 2, cy + arcY);
            curX += chW;
          });
          break;
        }

        case 'rotate': {
          // Dynamic angled -6° tilt
          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate((-6 * Math.PI) / 180);
          ctx.translate(-cx, -cy);
          ctx.lineWidth = Math.max(2, Math.round(fontSize * 0.08));
          ctx.strokeStyle = '#000000';
          ctx.strokeText(txt, cx, cy);
          ctx.fillStyle = textColor;
          ctx.fillText(txt, cx, cy);
          ctx.restore();
          break;
        }

        case 'glitch': {
          // RGB chromatic aberration glitch split
          ctx.save();
          ctx.fillStyle = 'rgba(6, 182, 212, 0.9)'; // Cyan offset
          ctx.fillText(txt, cx - 3, cy - 1);
          ctx.fillStyle = 'rgba(239, 68, 68, 0.9)'; // Red offset
          ctx.fillText(txt, cx + 3, cy + 1);
          ctx.fillStyle = textColor;
          ctx.fillText(txt, cx, cy);
          ctx.restore();
          break;
        }

        case 'splice': {
          ctx.save();
          ctx.lineJoin = 'round';
          ctx.lineCap = 'round';
          ctx.lineWidth = Math.max(3, Math.round(fontSize * 0.14));
          ctx.strokeStyle = '#000000';
          ctx.strokeText(txt, cx, cy);
          ctx.fillStyle = textColor;
          ctx.fillText(txt, cx, cy);
          ctx.restore();
          break;
        }

        case 'none':
        default: {
          if (shouldDrawPill) {
            const m = ctx.measureText(txt);
            const pX = Math.round(fontSize * 0.45);
            const pY = Math.round(fontSize * 0.28);
            const bW = Math.min(width * 0.94, m.width + pX * 2);
            const bH = fontSize + pY * 2;
            ctx.fillStyle = backgroundFill;
            ctx.roundRect(cx - bW / 2, cy - bH / 2, bW, bH, 8);
            ctx.fill();
            ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
            ctx.shadowBlur = 3;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 1;
          } else {
            ctx.lineWidth = Math.max(2, Math.round(fontSize * 0.08));
            ctx.strokeStyle = '#000000';
            ctx.strokeText(txt, cx, cy);
          }
          ctx.fillStyle = textColor;
          ctx.fillText(txt, cx, cy);
          break;
        }
      }
    };

    // 1. ANIMATION: FADE-UP
    if (animStyle === 'fade-up') {
      const fadeProgress = Math.min(1, (time - activeCaption.startTime) / 0.35);
      ctx.globalAlpha = fadeProgress;
      captionY += (1 - fadeProgress) * 18;
    }

    // 2. ANIMATION: BOUNCE
    if (animStyle === 'bounce') {
      const bounceOffset = Math.sin((time - activeCaption.startTime) * 9) * (fontSize * 0.12);
      captionY += bounceOffset;
    }

    // 3. ANIMATION: TYPEWRITER
    if (animStyle === 'typewriter') {
      const charCount = Math.max(1, Math.floor(progress * text.length));
      const displayText = text.slice(0, charCount);
      const isTyping = progress < 0.98;
      const cursor = isTyping && Math.floor(time * 4) % 2 === 0 ? '|' : '';
      const fullRenderText = displayText + cursor;

      renderEffectText(fullRenderText, width / 2, captionY);
      ctx.restore();
      return;
    }

    // 4. ANIMATION: KARAOKE (Progressive Word-By-Word Highlight)
    if (animStyle === 'karaoke') {
      const words = text.split(/\s+/);
      const activeWordIdx = Math.min(words.length - 1, Math.floor(progress * words.length));

      // Calculate total width with word spacing
      const spaceWidth = ctx.measureText(' ').width;
      const wordMetrics = words.map((w) => ctx.measureText(w).width);
      const totalTextWidth = wordMetrics.reduce((sum, w) => sum + w, 0) + spaceWidth * (words.length - 1);

      if (shouldDrawPill) {
        const boxW = Math.min(width * 0.96, totalTextWidth + padX * 2);
        const boxH = fontSize + padY * 2;
        ctx.fillStyle = backgroundFill;
        ctx.roundRect(width / 2 - boxW / 2, captionY - boxH / 2, boxW, boxH, 8);
        ctx.fill();
      }

      ctx.textAlign = 'left';
      let currentX = width / 2 - totalTextWidth / 2;

      words.forEach((word, idx) => {
        const isCurrent = idx === activeWordIdx;
        const isPast = idx < activeWordIdx;

        ctx.save();
        if (isCurrent) {
          ctx.translate(currentX + wordMetrics[idx] / 2, captionY);
          ctx.scale(1.15, 1.15);
          ctx.translate(-(currentX + wordMetrics[idx] / 2), -captionY);
        }

        if (effect === 'hollow') {
          ctx.lineWidth = Math.max(2, Math.round(fontSize * 0.08));
          ctx.strokeStyle = isCurrent || isPast ? textColor : 'rgba(255, 255, 255, 0.4)';
          ctx.strokeText(word, currentX, captionY);
        } else {
          if (!shouldDrawPill) {
            ctx.lineWidth = Math.max(2, Math.round(fontSize * 0.08));
            ctx.strokeStyle = '#000000';
            ctx.strokeText(word, currentX, captionY);
          }
          ctx.fillStyle = isCurrent || isPast ? textColor : 'rgba(255, 255, 255, 0.45)';
          ctx.fillText(word, currentX, captionY);
        }

        ctx.restore();
        currentX += wordMetrics[idx] + spaceWidth;
      });

      ctx.restore();
      return;
    }

    // 5. ANIMATION: BEAST-GLOW / MINIMAL / DEFAULT
    // Pop scale on entrance
    let scale = 1.0;
    if (animStyle === 'beast-glow' && progress < 0.15) {
      scale = 1.0 + (0.15 - progress) * 1.2;
    }

    ctx.translate(width / 2, captionY);
    ctx.scale(scale, scale);
    ctx.translate(-width / 2, -captionY);

    renderEffectText(text, width / 2, captionY);
    ctx.restore();
  };

  // High-performance 60fps render loop with throttled React state sync
  useEffect(() => {
    let animId: number;
    let lastTimestamp = performance.now();

    const render = (time: number) => {
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) {
          drawFrame(time, ctx, targetWidth, targetHeight);
        }
      }
    };

    // When paused, render single frame and DO NOT keep requestAnimationFrame running in background
    if (!isPlaying) {
      render(currentTimeRef.current);
      return;
    }

    const loop = (timestamp: number) => {
      const delta = Math.min(0.08, (timestamp - lastTimestamp) / 1000);
      lastTimestamp = timestamp;

      const next = currentTimeRef.current + delta;
      if (next >= project.totalDuration) {
        currentTimeRef.current = 0;
        setCurrentTime(0);
        setIsPlaying(false);
        render(0);
        if (isExportingRef.current) finishExport();
        return;
      }

      currentTimeRef.current = next;
      render(next);

      // Throttle React state update to ~4fps (every 250ms) to update scrubber without UI lag
      if (timestamp - lastUiSyncRef.current > 250) {
        lastUiSyncRef.current = timestamp;
        setCurrentTime(next);
        if (isExportingRef.current) setExportProgress(Math.min(99, Math.round((next / project.totalDuration) * 100)));
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [isPlaying, drawFrame, project.totalDuration, targetWidth, targetHeight]);

  // Sync Audio when currentTime updates
  useEffect(() => {
    const activeCaption = project.captions?.find(
      (c) => currentTime >= c.startTime && currentTime <= c.endTime
    );

    audioEngine.syncPlayback(
      currentTime,
      isPlaying,
      audioSettings.voiceover.url,
      audioSettings.music.url,
      audioSettings.music.presetId,
      audioSettings.voiceover.useNativeSpeech,
      audioSettings.voiceover.transcript,
      audioSettings.voiceover.voicePersona || 'Puck',
      audioSettings.voiceover.volume,
      audioSettings.voiceover.muted,
      audioSettings.music.volume,
      audioSettings.music.muted,
      audioSettings.music.autoDuck,
      audioSettings.music.duckAmount,
      activeCaption ? activeCaption.id : null,
      activeCaption ? activeCaption.text : null,
      activeCaption ? activeCaption.endTime - activeCaption.startTime : undefined
    );
    onTimeUpdateRef.current?.(currentTime);
  }, [currentTime, isPlaying, audioSettings, project.captions]);

  // Play / Pause toggle
  const togglePlay = () => {
    if (isExportingRef.current) return;
    if (currentTimeRef.current >= project.totalDuration) {
      currentTimeRef.current = 0;
      setCurrentTime(0);
    }
    setIsEditingTextOnFootage(false);
    setIsEditingInlineText(false);
    setIsPlaying(!isPlaying);
  };

  // Reset to 0
  const handleReset = () => {
    currentTimeRef.current = 0;
    setCurrentTime(0);
    setIsPlaying(false);
    setIsEditingTextOnFootage(false);
    audioEngine.pauseAll();
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) drawFrame(0, ctx, targetWidth, targetHeight);
    }
  };

  // Timeline scrub
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    currentTimeRef.current = val;
    setCurrentTime(val);
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) drawFrame(val, ctx, targetWidth, targetHeight);
    }
  };

  // In-browser export: record the canvas + Web Audio mix while the timeline plays through in real time.
  // (The normal playback loop already keeps audio, video clips and captions in sync, so export reuses it.)
  const [exportWarning, setExportWarning] = useState<string | null>(null);

  // A finished export becomes stale as soon as the edit changes
  useEffect(() => {
    if (!isExportingRef.current) setExportedVideoUrl(null);
  }, [project.clips, project.captions, project.colorFilter, project.aspectRatio, audioSettings.voiceover.url]);

  const finishExport = () => {
    const rec = mediaRecorderRef.current;
    audioEngine.pauseAll();
    if (rec && rec.state !== 'inactive') {
      rec.stop(); // onstop publishes the file and clears isExporting
    } else {
      setIsExporting(false);
    }
  };

  const cancelExport = () => {
    const rec = mediaRecorderRef.current;
    if (rec) rec.onstop = null;
    if (rec && rec.state !== 'inactive') rec.stop();
    recordedChunksRef.current = [];
    audioEngine.pauseAll();
    setIsPlaying(false);
    setIsExporting(false);
    isExportingRef.current = false;
    setExportProgress(0);
  };

  const handleExportVideo = async () => {
    if (!canvasRef.current || project.clips.length === 0) return;
    if (isExportingRef.current || isPreparingExportRef.current) return; // ignore double-clicks (would double-charge)
    isPreparingExportRef.current = true;
    try {
      if (onBeforeExport && !(await onBeforeExport())) return;
    } finally {
      isPreparingExportRef.current = false;
    }
    try {
      const canvas = canvasRef.current;
      const stream = canvas.captureStream(30);

      const audioDest = audioEngine.getAudioStreamDestination();
      audioEngine.ensureResume();
      if (audioDest) audioDest.stream.getAudioTracks().forEach((track) => stream.addTrack(track));

      const candidates = [
        'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
        'video/mp4;codecs=avc1',
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm',
      ];
      const mimeType = candidates.find((m) => MediaRecorder.isTypeSupported(m)) || '';
      setExportExt(mimeType.startsWith('video/mp4') ? 'mp4' : 'webm');

      // Browser speech synthesis can't be captured by any recorder - tell the user instead of exporting silently
      const vo = audioSettings.voiceover;
      setExportWarning(
        vo.useNativeSpeech && !vo.url && !vo.muted
          ? "Your narration uses the browser's built-in voice, which can't be recorded into the file. Generate the Gemini voice (or upload/record a voiceover) to have narration in the export."
          : null
      );

      recordedChunksRef.current = [];
      const recorder = new MediaRecorder(stream, { ...(mimeType ? { mimeType } : {}), videoBitsPerSecond: 10_000_000 });
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: recorder.mimeType || mimeType || 'video/webm' });
        if (exportedVideoUrl) URL.revokeObjectURL(exportedVideoUrl);
        setExportedVideoUrl(URL.createObjectURL(blob));
        setExportProgress(100);
        setIsExporting(false);
        isExportingRef.current = false;
      };

      // Start from the top, then let the normal playback loop run (it calls finishExport at the end)
      setExportedVideoUrl(null);
      setExportProgress(0);
      isExportingRef.current = true;
      setIsExporting(true);
      currentTimeRef.current = 0;
      setCurrentTime(0);
      setIsEditingTextOnFootage(false);
      recorder.start(500);
      setIsPlaying(true);
    } catch (err: any) {
      console.error('Export error:', err);
      isExportingRef.current = false;
      setIsExporting(false);
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="flex flex-col items-center w-full max-w-4xl mx-auto bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden p-4 sm:p-6">
      {/* Top Bar Header */}
      <div className="flex items-center justify-between w-full mb-3 px-1">
        <div className="flex items-center space-x-2">
          <span className="text-xs font-bold tracking-wider text-slate-300 uppercase">
            Preview Player ({targetWidth}x{targetHeight} • {project.aspectRatio})
          </span>
        </div>

        <div className="flex items-center space-x-3 text-xs text-slate-400">
          {audioSettings.voiceover.url ? (
            <span className="flex items-center space-x-1.5 px-2 py-0.5 rounded bg-pink-950/80 text-pink-300 font-mono text-[11px] border border-pink-800/60">
              <span className="w-1.5 h-1.5 rounded-full bg-pink-400 animate-pulse"></span>
              <span>🎙️ Voice: {audioSettings.voiceover.name.slice(0, 15)}</span>
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-500 font-mono text-[11px]">
              Voice: Inactive
            </span>
          )}
          <span className="px-2 py-0.5 rounded bg-slate-800 text-indigo-300 font-mono border border-slate-700">
            Grade: {project.colorFilter}
          </span>
          <span className="font-mono font-medium text-slate-300">
            {formatTime(currentTime)} / {formatTime(project.totalDuration)}
          </span>
        </div>
      </div>

      {/* Video Viewport */}
      <div
        ref={containerRef}
        className="relative mx-auto w-full bg-black rounded-xl overflow-hidden group"
        style={{
          aspectRatio: `${targetWidth} / ${targetHeight}`,
          // fit within ~560px of height while keeping the box EXACTLY the canvas shape
          maxWidth: `${Math.round((560 * targetWidth) / targetHeight)}px`,
        }}
      >
        <canvas
          ref={canvasRef}
          width={targetWidth}
          height={targetHeight}
          className="w-full h-full object-contain cursor-pointer"
          onClick={togglePlay}
        />

        {brokenVideoNames.length > 0 && (
          <div className="absolute top-2 left-2 right-2 z-30 rounded-lg bg-amber-950/95 border border-amber-600/70 text-amber-200 text-[11px] leading-snug px-3 py-2 shadow-lg">
            <strong>"{brokenVideoNames[0]}"</strong>
            {brokenVideoNames.length > 1 ? ` and ${brokenVideoNames.length - 1} more` : ''} can't be played by this browser
            (common with iPhone videos in HEVC format). Re-export it as MP4 / "Most Compatible", or open ReelCraft in Safari
            or Edge, then add it again.
          </div>
        )}

        {/* Canva-Style Interactive Text Overlay on Footage (Active when editing) */}
        {showOverlayEditor && activeOverlay && (
          <div
            style={{
              position: 'absolute',
              left: `${(activeOverlay.x ?? 0.5) * 100}%`,
              top: `${(activeOverlay.y ?? 0.2) * 100}%`,
              transform: `translate(-50%, -50%) rotate(${activeOverlay.rotation ?? 0}deg) scale(${activeOverlay.scale ?? 1.0})`,
              transformOrigin: 'center center',
              zIndex: 30,
            }}
            className="select-none group"
          >
            {/* Canva Bounding Box */}
            <div
              onMouseDown={(e) => {
                setIsEditingTextOnFootage(true);
                handleDragStart(e);
              }}
              onTouchStart={(e) => {
                setIsEditingTextOnFootage(true);
                handleDragStart(e);
              }}
              style={{ touchAction: 'none' }}
              className={`relative px-3.5 py-2 border-2 ${
                isEditingTextOnFootage
                  ? `border-dashed ${isDraggingText ? 'border-pink-400 bg-pink-500/20' : 'border-cyan-400 bg-black/30'}`
                  : 'border-transparent hover:border-dashed hover:border-cyan-300/80'
              } rounded-xl cursor-move transition-colors`}
              title="Drag to move anywhere on footage (left, right, up, down)"
            >
              {/* Visual Text preview with selected effect or inline input editor */}
              {isEditingInlineText ? (
                <input
                  type="text"
                  autoFocus
                  value={activeOverlay.text}
                  onChange={(e) => {
                    if (onUpdateClipTextOverlay && currentClip) {
                      onUpdateClipTextOverlay(currentClip.id, { ...activeOverlay, text: e.target.value });
                    }
                  }}
                  onBlur={() => setIsEditingInlineText(false)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') setIsEditingInlineText(false);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="bg-black/70 border border-white/60 rounded-md px-2 py-0.5 text-center font-extrabold outline-none text-white shadow-xl min-w-[140px]"
                  style={{
                    fontFamily: getFontFamily(activeOverlay.fontStyle),
                    fontSize: `${((activeOverlay.fontSize || 34) * viewW) / 720}px`,
                    color: activeOverlay.textColor || '#FFFFFF',
                  }}
                  placeholder="Type slide title..."
                />
              ) : (
                <span
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    setIsEditingInlineText(true);
                  }}
                  style={{
                    fontFamily: getFontFamily(activeOverlay.fontStyle),
                    fontSize: `${((activeOverlay.fontSize || 34) * viewW) / 720}px`,
                    ...getTextEffectStyles(activeOverlay.effect, activeOverlay.textColor),
                  }}
                  className="font-extrabold whitespace-nowrap leading-none block drop-shadow-lg cursor-text"
                  title="Double click to edit text directly on footage"
                >
                  {activeOverlay.text}
                </span>
              )}

              {/* Canva Top Rotation Stalk & Handle */}
              <div
                className={`${isEditingTextOnFootage ? "flex" : "hidden"} absolute -top-7 left-1/2 -translate-x-1/2 flex-col items-center cursor-grab active:cursor-grabbing group/rot`}
                onMouseDown={handleRotateStart}
                onTouchStart={handleRotateStart}
                title="Drag to rotate text (-180° to 180°)"
              >
                <div className={`w-5 h-5 rounded-full ${isRotatingText ? 'bg-indigo-400 scale-125' : 'bg-white'} border-2 border-indigo-600 shadow-md flex items-center justify-center hover:scale-125 transition-transform`}>
                  <RotateCw className="w-2.5 h-2.5 text-indigo-600" />
                </div>
                <div className="w-0.5 h-2 bg-indigo-500" />
              </div>

              {/* Canva 4 Corner Resize Handles */}
              <div
                onMouseDown={handleResizeStart}
                onTouchStart={handleResizeStart}
                className={`${isEditingTextOnFootage ? "" : "hidden"} absolute -top-1.5 -left-1.5 w-3.5 h-3.5 rounded-full bg-white border-2 border-cyan-500 shadow hover:scale-125 cursor-nwse-resize transition-transform`}
                title="Drag corner to expand / shrink text"
              />
              <div
                onMouseDown={handleResizeStart}
                onTouchStart={handleResizeStart}
                className={`${isEditingTextOnFootage ? "" : "hidden"} absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-white border-2 border-cyan-500 shadow hover:scale-125 cursor-nesw-resize transition-transform`}
                title="Drag corner to expand / shrink text"
              />
              <div
                onMouseDown={handleResizeStart}
                onTouchStart={handleResizeStart}
                className={`${isEditingTextOnFootage ? "" : "hidden"} absolute -bottom-1.5 -left-1.5 w-3.5 h-3.5 rounded-full bg-white border-2 border-cyan-500 shadow hover:scale-125 cursor-nesw-resize transition-transform`}
                title="Drag corner to expand / shrink text"
              />
              <div
                onMouseDown={handleResizeStart}
                onTouchStart={handleResizeStart}
                className={`${isEditingTextOnFootage ? "" : "hidden"} absolute -bottom-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-white border-2 border-cyan-500 shadow hover:scale-125 cursor-nwse-resize transition-transform`}
                title="Drag corner to expand / shrink text"
              />

              {/* Floating Canva Mini-Bar right underneath */}
              <div className={`${isEditingTextOnFootage ? "flex" : "hidden"} absolute top-full left-1/2 -translate-x-1/2 mt-2 items-center space-x-1.5 bg-slate-900/95 backdrop-blur border border-slate-700 px-2.5 py-1 rounded-full shadow-2xl text-[10px] text-white opacity-95 group-hover:opacity-100 transition-opacity whitespace-nowrap z-40`}>
                <span className="font-mono text-cyan-400 font-bold px-1">
                  Slide #{currentClipIndex + 1}
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsEditingInlineText(!isEditingInlineText);
                  }}
                  className="hover:text-cyan-300 px-1.5 py-0.5 rounded cursor-pointer flex items-center space-x-1 bg-slate-800/80 hover:bg-slate-700 text-slate-200"
                  title="Type text directly on footage"
                >
                  <Type className="w-2.5 h-2.5" />
                  <span>{isEditingInlineText ? 'Done' : 'Edit Text'}</span>
                </button>
                {onOpenSettings && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenSettings();
                    }}
                    className="hover:text-pink-300 px-1.5 py-0.5 rounded cursor-pointer flex items-center space-x-1 bg-pink-950/80 text-pink-300 border border-pink-700/60"
                    title="Open unified font size, color & effects settings"
                  >
                    <Sliders className="w-2.5 h-2.5" />
                    <span>Style & Effects</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onUpdateClipTextOverlay && currentClip) {
                      onUpdateClipTextOverlay(currentClip.id, { ...activeOverlay, rotation: 0, scale: 1.0 });
                    }
                  }}
                  className="hover:text-amber-300 px-1.5 py-0.5 rounded cursor-pointer text-slate-400 hover:bg-slate-800"
                  title="Reset rotation & scale"
                >
                  Reset
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onUpdateClipTextOverlay && currentClip) {
                      onUpdateClipTextOverlay(currentClip.id, undefined);
                    }
                  }}
                  className="text-red-400 hover:text-red-300 px-1.5 py-0.5 rounded cursor-pointer hover:bg-red-950/60"
                  title="Remove text from slide"
                >
                  ✕
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsEditingInlineText(false);
                    setIsEditingTextOnFootage(false);
                  }}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-2 py-0.5 rounded cursor-pointer transition-colors shadow text-[10px]"
                  title="Done editing text on footage"
                >
                  ✓ Done
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Quick Add Text Button when paused without text on current slide */}
        {!isPlaying && !isExporting && !isGenerating && (!activeOverlay?.enabled || !activeOverlay?.text) && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (onUpdateClipTextOverlay && currentClip) {
                onUpdateClipTextOverlay(currentClip.id, {
                  enabled: true,
                  text: 'TITLE HERE',
                  fontStyle: 'impact',
                  fontSize: 34,
                  textColor: '#FFFFFF',
                  effect: 'outline',
                  x: 0.5,
                  y: 0.2,
                  scale: 1.0,
                  rotation: 0,
                });
              }
              setIsEditingTextOnFootage(true);
              onOpenSettings?.();
            }}
            className="absolute top-3 right-3 z-20 flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-bold text-xs shadow-lg backdrop-blur border border-pink-400/40 transition-all hover:scale-105 active:scale-95 cursor-pointer"
            title="Add Canva-style text overlay to this slide and open controls"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Add Text to Slide #{currentClipIndex + 1}</span>
          </button>
        )}

        {/* Big Center Play Overlay Button when paused */}
        {!isPlaying && !isExporting && !isGenerating && (
          <button
            onClick={togglePlay}
            className="absolute z-10 flex items-center justify-center w-16 h-16 rounded-full bg-indigo-600/90 text-white shadow-lg backdrop-blur hover:scale-110 active:scale-95 transition-all duration-200"
            aria-label="Play video"
          >
            <Play className="w-8 h-8 fill-white translate-x-0.5" />
          </button>
        )}

        {/* ReelCraft AI Generating / Processing Overlay */}
        {isGenerating && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/85 backdrop-blur-md p-6 text-center animate-in fade-in duration-200">
            <ReelCraftSpinner size="lg" className="mb-5" />
            <h4 className="text-base font-bold text-white mb-2 tracking-wide flex items-center space-x-2">
              <span className="bg-gradient-to-r from-indigo-300 via-purple-300 to-pink-300 bg-clip-text text-transparent">
                ReelCraftpro.com Auto-Director Editing...
              </span>
            </h4>
            <p className="text-xs text-slate-300 max-w-sm mb-4 font-mono">
              {generationStep || 'Sequencing cuts, kinetic camera motions & caption timing...'}
            </p>
            <div className="w-56 bg-slate-800 rounded-full h-2 overflow-hidden border border-slate-700">
              <div className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 h-full w-full animate-pulse" />
            </div>
          </div>
        )}

        {/* Export Progress Overlay with Branded Spinner */}
        {isExporting && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/85 backdrop-blur-md p-6 text-center animate-in fade-in duration-200">
            <ReelCraftSpinner size="lg" className="mb-4" />
            <h4 className="text-lg font-bold text-white mb-2">Rendering High-Fidelity Video...</h4>
            <p className="text-sm text-slate-300 max-w-sm mb-4">
              Recording in real time - keep this tab open and visible until it finishes.
            </p>
            <div className="w-64 bg-slate-800 rounded-full h-3 overflow-hidden border border-slate-700">
              <div
                className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 h-full transition-all duration-150"
                style={{ width: `${exportProgress}%` }}
              />
            </div>
            <span className="mt-2 text-xs font-mono text-indigo-300">{exportProgress}% Completed</span>
            {exportWarning && (
              <p className="mt-3 max-w-sm text-[11px] leading-snug text-amber-300 bg-amber-950/60 border border-amber-700/60 rounded-lg px-3 py-2">
                {exportWarning}
              </p>
            )}
            <button
              type="button"
              onClick={cancelExport}
              className="mt-4 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 cursor-pointer"
            >
              Cancel export
            </button>
          </div>
        )}
      </div>

      {/* Timeline Scrubber */}
      <div className="w-full mt-4 px-1">
        <input
          type="range"
          min={0}
          max={project.totalDuration || 15}
          step={0.05}
          value={currentTime}
          onChange={handleSeek}
          className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500 hover:accent-indigo-400 focus:outline-none"
        />

        {/* Clip markers along timeline */}
        <div className="flex w-full mt-1.5 space-x-1">
          {project.clips.map((clip, idx) => {
            const widthPct = (clip.duration / project.totalDuration) * 100;
            const isCurrent =
              currentTime >= clip.startTime && currentTime < clip.startTime + clip.duration;
            return (
              <button
                key={clip.id}
                onClick={() => {
                  setCurrentTime(clip.startTime);
                  if (onClipSelect) onClipSelect(clip.id);
                }}
                className={`h-2.5 rounded-sm transition-all duration-150 group relative ${
                  isCurrent
                    ? 'bg-indigo-500 ring-2 ring-indigo-300 ring-offset-1 ring-offset-slate-900'
                    : 'bg-slate-700 hover:bg-slate-600'
                }`}
                style={{ width: `${widthPct}%` }}
                title={`Scene ${idx + 1}: ${clip.transitionIn} (${clip.duration}s)`}
              >
                <span className="sr-only">Scene {idx + 1}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Control Bar */}
      <div className="flex flex-wrap items-center justify-between w-full mt-4 gap-3">
        {/* Playback Controls */}
        <div className="flex items-center space-x-2">
          <button
            onClick={togglePlay}
            className="flex items-center justify-center w-10 h-10 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium shadow-md transition-colors cursor-pointer"
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 fill-white" />}
          </button>

          <button
            onClick={handleReset}
            className="flex items-center justify-center w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
            title="Replay from start"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <button
            onClick={() => setIsMuted(!isMuted)}
            className="flex items-center justify-center w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
            title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4" />}
          </button>

          {/* Pause & Add/Edit Title on Current Slide */}
          <button
            type="button"
            onClick={() => {
              if (isPlaying) setIsPlaying(false);
              if (onUpdateClipTextOverlay && currentClip) {
                if (!activeOverlay?.enabled || !activeOverlay?.text) {
                  onUpdateClipTextOverlay(currentClip.id, {
                    enabled: true,
                    text: 'TITLE HERE',
                    fontStyle: 'impact',
                    fontSize: 34,
                    textColor: '#FFFFFF',
                    effect: 'outline',
                    x: 0.5,
                    y: 0.2,
                    scale: 1.0,
                    rotation: 0,
                  });
                }
              }
              setIsEditingTextOnFootage(!isEditingTextOnFootage);
              onOpenSettings?.();
            }}
            className={`flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              isEditingTextOnFootage
                ? 'bg-emerald-950/80 border border-emerald-500/80 text-emerald-300 hover:bg-emerald-900/80 ring-2 ring-emerald-500/30'
                : activeOverlay?.enabled && activeOverlay?.text
                ? 'bg-pink-950/80 border border-pink-500/80 text-pink-300 hover:bg-pink-900/80'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
            }`}
            title="Pause and position text overlay on current slide"
          >
            <Type className="w-4 h-4 text-pink-400" />
            <span>
              {isEditingTextOnFootage
                ? `Done Editing Slide #${currentClipIndex + 1}`
                : activeOverlay?.enabled && activeOverlay?.text
                ? `Edit Slide #${currentClipIndex + 1} Text`
                : `+ Add Text to Slide #${currentClipIndex + 1}`}
            </span>
          </button>
        </div>

        {/* Audio Ducking Status Pill */}
        {audioSettings.music.autoDuck && audioSettings.voiceover.url && (
          <div className="hidden sm:flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-indigo-950/80 border border-indigo-800/60 text-xs text-indigo-300">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
            <span>Voice-Ducking Active (-{(100 - audioSettings.music.duckAmount * 100).toFixed(0)}%)</span>
          </div>
        )}

        {/* Actions: Export / Download */}
        <div className="flex items-center space-x-2">
          {exportedVideoUrl ? (
            <a
              href={exportedVideoUrl}
              download={`${project.title.replace(/\s+/g, '_')}_autocut.${exportExt}`}
              className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold shadow-lg shadow-emerald-900/30 transition-all"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Download Video</span>
            </a>
          ) : (
            <button
              onClick={handleExportVideo}
              disabled={isExporting || project.clips.length === 0}
              className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 text-white text-sm font-semibold shadow-lg shadow-indigo-900/40 transition-all cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>{isExporting ? 'Exporting...' : 'Export Video'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
