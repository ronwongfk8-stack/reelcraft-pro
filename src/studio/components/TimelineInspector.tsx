import React from 'react';
import {
  Film,
  Zap,
  Type,
  Plus,
  Clock,
  Volume2,
} from 'lucide-react';
import {
  TimelineClip,
  MediaItem,
  TransitionType,
  MotionType,
  SceneTextOverlay,
} from '../types';

interface TimelineInspectorProps {
  clips: TimelineClip[];
  mediaItems: MediaItem[];
  selectedClipId?: string;
  onSelectClip: (id: string) => void;
  onUpdateClipTransition: (clipId: string, transition: TransitionType) => void;
  onUpdateClipMotion?: (clipId: string, motion: MotionType) => void;
  onUpdateClipTextOverlay?: (clipId: string, overlay: SceneTextOverlay | undefined) => void;
  onOpenSettings?: () => void;
  onUpdateClipTiming?: (clipId: string, patch: { duration?: number; trimStart?: number; keepAudio?: boolean }) => void;
}

const TimelineInspectorComponent: React.FC<TimelineInspectorProps> = ({
  clips,
  mediaItems,
  selectedClipId,
  onSelectClip,
  onUpdateClipTransition,
  onUpdateClipTextOverlay,
  onOpenSettings,
  onUpdateClipTiming,
}) => {
  const getMediaItem = (mediaId: string) => {
    return mediaItems.find((m) => m.id === mediaId);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center space-x-2">
          <Film className="w-5 h-5 text-indigo-400" />
          <h3 className="text-base font-bold text-white">AI Director's Cut Storyboard</h3>
        </div>
        <span className="text-xs text-slate-400 font-mono">
          {clips.length} sequenced cuts • Click any slide to pause &amp; edit text on footage
        </span>
      </div>

      {/* Sequenced Storyboard Scenes Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-h-72 overflow-y-auto pr-1">
        {clips.map((clip, idx) => {
          const media = getMediaItem(clip.mediaId);
          const isSelected = selectedClipId === clip.id;
          const overlay = clip.textOverlay;

          return (
            <div
              key={clip.id}
              onClick={() => onSelectClip(clip.id)}
              className={`p-3 rounded-xl border transition-all cursor-pointer space-y-2 relative group ${
                isSelected
                  ? 'bg-slate-800/90 border-pink-500 ring-2 ring-pink-500/50 shadow-lg shadow-pink-950/40'
                  : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
              }`}
            >
              {/* Header: Scene # & Timecode */}
              <div className="flex items-center justify-between text-[11px] font-mono">
                <span className={`font-bold ${isSelected ? 'text-pink-400' : 'text-indigo-400'}`}>
                  Slide #{idx + 1}
                </span>
                <span className="text-slate-400">
                  {clip.startTime.toFixed(1)}s - {(clip.startTime + clip.duration).toFixed(1)}s ({clip.duration.toFixed(1)}s)
                </span>
              </div>

              {/* Preview Thumbnail */}
              <div className="relative rounded-lg overflow-hidden aspect-video bg-black">
                {media ? (
                  media.type === 'image' ? (
                    <img
                      src={media.url}
                      alt={media.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    />
                  ) : (
                    <video
                      src={`${media.url}#t=0.1`}
                      className="w-full h-full object-cover"
                      muted
                      playsInline
                      preload="metadata"
                    />
                  )
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs text-slate-600">
                    No Media
                  </div>
                )}

                {/* Transition Badge */}
                {idx > 0 && (
                  <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-black/80 backdrop-blur text-[10px] font-medium text-amber-300 flex items-center space-x-1 border border-amber-500/30">
                    <Zap className="w-3 h-3 text-amber-400" />
                    <span>{clip.transitionIn}</span>
                  </div>
                )}

                {/* Text Overlay Indicator Tag */}
                {overlay?.enabled && overlay.text && (
                  <div className="absolute top-1 right-1 px-1.5 py-0.5 rounded bg-pink-950/90 backdrop-blur text-[9px] font-bold text-pink-300 border border-pink-500/40 flex items-center space-x-1 truncate max-w-[110px]">
                    <Type className="w-2.5 h-2.5 text-pink-400 shrink-0" />
                    <span className="truncate">{overlay.text}</span>
                  </div>
                )}

                {/* Motion Badge */}
                {clip.motionEffect !== 'none' && (
                  <div className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/80 backdrop-blur text-[10px] text-cyan-300 border border-cyan-500/30">
                    {clip.motionEffect}
                  </div>
                )}
              </div>

              {/* Transition Selector Dropdown for custom tweak */}
              {idx > 0 && (
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 flex items-center space-x-1">
                    <Zap className="w-3 h-3 text-amber-400" />
                    <span>In-Transition:</span>
                  </label>
                  <select
                    value={clip.transitionIn}
                    onChange={(e) =>
                      onUpdateClipTransition(clip.id, e.target.value as TransitionType)
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-[11px] text-slate-200 focus:outline-none focus:border-indigo-500"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <option value="none">None (Cut)</option>
                    <option value="whip-left">Whip Pan Left</option>
                    <option value="whip-right">Whip Pan Right</option>
                    <option value="zoom-in">Punch Zoom In</option>
                    <option value="zoom-out">Snap Zoom Out</option>
                    <option value="glitch">Digital Glitch</option>
                    <option value="flash-white">Exposure Flash</option>
                    <option value="crossfade">Smooth Dissolve</option>
                    <option value="slide-up">Kinetic Push Up</option>
                    <option value="lens-blur">Dream Lens Blur</option>
                    <option value="film-roll">Retro Film Roll</option>
                  </select>
                </div>
              )}

              {/* Clip length + (videos) trim start & original sound */}
              {onUpdateClipTiming && (() => {
                const isVideo = media?.type === 'video';
                const srcDur = isVideo ? media?.duration || 0 : 0;
                const trim = clip.trimStart || 0;
                const maxLen = isVideo && srcDur > 0 ? Math.max(clip.duration, srcDur - trim) : 15;
                const maxTrim = Math.max(0, srcDur - 0.5);
                return (
                  <div className="space-y-2 pt-0.5" onClick={(e) => e.stopPropagation()}>
                    <div className="space-y-0.5">
                      <label className="text-[10px] text-slate-400 flex items-center justify-between">
                        <span className="flex items-center space-x-1">
                          <Clock className="w-3 h-3 text-cyan-400" />
                          <span>Length</span>
                        </span>
                        <span className="font-mono text-slate-300">{clip.duration.toFixed(1)}s</span>
                      </label>
                      <input
                        type="range"
                        min={0.5}
                        max={Math.max(1, Number(maxLen.toFixed(1)))}
                        step={0.1}
                        value={clip.duration}
                        onChange={(e) => onUpdateClipTiming(clip.id, { duration: Number(e.target.value) })}
                        className="w-full accent-cyan-400 cursor-pointer"
                        aria-label="Clip length in seconds"
                      />
                    </div>

                    {isVideo && srcDur > 0 && (
                      <>
                        <div className="space-y-0.5">
                          <label className="text-[10px] text-slate-400 flex items-center justify-between">
                            <span>Start at (of {srcDur.toFixed(1)}s video)</span>
                            <span className="font-mono text-slate-300">{trim.toFixed(1)}s</span>
                          </label>
                          <input
                            type="range"
                            min={0}
                            max={Number(maxTrim.toFixed(1))}
                            step={0.1}
                            value={Math.min(trim, maxTrim)}
                            onChange={(e) => onUpdateClipTiming(clip.id, { trimStart: Number(e.target.value) })}
                            className="w-full accent-pink-400 cursor-pointer"
                            aria-label="Where this clip starts inside the video"
                          />
                        </div>
                        <label className="flex items-center space-x-1.5 text-[10px] text-slate-300 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={!!clip.keepAudio}
                            onChange={(e) => onUpdateClipTiming(clip.id, { keepAudio: e.target.checked })}
                            className="accent-indigo-500"
                          />
                          <Volume2 className="w-3 h-3 text-indigo-300" />
                          <span>Keep this video&apos;s original sound</span>
                        </label>
                      </>
                    )}
                  </div>
                );
              })()}

              {/* Title / Text Overlay Status & Quick Add */}
              <div className="pt-0.5">
                {overlay?.enabled && overlay.text ? (
                  <div className="text-[11px] text-pink-300 font-bold truncate bg-pink-950/40 px-2 py-1.5 rounded-lg border border-pink-500/40 flex items-center justify-between">
                    <span className="truncate">🏷️ Title: "{overlay.text}"</span>
                    <span className="text-[9px] uppercase font-mono text-pink-400 ml-1 shrink-0">
                      [{overlay.effect || 'outline'}]
                    </span>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectClip(clip.id);
                      if (onUpdateClipTextOverlay) {
                        onUpdateClipTextOverlay(clip.id, {
                          enabled: true,
                          text: 'TITLE HERE',
                          fontSize: 34,
                          fontStyle: 'impact',
                          textColor: '#FFFFFF',
                          effect: 'outline',
                          x: 0.5,
                          y: 0.2,
                          scale: 1.0,
                          rotation: 0,
                        });
                      }
                      onOpenSettings?.();
                    }}
                    className="w-full text-[10px] text-slate-400 hover:text-white bg-slate-950/60 hover:bg-pink-950/30 px-2 py-1 rounded-lg border border-slate-800 hover:border-pink-500/40 flex items-center justify-center space-x-1 transition-colors cursor-pointer"
                  >
                    <Plus className="w-3 h-3 text-pink-400" />
                    <span>+ Add Title Overlay</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
export const TimelineInspector = React.memo(TimelineInspectorComponent);
