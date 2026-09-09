import { SlideItem, SubtitleConfig, AspectRatio, AudioTrackConfig } from '../types';

// Uses IndexedDB rather than localStorage because uploaded photos are
// stored as base64 data URLs, which for a real multi-photo project can
// easily run into the tens of megabytes — well past localStorage's
// typical 5–10MB per-origin quota. IndexedDB has a much higher ceiling
// and natively supports storing Blobs, which is what custom-uploaded
// music and AI-generated voiceover audio actually are (blob: URLs are
// just ephemeral references — the underlying Blob has to be stored
// separately and a fresh URL regenerated on restore).

const DB_NAME = 'reelcraft-project';
const DB_VERSION = 1;
const STORE_NAME = 'project';
const RECORD_ID = 'current';

export interface PersistedProject {
  id: string;
  slides: SlideItem[];
  subtitleConfig: SubtitleConfig;
  aspectRatio: AspectRatio;
  videoSpeed: number;
  brandingLogoUrl: string | null;
  musicTrack: AudioTrackConfig;
  voiceoverTrack: AudioTrackConfig;
  musicBlob?: Blob;
  voiceoverBlob?: Blob;
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
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Fetches a blob: URL back into an actual Blob object so it can be stored.
// Blob URLs are cheap same-origin reads, not network requests.
async function blobUrlToBlob(url: string): Promise<Blob | null> {
  try {
    const res = await fetch(url);
    return await res.blob();
  } catch (err) {
    console.warn('Could not read blob URL for persistence:', err);
    return null;
  }
}

export interface SaveProjectInput {
  slides: SlideItem[];
  subtitleConfig: SubtitleConfig;
  aspectRatio: AspectRatio;
  videoSpeed: number;
  brandingLogoUrl: string | null;
  musicTrack: AudioTrackConfig;
  voiceoverTrack: AudioTrackConfig;
}

export async function saveProject(input: SaveProjectInput): Promise<void> {
  try {
    // Custom-uploaded music and AI-generated voiceover both live behind
    // blob: URLs, which don't survive a reload — pull out the real Blob so
    // it can be stored, and strip the (soon-to-be-invalid) URL from the
    // saved metadata so we don't accidentally try to reuse a dead
    // reference on restore.
    let musicBlob: Blob | undefined;
    let musicTrackToSave = input.musicTrack;
    if (input.musicTrack.sourceType === 'custom' && input.musicTrack.fileUrl?.startsWith('blob:')) {
      const blob = await blobUrlToBlob(input.musicTrack.fileUrl);
      if (blob) {
        musicBlob = blob;
        musicTrackToSave = { ...input.musicTrack, fileUrl: null };
      }
    }

    let voiceoverBlob: Blob | undefined;
    let voiceoverTrackToSave = input.voiceoverTrack;
    if (input.voiceoverTrack.fileUrl?.startsWith('blob:')) {
      const blob = await blobUrlToBlob(input.voiceoverTrack.fileUrl);
      if (blob) {
        voiceoverBlob = blob;
        voiceoverTrackToSave = { ...input.voiceoverTrack, fileUrl: null };
      }
    }

    const record: PersistedProject = {
      id: RECORD_ID,
      slides: input.slides,
      subtitleConfig: input.subtitleConfig,
      aspectRatio: input.aspectRatio,
      videoSpeed: input.videoSpeed,
      brandingLogoUrl: input.brandingLogoUrl,
      musicTrack: musicTrackToSave,
      voiceoverTrack: voiceoverTrackToSave,
      musicBlob,
      voiceoverBlob,
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
    // Persistence failing should never break the app — the user's current
    // in-memory session still works fine, they just won't have a saved
    // copy to restore later.
    console.error('Failed to save project:', err);
  }
}

export interface LoadedProject extends SaveProjectInput {
  savedAt: string;
}

export async function loadProject(): Promise<LoadedProject | null> {
  try {
    const db = await openDb();
    const record = await new Promise<PersistedProject | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(RECORD_ID);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    db.close();

    if (!record || !record.slides || record.slides.length === 0) {
      return null;
    }

    // Regenerate fresh blob: URLs from the stored Blobs — the ones saved
    // in musicTrack/voiceoverTrack were intentionally cleared since they'd
    // be dead references from a previous session.
    let musicTrack = record.musicTrack;
    if (record.musicBlob) {
      musicTrack = { ...musicTrack, fileUrl: URL.createObjectURL(record.musicBlob) };
    }

    let voiceoverTrack = record.voiceoverTrack;
    if (record.voiceoverBlob) {
      voiceoverTrack = { ...voiceoverTrack, fileUrl: URL.createObjectURL(record.voiceoverBlob) };
    }

    return {
      slides: record.slides,
      subtitleConfig: record.subtitleConfig,
      aspectRatio: record.aspectRatio,
      videoSpeed: record.videoSpeed,
      brandingLogoUrl: record.brandingLogoUrl,
      musicTrack,
      voiceoverTrack,
      savedAt: record.savedAt,
    };
  } catch (err) {
    console.error('Failed to load saved project:', err);
    return null;
  }
}

export async function clearProject(): Promise<void> {
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
    console.error('Failed to clear saved project:', err);
  }
}
