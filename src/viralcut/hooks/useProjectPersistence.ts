// ============================================================
// useProjectPersistence – Autosave + restore + JSON export/import
// Uses localStorage with debounce.  MediaFile.file/url are NOT
// persisted (File objects can't be serialised); only metadata.
// ============================================================
import { useEffect, useRef, useCallback } from 'react';
import { Project } from '../types';

const STORAGE_KEY = 'viralcut_project_v2';
const DEBOUNCE_MS = 1200;

type SerializableProject = Omit<Project, 'tracks'> & {
  tracks: typeof Project.prototype.tracks;
};

export function useProjectPersistence(
  project: Project,
  onRestore: (p: Project) => void
) {
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasRestoredRef = useRef(false);

  // ── Restore once on mount ────────────────────────────────
  useEffect(() => {
    if (hasRestoredRef.current) return;
    hasRestoredRef.current = true;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as Project;
      // Basic shape validation
      if (saved?.tracks && Array.isArray(saved.tracks) && saved.id) {
        // Clean up any stale object URLs that were persisted by accident
        const cleaned: Project = {
          ...saved,
          tracks: saved.tracks.map((t) => ({
            ...t,
            items: t.items.map((i) => ({ ...i })),
          })),
        };
        onRestore(cleaned);
      }
    } catch {
      // Corrupted data – silently skip
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Debounced autosave whenever project changes ───────────
  useEffect(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      try {
        // Persist only serialisable data (no File objects)
        const serialisable: Project = {
          ...project,
          tracks: project.tracks.map((t) => ({
            ...t,
            items: t.items.map((i) => {
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              const { ...rest } = i;
              return rest;
            }),
          })),
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(serialisable));
      } catch {
        // Storage full or private mode – ignore
      }
    }, DEBOUNCE_MS);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [project]);

  // ── Manual save ──────────────────────────────────────────
  const saveNow = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
    } catch { /* ignore */ }
  }, [project]);

  // ── Export to .json file ─────────────────────────────────
  const exportJson = useCallback(() => {
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.name.replace(/\s+/g, '_')}_viralcut.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }, [project]);

  // ── Import from .json file ───────────────────────────────
  const importJson = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target?.result as string) as Project;
        if (parsed?.tracks && Array.isArray(parsed.tracks)) {
          onRestore(parsed);
        }
      } catch {
        alert('Arquivo inválido. Certifique-se de importar um projeto .json do ViralCut.');
      }
    };
    reader.readAsText(file);
  }, [onRestore]);

  return { saveNow, exportJson, importJson };
}
