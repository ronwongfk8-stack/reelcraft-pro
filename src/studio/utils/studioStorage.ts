import {
  VideoProject,
  MediaItem,
  LogoSettings,
  AudioSettings,
  AspectRatio,
  ColorFilterType,
  CaptionStyle,
  NarrationState,
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
// Phone videos can be hundreds of MB. Browsers cap what a site may store, and one oversized write would
// make the whole autosave fail, so videos above this size are kept in memory only (not restored after a reload).
const MAX_SAVED_VIDEO_BYTES = 150 * 1024 * 1024;

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
  narration?: NarrationState | null;
  logo?: LogoSettings;
  /** Set on load: how many videos were too large to be saved. */
  droppedLargeMedia?: number;
}

interface StoredRecord {
  id: string;
  snapshot: StudioSnapshot; // with blob: URLs stripped
  mediaBlobs: Record<string, Blob>; // mediaItem.id -> file
  voiceoverBlob?: Blob;
  musicBlob?: Blob;
  logoBlob?: Blob;
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
    const droppedIds = new Set<string>();
    for (const item of snapshot.mediaItems) {
      if (item.url.startsWith('blob:')) {
        const blob = item.file || (await blobFromUrl(item.url));
        if (blob && item.type === 'video' && blob.size > MAX_SAVED_VIDEO_BYTES) {
          droppedIds.add(item.id);
          continue;
        }
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

    // Clips that point at a video we could not save are removed (and the rest re-packed) so nothing restores blank.
    let project = snapshot.project;
    if (droppedIds.size > 0) {
      let t = 0;
      const keptClips = project.clips
        .filter((c) => !droppedIds.has(c.mediaId))
        .map((c) => {
          const out = { ...c, startTime: Number(t.toFixed(2)) };
          t += c.duration;
          return out;
        });
      project = {
        ...project,
        clips: keptClips,
        captions: project.captions.filter((cap) => cap.startTime < t),
        totalDuration: Number(t.toFixed(2)),
      };
    }

    let logoBlob: Blob | undefined;
    let logo = snapshot.logo;
    if (logo?.url && logo.url.startsWith('blob:')) {
      const blob = await blobFromUrl(logo.url);
      if (blob) {
        logoBlob = blob;
        logo = { ...logo, url: null };
      }
    }

    const record: StoredRecord & { droppedLargeMedia?: number } = {
      id: RECORD_ID,
      droppedLargeMedia: droppedIds.size,
      snapshot: { ...snapshot, project, mediaItems, logo, audioSettings: { ...snapshot.audioSettings, voiceover, music } },
      mediaBlobs,
      voiceoverBlob,
      musicBlob,
      logoBlob,
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

    return {
      ...snap,
      mediaItems,
      audioSettings: { ...snap.audioSettings, voiceover, music },
      logo: record.logoBlob && snap.logo ? { ...snap.logo, url: URL.createObjectURL(record.logoBlob) } : snap.logo,
      droppedLargeMedia: (record as any).droppedLargeMedia || 0,
    };
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
