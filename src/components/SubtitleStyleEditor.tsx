import React from 'react';
import {
  Type,
  Sparkles,
  Sliders,
  Eye,
  EyeOff,
  MoveVertical,
  MoveHorizontal,
  Move,
  Palette,
  CheckCircle2,
  Wand2,
  RotateCcw
} from 'lucide-react';
import { SubtitleConfig, TextStylePreset, TextAnimationPreset } from '../types';

interface SubtitleStyleEditorProps {
  subtitleConfig: SubtitleConfig;
  onUpdateSubtitleConfig: (config: SubtitleConfig) => void;
  onGenerateAiCaptions: () => void;
  isAiGenerating?: boolean;
}

const TEXT_STYLES: { id: TextStylePreset; name: string; desc: string; sampleBg: string }[] = [
  {
    id: 'luxury-gold',
    name: '1. Luxury Gold Serif',
    desc: 'Gold Serif typography with glass card & gold border',
    sampleBg: 'border-yellow-500/80 bg-slate-900 text-yellow-300 font-serif',
  },
  {
    id: 'modern-minimal',
    name: '2. Modern Minimalist',
    desc: 'Clean sans-serif with high contrast dark pill container',
    sampleBg: 'border-slate-400 bg-slate-950 text-white font-sans',
  },
  {
    id: 'cinematic-glass',
    name: '3. Cinematic Glass',
    desc: 'Translucent glassmorphism with sky-blue gradient border',
    sampleBg: 'border-sky-400/80 bg-slate-900/80 text-sky-100 font-bold',
  },
  {
    id: 'architectural-lower-third',
    name: '4. Real Estate Lower Third',
    desc: 'Agency 2-line banner with vertical sky-blue brand strip',
    sampleBg: 'border-l-4 border-l-sky-500 bg-slate-900 text-white',
  },
  {
    id: 'vibrant-neon',
    name: '5. Vibrant Neon Accent',
    desc: 'Bold headline with glowing emerald neon underline',
    sampleBg: 'border-emerald-500 bg-black text-emerald-300 font-black',
  },
];

const ANIMATION_PRESETS: { id: TextAnimationPreset; name: string; desc: string }[] = [
  { id: 'typewriter', name: 'Typewriter Reveal', desc: 'Characters type out sequentially' },
  { id: 'slide-up', name: 'Fade & Slide Up', desc: 'Smooth upward emergence' },
  { id: 'zoom-pop', name: 'Zoom & Pop In', desc: 'Pop-in scale with spring feel' },
  { id: 'bar-reveal', name: 'Center Bar Expansion', desc: 'Box unfolds from center' },
  { id: 'kinetic-word', name: 'Kinetic Word Pulse', desc: 'Text highlights in sequence' },
];

export const SubtitleStyleEditor: React.FC<SubtitleStyleEditorProps> = ({
  subtitleConfig,
  onUpdateSubtitleConfig,
  onGenerateAiCaptions,
  isAiGenerating = false,
}) => {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 md:p-5 flex flex-col gap-4 shadow-xl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
        <div>
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Type className="w-4 h-4 text-amber-400" />
            <span>Subtitle & Caption Studio (5 Styles & 5 Animations)</span>
          </h2>
          <p className="text-xs text-slate-400">
            Customize typography, motion effects, and auto-generate luxury property copy
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onGenerateAiCaptions}
            disabled={isAiGenerating}
            className="flex items-center gap-1.5 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 text-xs font-bold px-3 py-1.5 rounded-lg shadow transition-colors disabled:opacity-50"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{isAiGenerating ? 'Generating Captions...' : 'AI Auto-Captions'}</span>
          </button>

          <button
            onClick={() =>
              onUpdateSubtitleConfig({
                ...subtitleConfig,
                showCaptions: !subtitleConfig.showCaptions,
              })
            }
            className={`p-2 rounded-lg transition-colors ${
              subtitleConfig.showCaptions
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                : 'bg-slate-800 text-slate-400'
            }`}
          >
            {subtitleConfig.showCaptions ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* 5 Distinct Visual Styles Grid */}
      <div className="space-y-2">
        <label className="text-xs font-bold text-slate-200 block">
          Select Subtitle Text Style (5 Distinct Styles)
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {TEXT_STYLES.map((style) => {
            const isSelected = subtitleConfig.stylePreset === style.id;
            return (
              <button
                key={style.id}
                onClick={() =>
                  onUpdateSubtitleConfig({ ...subtitleConfig, stylePreset: style.id })
                }
                className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between gap-2 ${
                  isSelected
                    ? 'border-amber-500 bg-amber-500/10 ring-1 ring-amber-500/50'
                    : 'border-slate-800 bg-slate-950/40 hover:border-slate-700'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-white">{style.name}</span>
                    {isSelected && <CheckCircle2 className="w-4 h-4 text-amber-400" />}
                  </div>
                  <p className="text-[10px] text-slate-400 line-clamp-1">{style.desc}</p>
                </div>

                {/* Sample Preview Badge */}
                <div
                  className={`mt-1 p-2 rounded-lg text-center text-[11px] border ${style.sampleBg}`}
                >
                  "Modern Luxury Estate"
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 5 Distinct Text Animations */}
      <div className="space-y-2 pt-2 border-t border-slate-800">
        <label className="text-xs font-bold text-slate-200 block">
          Select Subtitle Animation Motion (5 Animations)
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {ANIMATION_PRESETS.map((anim) => {
            const isSelected = subtitleConfig.animationPreset === anim.id;
            return (
              <button
                key={anim.id}
                onClick={() =>
                  onUpdateSubtitleConfig({ ...subtitleConfig, animationPreset: anim.id })
                }
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  isSelected
                    ? 'border-amber-500 bg-amber-500/10 text-amber-300'
                    : 'border-slate-800 bg-slate-950/40 text-slate-300 hover:border-slate-700'
                }`}
              >
                <span className="text-xs font-bold block">{anim.name}</span>
                <span className="text-[10px] text-slate-400 block">{anim.desc}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Subtitle Positioning & Styling Sliders */}
      <div className="space-y-3 bg-slate-950/80 p-3.5 rounded-xl border border-slate-800">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-[11px] font-semibold text-slate-300 block mb-1">
              Caption Placement Mode
            </label>
            <select
              value={subtitleConfig.position}
              onChange={(e) => {
                const pos = e.target.value as any;
                let defaultX = subtitleConfig.customXRatio ?? 0.5;
                let defaultY = 0.82;
                if (pos === 'top') defaultY = 0.18;
                else if (pos === 'center') defaultY = 0.5;
                else if (pos === 'lower-third') defaultY = 0.75;
                else if (pos === 'bottom') defaultY = 0.82;

                onUpdateSubtitleConfig({
                  ...subtitleConfig,
                  position: pos,
                  customXRatio: defaultX,
                  customYRatio: defaultY,
                });
              }}
              className="w-full bg-slate-900 text-xs text-slate-200 border border-slate-800 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-amber-500"
            >
              <option value="bottom">Bottom Overlay (Standard)</option>
              <option value="lower-third">Lower Third (Agency Banner)</option>
              <option value="center">Center Screen</option>
              <option value="top">Top Header</option>
              <option value="custom">Custom (Drag or Sliders)</option>
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-300 mb-1">
              <span>Font Size</span>
              <span className="text-amber-400 font-mono">{subtitleConfig.fontSize}px</span>
            </div>
            <input
              type="range"
              min={18}
              max={48}
              step={2}
              value={subtitleConfig.fontSize}
              onChange={(e) =>
                onUpdateSubtitleConfig({ ...subtitleConfig, fontSize: parseInt(e.target.value) })
              }
              className="w-full accent-amber-500 cursor-pointer h-1.5 bg-slate-800 rounded mt-1"
            />
          </div>

          <div>
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-300 mb-1">
              <span>Backdrop Opacity</span>
              <span className="text-amber-400 font-mono">
                {Math.round(subtitleConfig.bgOpacity * 100)}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={subtitleConfig.bgOpacity}
              onChange={(e) =>
                onUpdateSubtitleConfig({
                  ...subtitleConfig,
                  bgOpacity: parseFloat(e.target.value),
                })
              }
              className="w-full accent-amber-500 cursor-pointer h-1.5 bg-slate-800 rounded mt-1"
            />
          </div>
        </div>

        {/* Freeform Horizontal X and Vertical Y Sliders with Quick Snap Actions */}
        <div className="pt-2 border-t border-slate-800/80 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
              <Move className="w-3.5 h-3.5 text-amber-400" />
              <span>Drag & Fine-Tune Text Coordinates</span>
              <span className="text-[10px] text-slate-400 font-normal hidden sm:inline">
                (Click and drag directly on preview or slide below)
              </span>
            </div>

            {/* Quick Snap Buttons */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() =>
                  onUpdateSubtitleConfig({
                    ...subtitleConfig,
                    position: 'custom',
                    customXRatio: 0.18,
                    customYRatio: 0.18,
                  })
                }
                className="text-[10px] px-1.5 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition-colors"
                title="Top Left"
              >
                ↖ Top Left
              </button>
              <button
                type="button"
                onClick={() =>
                  onUpdateSubtitleConfig({
                    ...subtitleConfig,
                    position: 'custom',
                    customXRatio: 0.5,
                    customYRatio: 0.18,
                  })
                }
                className="text-[10px] px-1.5 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition-colors"
                title="Top Center"
              >
                ⬆ Top Center
              </button>
              <button
                type="button"
                onClick={() =>
                  onUpdateSubtitleConfig({
                    ...subtitleConfig,
                    position: 'custom',
                    customXRatio: 0.82,
                    customYRatio: 0.18,
                  })
                }
                className="text-[10px] px-1.5 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition-colors"
                title="Top Right"
              >
                ↗ Top Right
              </button>
              <button
                type="button"
                onClick={() =>
                  onUpdateSubtitleConfig({
                    ...subtitleConfig,
                    position: 'custom',
                    customXRatio: 0.5,
                    customYRatio: 0.5,
                  })
                }
                className="text-[10px] px-1.5 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition-colors"
                title="Center"
              >
                ✛ Center
              </button>
              <button
                type="button"
                onClick={() =>
                  onUpdateSubtitleConfig({
                    ...subtitleConfig,
                    position: 'bottom',
                    customXRatio: 0.5,
                    customYRatio: 0.82,
                  })
                }
                className="text-[10px] px-1.5 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition-colors flex items-center gap-1"
                title="Reset to default bottom center"
              >
                <RotateCcw className="w-2.5 h-2.5" />
                <span>Reset</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Horizontal X Slider (Left to Right) */}
            <div className="bg-slate-900/90 p-2 rounded-lg border border-slate-800">
              <div className="flex items-center justify-between text-[11px] font-semibold text-slate-300 mb-1">
                <span className="flex items-center gap-1">
                  <MoveHorizontal className="w-3.5 h-3.5 text-amber-400" />
                  <span>Horizontal Position (Left ⟷ Right)</span>
                </span>
                <span className="text-amber-400 font-mono text-xs">
                  {Math.round((subtitleConfig.customXRatio ?? 0.5) * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={0.1}
                max={0.9}
                step={0.01}
                value={subtitleConfig.customXRatio ?? 0.5}
                onChange={(e) =>
                  onUpdateSubtitleConfig({
                    ...subtitleConfig,
                    position: 'custom',
                    customXRatio: parseFloat(e.target.value),
                    customYRatio: subtitleConfig.customYRatio ?? 0.82,
                  })
                }
                className="w-full accent-amber-500 cursor-pointer h-1.5 bg-slate-800 rounded"
              />
              <div className="flex justify-between text-[9px] text-slate-500 font-medium mt-1">
                <span>Left (10%)</span>
                <span>Center (50%)</span>
                <span>Right (90%)</span>
              </div>
            </div>

            {/* Vertical Y Slider (Up to Down) */}
            <div className="bg-slate-900/90 p-2 rounded-lg border border-slate-800">
              <div className="flex items-center justify-between text-[11px] font-semibold text-slate-300 mb-1">
                <span className="flex items-center gap-1">
                  <MoveVertical className="w-3.5 h-3.5 text-amber-400" />
                  <span>Vertical Position (Top ⟷ Bottom)</span>
                </span>
                <span className="text-amber-400 font-mono text-xs">
                  {Math.round(
                    (subtitleConfig.customYRatio ??
                      (subtitleConfig.position === 'top'
                        ? 0.18
                        : subtitleConfig.position === 'center'
                        ? 0.5
                        : subtitleConfig.position === 'lower-third'
                        ? 0.75
                        : 0.82)) * 100
                  )}
                  %
                </span>
              </div>
              <input
                type="range"
                min={0.08}
                max={0.92}
                step={0.01}
                value={
                  subtitleConfig.customYRatio ??
                  (subtitleConfig.position === 'top'
                    ? 0.18
                    : subtitleConfig.position === 'center'
                    ? 0.5
                    : subtitleConfig.position === 'lower-third'
                    ? 0.75
                    : 0.82)
                }
                onChange={(e) =>
                  onUpdateSubtitleConfig({
                    ...subtitleConfig,
                    position: 'custom',
                    customXRatio: subtitleConfig.customXRatio ?? 0.5,
                    customYRatio: parseFloat(e.target.value),
                  })
                }
                className="w-full accent-amber-500 cursor-pointer h-1.5 bg-slate-800 rounded"
              />
              <div className="flex justify-between text-[9px] text-slate-500 font-medium mt-1">
                <span>Top (8%)</span>
                <span>Center (50%)</span>
                <span>Bottom (92%)</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
