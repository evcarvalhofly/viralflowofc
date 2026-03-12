// ============================================================
// useProjectPersistence – Manual save + JSON export/import
//
// AUTOSAVE REMOVED: automatic restore and debounced save have
// been deliberately removed to keep the editor clean on open
// and avoid restoring broken/stale projects during testing.
//
// Persistence strategy:
//   • saveNow()   – explicit manual save (Ctrl+S / toolbar button)
//   • exportJson  – download full project as .json
//   • importJson  – load project from a .json file
// ============================================================
import { useCallback } from 'react';
import { Project } from '../types';

// Clear any legacy autosave keys left over from previous versions
const LEGACY_KEYS = [
  'viralcut_project_v1',
  'viralcut_project_v2',
  'viralcut_autosave',
  'viralcut_last_project',
];

function clearLegacyStorage() {
  for (const key of LEGACY_KEYS) {
    try { localStorage.removeItem(key); } catch { /* ignore */ }
  }
}

// Run once on module load so stale data is gone immediately
clearLegacyStorage();

export function useProjectPersistence(
  project: Project,
  // onRestore kept in signature for API compatibility (JSON import still uses it)
  onRestore: (p: Project) => void
) {
  // ── Manual save ──────────────────────────────────────────
  const saveNow = useCallback(() => {
    try {
      localStorage.setItem('viralcut_manual_save', JSON.stringify(project));
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
