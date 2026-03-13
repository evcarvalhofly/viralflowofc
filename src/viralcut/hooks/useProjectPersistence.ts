// ============================================================
// useProjectPersistence – STRIPPED
// Autosave, localStorage restore, and JSON import/export have
// been removed for simplicity and mobile performance.
// This stub keeps the hook interface compatible so callers
// don't need immediate updates.
// ============================================================
import { useCallback } from 'react';
import { Project } from '../types';

export function useProjectPersistence(
  _project: Project,
  _onRestore: (p: Project) => void
) {
  // Clear any legacy stored data on first run
  try { localStorage.removeItem('viralcut_project_v2'); } catch { /* ignore */ }

  const saveNow = useCallback(() => {}, []);
  const exportJson = useCallback(() => {}, []);
  const importJson = useCallback((_file: File) => {}, []);

  return { saveNow, exportJson, importJson };
}
