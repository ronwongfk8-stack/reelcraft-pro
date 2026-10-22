export type TransitionType =
  | 'none'
  | 'crossfade'
  | 'zoom-in'
  | 'zoom-out'
  | 'whip-left'
  | 'whip-right'
  | 'glitch'
  | 'flash-white'
  | 'slide-up'
  | 'lens-blur'
  | 'film-roll';

export type MotionType =
  | 'none'
  | 'push-in'
  | 'pull-out'
  | 'pan-left'
  | 'pan-right'
  | 'subtle-drift';

export type ColorFilterType =
  | 'natural'
  | 'teal-orange'
  | 'vintage'
  | 'moody-noir'
  | 'cyberpunk'
  | 'golden-hour'
  | 'pastel';

export type AspectRatio = '9:16' | '16:9' | '1:1';

export type CaptionStyle =
  | 'beast-glow'
  | 'minimal'
  | 'cinematic'
  | 'retro-glitch'
  | 'karaoke';

export type CaptionAnimationStyle =
  | 'beast-glow'
  | 'typewriter'
  | 'karaoke'
  | 'bounce'
  | 'fade-up'
  | 'minimal';

export type CaptionFontStyle =
  | 'impact'
  | 'modern-sans'
  | 'serif'
  | 'mono'
  | 'rounded';

export type TextOverlayLocation = 'top' | 'center' | 'bottom';

export type TextOverlayEffect =
  | 'none'
  | 'hollow'
  | 'outline'
  | 'background'
  | 'drop'
  | 'curve'
  | 'rotate'
  | 'glitch'
  | 'splice';

export interface TextOverlayConfig {
  fontStyle: CaptionFontStyle;
  fontSize: number;
  location: TextOverlayLocation;
  textColor: string;
  effect: TextOverlayEffect;
}

export interface SubtitleConfig {
  fontSize: number; // 16 to 64 px
  fontStyle: CaptionFontStyle;
  animationStyle: CaptionAnimationStyle;
  textColor: string; // e.g. '#FACC15', '#FFFFFF', '#06B6D4'
  location?: TextOverlayLocation;
  effect?: TextOverlayEffect;
  highlightColor?: string;
  showBackgroundPill: boolean;
  pillColor?: string; // Hex color for caption padding background (e.g. '#000000')
  pillOpacity?: number; // 0.0 to 1.0
  pillPadding?: number; // 8 to 36 px
}

export interface MediaItem {
  id: string;
  name: string;
  type: 'image' | 'video';
  url: string;
  duration?: number;
  width?: number;
  height?: number;
  thumbnail?: string;
  file?: File;
  aspectRatio?: number;
}

export interface SceneTextOverlay {
  enabled: boolean;
  text: string;
  fontStyle?: CaptionFontStyle;
  fontSize?: number;
  location?: TextOverlayLocation;
  textColor?: string;
  effect?: TextOverlayEffect;
  x?: number; // 0.0 to 1.0 relative horizontal position (0.5 is centered)
  y?: number; // 0.0 to 1.0 relative vertical position (0.2 is top)
  scale?: number; // resize scale factor (default 1.0)
  rotation?: number; // rotation in degrees (-180 to 180, default 0)
}

export interface TimelineClip {
  id: string;
  mediaId: string;
  startTime: number;
  duration: number;
  transitionIn: TransitionType;
  transitionDuration: number;
  motionEffect: MotionType;
  caption?: string;
  captionHighlight?: string;
  textOverlay?: SceneTextOverlay;
  /** Videos only: where in the source video this clip starts (seconds). */
  trimStart?: number;
  /** Videos only: play the clip's own recorded sound. */
  keepAudio?: boolean;
}

export interface CaptionSegment {
  id: string;
  startTime: number;
  endTime: number;
  text: string;
  emphasis?: string;
}

export interface VoiceoverTrack {
  url: string | null;
  name: string;
  volume: number; // 0 to 1.0
  muted: boolean;
  duration: number;
  transcript?: string;
  isRecorded?: boolean;
  useNativeSpeech?: boolean;
  voicePersona?: string;
}

export interface MusicTrack {
  url: string | null;
  name: string;
  volume: number; // 0 to 1
  muted: boolean;
  duration: number;
  autoDuck: boolean;
  duckAmount: number; // e.g. 0.2
  presetId?: string;
}

export interface SfxTrack {
  enabled: boolean;
  volume: number;
  preset: 'cinematic' | 'modern' | 'minimal';
}

export interface AudioSettings {
  voiceover: VoiceoverTrack;
  music: MusicTrack;
  sfx: SfxTrack;
}

export interface VideoProject {
  title: string;
  prompt: string;
  aspectRatio: AspectRatio;
  colorFilter: ColorFilterType;
  captionStyle: CaptionStyle;
  subtitleConfig?: SubtitleConfig;
  textOverlayConfig?: TextOverlayConfig;
  clips: TimelineClip[];
  captions: CaptionSegment[];
  totalDuration: number;
  styleSummary?: string;
}

export interface PresetSample {
  id: string;
  name: string;
  tagline: string;
  aspectRatio: AspectRatio;
  prompt: string;
  voiceoverScript?: string;
  musicPreset: string;
  colorFilter: ColorFilterType;
  items: Omit<MediaItem, 'file'>[];
}

/** Saved state of the AI voiceover wizard (so reopening it, or reloading the page, keeps the user's work). */
export interface NarrationState {
  industry: string;
  facts: Record<string, string>;
  voiceId: string;
  lines: { clipId: string; sees?: string; line: string }[];
  /** Order of clips when the lines were written. If the photos change, the lines are out of date. */
  signature: string;
  /** The exact text that was last turned into audio (so we know when lines were edited afterwards). */
  voicedText?: string;
}

export type LogoPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

/** A brand logo / watermark drawn on top of the whole video (and recorded in the export). */
export interface LogoSettings {
  url: string | null;
  name: string;
  position: LogoPosition;
  /** width as a percentage of the video width */
  size: number;
  /** 0.2 - 1 */
  opacity: number;
}

export const DEFAULT_LOGO: LogoSettings = {
  url: null,
  name: '',
  position: 'top-right',
  size: 12,
  opacity: 0.95,
};
