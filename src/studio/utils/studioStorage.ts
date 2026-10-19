import {
  VideoProject,
  MediaItem,
  AudioSettings,
  AspectRatio,
  ColorFilterType,
  CaptionStyle,
  TransitionType,
  MotionType,
  SubtitleConfig,
} from '../types';

// The studio project is saved in IndexedDB (not localStorage) because uploaded photos/videos are real
// Blobs that can be tens of MB. This is what lets a project survive a reload AND the full-page round-trip
// to Stripe Checkout and back, exactly like the previous editor did.
//
// Remote images (e.g. industry presets) are saved by URL only. Uploaded files, voiceovers and uploaded music
// are saved as Blobs and given a fresh blob: URL on restore.

const DB_NAME = 'reelcraft-studio';
const DB_VERSION = 1;
const STORE_NAME = 'project';
const RECORD_ID = 'current';

export interface StudioSnapshot {
  prompt: string;
  project: VideoProject;
  mediaItems: MediaItem[];
  audioSettings: AudioSettings;
  aspectRatio: AspectRatio;
  colorFilter: ColorFilterType;
  captionStyle: CaptionStyle;
  preferredTransition: TransitionType;
  preferredMotion: MotionType;
  voicePersona: string;
  subtitleConfig: SubtitleConfig;
}

interface StoredRecord {
  id: string;
  snapshot: StudioSnapshot; // with blob: URLs stripped
  mediaBlobs: Record<string, Blob>; // mediaItem.id -> file
  voiceoverBlob?: Blob;
  musicBlob?: Blob;
  savedAt: string;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not available in this browser.'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function blobFromUrl(url: string): Promise<Blob | null> {
  try {
    const res = await fetch(url);
    return await res.blob();
  } catch {
    return null;
  }
}

export async function saveStudioProject(snapshot: StudioSnapshot): Promise<void> {
  try {
    const mediaBlobs: Record<string, Blob> = {};
    const mediaItems: MediaItem[] = [];
    for (const item of snapshot.mediaItems) {
      if (item.url.startsWith('blob:')) {
        const blob = item.file || (await blobFromUrl(item.url));
        if (blob) {
          mediaBlobs[item.id] = blob;
          mediaItems.push({ ...item, url: '', file: undefined, thumbnail: undefined });
        }
        // if the blob could not be read the item is dropped from the saved copy rather than saved broken
      } else {
        mediaItems.push({ ...item, file: undefined });
      }
    }

    let voiceoverBlob: Blob | undefined;
    let voiceover = snapshot.audioSettings.voiceover;
    if (voiceover.url && (voiceover.url.startsWith('blob:') || voiceover.url.startsWith('data:'))) {
      const blob = await blobFromUrl(voiceover.url);
      if (blob) {
        voiceoverBlob = blob;
        voiceover = { ...voiceover, url: null };
      }
    }

    let musicBlob: Blob | undefined;
    let music = snapshot.audioSettings.music;
    if (music.url && music.url.startsWith('blob:')) {
      const blob = await blobFromUrl(music.url);
      if (blob) {
        musicBlob = blob;
        music = { ...music, url: null };
      }
    }

    const record: StoredRecord = {
      id: RECORD_ID,
      snapshot: { ...snapshot, mediaItems, audioSettings: { ...snapshot.audioSettings, voiceover, music } },
      mediaBlobs,
      voiceoverBlob,
      musicBlob,
      savedAt: new Date().toISOString(),
    };

    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch (err) {
    // Saving must never break editing - the in-memory session still works.
    console.error('Failed to save studio project:', err);
  }
}

async function readRecord(): Promise<StoredRecord | undefined> {
  const db = await openDb();
  const record = await new Promise<StoredRecord | undefined>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(RECORD_ID);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return record;
}

/** Cheap check used by the landing page to decide whether to skip straight into the studio. */
export async function hasSavedStudioProject(): Promise<boolean> {
  try {
    const record = await readRecord();
    return !!record && record.snapshot.project.clips.length > 0;
  } catch {
    return false;
  }
}

export async function loadStudioProject(): Promise<StudioSnapshot | null> {
  try {
    const record = await readRecord();
    if (!record || record.snapshot.project.clips.length === 0) return null;

    const snap = record.snapshot;
    const mediaItems = snap.mediaItems.map((item) => {
      const blob = record.mediaBlobs[item.id];
      return blob ? { ...item, url: URL.createObjectURL(blob), file: blob instanceof File ? blob : undefined } : item;
    });

    const voiceover = record.voiceoverBlob
      ? { ...snap.audioSettings.voiceover, url: URL.createObjectURL(record.voiceoverBlob) }
      : snap.audioSettings.voiceover;
    const music = record.musicBlob
      ? { ...snap.audioSettings.music, url: URL.createObjectURL(record.musicBlob) }
      : snap.audioSettings.music;

    return { ...snap, mediaItems, audioSettings: { ...snap.audioSettings, voiceover, music } };
  } catch (err) {
    console.error('Failed to load studio project:', err);
    return null;
  }
}

export async function clearStudioProject(): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(RECORD_ID);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch (err) {
    console.error('Failed to clear studio project:', err);
  }
}
