// ============================================================
// useMediaStorage – IndexedDB persistence for media files
//
// Stores the actual File/Blob objects so the project can be
// fully restored after the browser tab is closed/reopened.
// Each file is keyed by its mediaId (stable across sessions).
// ============================================================

const DB_NAME    = 'viralcut_media_v1';
const STORE_NAME = 'files';
const DB_VERSION = 1;

// ── DB open ────────────────────────────────────────────────

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

// ── Public API ─────────────────────────────────────────────

/** Save a File/Blob to IndexedDB, keyed by mediaId. */
export async function saveMediaFile(mediaId: string, file: File): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req   = store.put(file, mediaId);
    req.onsuccess = () => { db.close(); resolve(); };
    req.onerror   = () => { db.close(); reject(req.error); };
  });
}

/** Retrieve a File from IndexedDB by mediaId. Returns null if not found. */
export async function getMediaFile(mediaId: string): Promise<File | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req   = store.get(mediaId);
    req.onsuccess = () => { db.close(); resolve(req.result ?? null); };
    req.onerror   = () => { db.close(); reject(req.error); };
  });
}

/** Retrieve all stored files as a Map<mediaId, File>. */
export async function getAllMediaFiles(): Promise<Map<string, File>> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx      = db.transaction(STORE_NAME, 'readonly');
    const store   = tx.objectStore(STORE_NAME);
    const result  = new Map<string, File>();
    const reqKeys = store.getAllKeys();
    reqKeys.onsuccess = () => {
      const keys    = reqKeys.result as string[];
      const reqVals = store.getAll();
      reqVals.onsuccess = () => {
        reqVals.result.forEach((file: File, i: number) => {
          result.set(keys[i], file);
        });
        db.close();
        resolve(result);
      };
      reqVals.onerror = () => { db.close(); reject(reqVals.error); };
    };
    reqKeys.onerror = () => { db.close(); reject(reqKeys.error); };
  });
}

/** Delete a single media file by mediaId. */
export async function deleteMediaFile(mediaId: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req   = store.delete(mediaId);
    req.onsuccess = () => { db.close(); resolve(); };
    req.onerror   = () => { db.close(); reject(req.error); };
  });
}

/** Delete all files whose mediaId is NOT in the keepIds set (orphan cleanup). */
export async function pruneOrphanMedia(keepIds: Set<string>): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx      = db.transaction(STORE_NAME, 'readwrite');
    const store   = tx.objectStore(STORE_NAME);
    const reqKeys = store.getAllKeys();
    reqKeys.onsuccess = () => {
      const keys = reqKeys.result as string[];
      let pending = 0;
      for (const key of keys) {
        if (!keepIds.has(key)) {
          pending++;
          const del = store.delete(key);
          del.onsuccess = () => { if (--pending === 0) { db.close(); resolve(); } };
          del.onerror   = () => { db.close(); reject(del.error); };
        }
      }
      if (pending === 0) { db.close(); resolve(); }
    };
    reqKeys.onerror = () => { db.close(); reject(reqKeys.error); };
  });
}
