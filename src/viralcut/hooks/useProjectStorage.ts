// ============================================================
// useProjectStorage – Multi-project IndexedDB persistence
//
// DB: viralcut_projects_v1
// Stores:
//   summaries   → { id, name, aspectRatio, updatedAt }
//   project_data → full Project JSON (tracks, settings)
//   media_meta  → MediaMeta[] per projectId
//
// Media binary files live in viralcut_media_v1 (useMediaStorage)
// ============================================================

import { Project } from '../types';

const DB_NAME    = 'viralcut_projects_v1';
const DB_VERSION = 1;

export interface ProjectSummary {
  id:          string;
  name:        string;
  aspectRatio: string;
  duration:    number;
  updatedAt:   number;
}

export type MediaMeta = {
  id:           string;
  name:         string;
  type:         'video' | 'audio' | 'image';
  duration:     number;
  thumbnail?:   string;
  width?:       number;
  height?:      number;
  orientation?: 'portrait' | 'landscape' | 'square';
};

// ── DB open ────────────────────────────────────────────────

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('summaries'))    db.createObjectStore('summaries');
      if (!db.objectStoreNames.contains('project_data')) db.createObjectStore('project_data');
      if (!db.objectStoreNames.contains('media_meta'))   db.createObjectStore('media_meta');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

// ── Public API ─────────────────────────────────────────────

/** Return all project summaries sorted by updatedAt desc. */
export async function listProjects(): Promise<ProjectSummary[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx    = db.transaction('summaries', 'readonly');
    const store = tx.objectStore('summaries');
    const req   = store.getAll();
    req.onsuccess = () => {
      db.close();
      const all = (req.result as ProjectSummary[]).sort((a, b) => b.updatedAt - a.updatedAt);
      resolve(all);
    };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

/** Save (upsert) a project and its media metadata. */
export async function saveProjectData(
  project:   Project,
  mediaMeta: MediaMeta[]
): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx   = db.transaction(['summaries', 'project_data', 'media_meta'], 'readwrite');
    const summary: ProjectSummary = {
      id:          project.id,
      name:        project.name,
      aspectRatio: project.aspectRatio,
      duration:    project.duration,
      updatedAt:   Date.now(),
    };
    tx.objectStore('summaries').put(summary, project.id);
    tx.objectStore('project_data').put(project, project.id);
    tx.objectStore('media_meta').put(mediaMeta, project.id);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror    = () => { db.close(); reject(tx.error); };
  });
}

/** Load full project + media metadata by projectId. */
export async function loadProjectData(
  projectId: string
): Promise<{ project: Project; mediaMeta: MediaMeta[] } | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx         = db.transaction(['project_data', 'media_meta'], 'readonly');
    let project:   Project | null   = null;
    let mediaMeta: MediaMeta[] | null = null;

    const reqP = tx.objectStore('project_data').get(projectId);
    reqP.onsuccess = () => { project = reqP.result ?? null; };

    const reqM = tx.objectStore('media_meta').get(projectId);
    reqM.onsuccess = () => { mediaMeta = reqM.result ?? []; };

    tx.oncomplete = () => {
      db.close();
      if (!project) { resolve(null); return; }
      resolve({ project, mediaMeta: mediaMeta ?? [] });
    };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

/** Delete a project (summary + data + media meta). Media files are pruned separately. */
export async function deleteProjectData(projectId: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['summaries', 'project_data', 'media_meta'], 'readwrite');
    tx.objectStore('summaries').delete(projectId);
    tx.objectStore('project_data').delete(projectId);
    tx.objectStore('media_meta').delete(projectId);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror    = () => { db.close(); reject(tx.error); };
  });
}
