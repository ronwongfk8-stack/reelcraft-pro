export type AspectRatio = '16:9' | '9:16' | '1:1';

export type TransitionType = 
  | 'slide' 
  | 'flip-book' 
  | 'open-pic' 
  | 'corner-flip' 
  | 'twist-flip'
  | 'ken-burns-in' 
  | 'ken-burns-out' 
  | 'pan-right' 
  | 'pan-up' 
  | 'fade' 
  | 'zoom-rotate';

export type PhotoAnimationType = 
  | 'zoom-in'             // Zoom In
  | 'zoom-out'            // Zoom Out
  | 'pan-in-out'          // Pan In & Out
  | 'pan-left-to-right'   // Pan Left to Right
  | 'pan-right-to-left'   // Pan Right to Left
  | 'pan-up'              // Pan Up
  | 'pan-down'            // Pan Down
  | 'bird-eye-view';      // Bird Eye View

export type TextStylePreset = 
  | 'luxury-gold' 
  | 'modern-minimal' 
  | 'cinematic-glass' 
  | 'architectural-lower-third' 
  | 'vibrant-neon';

export type TextAnimationPreset = 
  | 'typewriter' 
  | 'slide-up' 
  | 'zoom-pop' 
  | 'kinetic-word' 
  | 'bar-reveal';

export interface SlideItem {
  id: string;
  url: string;
  title: string;
  subtitle: string;
  duration: number; // in seconds
  transition: TransitionType;
  animation?: PhotoAnimationType; // photo motion animation (zoom-in, zoom-out, pan, bird-eye, etc.)
  voiceId?: string; // e.g. 'male-james', 'female-sophia', etc.
  voiceLanguage?: string; // e.g. 'en-US', 'es-ES', etc.
  customScript?: string; // custom text for this slide's voiceover narration
}

export interface AudioTrackConfig {
  enabled: boolean;
  sourceType: 'custom' | 'preset' | 'recorded' | 'ai-generated';
  fileUrl: string | null;
  fileName: string | null;
  presetId?: string;
  voiceId?: string;
  language?: string;
  scriptText?: string;
  volume: number; // 0.0 to 1.5 (0% to 150%)
  fadeInDuration: number; // in seconds (0 to 5s)
  fadeOutDuration: number; // in seconds (0 to 5s)
  isMuted: boolean;
}

export interface SubtitleConfig {
  stylePreset: TextStylePreset;
  animationPreset: TextAnimationPreset;
  position: 'bottom' | 'center' | 'top' | 'lower-third' | 'custom';
  customXRatio?: number; // 0 to 1 (left to right horizontal positioning)
  customYRatio?: number; // 0 to 1 (up to down vertical positioning)
  fontSize: number; // px (e.g. 18 to 48)
  bgOpacity: number; // 0 to 1
  primaryColor: string;
  accentColor: string;
  showCaptions: boolean;
}

export interface ProjectSettings {
  title: string;
  aspectRatio: AspectRatio;
  resolution: '1080p' | '720p' | '4k';
  fps: number; // 30 or 60
}

export interface UserCreditAccount {
  email: string;
  deviceId: string;
  freeTrialUsed: boolean;
  paidCredits: number;
}

export interface PropertyPreset {
  id: string;
  name: string;
  description: string;
  aspectRatio: AspectRatio;
  stylePreset: TextStylePreset;
  animationPreset: TextAnimationPreset;
  musicPresetId: string;
  slides: Array<{
    title: string;
    subtitle: string;
    imageUrl: string;
    duration: number;
    transition: TransitionType;
  }>;
}
