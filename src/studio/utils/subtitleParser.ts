import { SubtitleConfig, CaptionAnimationStyle, CaptionFontStyle, TextOverlayConfig, SceneTextOverlay } from '../types';

export const DEFAULT_SCENE_TEXT_OVERLAY: SceneTextOverlay = {
  enabled: true,
  text: '',
  fontStyle: 'impact',
  fontSize: 34,
  location: 'top',
  textColor: '#FFFFFF',
  effect: 'outline',
  x: 0.5,
  y: 0.2,
  scale: 1.0,
  rotation: 0,
};

export const DEFAULT_TEXT_OVERLAY_CONFIG: TextOverlayConfig = {
  fontStyle: 'impact',
  fontSize: 28,
  location: 'bottom',
  textColor: '#FACC15',
  effect: 'none',
};

export const DEFAULT_SUBTITLE_CONFIG: SubtitleConfig = {
  fontSize: 28,
  fontStyle: 'impact',
  animationStyle: 'beast-glow',
  textColor: '#FACC15', // Vibrant yellow
  location: 'bottom',
  effect: 'none',
  highlightColor: '#FFFFFF',
  showBackgroundPill: false,
  pillColor: '#000000',
  pillOpacity: 0,
  pillPadding: 0,
};

export function parseSubtitleFromPrompt(prompt: string, fallback = DEFAULT_SUBTITLE_CONFIG): SubtitleConfig {
  const p = prompt.toLowerCase();
  const config: SubtitleConfig = { ...fallback };

  // 1. Text Color Detection
  if (p.includes('yellow') || p.includes('gold')) {
    config.textColor = '#FACC15';
  } else if (p.includes('cyan') || p.includes('neon blue') || p.includes('blue font') || p.includes('blue text')) {
    config.textColor = '#06B6D4';
  } else if (p.includes('white font') || p.includes('white text') || p.includes('white caption') || p.includes('white subtitle')) {
    config.textColor = '#FFFFFF';
  } else if (p.includes('green') || p.includes('lime')) {
    config.textColor = '#4ADE80';
  } else if (p.includes('pink') || p.includes('rose') || p.includes('magenta')) {
    config.textColor = '#F43F5E';
  } else if (p.includes('purple') || p.includes('violet')) {
    config.textColor = '#A855F7';
  } else if (p.includes('orange') || p.includes('amber')) {
    config.textColor = '#FB923C';
  } else if (p.includes('red font') || p.includes('red text')) {
    config.textColor = '#EF4444';
  }

  // 2. Font Size Detection
  if (p.includes('huge') || p.includes('giant') || p.includes('extra large') || p.includes('massive font')) {
    config.fontSize = 44;
  } else if (p.includes('large font') || p.includes('large text') || p.includes('large subtitle') || p.includes('big font') || p.includes('big text') || p.includes('big caption')) {
    config.fontSize = 36;
  } else if (p.includes('small font') || p.includes('small text') || p.includes('small subtitle') || p.includes('tiny text') || p.includes('subtle caption')) {
    config.fontSize = 20;
  } else if (p.includes('medium font') || p.includes('medium text')) {
    config.fontSize = 28;
  }

  // 3. Animation Style Detection
  if (p.includes('typewriter') || p.includes('type writer') || p.includes('typing')) {
    config.animationStyle = 'typewriter';
  } else if (p.includes('karaoke') || p.includes('word by word') || p.includes('highlight word')) {
    config.animationStyle = 'karaoke';
  } else if (p.includes('bounce') || p.includes('bouncy') || p.includes('pop')) {
    config.animationStyle = 'bounce';
  } else if (p.includes('fade up') || p.includes('fade in') || p.includes('floating text')) {
    config.animationStyle = 'fade-up';
  } else if (p.includes('minimal subtitle') || p.includes('simple text') || p.includes('clean subtitle')) {
    config.animationStyle = 'minimal';
  } else if (p.includes('beast') || p.includes('viral') || p.includes('glow') || p.includes('animated style') || p.includes('animated subtitle')) {
    config.animationStyle = 'beast-glow';
  }

  // 4. Font Style Detection
  if (p.includes('serif') || p.includes('classic font') || p.includes('playfair') || p.includes('editorial')) {
    config.fontStyle = 'serif';
  } else if (p.includes('mono') || p.includes('monospace') || p.includes('code') || p.includes('terminal')) {
    config.fontStyle = 'mono';
  } else if (p.includes('rounded') || p.includes('friendly font') || p.includes('soft font')) {
    config.fontStyle = 'rounded';
  } else if (p.includes('impact') || p.includes('bold font') || p.includes('heavy font') || p.includes('thick text')) {
    config.fontStyle = 'impact';
  } else if (p.includes('sans') || p.includes('modern font') || p.includes('clean font')) {
    config.fontStyle = 'modern-sans';
  }

  // 5. Location Detection
  if (p.includes('top caption') || p.includes('top subtitle') || p.includes('top text') || p.includes('header text')) {
    config.location = 'top';
  } else if (p.includes('center text') || p.includes('middle text') || p.includes('center caption') || p.includes('center subtitle')) {
    config.location = 'center';
  } else if (p.includes('bottom text') || p.includes('lower third') || p.includes('bottom caption')) {
    config.location = 'bottom';
  }

  // 6. Font Effect Detection
  if (p.includes('hollow') || p.includes('outline only')) {
    config.effect = 'hollow';
  } else if (p.includes('outline') || p.includes('stroke') || p.includes('bordered')) {
    config.effect = 'outline';
  } else if (p.includes('background') || p.includes('banner') || p.includes('pill')) {
    config.effect = 'background';
  } else if (p.includes('drop shadow') || p.includes('3d drop') || p.includes('shadow text')) {
    config.effect = 'drop';
  } else if (p.includes('curve') || p.includes('curved') || p.includes('arch')) {
    config.effect = 'curve';
  } else if (p.includes('rotate') || p.includes('rotated') || p.includes('tilt') || p.includes('tilted') || p.includes('slanted')) {
    config.effect = 'rotate';
  } else if (p.includes('glitch') || p.includes('chromatic') || p.includes('rgb')) {
    config.effect = 'glitch';
  } else if (p.includes('splice') || p.includes('spliced') || p.includes('sliced')) {
    config.effect = 'splice';
  }

  return config;
}
