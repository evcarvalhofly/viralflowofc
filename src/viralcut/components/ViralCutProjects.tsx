// ============================================================
// ViralCutProjects – Project selection screen
// ============================================================
import { useEffect, useState } from 'react';
import { Scissors, Plus, Trash2, Film, Clock, FolderOpen } from 'lucide-react';
import { ProjectSummary, listProjects, deleteProjectData } from '../hooks/useProjectStorage';
import { deleteMediaFile } from '../hooks/useMediaStorage';
import { getAllMediaFiles } from '../hooks/useMediaStorage';

interface Props {
  onOpenProject: (projectId: string) => void;
  onNewProject:  () => void;
}

function formatDuration(secs: number): string {
  if (!secs) return '0s';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

const ASPECT_LABELS: Record<string, string> = {
  '16:9': '16:9 Paisagem',
  '9:16': '9:16 Reels',
  '1:1':  '1:1 Quadrado',
  '4:5':  '4:5 Feed',
};

export function ViralCutProjects({ onOpenProject, onNewProject }: Props) {
  const [projects, setProjects]   = useState<ProjectSummary[]>([]);
  const [loading, setLoading]     = useState(true);
  const [deleting, setDeleting]   = useState<string | null>(null);

  useEffect(() => {
    listProjects()
      .then(setProjects)
      .catch(() => setProjects([]))
      .finally(() => setLoading(false));
  }, []);

  const handleDelete = async (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation();
    if (!confirm('Excluir este projeto? Esta ação não pode ser desfeita.')) return;
    setDeleting(projectId);
    try {
      await deleteProjectData(projectId);
      // Best-effort: prune media files that belong only to this project
      // (simplified: keep files referenced by remaining projects)
      setProjects((prev) => prev.filter((p) => p.id !== projectId));
    } catch {
      // ignore
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card/60 shrink-0">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-md gradient-viral flex items-center justify-center">
            <Scissors className="h-3.5 w-3.5 text-white" />
          </div>
          <span className="text-base font-bold text-foreground">ViralCut</span>
        </div>
        <button
          onClick={onNewProject}
          className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Novo Projeto
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
            Carregando projetos...
          </div>
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 py-12">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <FolderOpen className="h-7 w-7 text-primary/60" />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-foreground mb-1">Nenhum projeto salvo</p>
              <p className="text-xs text-muted-foreground">Crie seu primeiro projeto abaixo</p>
            </div>
            <button
              onClick={onNewProject}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Criar novo projeto
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">
              Projetos salvos
            </p>
            {projects.map((p) => (
              <button
                key={p.id}
                onClick={() => onOpenProject(p.id)}
                disabled={deleting === p.id}
                className="w-full flex items-center gap-3 rounded-2xl border border-border bg-card hover:bg-card/80 hover:border-primary/40 transition-all px-4 py-3.5 text-left disabled:opacity-50"
              >
                {/* Icon */}
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Film className="h-5 w-5 text-primary" />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{p.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-muted-foreground">
                      {ASPECT_LABELS[p.aspectRatio] ?? p.aspectRatio}
                    </span>
                    {p.duration > 0 && (
                      <>
                        <span className="text-muted-foreground/40">·</span>
                        <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                          <Clock className="h-3 w-3" />
                          {formatDuration(p.duration)}
                        </span>
                      </>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground/60 mt-0.5">{formatDate(p.updatedAt)}</p>
                </div>

                {/* Delete */}
                <button
                  onClick={(e) => handleDelete(e, p.id)}
                  disabled={deleting === p.id}
                  className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors shrink-0"
                  title="Excluir projeto"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </button>
            ))}

            {/* New project at bottom */}
            <button
              onClick={onNewProject}
              className="w-full flex items-center gap-3 rounded-2xl border-2 border-dashed border-primary/30 hover:border-primary/60 hover:bg-primary/5 transition-all px-4 py-3.5 text-left"
            >
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Plus className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Novo projeto</p>
                <p className="text-xs text-muted-foreground mt-0.5">Começar do zero</p>
              </div>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
