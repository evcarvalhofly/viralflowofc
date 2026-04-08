// ============================================================
// useProjectPersistence – Autosave via localStorage
// Saves project JSON (tracks + metadata, NO media files) with
// 2s debounce. Restores on mount if a saved state exists.
// ============================================================
import { useCallback, useEffect, useRef } from 'react';
import { Project } from '../types';
import { toast } from 'sonner';

const STORAGE_KEY = 'viralcut_project_v3';
const DEBOUNCE_MS = 2000;

export function useProjectPersistence(
  project: Project,
  onRestore: (p: Project) => void
) {
  const timerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRef = useRef(true);

  // On mount: attempt to restore a previously saved project
  useEffect(() => {
    // Clear legacy key from old stub
    try { localStorage.removeItem('viralcut_project_v2'); } catch { /* ignore */ }
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as Project;
        if (saved?.tracks && Array.isArray(saved.tracks)) {
          onRestore(saved);
          toast.info('Projeto anterior restaurado automaticamente.');
        }
      }
    } catch {
      try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Autosave with debounce whenever project changes
  useEffect(() => {
    if (isFirstRef.current) {
      isFirstRef.current = false;
      return;
    }
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
      } catch { /* storage quota or private browsing */ }
    }, DEBOUNCE_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [project]);

  const saveNow = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
      toast.success('Projeto salvo.');
    } catch {
      toast.error('Não foi possível salvar o projeto.');
    }
  }, [project]);

  const exportJson = useCallback(() => {
    try {
      const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `${project.name || 'projeto'}.vcproject`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Erro ao exportar projeto.');
    }
  }, [project]);

  const importJson = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target?.result as string) as Project;
        if (!parsed?.tracks || !Array.isArray(parsed.tracks)) {
          toast.error('Arquivo inválido: não é um projeto ViralCut.');
          return;
        }
        onRestore(parsed);
        toast.success('Projeto importado com sucesso!');
      } catch {
        toast.error('Erro ao ler o arquivo de projeto.');
      }
    };
    reader.readAsText(file);
  }, [onRestore]);

  return { saveNow, exportJson, importJson };
}
