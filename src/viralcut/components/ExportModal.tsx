// ============================================================
// ExportModal – Export panel with resolution + fps + quality options
// ============================================================
import { useState } from 'react';
import { X, Download, Film, Gauge, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ExportState, Project } from '../types';
import { cn } from '@/lib/utils';
import { getExportDimensions } from '../export3/mediaBunnyUtils';

interface ExportModalProps {
  open: boolean;
  onClose: () => void;
  onExport: (opts: ExportOptions) => void;
  exportState: ExportState;
  project: Project;
}

export interface ExportOptions {
  resolution: '1080p' | '720p';
  fps: 30 | 60;
  format: 'mp4';
  quality: 'low' | 'medium' | 'high';
}

type Res = '1080p' | '720p';
type Fps = 30 | 60;
type Quality = 'low' | 'medium' | 'high';

export function ExportModal({ open, onClose, onExport, exportState, project }: ExportModalProps) {
  const [resolution, setResolution] = useState<Res>('1080p');
  const [fps, setFps] = useState<Fps>(30);
  const [quality, setQuality] = useState<Quality>('medium');

  if (!open) return null;

  const busy = exportState.status === 'preparing' || exportState.status === 'encoding';
  const done = exportState.status === 'done';
  const hasError = exportState.status === 'error';

  const dim1080 = getExportDimensions(project, '1080p');
  const dim720 = getExportDimensions(project, '720p');

  const resOptions: { label: string; value: Res; sub: string }[] = [
    { label: '1080p', value: '1080p', sub: `${dim1080.width} × ${dim1080.height}` },
    { label: '720p',  value: '720p',  sub: `${dim720.width} × ${dim720.height}` },
  ];

  const fpsOptions: { label: string; value: Fps; sub: string }[] = [
    { label: '30 fps', value: 30, sub: 'Padrão' },
    { label: '60 fps', value: 60, sub: 'Suave' },
  ];

  const qualityOptions: { label: string; value: Quality; sub: string }[] = [
    { label: 'Menor arquivo', value: 'low',    sub: 'Upload mais rápido' },
    { label: 'Equilibrado',   value: 'medium', sub: 'Recomendado' },
    { label: 'Alta qualidade',value: 'high',   sub: 'Arquivo maior' },
  ];

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

          {/* Progress */}
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
              <p className="text-[10px] text-muted-foreground text-center">
                Não feche esta janela durante a exportação
              </p>
            </div>
          )}

          {done && (
            <div className="rounded-xl bg-primary/10 border border-primary/30 px-4 py-3 text-sm text-primary text-center font-medium">
              ✓ Download iniciado com sucesso!
            </div>
          )}

          {hasError && (
            <div className="rounded-xl bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm text-destructive text-center">
              {exportState.error ?? 'Erro ao exportar'}
            </div>
          )}

          {!busy && !done && (
            <>
              {/* Project info */}
              <div className="rounded-xl bg-muted/40 px-4 py-3">
                <p className="text-xs text-muted-foreground">Projeto · MP4 (TikTok, Instagram, YouTube, Facebook)</p>
                <p className="text-sm font-semibold text-foreground mt-0.5 truncate">{project.name}</p>
              </div>

              {/* Resolution */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <Film className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-semibold text-foreground">Resolução</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {resOptions.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setResolution(opt.value)}
                      className={cn(
                        'rounded-xl border-2 px-3 py-2.5 text-left transition-all',
                        resolution === opt.value
                          ? 'border-primary bg-primary/10'
                          : 'border-border bg-muted/30 hover:border-border/80'
                      )}
                    >
                      <p className={cn('text-sm font-bold', resolution === opt.value ? 'text-primary' : 'text-foreground')}>
                        {opt.label}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{opt.sub}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* FPS */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <Gauge className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-semibold text-foreground">Taxa de quadros</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {fpsOptions.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setFps(opt.value)}
                      className={cn(
                        'rounded-xl border-2 px-3 py-2.5 text-left transition-all',
                        fps === opt.value
                          ? 'border-primary bg-primary/10'
                          : 'border-border bg-muted/30 hover:border-border/80'
                      )}
                    >
                      <p className={cn('text-sm font-bold', fps === opt.value ? 'text-primary' : 'text-foreground')}>
                        {opt.label}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{opt.sub}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Quality */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-semibold text-foreground">Qualidade</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {qualityOptions.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setQuality(opt.value)}
                      className={cn(
                        'relative rounded-xl border-2 px-2 py-2.5 text-left transition-all',
                        quality === opt.value
                          ? 'border-primary bg-primary/10'
                          : 'border-border bg-muted/30 hover:border-border/80'
                      )}
                    >
                      {opt.value === 'medium' && (
                        <span className="absolute -top-2 right-1.5 bg-emerald-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                          padrão
                        </span>
                      )}
                      <p className={cn('text-xs font-bold leading-tight', quality === opt.value ? 'text-primary' : 'text-foreground')}>
                        {opt.label}
                      </p>
                      <p className="text-[9px] text-muted-foreground mt-0.5 leading-tight">{opt.sub}</p>
                    </button>
                  ))}
                </div>
              </div>

              <p className="text-[10px] text-muted-foreground bg-muted/40 rounded-lg px-3 py-2">
                ℹ️ Todas as edições serão aplicadas (cortes, velocidade, filtros).
              </p>
            </>
          )}
        </div>

        {/* Footer */}
        {!busy && !done && (
          <div className="px-5 pb-5">
            <Button
              className="w-full gradient-viral text-white border-0 gap-2 h-11"
              onClick={() => onExport({ resolution, fps, format: 'mp4', quality })}
            >
              <Download className="h-4 w-4" />
              Exportar {resolution} · {fps}fps
            </Button>
          </div>
        )}

        {done && (
          <div className="px-5 pb-5">
            <Button variant="outline" className="w-full" onClick={onClose}>
              Fechar
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
