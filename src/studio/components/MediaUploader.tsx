import React, { useEffect, useRef, useState } from 'react';
import { Upload, Image as ImageIcon, Video, Trash2, Plus, Film, ClipboardPaste } from 'lucide-react';
import { MediaItem } from '../types';

interface MediaUploaderProps {
  mediaItems: MediaItem[];
  onAddMedia: (items: MediaItem[]) => void;
  onRemoveMedia: (id: string) => void;
}

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent || '');
const PASTE_SHORTCUT = isMac ? '⌘V' : 'Ctrl+V';

const LARGE_VIDEO_BYTES = 150 * 1024 * 1024;

/** Loads just the metadata of a video. Returns null if the browser can't decode it. */
const probeVideo = (url: string): Promise<{ duration: number; width: number; height: number } | null> =>
  new Promise((resolve) => {
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.muted = true;
    (v as any).playsInline = true;
    let settled = false;
    const done = (result: { duration: number; width: number; height: number } | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      v.removeAttribute('src');
      v.load();
      resolve(result);
    };
    const timer = setTimeout(() => done(null), 15000);
    v.onloadedmetadata = () =>
      // width 0 = no decodable picture (audio-only file, or a codec this browser can't show)
      done(v.videoWidth > 0 ? { duration: isFinite(v.duration) ? v.duration : 0, width: v.videoWidth, height: v.videoHeight } : null);
    v.onerror = () => done(null);
    v.src = url;
  });

const extensionFor = (mime: string) => {
  const ext = (mime.split('/')[1] || 'png').split('+')[0].replace('jpeg', 'jpg');
  return ext || 'png';
};

const MediaUploaderComponent: React.FC<MediaUploaderProps> = ({
  mediaItems,
  onAddMedia,
  onRemoveMedia,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [flash, setFlash] = useState<{ kind: 'ok' | 'info'; text: string } | null>(null);
  const flashTimer = useRef<any>(null);

  // The paste listener is registered once, so it must always call the LATEST onAddMedia
  // (the parent recreates it on every render because it closes over the current media list).
  const onAddMediaRef = useRef(onAddMedia);
  onAddMediaRef.current = onAddMedia;

  const showFlash = (kind: 'ok' | 'info', text: string) => {
    setFlash({ kind, text });
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(null), 4000);
  };

  useEffect(() => () => flashTimer.current && clearTimeout(flashTimer.current), []);

  /** One path for every way media arrives: file picker, drag & drop, and clipboard paste. */
  const addFiles = async (files: File[], source: 'picker' | 'drop' | 'paste') => {
    const stamp = Date.now();
    const time = new Date(stamp).toTimeString().slice(0, 8).replace(/:/g, '-');
    const newItems: MediaItem[] = [];
    const unreadable: string[] = [];
    let sawLargeVideo = false;

    for (let index = 0; index < files.length; index++) {
      const file = files[index];
      const isVideo = file.type.startsWith('video');
      const isImage = file.type.startsWith('image');
      if (!isImage && !isVideo) continue;

      // Screenshots are always called "image.png" by the browser - give pasted ones a unique readable name.
      const name =
        source === 'paste' && (!file.name || /^image\.\w+$/i.test(file.name) || /^clipboard\.\w+$/i.test(file.name))
          ? `Pasted ${isVideo ? 'video' : 'screenshot'} ${time}${files.length > 1 ? `-${index + 1}` : ''}.${extensionFor(file.type)}`
          : file.name;

      const url = URL.createObjectURL(file);
      let duration = 3.5;
      let width: number | undefined;
      let height: number | undefined;

      if (isVideo) {
        // Read the REAL length/size so the clip, the trim sliders and Auto-Cut know what they are working with
        const info = await probeVideo(url);
        if (!info) {
          URL.revokeObjectURL(url);
          unreadable.push(name);
          continue;
        }
        duration = info.duration > 0 ? info.duration : 5;
        width = info.width;
        height = info.height;
        if (file.size > LARGE_VIDEO_BYTES) sawLargeVideo = true;
      }

      newItems.push({
        id: `${source === 'paste' ? 'paste' : source === 'drop' ? 'drop' : 'upload'}-${stamp}-${index}`,
        name,
        type: isVideo ? 'video' : 'image',
        url,
        duration,
        width,
        height,
        file,
      });
    }

    if (newItems.length > 0) onAddMediaRef.current(newItems);

    if (unreadable.length > 0) {
      showFlash(
        'info',
        `"${unreadable[0]}"${unreadable.length > 1 ? ` and ${unreadable.length - 1} more` : ''} couldn't be read by this browser, so ${
          unreadable.length > 1 ? 'they were' : 'it was'
        } skipped. iPhone videos in HEVC format often fail on Windows - re-export as MP4 / "Most Compatible", or try Safari or Edge.`
      );
    } else if (sawLargeVideo) {
      showFlash(
        'info',
        "Large video added. It works for editing now, but it's too big to be kept if you leave this page (for example to buy credits), so you'd need to add it again."
      );
    } else if (newItems.length > 0 && source === 'paste') {
      showFlash('ok', `Pasted ${newItems.length} ${newItems.length === 1 ? 'image' : 'files'} from your clipboard.`);
    } else if (newItems.length === 0 && source === 'paste') {
      showFlash('info', 'The clipboard had no image or video. Copy a picture or take a screenshot first.');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = (e.target as HTMLInputElement).files;
    if (!files || files.length === 0) return;
    addFiles(Array.from(files as FileList), 'picker');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDrop = (e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;
    addFiles(Array.from(files as FileList), 'drop');
  };

  // Ctrl+V / ⌘V anywhere on the page: screenshots (Win+Shift+S, PrtScn, ⌘⇧4...), images copied from a
  // website or app, and files copied in File Explorer / Finder. Plain-text pastes are left alone, so the
  // prompt box keeps working normally.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const data = e.clipboardData;
      if (!data) return;

      const files: File[] = [];
      for (const item of Array.from(data.items || [])) {
        if (item.kind === 'file' && (item.type.startsWith('image/') || item.type.startsWith('video/'))) {
          const f = item.getAsFile();
          if (f) files.push(f);
        }
      }
      if (files.length === 0 && data.files?.length) {
        files.push(...(Array.from(data.files) as File[]).filter((f) => f.type.startsWith('image/') || f.type.startsWith('video/')));
      }
      if (files.length === 0) return; // normal text paste - do nothing

      e.preventDefault();
      addFiles(files, 'paste');
    };

    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Button for touch devices / people who prefer clicking. Needs the browser's clipboard permission,
  // so if that isn't available we simply point to the keyboard shortcut.
  const handlePasteButton = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      if (!navigator.clipboard || !(navigator.clipboard as any).read) throw new Error('unsupported');
      const items: any[] = await (navigator.clipboard as any).read();
      const files: File[] = [];
      for (const it of items) {
        const type = (it.types as string[]).find((t) => t.startsWith('image/'));
        if (type) {
          const blob: Blob = await it.getType(type);
          files.push(new File([blob], `clipboard.${extensionFor(type)}`, { type }));
        }
      }
      if (files.length === 0) {
        showFlash('info', 'No image found on your clipboard. Copy a picture or take a screenshot first.');
        return;
      }
      addFiles(files, 'paste');
    } catch {
      showFlash('info', `Your browser didn't allow clipboard access here. Just press ${PASTE_SHORTCUT} on this page instead.`);
    }
  };

  const PasteButton = ({ className = '' }: { className?: string }) => (
    <button
      onClick={handlePasteButton}
      title={`Paste an image from your clipboard (or press ${PASTE_SHORTCUT})`}
      className={`flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors cursor-pointer ${className}`}
    >
      <ClipboardPaste className="w-3.5 h-3.5 text-indigo-300" />
      <span>Paste</span>
    </button>
  );

  return (
    <div
      className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl"
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        onChange={handleFileChange}
        className="hidden"
      />

      <div className="flex items-center justify-between mb-3 gap-2">
        <div className="flex items-center space-x-2">
          <Film className="w-4 h-4 text-indigo-400" />
          <h3 className="text-sm font-bold text-white">Your Media Footage</h3>
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-indigo-300 font-mono">
            {mediaItems.length} {mediaItems.length === 1 ? 'file' : 'files'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <PasteButton />
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
      </div>

      {flash && (
        <p
          role="status"
          className={`mb-3 text-[11px] rounded-lg px-2.5 py-1.5 border ${
            flash.kind === 'ok'
              ? 'text-emerald-300 bg-emerald-950/50 border-emerald-800/60'
              : 'text-amber-300 bg-amber-950/50 border-amber-800/60'
          }`}
        >
          {flash.text}
        </p>
      )}

      {mediaItems.length === 0 ? (
        <div
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
          <p className="text-xs text-slate-300 mt-1.5">
            or copy an image / screenshot and press{' '}
            <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-[10px] font-mono text-indigo-300">
              {PASTE_SHORTCUT}
            </kbd>{' '}
            to paste it
          </p>
          <p className="text-[10px] text-slate-500 mt-1">Photos (JPG, PNG, WEBP) and phone videos (MP4, MOV, WEBM)</p>
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
                <video src={`${item.url}#t=0.1`} className="w-full h-full object-cover" muted playsInline preload="metadata" />
              )}

              <div className="absolute top-1 left-1 flex items-center space-x-1 px-1 py-0.5 rounded bg-black/70 text-[9px] font-mono text-white">
                {item.type === 'image' ? (
                  <ImageIcon className="w-2.5 h-2.5 text-cyan-400" />
                ) : (
                  <Video className="w-2.5 h-2.5 text-amber-400" />
                )}
                <span>#{idx + 1}</span>
                {item.type === 'video' && item.duration ? <span className="text-amber-300">{Math.round(item.duration)}s</span> : null}
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
