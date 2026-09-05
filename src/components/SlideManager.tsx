import React, { useRef, useState } from 'react';
import {
  Upload,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Clock,
  Sparkles,
  MoveHorizontal,
  GripVertical,
  Image as ImageIcon
} from 'lucide-react';
import { SlideItem, TransitionType, PhotoAnimationType } from '../types';
import { getSamplePhotosWithUniqueIds, generateUniqueId } from '../data/sampleAssets';

interface SlideManagerProps {
  slides: SlideItem[];
  onUpdateSlides: (slides: SlideItem[]) => void;
  activeSlideId: string | null;
  onSelectSlide: (id: string) => void;
}

const TRANSITION_OPTIONS: { value: TransitionType; label: string; shortLabel: string }[] = [
  { value: 'slide', label: '1. Smooth Slide (Horizontal Push)', shortLabel: 'Slide' },
  { value: 'flip-book', label: '2. 3D Flip Book (Page Turn)', shortLabel: 'Flip Book' },
  { value: 'open-pic', label: '3. Open Pic (Center Iris Reveal)', shortLabel: 'Open Pic' },
  { value: 'corner-flip', label: '4. Corner Flip (Diagonal Peel)', shortLabel: 'Corner Flip' },
  { value: 'twist-flip', label: '5. Twist Flip (3D Spin & Twist)', shortLabel: 'Twist Flip' },
  { value: 'ken-burns-in', label: '6. Ken Burns Zoom In', shortLabel: 'Ken In' },
  { value: 'fade', label: '7. Soft Cross-Fade', shortLabel: 'Fade' },
];

const PHOTO_ANIMATION_OPTIONS: { value: PhotoAnimationType; label: string; shortLabel: string }[] = [
  { value: 'zoom-in', label: '1. Zoom In (Forward Push)', shortLabel: 'Zoom In' },
  { value: 'zoom-out', label: '2. Zoom Out (Pull Back)', shortLabel: 'Zoom Out' },
  { value: 'pan-in-out', label: '3. Pan In & Out (Pulse Zoom)', shortLabel: 'Pulse Zoom' },
  { value: 'pan-left-to-right', label: '4. Pan Left to Right', shortLabel: 'Pan L→R' },
  { value: 'pan-right-to-left', label: '5. Pan Right to Left', shortLabel: 'Pan R→L' },
  { value: 'pan-up', label: '6. Pan Up (Bottom to Top)', shortLabel: 'Pan Up' },
  { value: 'pan-down', label: '7. Pan Down (Top to Bottom)', shortLabel: 'Pan Down' },
  { value: 'bird-eye-view', label: '8. Bird Eye View (Drone Drift)', shortLabel: 'Bird Eye' },
];

export const SlideManager: React.FC<SlideManagerProps> = ({
  slides,
  onUpdateSlides,
  activeSlideId,
  onSelectSlide,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [draggedCardIdx, setDraggedCardIdx] = useState<number | null>(null);

  // Process File List into SlideItems
  const processFiles = async (files: FileList | File[]) => {
    const fileList = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (fileList.length === 0) return;

    const readAsDataURL = (file: File, index: number): Promise<SlideItem> => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          const url = event.target?.result as string;
          const nameWithoutExt = file.name
            .replace(/\.[^/.]+$/, '')
            .replace(/[-_]/g, ' ');
          const title =
            nameWithoutExt.charAt(0).toUpperCase() + nameWithoutExt.slice(1);
          resolve({
            id: generateUniqueId(`upload-${index}`),
            url,
            title: title || 'Property Feature',
            subtitle: 'Luxury Tour View',
            duration: 4,
            transition: 'ken-burns-in',
          });
        };
        reader.onerror = () => {
          resolve({
            id: generateUniqueId(`upload-err-${index}`),
            url: '',
            title: 'Uploaded Photo',
            subtitle: 'Property View',
            duration: 4,
            transition: 'ken-burns-in',
          });
        };
        reader.readAsDataURL(file);
      });
    };

    try {
      const uploadedSlides = await Promise.all(
        fileList.map((file, idx) => readAsDataURL(file, idx))
      );
      const validUploaded = uploadedSlides.filter((s) => s.url);
      if (validUploaded.length > 0) {
        const nextSlides = [...slides, ...validUploaded];
        onUpdateSlides(nextSlides);
        if (!activeSlideId || slides.length === 0) {
          onSelectSlide(validUploaded[0].id);
        }
      }
    } catch (err) {
      console.error('Error uploading image files:', err);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // File Input Handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
    }
  };

  // Drag & Drop Handlers for file upload area
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  // Reorder Slide Position directly
  const moveSlideToPosition = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= slides.length || fromIndex === toIndex) return;
    const updated = [...slides];
    const [movedItem] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, movedItem);
    onUpdateSlides(updated);
    onSelectSlide(movedItem.id);
  };

  // Reorder Slide Up
  const moveSlideUp = (index: number) => {
    moveSlideToPosition(index, index - 1);
  };

  // Reorder Slide Down
  const moveSlideDown = (index: number) => {
    moveSlideToPosition(index, index + 1);
  };

  // Card Drag & Drop reordering handlers
  const handleCardDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleCardDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (draggedCardIdx !== null && draggedCardIdx !== targetIndex) {
      moveSlideToPosition(draggedCardIdx, targetIndex);
    }
    setDraggedCardIdx(null);
  };

  // Delete Slide
  const deleteSlide = (id: string) => {
    const nextSlides = slides.filter((s) => s.id !== id);
    onUpdateSlides(nextSlides);
    if (activeSlideId === id) {
      onSelectSlide(nextSlides[0]?.id || null);
    }
  };

  // Delete ALL slides at once, with a confirmation to avoid accidental data loss.
  const deleteAllSlides = () => {
    if (slides.length === 0) return;
    const confirmed = window.confirm(
      `Remove all ${slides.length} photo${slides.length === 1 ? '' : 's'}? This can't be undone.`
    );
    if (!confirmed) return;
    onUpdateSlides([]);
    onSelectSlide(null);
  };

  // Update Individual Slide Property
  const updateSlideProp = (id: string, key: keyof SlideItem, value: any) => {
    onUpdateSlides(
      slides.map((s) => (s.id === id ? { ...s, [key]: value } : s))
    );
  };

  // Apply Selected Transition to ALL slides
  const handleApplyTransitionToAll = (transitionType: TransitionType) => {
    onUpdateSlides(slides.map((s) => ({ ...s, transition: transitionType })));
  };

  // Apply Selected Photo Animation to ALL slides
  const handleApplyAnimationToAll = (animType: PhotoAnimationType) => {
    onUpdateSlides(slides.map((s) => ({ ...s, animation: animType })));
  };

  // Populate Sample Photos with guaranteed unique IDs
  const handleAddSamplePhotos = () => {
    const newSamples = getSamplePhotosWithUniqueIds();
    const next = [...slides, ...newSamples];
    onUpdateSlides(next);
    if (!activeSlideId && newSamples.length > 0) {
      onSelectSlide(newSamples[0].id);
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`bg-slate-900 border rounded-2xl p-4 md:p-5 flex flex-col gap-4 shadow-xl transition-all relative ${
        isDragging
          ? 'border-amber-500 bg-amber-500/5 ring-2 ring-amber-500/30'
          : 'border-slate-800'
      }`}
    >
      {/* Drag Overlay Notice */}
      {isDragging && (
        <div className="absolute inset-0 z-30 bg-slate-950/90 backdrop-blur-sm rounded-2xl flex flex-col items-center justify-center p-6 border-2 border-dashed border-amber-500 text-amber-400 pointer-events-none">
          <Upload className="w-12 h-12 mb-2 animate-bounce text-amber-400" />
          <p className="text-base font-bold text-white">Drop Property Photos Here</p>
          <p className="text-xs text-amber-300 mt-1">Upload multiple PNG, JPG, or WEBP images</p>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
        <div>
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <ImageIcon className="w-4 h-4 text-amber-400" />
            <span>Property Photos & Sequence ({slides.length})</span>
          </h2>
          <p className="text-xs text-slate-400">
            Drag cards, reorder sequence, set photo durations & transition effects
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Batch Apply Transition & Animation to ALL Photos */}
          {slides.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 bg-slate-950/80 border border-slate-800 rounded-lg px-2 py-1">
              <MoveHorizontal className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-[11px] font-semibold text-slate-300">Set All:</span>
              <select
                defaultValue=""
                onChange={(e) => {
                  if (e.target.value) {
                    handleApplyTransitionToAll(e.target.value as TransitionType);
                    e.target.value = "";
                  }
                }}
                className="bg-slate-900 text-xs font-semibold text-amber-300 border border-slate-700 rounded px-2 py-0.5 focus:outline-none focus:border-amber-500 cursor-pointer"
              >
                <option value="" disabled>Transition for All...</option>
                {TRANSITION_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>

              <select
                defaultValue=""
                onChange={(e) => {
                  if (e.target.value) {
                    handleApplyAnimationToAll(e.target.value as PhotoAnimationType);
                    e.target.value = "";
                  }
                }}
                className="bg-slate-900 text-xs font-semibold text-amber-400 border border-slate-700 rounded px-2 py-0.5 focus:outline-none focus:border-amber-500 cursor-pointer"
              >
                <option value="" disabled>Animation for All...</option>
                {PHOTO_ANIMATION_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            onClick={handleAddSamplePhotos}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-amber-400 text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-700 transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Add Sample Photos</span>
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold px-3 py-1.5 rounded-lg shadow transition-colors"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload Multi Images</span>
          </button>

          {slides.length > 0 && (
            <button
              onClick={deleteAllSlides}
              className="flex items-center gap-1.5 bg-slate-800 hover:bg-red-900/40 text-red-400 text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-700 hover:border-red-800 transition-colors"
              title="Remove all photos from this project"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete All</span>
            </button>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileUpload}
            className="hidden"
          />
        </div>
      </div>

      {/* Slide Cards List */}
      {slides.length === 0 ? (
        <div
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-slate-800 hover:border-amber-500/50 rounded-xl p-8 text-center cursor-pointer transition-colors bg-slate-950/40"
        >
          <Upload className="w-10 h-10 text-slate-500 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-300">
            Drop or Select Multiple Property Photos
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Supports PNG, JPG, WEBP. Upload exterior, interior, kitchen, bedrooms & amenities.
          </p>
        </div>
      ) : (
        <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
          {slides.map((slide, idx) => {
            const isActive = slide.id === activeSlideId;
            const isBeingDragged = draggedCardIdx === idx;
            return (
              <div
                key={slide.id}
                onDragOver={(e) => handleCardDragOver(e, idx)}
                onDrop={(e) => handleCardDrop(e, idx)}
                onClick={() => onSelectSlide(slide.id)}
                className={`p-3 rounded-xl border transition-all bg-slate-950/60 cursor-pointer ${
                  isBeingDragged ? 'opacity-40 border-dashed border-amber-500' : ''
                } ${
                  isActive
                    ? 'border-amber-500 ring-1 ring-amber-500/50 shadow-md shadow-amber-500/10'
                    : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                  {/* Drag Handle & Position Indicator */}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <div
                      draggable
                      onDragStart={(e) => {
                        e.stopPropagation();
                        setDraggedCardIdx(idx);
                        e.dataTransfer.effectAllowed = 'move';
                      }}
                      onDragEnd={() => setDraggedCardIdx(null)}
                      title="Drag to reorder sequence"
                      className="cursor-grab active:cursor-grabbing text-slate-500 hover:text-amber-400 p-1"
                    >
                      <GripVertical className="w-4 h-4" />
                    </div>

                    {/* Thumbnail Preview with position badge */}
                    <div className="relative w-24 h-16 rounded-lg overflow-hidden bg-slate-900 border border-slate-800 flex-shrink-0 group">
                      <img
                        src={slide.url}
                        alt={slide.title}
                        className="w-full h-full object-cover"
                      />
                      <span className="absolute bottom-1 left-1 bg-slate-950/85 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow">
                        #{idx + 1}
                      </span>
                    </div>
                  </div>

                  {/* Text Inputs & Controls */}
                  <div className="flex-1 space-y-2 w-full">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-semibold text-slate-400 block mb-0.5">
                          Slide Title / Caption Line 1
                        </label>
                        <input
                          type="text"
                          value={slide.title}
                          draggable={false}
                          onFocus={() => onSelectSlide(slide.id)}
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectSlide(slide.id);
                          }}
                          onChange={(e) => updateSlideProp(slide.id, 'title', e.target.value)}
                          className="w-full bg-slate-900 text-xs text-slate-200 border border-slate-800 rounded px-2 py-1 focus:outline-none focus:border-amber-500"
                          placeholder="e.g. Grand Living Area"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-semibold text-slate-400 block mb-0.5">
                          Subtitle / Highlight Line 2
                        </label>
                        <input
                          type="text"
                          value={slide.subtitle}
                          draggable={false}
                          onFocus={() => onSelectSlide(slide.id)}
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectSlide(slide.id);
                          }}
                          onChange={(e) => updateSlideProp(slide.id, 'subtitle', e.target.value)}
                          className="w-full bg-slate-900 text-xs text-slate-200 border border-slate-800 rounded px-2 py-1 focus:outline-none focus:border-amber-500"
                          placeholder="e.g. High Ceilings & Natural Light"
                        />
                      </div>
                    </div>

                    {/* Transition & Photo Animation Selectors */}
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {/* Position Selector Dropdown */}
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <span className="text-[10px] font-medium text-slate-400">Pos:</span>
                        <select
                          value={idx}
                          onChange={(e) => moveSlideToPosition(idx, parseInt(e.target.value))}
                          className="bg-slate-900 text-xs font-bold text-amber-400 border border-slate-800 rounded px-1.5 py-0.5 focus:outline-none focus:border-amber-500"
                        >
                          {slides.map((_, pos) => (
                            <option key={pos} value={pos}>
                              #{pos + 1}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Duration */}
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <input
                          type="range"
                          min={1.5}
                          max={10}
                          step={0.5}
                          value={slide.duration}
                          draggable={false}
                          onChange={(e) => updateSlideProp(slide.id, 'duration', parseFloat(e.target.value))}
                          className="w-14 accent-amber-500 cursor-pointer h-1 bg-slate-800 rounded"
                        />
                        <span className="text-xs font-mono font-semibold text-amber-400 w-7">
                          {slide.duration}s
                        </span>
                      </div>

                      {/* Transition Dropdown */}
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <MoveHorizontal className="w-3.5 h-3.5 text-amber-400" />
                        <select
                          value={slide.transition}
                          onChange={(e) => updateSlideProp(slide.id, 'transition', e.target.value)}
                          className="bg-slate-900 text-xs font-medium text-amber-300 border border-slate-700 rounded px-2 py-0.5 focus:outline-none focus:border-amber-500 cursor-pointer"
                        >
                          {TRANSITION_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Photo Motion / Animation Dropdown */}
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <Sparkles className="w-3.5 h-3.5 text-sky-400" />
                        <select
                          value={slide.animation || 'zoom-in'}
                          onChange={(e) => updateSlideProp(slide.id, 'animation', e.target.value)}
                          className="bg-slate-900 text-xs font-medium text-sky-300 border border-slate-700 rounded px-2 py-0.5 focus:outline-none focus:border-sky-500 cursor-pointer"
                        >
                          {PHOTO_ANIMATION_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Actions (Reorder Up/Down & Delete) */}
                  <div className="flex sm:flex-col items-center gap-1 self-end sm:self-center pt-2 sm:pt-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        moveSlideUp(idx);
                      }}
                      disabled={idx === 0}
                      title="Move Up in Sequence"
                      className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-amber-400 disabled:opacity-30 disabled:hover:text-slate-400 transition-colors"
                    >
                      <ChevronUp className="w-4 h-4" />
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        moveSlideDown(idx);
                      }}
                      disabled={idx === slides.length - 1}
                      title="Move Down in Sequence"
                      className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-amber-400 disabled:opacity-30 disabled:hover:text-slate-400 transition-colors"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteSlide(slide.id);
                      }}
                      title="Delete Slide"
                      className="p-1.5 rounded hover:bg-red-500/20 text-red-400 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

