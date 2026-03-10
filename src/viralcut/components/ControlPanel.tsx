import { Scissors, Mic, Download, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AutoCutMode, SubtitleOptions, SubtitleStyle, SubtitlePosition } from '../types';
import { cn } from '@/lib/utils';

interface ControlPanelProps {
  mode: AutoCutMode;
  onModeChange: (m: AutoCutMode) => void;
  onAutoCut: () => void;
  onGenerateSubtitles: () => void;
  onExport: () => void;
  subtitleOptions: SubtitleOptions;
  onSubtitleOptionsChange: (o: Partial<SubtitleOptions>) => void;
  hasVideo: boolean;
  hasSegments: boolean;
  hasSubtitles: boolean;
  isAnalyzing: boolean;
  isTranscribing: boolean;
  isExporting: boolean;
  embedSubtitles: boolean;
  onEmbedSubtitlesChange: (v: boolean) => void;
}

const MODES: { value: AutoCutMode; label: string; desc: string }[] = [
  { value: 'suave', label: 'Suave', desc: 'Remove pausas longas, mantém naturalidade' },
  { value: 'medio', label: 'Médio', desc: 'Equilíbrio entre fluidez e dinamismo' },
  { value: 'agressivo', label: 'Agressivo', desc: 'Ritmo rápido, remove pausas curtas' },
];

const STYLES: { value: SubtitleStyle; label: string }[] = [
  { value: 'padrao', label: 'Padrão' },
  { value: 'caixa-alta', label: 'Caixa Alta' },
  { value: 'destaque', label: 'Destaque' },
];

const POSITIONS: { value: SubtitlePosition; label: string }[] = [
  { value: 'top', label: 'Topo' },
  { value: 'middle', label: 'Meio' },
  { value: 'bottom', label: 'Baixo' },
];

export function ControlPanel({
  mode,
  onModeChange,
  onAutoCut,
  onGenerateSubtitles,
  onExport,
  subtitleOptions,
  onSubtitleOptionsChange,
  hasVideo,
  hasSegments,
  hasSubtitles,
  isAnalyzing,
  isTranscribing,
  isExporting,
  embedSubtitles,
  onEmbedSubtitlesChange,
}: ControlPanelProps) {
  return (
    <div className="space-y-5">
      {/* Auto Cut */}
      <section className="rounded-xl bg-card border border-border p-4 space-y-3">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Scissors className="h-4 w-4 text-primary" />
          Corte Automático
        </h3>

        {/* Mode selector */}
        <div className="grid grid-cols-3 gap-2">
          {MODES.map((m) => (
            <button
              key={m.value}
              onClick={() => onModeChange(m.value)}
              className={cn(
                'rounded-lg border px-2 py-2.5 text-xs font-medium transition-all text-center',
                mode === m.value
                  ? 'border-primary bg-primary/15 text-primary'
                  : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'
              )}
            >
              <span className="block font-semibold">{m.label}</span>
              <span className="block text-[10px] mt-0.5 leading-tight opacity-70">
                {m.desc}
              </span>
            </button>
          ))}
        </div>

        <Button
          className="w-full"
          onClick={onAutoCut}
          disabled={!hasVideo || isAnalyzing || isExporting}
        >
          {isAnalyzing ? (
            <span className="flex items-center gap-2">
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
              Analisando…
            </span>
          ) : (
            <>
              <Scissors className="h-4 w-4" />
              {hasSegments ? 'Re-analisar' : 'Aplicar Corte Automático'}
            </>
          )}
        </Button>
      </section>

      {/* Subtitles */}
      <section className="rounded-xl bg-card border border-border p-4 space-y-3">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Mic className="h-4 w-4 text-accent" />
          Legenda Automática
        </h3>

        <Button
          variant="outline"
          className="w-full"
          onClick={onGenerateSubtitles}
          disabled={!hasVideo || isTranscribing || isExporting}
        >
          {isTranscribing ? (
            <span className="flex items-center gap-2">
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
              Transcrevendo…
            </span>
          ) : (
            <>
              <Mic className="h-4 w-4" />
              {hasSubtitles ? 'Re-gerar Legenda' : 'Gerar Legenda'}
            </>
          )}
        </Button>

        {hasSubtitles && (
          <div className="space-y-3 pt-1">
            {/* Style */}
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1.5">
                Estilo
              </label>
              <div className="flex gap-1.5">
                {STYLES.map((s) => (
                  <button
                    key={s.value}
                    onClick={() => onSubtitleOptionsChange({ style: s.value })}
                    className={cn(
                      'flex-1 rounded-md border px-2 py-1.5 text-xs font-medium transition-all',
                      subtitleOptions.style === s.value
                        ? 'border-accent bg-accent/15 text-accent'
                        : 'border-border text-muted-foreground hover:border-accent/50'
                    )}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Position */}
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1.5">
                Posição
              </label>
              <div className="flex gap-1.5">
                {POSITIONS.map((p) => (
                  <button
                    key={p.value}
                    onClick={() => onSubtitleOptionsChange({ position: p.value })}
                    className={cn(
                      'flex-1 rounded-md border px-2 py-1.5 text-xs font-medium transition-all',
                      subtitleOptions.position === p.value
                        ? 'border-accent bg-accent/15 text-accent'
                        : 'border-border text-muted-foreground hover:border-accent/50'
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Color + Size */}
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <label className="text-xs font-medium text-muted-foreground block mb-1.5">
                  Cor
                </label>
                <input
                  type="color"
                  value={subtitleOptions.color}
                  onChange={(e) => onSubtitleOptionsChange({ color: e.target.value })}
                  className="h-9 w-full cursor-pointer rounded-md border border-border bg-card"
                />
              </div>
              <div className="flex-1">
                <label className="text-xs font-medium text-muted-foreground block mb-1.5">
                  Tamanho ({subtitleOptions.fontSize}px)
                </label>
                <input
                  type="range"
                  min={14}
                  max={48}
                  step={2}
                  value={subtitleOptions.fontSize}
                  onChange={(e) =>
                    onSubtitleOptionsChange({ fontSize: Number(e.target.value) })
                  }
                  className="w-full accent-accent"
                />
              </div>
            </div>

            {/* Background toggle */}
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <div
                onClick={() =>
                  onSubtitleOptionsChange({ background: !subtitleOptions.background })
                }
                className={cn(
                  'h-5 w-9 rounded-full transition-colors relative',
                  subtitleOptions.background ? 'bg-accent' : 'bg-muted'
                )}
              >
                <div
                className={cn(
                  'absolute top-0.5 h-4 w-4 rounded-full bg-background shadow transition-transform',
                  subtitleOptions.background ? 'translate-x-4' : 'translate-x-0.5'
                )}
                />
              </div>
              <span className="text-xs text-muted-foreground">Fundo escuro</span>
            </label>
          </div>
        )}
      </section>

      {/* Export */}
      <section className="rounded-xl bg-card border border-border p-4 space-y-3">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Download className="h-4 w-4 text-primary" />
          Exportar
        </h3>

        {hasSubtitles && (
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <div
              onClick={() => onEmbedSubtitlesChange(!embedSubtitles)}
              className={cn(
                'h-5 w-9 rounded-full transition-colors relative',
                embedSubtitles ? 'bg-primary' : 'bg-muted'
              )}
            >
              <div
                className={cn(
                  'absolute top-0.5 h-4 w-4 rounded-full bg-background shadow transition-transform',
                  embedSubtitles ? 'translate-x-4' : 'translate-x-0.5'
                )}
              />
            </div>
            <span className="text-xs text-muted-foreground">Embutir legenda no vídeo</span>
          </label>
        )}

        <Button
          className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
          onClick={onExport}
          disabled={!hasSegments || isExporting || isAnalyzing || isTranscribing}
        >
          {isExporting ? (
            <span className="flex items-center gap-2">
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
              Exportando…
            </span>
          ) : (
            <>
              <Download className="h-4 w-4" />
              Exportar Vídeo
            </>
          )}
        </Button>

        {!hasSegments && hasVideo && (
          <p className="text-xs text-muted-foreground text-center">
            Aplique o corte automático antes de exportar
          </p>
        )}
      </section>
    </div>
  );
}
