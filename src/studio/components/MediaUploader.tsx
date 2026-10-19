import React, { useRef } from 'react';
import { Upload, Image as ImageIcon, Video, Trash2, Plus, Film } from 'lucide-react';
import { MediaItem } from '../types';

interface MediaUploaderProps {
  mediaItems: MediaItem[];
  onAddMedia: (items: MediaItem[]) => void;
  onRemoveMedia: (id: string) => void;
}

const MediaUploaderComponent: React.FC<MediaUploaderProps> = ({
  mediaItems,
  onAddMedia,
  onRemoveMedia,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newItems: MediaItem[] = [];

    Array.from(files as FileList).forEach((file: File, index: number) => {
      const isVideo = file.type.startsWith('video');
      const isImage = file.type.startsWith('image');
      if (!isImage && !isVideo) return;

      const url = URL.createObjectURL(file);
      const id = `upload-${Date.now()}-${index}`;

      newItems.push({
        id,
        name: file.name,
        type: isVideo ? 'video' : 'image',
        url,
        duration: isVideo ? 5 : 3.5,
        file,
      });
    });

    if (newItems.length > 0) {
      onAddMedia(newItems);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;

    const newItems: MediaItem[] = [];
    Array.from(files as FileList).forEach((file: File, index: number) => {
      const isVideo = file.type.startsWith('video');
      const isImage = file.type.startsWith('image');
      if (!isImage && !isVideo) return;

      const url = URL.createObjectURL(file);
      newItems.push({
        id: `drop-${Date.now()}-${index}`,
        name: file.name,
        type: isVideo ? 'video' : 'image',
        url,
        duration: isVideo ? 5 : 3.5,
        file,
      });
    });

    if (newItems.length > 0) {
      onAddMedia(newItems);
    }
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        onChange={handleFileChange}
        className="hidden"
      />

      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <Film className="w-4 h-4 text-indigo-400" />
          <h3 className="text-sm font-bold text-white">Your Media Footage</h3>
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-indigo-300 font-mono">
            {mediaItems.length} {mediaItems.length === 1 ? 'file' : 'files'}
          </span>
        </div>

        {mediaItems.length > 0 && (
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 text-xs font-semibold border border-indigo-500/30 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add More</span>
          </button>
        )}
      </div>

      {mediaItems.length === 0 ? (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-800 hover:border-indigo-500/60 rounded-xl bg-slate-950/40 hover:bg-slate-800/30 transition-all cursor-pointer text-center group"
        >
          <div className="w-11 h-11 rounded-xl bg-indigo-500/10 group-hover:bg-indigo-500/20 text-indigo-400 flex items-center justify-center mb-2.5 transition-colors">
            <Upload className="w-5 h-5 group-hover:scale-110 transition-transform" />
          </div>
          <p className="text-xs font-semibold text-slate-200">
            Drag & drop your photos and video clips here, or{' '}
            <span className="text-indigo-400 underline">browse files</span>
          </p>
          <p className="text-[10px] text-slate-500 mt-1">Supports JPG, PNG, WEBP, MP4, MOV, WEBM</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2.5 max-h-48 overflow-y-auto pr-1">
          {mediaItems.map((item, idx) => (
            <div
              key={item.id}
              className="group relative rounded-lg overflow-hidden bg-black border border-slate-800 aspect-video shadow-sm hover:border-indigo-500/70 transition-all"
            >
              {item.type === 'image' ? (
                <img
                  src={item.url}
                  alt={item.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-150"
                />
              ) : (
                <video src={item.url} className="w-full h-full object-cover" muted playsInline />
              )}

              <div className="absolute top-1 left-1 flex items-center space-x-1 px-1 py-0.5 rounded bg-black/70 text-[9px] font-mono text-white">
                {item.type === 'image' ? (
                  <ImageIcon className="w-2.5 h-2.5 text-cyan-400" />
                ) : (
                  <Video className="w-2.5 h-2.5 text-amber-400" />
                )}
                <span>#{idx + 1}</span>
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveMedia(item.id);
                }}
                className="absolute top-1 right-1 p-1 rounded bg-black/80 hover:bg-red-600 text-slate-300 hover:text-white transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
                title="Remove"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}

          {/* Add Tile */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-800 hover:border-indigo-500 text-slate-400 hover:text-indigo-300 bg-slate-950/40 aspect-video transition-colors cursor-pointer text-[10px]"
          >
            <Plus className="w-4 h-4 mb-0.5" />
            <span>Add</span>
          </button>
        </div>
      )}
    </div>
  );
};
export const MediaUploader = React.memo(MediaUploaderComponent);
