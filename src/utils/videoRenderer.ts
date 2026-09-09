import { SlideItem, SubtitleConfig, AspectRatio, PhotoAnimationType } from '../types';

export interface RenderCanvasOptions {
  canvas: HTMLCanvasElement;
  slides: SlideItem[];
  currentTime: number; // seconds
  subtitleConfig: SubtitleConfig;
  aspectRatio: AspectRatio;
  imagesMap: Map<string, HTMLImageElement>;
  logoImg?: HTMLImageElement | null;
  logoPosition?: { xRatio: number; yRatio: number } | null;
  isDraggingLogo?: boolean;
  showLogoBorder?: boolean;
  isDraggingText?: boolean;
  showTextBorder?: boolean;
}

// Canvas fillText() never wraps on its own — without this, any caption
// longer than a few words just draws as one line and runs off both edges
// of the frame. This greedily wraps words to fit maxWidth, and if the text
// still exceeds maxLines, folds the remainder into the last line with an
// ellipsis rather than letting it overflow.
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  if (!text) return [];
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const allLines: string[] = [];
  let current = words[0];
  for (let i = 1; i < words.length; i++) {
    const test = `${current} ${words[i]}`;
    if (ctx.measureText(test).width > maxWidth) {
      allLines.push(current);
      current = words[i];
    } else {
      current = test;
    }
  }
  allLines.push(current);

  if (allLines.length <= maxLines) return allLines;

  const kept = allLines.slice(0, maxLines - 1);
  let lastLine = allLines.slice(maxLines - 1).join(' ');
  while (lastLine.length > 0 && ctx.measureText(lastLine + '…').width > maxWidth) {
    lastLine = lastLine.slice(0, -1).trimEnd();
  }
  kept.push(lastLine + '…');
  return kept;
}

// Wraps title + subtitle against the same max width and returns everything
// each style function needs to size its background box and draw the lines.
function layoutCaptionBlock(
  ctx: CanvasRenderingContext2D,
  title: string,
  subtitle: string,
  titleFont: string,
  subFont: string,
  maxTextWidth: number,
  titleLineHeight: number,
  subLineHeight: number
) {
  ctx.font = titleFont;
  const titleLines = title ? wrapText(ctx, title, maxTextWidth, 3) : [];
  const titleLineWidth = titleLines.reduce((max, l) => Math.max(max, ctx.measureText(l).width), 0);

  ctx.font = subFont;
  const subtitleLines = subtitle ? wrapText(ctx, subtitle, maxTextWidth, 2) : [];
  const subLineWidth = subtitleLines.reduce((max, l) => Math.max(max, ctx.measureText(l).width), 0);

  const contentWidth = Math.max(titleLineWidth, subLineWidth);
  const contentHeight = titleLines.length * titleLineHeight + subtitleLines.length * subLineHeight;

  return { titleLines, subtitleLines, contentWidth, contentHeight };
}

// Draws a set of already-wrapped lines starting at (x, startY), advancing
// by lineHeight per line. Returns the Y position after the last line.
function drawTextLines(
  ctx: CanvasRenderingContext2D,
  lines: string[],
  x: number,
  startY: number,
  lineHeight: number
): number {
  let y = startY;
  for (const line of lines) {
    ctx.fillText(line, x, y);
    y += lineHeight;
  }
  return y;
}

export function getCanvasDimensions(aspectRatio: AspectRatio) {
  switch (aspectRatio) {
    case '9:16':
      return { width: 1080, height: 1920 };
    case '1:1':
      return { width: 1080, height: 1080 };
    case '16:9':
    default:
      return { width: 1920, height: 1080 };
  }
}

export function getTotalDuration(slides: SlideItem[]): number {
  return slides.reduce((acc, slide) => acc + (slide.duration || 4), 0);
}

export function getSlideAtTime(slides: SlideItem[], currentTime: number) {
  let accumulated = 0;
  for (let i = 0; i < slides.length; i++) {
    const duration = slides[i].duration || 4;
    if (currentTime >= accumulated && currentTime < accumulated + duration) {
      const slideProgress = (currentTime - accumulated) / duration;
      return {
        slide: slides[i],
        index: i,
        progress: Math.min(1, Math.max(0, slideProgress)),
        timeInSlide: currentTime - accumulated,
        duration,
      };
    }
    accumulated += duration;
  }
  // Fallback to last slide
  const lastIndex = Math.max(0, slides.length - 1);
  return {
    slide: slides[lastIndex],
    index: lastIndex,
    progress: 1,
    timeInSlide: slides[lastIndex]?.duration || 4,
    duration: slides[lastIndex]?.duration || 4,
  };
}

function easeOutCubic(x: number): number {
  return 1 - Math.pow(1 - x, 3);
}

function easeOutQuad(x: number): number {
  return 1 - (1 - x) * (1 - x);
}

function drawSingleImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | undefined | null,
  width: number,
  height: number,
  options: {
    scale?: number;
    scaleX?: number;
    scaleY?: number;
    translateX?: number;
    translateY?: number;
    rotate?: number;
    alpha?: number;
  } = {}
) {
  if (!img || !img.complete || img.naturalWidth === 0) return;
  const {
    scale = 1.0,
    scaleX = 1.0,
    scaleY = 1.0,
    translateX = 0,
    translateY = 0,
    rotate = 0,
    alpha = 1.0,
  } = options;

  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
  ctx.translate(width / 2 + translateX, height / 2 + translateY);
  if (rotate !== 0) ctx.rotate(rotate);
  ctx.scale(scale * scaleX, scale * scaleY);

  const imgRatio = img.naturalWidth / img.naturalHeight;
  const canvasRatio = width / height;
  let drawW = width;
  let drawH = height;

  if (imgRatio > canvasRatio) {
    drawW = height * imgRatio;
    drawH = height;
  } else {
    drawW = width;
    drawH = width / imgRatio;
  }

  ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
  ctx.restore();
}

export function getPhotoAnimationTransform(
  animType: PhotoAnimationType | undefined,
  progress: number,
  width: number,
  height: number
) {
  let scale = 1.05;
  let translateX = 0;
  let translateY = 0;
  let rotate = 0;

  switch (animType) {
    case 'zoom-out':
      // Pan & Zoom pull-back: 1.18 down to 1.03
      scale = 1.18 - progress * 0.15;
      break;

    case 'pan-left-to-right':
      scale = 1.12;
      translateX = (progress - 0.5) * (width * 0.10);
      break;

    case 'pan-right-to-left':
      scale = 1.12;
      translateX = (0.5 - progress) * (width * 0.10);
      break;

    case 'pan-up':
      scale = 1.12;
      translateY = (0.5 - progress) * (height * 0.10);
      break;

    case 'pan-down':
      scale = 1.12;
      translateY = (progress - 0.5) * (height * 0.10);
      break;

    case 'bird-eye-view':
      // Drone overhead slow drift with micro rotation tilt & zoom pulse
      scale = 1.05 + Math.sin(progress * Math.PI) * 0.08;
      translateX = Math.sin(progress * Math.PI * 1.5) * (width * 0.03);
      translateY = (progress - 0.5) * (height * 0.04);
      rotate = (progress - 0.5) * 0.025;
      break;

    case 'pan-in-out':
      // Dynamic zoom pulse & subtle horizontal drift
      scale = 1.03 + Math.sin(progress * Math.PI) * 0.12;
      translateX = (progress - 0.5) * (width * 0.04);
      break;

    case 'zoom-in':
    default:
      // Zoom In forward push: 1.02 up to 1.16
      scale = 1.02 + progress * 0.14;
      break;
  }

  return { scale, translateX, translateY, rotate };
}

export function renderVideoFrame(options: RenderCanvasOptions) {
  const {
    canvas,
    slides,
    currentTime,
    subtitleConfig,
    aspectRatio,
    imagesMap,
    logoImg,
    logoPosition,
    isDraggingLogo,
    showLogoBorder,
    isDraggingText,
    showTextBorder,
  } = options;
  const ctx = canvas.getContext('2d');
  if (!ctx || slides.length === 0) return;

  const { width, height } = getCanvasDimensions(aspectRatio);
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  const { slide, index, progress, timeInSlide, duration } = getSlideAtTime(slides, currentTime);
  const img = imagesMap.get(slide.id);
  const prevSlide = index > 0 ? slides[index - 1] : null;
  const prevImg = prevSlide ? imagesMap.get(prevSlide.id) : null;

  // Clear background
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, width, height);

  const TRANSITION_DURATION = 0.8;
  const isTransitioning = index > 0 && timeInSlide < TRANSITION_DURATION && prevImg;
  const tTrans = isTransitioning ? Math.min(1, timeInSlide / TRANSITION_DURATION) : 1;
  const easeT = easeOutCubic(tTrans);

  const anim = getPhotoAnimationTransform(slide.animation, progress, width, height);
  const prevAnim = prevSlide ? getPhotoAnimationTransform(prevSlide.animation, 1.0, width, height) : { scale: 1.05, translateX: 0, translateY: 0, rotate: 0 };

  if (img && img.complete && img.naturalWidth > 0) {
    switch (slide.transition) {
      case 'slide': {
        if (isTransitioning && prevImg) {
          drawSingleImage(ctx, prevImg, width, height, {
            translateX: -easeT * width + prevAnim.translateX,
            translateY: prevAnim.translateY,
            scale: prevAnim.scale,
            rotate: prevAnim.rotate,
          });
          drawSingleImage(ctx, img, width, height, {
            translateX: (1 - easeT) * width + anim.translateX,
            translateY: anim.translateY,
            scale: anim.scale,
            rotate: anim.rotate,
          });
        } else {
          drawSingleImage(ctx, img, width, height, {
            scale: anim.scale,
            translateX: anim.translateX,
            translateY: anim.translateY,
            rotate: anim.rotate,
          });
        }
        break;
      }

      case 'flip-book': {
        if (isTransitioning && prevImg) {
          if (tTrans < 0.5) {
            const p1 = tTrans / 0.5;
            const easeP1 = easeOutQuad(p1);
            drawSingleImage(ctx, prevImg, width, height, {
              scaleX: Math.max(0.01, 1 - easeP1),
              scaleY: 1 - 0.08 * Math.sin(easeP1 * Math.PI),
              scale: prevAnim.scale,
              translateX: prevAnim.translateX,
              translateY: prevAnim.translateY,
              rotate: prevAnim.rotate,
            });
            ctx.fillStyle = `rgba(0, 0, 0, ${0.45 * easeP1})`;
            ctx.fillRect(0, 0, width, height);
          } else {
            const p2 = (tTrans - 0.5) / 0.5;
            const easeP2 = easeOutCubic(p2);
            drawSingleImage(ctx, img, width, height, {
              scaleX: Math.max(0.01, easeP2),
              scaleY: 1 - 0.08 * Math.sin((1 - easeP2) * Math.PI),
              scale: anim.scale,
              translateX: anim.translateX,
              translateY: anim.translateY,
              rotate: anim.rotate,
            });
            ctx.fillStyle = `rgba(0, 0, 0, ${0.45 * (1 - easeP2)})`;
            ctx.fillRect(0, 0, width, height);
          }
        } else {
          drawSingleImage(ctx, img, width, height, {
            scale: anim.scale,
            translateX: anim.translateX,
            translateY: anim.translateY,
            rotate: anim.rotate,
          });
        }
        break;
      }

      case 'open-pic': {
        if (isTransitioning && prevImg) {
          drawSingleImage(ctx, prevImg, width, height, {
            scale: prevAnim.scale,
            translateX: prevAnim.translateX,
            translateY: prevAnim.translateY,
            rotate: prevAnim.rotate,
          });

          const maxRadius = Math.hypot(width / 2, height / 2);
          const currentRadius = Math.max(2, maxRadius * easeT);

          ctx.save();
          ctx.beginPath();
          ctx.arc(width / 2, height / 2, currentRadius, 0, Math.PI * 2);
          ctx.clip();

          drawSingleImage(ctx, img, width, height, {
            scale: anim.scale,
            translateX: anim.translateX,
            translateY: anim.translateY,
            rotate: anim.rotate,
          });
          ctx.restore();

          ctx.save();
          ctx.strokeStyle = `rgba(245, 158, 11, ${Math.max(0, 0.9 * (1 - easeT))})`;
          ctx.lineWidth = Math.max(4, width * 0.005);
          ctx.beginPath();
          ctx.arc(width / 2, height / 2, currentRadius, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        } else {
          drawSingleImage(ctx, img, width, height, {
            scale: anim.scale,
            translateX: anim.translateX,
            translateY: anim.translateY,
            rotate: anim.rotate,
          });
        }
        break;
      }

      case 'corner-flip': {
        if (isTransitioning && prevImg) {
          drawSingleImage(ctx, prevImg, width, height, {
            scale: prevAnim.scale,
            translateX: prevAnim.translateX,
            translateY: prevAnim.translateY,
            rotate: prevAnim.rotate,
          });

          const maxSweep = width + height;
          const currentSweep = maxSweep * easeT;

          ctx.save();
          ctx.beginPath();
          ctx.moveTo(width, 0);
          ctx.lineTo(width, height);
          ctx.lineTo(Math.max(0, width - currentSweep), height);
          ctx.lineTo(width, Math.max(0, height - currentSweep));
          ctx.closePath();
          ctx.clip();

          drawSingleImage(ctx, img, width, height, {
            scale: anim.scale,
            translateX: anim.translateX,
            translateY: anim.translateY,
            rotate: anim.rotate,
          });
          ctx.restore();

          ctx.save();
          ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
          ctx.shadowBlur = Math.max(10, width * 0.015);
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(Math.max(0, width - currentSweep), height);
          ctx.lineTo(width, Math.max(0, height - currentSweep));
          ctx.stroke();
          ctx.restore();
        } else {
          drawSingleImage(ctx, img, width, height, {
            scale: anim.scale,
            translateX: anim.translateX,
            translateY: anim.translateY,
            rotate: anim.rotate,
          });
        }
        break;
      }

      case 'twist-flip': {
        if (isTransitioning && prevImg) {
          drawSingleImage(ctx, prevImg, width, height, {
            alpha: 1 - easeT,
            scale: prevAnim.scale + 0.1 * easeT,
            translateX: prevAnim.translateX,
            translateY: prevAnim.translateY,
          });
          drawSingleImage(ctx, img, width, height, {
            scale: anim.scale * (0.35 + 0.65 * easeT),
            rotate: anim.rotate + (1 - easeT) * -0.42,
            alpha: easeT,
            translateX: anim.translateX * easeT,
            translateY: anim.translateY * easeT,
          });
        } else {
          drawSingleImage(ctx, img, width, height, {
            scale: anim.scale,
            translateX: anim.translateX,
            translateY: anim.translateY,
            rotate: anim.rotate,
          });
        }
        break;
      }

      case 'fade':
      default: {
        let alpha = 1.0;
        if (isTransitioning && prevImg) {
          alpha = easeT;
          drawSingleImage(ctx, prevImg, width, height, {
            scale: prevAnim.scale,
            translateX: prevAnim.translateX,
            translateY: prevAnim.translateY,
            rotate: prevAnim.rotate,
          });
        }
        drawSingleImage(ctx, img, width, height, {
          scale: anim.scale,
          translateX: anim.translateX,
          translateY: anim.translateY,
          rotate: anim.rotate,
          alpha,
        });
        break;
      }
    }
  }

  // Draw Optional Logo Watermark with Custom / Draggable Position
  if (logoImg && logoImg.complete && logoImg.naturalWidth > 0) {
    ctx.save();
    ctx.globalAlpha = 0.95;
    const maxLogoW = width * 0.18;
    const maxLogoH = height * 0.12;
    const logoAspect = logoImg.naturalWidth / logoImg.naturalHeight;
    let logoW = maxLogoW;
    let logoH = maxLogoW / logoAspect;
    if (logoH > maxLogoH) {
      logoH = maxLogoH;
      logoW = maxLogoH * logoAspect;
    }

    const margin = Math.min(width, height) * 0.04;
    let logoX = width - logoW - margin;
    let logoY = margin;

    if (logoPosition) {
      logoX = width * logoPosition.xRatio - logoW / 2;
      logoY = height * logoPosition.yRatio - logoH / 2;

      // Clamp within canvas boundaries
      logoX = Math.max(margin / 2, Math.min(width - logoW - margin / 2, logoX));
      logoY = Math.max(margin / 2, Math.min(height - logoH - margin / 2, logoY));
    }

    ctx.drawImage(logoImg, logoX, logoY, logoW, logoH);

    // If dragging or showing border overlay
    if (isDraggingLogo || showLogoBorder) {
      ctx.strokeStyle = isDraggingLogo ? '#f59e0b' : 'rgba(245, 158, 11, 0.7)';
      ctx.lineWidth = Math.max(2, width * 0.003);
      ctx.setLineDash([Math.max(4, width * 0.006), Math.max(4, width * 0.006)]);
      const padding = 6;
      ctx.strokeRect(logoX - padding, logoY - padding, logoW + padding * 2, logoH + padding * 2);

      // Draw subtle drag indicator badge
      ctx.fillStyle = '#f59e0b';
      ctx.setLineDash([]);
      ctx.font = `bold ${Math.max(12, Math.round(width * 0.012))}px sans-serif`;
      const tagText = isDraggingLogo ? 'Moving Logo...' : '❖ Logo (Drag to move)';
      const textWidth = ctx.measureText(tagText).width;
      const tagPadding = 6;
      const tagH = Math.max(18, width * 0.018);
      const tagY = logoY - tagH - 4 > 10 ? logoY - tagH - 4 : logoY + logoH + 4;
      ctx.fillRect(logoX - padding, tagY, textWidth + tagPadding * 2, tagH);
      ctx.fillStyle = '#0f172a';
      ctx.fillText(tagText, logoX - padding + tagPadding, tagY + tagH * 0.75);
    }

    ctx.restore();
  }

  // Draw Subtle Dark Gradient Vignette Overlay at top & bottom for high text readability
  const gradient = ctx.createLinearGradient(0, height * 0.5, 0, height);
  gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0.75)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, height * 0.5, width, height * 0.5);

  // Draw Subtitles / Captions if enabled
  if (subtitleConfig.showCaptions && (slide.title || slide.subtitle)) {
    renderSubtitleOverlay({
      ctx,
      width,
      height,
      title: slide.title || '',
      subtitle: slide.subtitle || '',
      config: subtitleConfig,
      progress,
      timeInSlide,
      duration,
      isDraggingText,
      showTextBorder,
    });
  }
}

interface RenderSubtitleOptions {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  title: string;
  subtitle: string;
  config: SubtitleConfig;
  progress: number; // 0 to 1
  timeInSlide: number;
  duration: number;
  isDraggingText?: boolean;
  showTextBorder?: boolean;
}

function renderSubtitleOverlay(opts: RenderSubtitleOptions) {
  const { ctx, width, height, title, subtitle, config, progress, isDraggingText, showTextBorder } = opts;

  ctx.save();

  // Position calculation (Supports left-to-right X and up-to-down Y moving)
  let posX = width * (config.customXRatio !== undefined ? config.customXRatio : 0.5);
  let posY = height * 0.82; // Default bottom
  if (config.position === 'custom' && config.customYRatio !== undefined) {
    posY = height * config.customYRatio;
  } else if (config.position === 'center') {
    posY = height * (config.customYRatio !== undefined ? config.customYRatio : 0.5);
  } else if (config.position === 'top') {
    posY = height * (config.customYRatio !== undefined ? config.customYRatio : 0.18);
  } else if (config.position === 'lower-third') {
    posY = height * (config.customYRatio !== undefined ? config.customYRatio : 0.75);
  } else if (config.customYRatio !== undefined) {
    posY = height * config.customYRatio;
  }

  // Animation Offset / Progress calculations
  let animYOffset = 0;
  let animScale = 1.0;
  let animAlpha = 1.0;
  let displayedTitle = title;
  let displayedSubtitle = subtitle;

  switch (config.animationPreset) {
    case 'typewriter': {
      const charProgress = Math.min(1, progress * 1.8);
      const titleLen = Math.floor(title.length * charProgress);
      const subLen = Math.floor(subtitle.length * charProgress);
      displayedTitle = title.substring(0, titleLen);
      displayedSubtitle = subtitle.substring(0, subLen);
      break;
    }
    case 'slide-up': {
      const easeOut = 1 - Math.pow(1 - Math.min(1, progress * 3), 3);
      animYOffset = (1 - easeOut) * 35; // slide up 35px
      animAlpha = Math.min(1, progress * 4);
      break;
    }
    case 'zoom-pop': {
      const popProg = Math.min(1, progress * 3);
      animScale = 0.85 + popProg * 0.15;
      animAlpha = popProg;
      break;
    }
    case 'bar-reveal': {
      animAlpha = Math.min(1, progress * 3);
      break;
    }
    case 'kinetic-word': {
      animAlpha = Math.min(1, progress * 3);
      break;
    }
  }

  ctx.globalAlpha = animAlpha;
  ctx.translate(posX, posY + animYOffset);
  ctx.scale(animScale, animScale);

  // 5 Visual Text Styles
  switch (config.stylePreset) {
    case 'luxury-gold':
      renderStyleLuxuryGold(ctx, width, displayedTitle, displayedSubtitle, config);
      break;

    case 'modern-minimal':
      renderStyleModernMinimal(ctx, width, displayedTitle, displayedSubtitle, config);
      break;

    case 'cinematic-glass':
      renderStyleCinematicGlass(ctx, width, displayedTitle, displayedSubtitle, config);
      break;

    case 'architectural-lower-third':
      renderStyleLowerThird(ctx, width, displayedTitle, displayedSubtitle, config);
      break;

    case 'vibrant-neon':
      renderStyleVibrantNeon(ctx, width, displayedTitle, displayedSubtitle, config);
      break;

    default:
      renderStyleModernMinimal(ctx, width, displayedTitle, displayedSubtitle, config);
      break;
  }

  // If user is hovering or dragging the text overlay, draw an interactive bounding outline & badge
  if (isDraggingText || showTextBorder) {
    ctx.save();
    const baseFontSize = config.fontSize || 30;
    const maxTextWidth = width * 0.9 - 80;
    const { contentWidth, contentHeight } = layoutCaptionBlock(
      ctx,
      title,
      subtitle,
      `600 ${baseFontSize * 1.2}px "Playfair Display", "Plus Jakarta Sans", sans-serif`,
      `400 ${baseFontSize * 0.9}px "Plus Jakarta Sans", sans-serif`,
      maxTextWidth,
      baseFontSize * 1.5,
      baseFontSize * 1.2
    );
    const boxW = Math.min(width * 0.9, Math.max(contentWidth, 240) + 80);
    const boxH = contentHeight + 44;

    ctx.strokeStyle = isDraggingText ? '#f59e0b' : 'rgba(245, 158, 11, 0.75)';
    ctx.lineWidth = Math.max(2, width * 0.003);
    ctx.setLineDash([Math.max(4, width * 0.006), Math.max(4, width * 0.006)]);
    ctx.strokeRect(-boxW / 2 - 6, -boxH / 2 - 6, boxW + 12, boxH + 12);

    // Draw drag indicator badge above the text box
    ctx.setLineDash([]);
    ctx.fillStyle = '#f59e0b';
    ctx.font = `bold ${Math.max(12, Math.round(width * 0.012))}px sans-serif`;
    const tagText = isDraggingText ? '✥ Repositioning Text Overlay...' : '✥ Text Overlay (Drag to move)';
    const tagMetrics = ctx.measureText(tagText);
    const tagPadding = 6;
    const tagH = Math.max(18, width * 0.018);
    const tagY = -boxH / 2 - tagH - 8;
    ctx.fillRect(-boxW / 2 - 6, tagY, tagMetrics.width + tagPadding * 2, tagH);
    ctx.fillStyle = '#0f172a';
    ctx.textAlign = 'left';
    ctx.fillText(tagText, -boxW / 2 - 6 + tagPadding, tagY + tagH * 0.75);
    ctx.restore();
  }

  ctx.restore();
}

// 1. STYLE: Luxury Gold Serif
function renderStyleLuxuryGold(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  title: string,
  subtitle: string,
  config: SubtitleConfig
) {
  const baseFontSize = config.fontSize || 32;
  const titleFont = `600 ${baseFontSize * 1.25}px "Playfair Display", Georgia, serif`;
  const subFont = `400 ${baseFontSize * 0.85}px "Plus Jakarta Sans", sans-serif`;
  const titleLineHeight = baseFontSize * 1.5;
  const subLineHeight = baseFontSize * 1.2;

  const maxTextWidth = canvasWidth * 0.85 - 80;
  const { titleLines, subtitleLines, contentWidth, contentHeight } = layoutCaptionBlock(
    ctx, title, subtitle, titleFont, subFont, maxTextWidth, titleLineHeight, subLineHeight
  );

  const boxWidth = Math.min(canvasWidth * 0.85, Math.max(contentWidth, 240) + 80);
  const boxHeight = contentHeight + 40;

  // Draw Dark Glass Backdrop
  ctx.fillStyle = `rgba(15, 23, 42, ${config.bgOpacity ?? 0.85})`;
  ctx.beginPath();
  ctx.roundRect(-boxWidth / 2, -boxHeight / 2, boxWidth, boxHeight, 12);
  ctx.fill();

  // Gold Border Accent
  ctx.strokeStyle = 'rgba(234, 179, 8, 0.8)'; // Gold
  ctx.lineWidth = 2;
  ctx.stroke();

  // Top Gold Accent Line
  ctx.fillStyle = '#eab308';
  ctx.fillRect(-boxWidth * 0.2, -boxHeight / 2, boxWidth * 0.4, 3);

  // Draw Title (wrapped, multi-line)
  let currentY = -boxHeight / 2 + 32;
  if (titleLines.length) {
    ctx.font = titleFont;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fef08a'; // Soft Gold Yellow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    ctx.shadowBlur = 8;
    currentY = drawTextLines(ctx, titleLines, 0, currentY, titleLineHeight);
  }

  // Draw Subtitle (wrapped, multi-line)
  if (subtitleLines.length) {
    ctx.font = subFont;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.shadowBlur = 4;
    drawTextLines(ctx, subtitleLines, 0, currentY, subLineHeight);
  }
}

// 2. STYLE: Modern Minimal Dark Badge
function renderStyleModernMinimal(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  title: string,
  subtitle: string,
  config: SubtitleConfig
) {
  const baseFontSize = config.fontSize || 28;
  const titleFont = `700 ${baseFontSize * 1.1}px "Plus Jakarta Sans", sans-serif`;
  const subFont = `500 ${baseFontSize * 0.85}px "Plus Jakarta Sans", sans-serif`;
  const titleLineHeight = baseFontSize * 1.4;
  const subLineHeight = baseFontSize * 1.1;

  const maxTextWidth = canvasWidth * 0.88 - 60;
  const { titleLines, subtitleLines, contentWidth, contentHeight } = layoutCaptionBlock(
    ctx, title, subtitle, titleFont, subFont, maxTextWidth, titleLineHeight, subLineHeight
  );

  const boxWidth = Math.min(canvasWidth * 0.88, Math.max(contentWidth, 240) + 60);
  const boxHeight = contentHeight + 32;

  // Dark rounded pill container
  ctx.fillStyle = `rgba(0, 0, 0, ${config.bgOpacity ?? 0.82})`;
  ctx.beginPath();
  ctx.roundRect(-boxWidth / 2, -boxHeight / 2, boxWidth, boxHeight, 16);
  ctx.fill();

  // Crisp White Border
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.lineWidth = 1;
  ctx.stroke();

  let currentY = -boxHeight / 2 + 28;
  if (titleLines.length) {
    ctx.font = titleFont;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    currentY = drawTextLines(ctx, titleLines, 0, currentY, titleLineHeight);
  }

  if (subtitleLines.length) {
    ctx.font = subFont;
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    drawTextLines(ctx, subtitleLines, 0, currentY, subLineHeight);
  }
}

// 3. STYLE: Cinematic Glassmorphism
function renderStyleCinematicGlass(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  title: string,
  subtitle: string,
  config: SubtitleConfig
) {
  const baseFontSize = config.fontSize || 30;
  const titleFont = `800 ${baseFontSize * 1.2}px "Plus Jakarta Sans", sans-serif`;
  const subFont = `400 ${baseFontSize * 0.85}px "Plus Jakarta Sans", sans-serif`;
  const titleLineHeight = baseFontSize * 1.4;
  const subLineHeight = baseFontSize * 1.1;

  const maxTextWidth = canvasWidth * 0.85 - 80;
  const { titleLines, subtitleLines, contentWidth, contentHeight } = layoutCaptionBlock(
    ctx, title, subtitle, titleFont, subFont, maxTextWidth, titleLineHeight, subLineHeight
  );

  const boxWidth = Math.min(canvasWidth * 0.85, Math.max(contentWidth, 240) + 80);
  const boxHeight = contentHeight + 36;

  // Frosted Glass Effect Fill
  ctx.fillStyle = `rgba(30, 41, 59, ${config.bgOpacity ?? 0.75})`;
  ctx.beginPath();
  ctx.roundRect(-boxWidth / 2, -boxHeight / 2, boxWidth, boxHeight, 14);
  ctx.fill();

  // Cyan / Glass Gradient Border
  const grad = ctx.createLinearGradient(-boxWidth / 2, 0, boxWidth / 2, 0);
  grad.addColorStop(0, 'rgba(56, 189, 248, 0.8)'); // Sky blue
  grad.addColorStop(1, 'rgba(168, 85, 247, 0.8)'); // Purple

  ctx.strokeStyle = grad;
  ctx.lineWidth = 2;
  ctx.stroke();

  let currentY = -boxHeight / 2 + 30;
  if (titleLines.length) {
    ctx.font = titleFont;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#f8fafc';
    ctx.shadowColor = 'rgba(56, 189, 248, 0.5)';
    ctx.shadowBlur = 12;
    currentY = drawTextLines(ctx, titleLines, 0, currentY, titleLineHeight);
  }

  if (subtitleLines.length) {
    ctx.font = subFont;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#cbd5e1';
    ctx.shadowBlur = 0;
    drawTextLines(ctx, subtitleLines, 0, currentY, subLineHeight);
  }
}

// 4. STYLE: Architectural Lower Third Banner
function renderStyleLowerThird(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  title: string,
  subtitle: string,
  config: SubtitleConfig
) {
  const baseFontSize = config.fontSize || 28;
  const titleFont = `800 ${baseFontSize * 1.1}px "Plus Jakarta Sans", sans-serif`;
  const subFont = `600 ${baseFontSize * 0.8}px "Plus Jakarta Sans", sans-serif`;
  const titleLineHeight = baseFontSize * 1.3;
  const subLineHeight = baseFontSize * 1.0;

  const maxTextWidth = canvasWidth * 0.8 - 90;
  // Uppercase the subtitle before wrapping so line widths are measured
  // against the text as it will actually be drawn.
  const { titleLines, subtitleLines, contentWidth, contentHeight } = layoutCaptionBlock(
    ctx, title, subtitle.toUpperCase(), titleFont, subFont, maxTextWidth, titleLineHeight, subLineHeight
  );

  const boxWidth = Math.min(canvasWidth * 0.8, Math.max(contentWidth, 240) + 90);
  const boxHeight = contentHeight + 32;

  const startX = -boxWidth / 2;

  // Solid dark background bar
  ctx.fillStyle = `rgba(15, 23, 42, ${config.bgOpacity ?? 0.92})`;
  ctx.fillRect(startX, -boxHeight / 2, boxWidth, boxHeight);

  // Left vertical brand accent bar
  ctx.fillStyle = config.accentColor || '#0284c7'; // Deep Sky Blue
  ctx.fillRect(startX, -boxHeight / 2, 8, boxHeight);

  let currentY = -boxHeight / 2 + 28;
  if (titleLines.length) {
    ctx.font = titleFont;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffffff';
    currentY = drawTextLines(ctx, titleLines, startX + 28, currentY, titleLineHeight);
  }

  if (subtitleLines.length) {
    ctx.font = subFont;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#94a3b8';
    drawTextLines(ctx, subtitleLines, startX + 28, currentY, subLineHeight);
  }
}

// 5. STYLE: Vibrant Neon Accent
function renderStyleVibrantNeon(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  title: string,
  subtitle: string,
  config: SubtitleConfig
) {
  const baseFontSize = config.fontSize || 30;
  const titleFont = `900 ${baseFontSize * 1.2}px "Plus Jakarta Sans", sans-serif`;
  const subFont = `600 ${baseFontSize * 0.85}px "Plus Jakarta Sans", sans-serif`;
  const titleLineHeight = baseFontSize * 1.4;
  const subLineHeight = baseFontSize * 1.1;

  const maxTextWidth = canvasWidth * 0.88 - 70;
  const { titleLines, subtitleLines, contentWidth, contentHeight } = layoutCaptionBlock(
    ctx, title, subtitle, titleFont, subFont, maxTextWidth, titleLineHeight, subLineHeight
  );

  const boxWidth = Math.min(canvasWidth * 0.88, Math.max(contentWidth, 240) + 70);
  const boxHeight = contentHeight + 36;

  // Dark background with neon glow
  ctx.fillStyle = `rgba(10, 10, 10, ${config.bgOpacity ?? 0.88})`;
  ctx.beginPath();
  ctx.roundRect(-boxWidth / 2, -boxHeight / 2, boxWidth, boxHeight, 10);
  ctx.fill();

  // Neon Underline Accent
  ctx.fillStyle = '#10b981'; // Emerald Neon Green
  ctx.fillRect(-boxWidth * 0.3, boxHeight / 2 - 4, boxWidth * 0.6, 4);

  let currentY = -boxHeight / 2 + 30;
  if (titleLines.length) {
    ctx.font = titleFont;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(16, 185, 129, 0.8)';
    ctx.shadowBlur = 10;
    currentY = drawTextLines(ctx, titleLines, 0, currentY, titleLineHeight);
  }

  if (subtitleLines.length) {
    ctx.font = subFont;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#6ee7b7'; // Mint
    ctx.shadowBlur = 0;
    drawTextLines(ctx, subtitleLines, 0, currentY, subLineHeight);
  }
}
