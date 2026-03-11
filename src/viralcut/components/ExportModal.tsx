// ============================================================
// ExportModal – Export panel with FFmpeg progress
// ============================================================
import { X, Download, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ExportState, Project } from '../types';
import { cn } from '@/lib/utils';

interface ExportModalProps {
  open: boolean;
  onClose: () => void;
  onExport: (opts: ExportOptions) => void;
  exportState: ExportState;
  project: Project;
}

export interface ExportOptions {
  resolution: '1080p' | '720p' | '480p';
  fps: 30 | 60;
  format: 'mp4' | 'webm';
}

export function ExportModal({ open, onClose, onExport, exportState, project }: ExportModalProps) {
  if (!open) return null;

  const busy = exportState.status === 'preparing' || exportState.status === 'encoding';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={!busy ? onClose : undefined} />
      <div className="relative z-10 bg-card border border-border rounded-2xl w-full max-w-sm mx-4 overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Download className="h-4 w-4 text-primary" />
            <span className="font-semibold text-foreground text-sm">Exportar vídeo</span>
          </div>
          {!busy && (
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1 rounded transition-colors">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Progress bar when busy */}
          {busy && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{exportState.label}</span>
                <span>{exportState.progress}%</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full gradient-viral rounded-full transition-all duration-300"
                  style={{ width: `${exportState.progress}%` }}
                />
              </div>
            </div>
          )}

          {exportState.status === 'done' && (
            <div className="rounded-xl bg-primary/10 border border-primary/30 px-4 py-3 text-sm text-primary text-center">
              ✓ Download iniciado!
            </div>
          )}

          {exportState.status === 'error' && (
            <div className="rounded-xl bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm text-destructive text-center">
              {exportState.error ?? 'Erro ao exportar'}
            </div>
          )}

          {!busy && exportState.status !== 'done' && (
            <>
              <div className="space-y-1">
                <p className="text-xs font-medium text-foreground">Projeto</p>
                <p className="text-xs text-muted-foreground">{project.name}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-muted/60 p-3 text-center">
                  <p className="text-xs text-muted-foreground">Resolução</p>
                  <p className="text-sm font-semibold text-foreground mt-0.5">1080p</p>
                </div>
                <div className="rounded-lg bg-muted/60 p-3 text-center">
                  <p className="text-xs text-muted-foreground">Formato</p>
                  <p className="text-sm font-semibold text-foreground mt-0.5">MP4</p>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {!busy && exportState.status !== 'done' && (
          <div className="px-5 pb-5">
            <Button
              className="w-full gradient-viral text-white border-0 gap-2"
              onClick={() => onExport({ resolution: '1080p', fps: 30, format: 'mp4' })}
            >
              <Download className="h-4 w-4" />
              Exportar MP4
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
