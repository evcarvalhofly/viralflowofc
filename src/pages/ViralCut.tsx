import { useState, useCallback, useRef } from 'react';
import { Scissors, X, RotateCcw, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

import { ViralCutState, AutoCutMode, SubtitleOptions, Segment, SilenceRange, SubtitleItem } from '@/viralcut/types';
import { Uploader } from '@/viralcut/components/Uploader';
import { PreviewPlayer } from '@/viralcut/components/PreviewPlayer';
import { Timeline } from '@/viralcut/components/Timeline';
import { ControlPanel } from '@/viralcut/components/ControlPanel';
import { ProcessingOverlay } from '@/viralcut/components/ProcessingOverlay';

import { detectSilences } from '@/viralcut/engines/audioAnalysis';
import { buildKeepSegments, totalKeptDuration } from '@/viralcut/engines/autoCut';
import { getAutoCutConfig } from '@/viralcut/engines/autoCutConfig';
import { transcribeFile } from '@/viralcut/engines/subtitleEngine';
import { exportVideo, downloadBlob } from '@/viralcut/engines/exportEngine';

const DEFAULT_SUBTITLE_OPTIONS: SubtitleOptions = {
  style: 'padrao',
  color: '#ffffff',
  fontSize: 26,
  position: 'bottom',
  background: true,
};

const DEFAULT_STATE: ViralCutState = {
  step: 'idle',
  file: null,
  videoUrl: null,
  audioUrl: null,
  duration: 0,
  silences: [],
  keepSegments: [],
  subtitles: [],
  subtitleOptions: DEFAULT_SUBTITLE_OPTIONS,
  mode: 'medio',
  progress: 0,
  progressLabel: '',
  error: null,
};

function fmtDuration(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
}

const ViralCut = () => {
  const [state, setState] = useState<ViralCutState>(DEFAULT_STATE);
  const [currentTime, setCurrentTime] = useState(0);
  const [embedSubtitles, setEmbedSubtitles] = useState(false);
  const abortRef = useRef(false);

  const patch = (partial: Partial<ViralCutState>) =>
    setState((s) => ({ ...s, ...partial }));

  // ── Upload ────────────────────────────────────────────────────
  const handleFile = useCallback((file: File) => {
    // Revoke old URLs
    if (state.videoUrl) URL.revokeObjectURL(state.videoUrl);
    if (state.audioUrl) URL.revokeObjectURL(state.audioUrl);

    const videoUrl = URL.createObjectURL(file);
    patch({
      ...DEFAULT_STATE,
      file,
      videoUrl,
      step: 'ready',
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleReset = () => {
    if (state.videoUrl) URL.revokeObjectURL(state.videoUrl);
    setState(DEFAULT_STATE);
    setCurrentTime(0);
  };

  // ── Auto Cut ─────────────────────────────────────────────────
  const handleAutoCut = async () => {
    if (!state.file) return;
    abortRef.current = false;

    patch({ step: 'analyzing', progress: 0, progressLabel: 'Analisando áudio…', error: null });

    try {
      const config = getAutoCutConfig(state.mode);

      const silences = await detectSilences(state.file, {
        threshold: config.threshold,
        minSilenceMs: config.minSilenceMs,
        frameMs: config.frameMs,
        onProgress: (pct) => {
          patch({ progress: Math.round(pct * 0.9), progressLabel: 'Detectando silêncios…' });
        },
      });

      const keepSegments = buildKeepSegments(
        state.duration,
        silences,
        config.paddingMs,
        config.mergeGap
      );

      patch({
        step: 'analyzed',
        silences,
        keepSegments,
        progress: 100,
        progressLabel: `${silences.length} silêncio(s) detectado(s)`,
      });
    } catch (err: any) {
      patch({
        step: 'ready',
        error: err?.message ?? 'Erro ao analisar áudio',
        progress: 0,
      });
    }
  };

  // ── Subtitles ─────────────────────────────────────────────────
  const handleGenerateSubtitles = async () => {
    if (!state.file) return;
    patch({ step: 'transcribing', progress: 0, progressLabel: 'Preparando transcrição…', error: null });

    try {
      const subtitles = await transcribeFile(state.file, (label) => {
        patch({ progressLabel: label, progress: 30 });
      });

      patch({
        step: state.keepSegments.length ? 'analyzed' : 'ready',
        subtitles,
        progress: 100,
        progressLabel: `${subtitles.length} bloco(s) de legenda gerado(s)`,
      });
    } catch (err: any) {
      patch({
        step: state.keepSegments.length ? 'analyzed' : 'ready',
        error: err?.message ?? 'Erro ao transcrever áudio',
        progress: 0,
      });
    }
  };

  // ── Export ────────────────────────────────────────────────────
  const handleExport = async () => {
    if (!state.file || !state.keepSegments.length) return;
    patch({ step: 'exporting', progress: 0, progressLabel: 'Iniciando exportação…', error: null });

    try {
      const blob = await exportVideo({
        file: state.file,
        keepSegments: state.keepSegments,
        subtitles: embedSubtitles ? state.subtitles : undefined,
        embedSubtitles: embedSubtitles && state.subtitles.length > 0,
        onProgress: (pct, label) => {
          patch({ progress: pct, progressLabel: label });
        },
      });

      downloadBlob(blob, `viralcut-${Date.now()}.mp4`);
      patch({
        step: 'analyzed',
        progress: 100,
        progressLabel: 'Exportação concluída!',
      });
    } catch (err: any) {
      patch({
        step: 'analyzed',
        error: err?.message ?? 'Erro durante exportação',
        progress: 0,
      });
    }
  };

  const handleSubtitleOptionsChange = (partial: Partial<SubtitleOptions>) => {
    patch({ subtitleOptions: { ...state.subtitleOptions, ...partial } });
  };

  // ── Computed flags ────────────────────────────────────────────
  const isAnalyzing = state.step === 'analyzing';
  const isTranscribing = state.step === 'transcribing';
  const isExporting = state.step === 'exporting';
  const isBusy = isAnalyzing || isTranscribing || isExporting;
  const hasVideo = !!state.file && !!state.videoUrl;
  const hasSegments = state.keepSegments.length > 0;
  const hasSubtitles = state.subtitles.length > 0;

  const savedTime =
    state.duration > 0 && hasSegments
      ? state.duration - totalKeptDuration(state.keepSegments)
      : 0;

  return (
    <div className="h-full flex flex-col bg-background overflow-hidden">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-5 py-3 border-b border-border bg-card/50">
        <div className="flex items-center gap-2">
          <Scissors className="h-5 w-5 text-primary" />
          <span className="font-bold text-foreground text-base">ViralCut</span>
          <span className="text-xs text-muted-foreground ml-1 hidden sm:inline">
            Editor automático de vídeo
          </span>
        </div>

        {hasVideo && (
          <div className="flex items-center gap-3">
            {hasSegments && (
              <span className="hidden sm:inline text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
                {fmtDuration(totalKeptDuration(state.keepSegments))} mantido
                {savedTime > 0 && (
                  <span className="text-green-400 ml-1">
                    (−{fmtDuration(savedTime)})
                  </span>
                )}
              </span>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReset}
              disabled={isBusy}
              className="text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="h-4 w-4 mr-1" />
              Novo vídeo
            </Button>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {!hasVideo ? (
          /* ── Upload screen ── */
          <div className="flex flex-col items-center justify-center h-full p-8 max-w-xl mx-auto">
            <div className="mb-6 text-center">
              <h1 className="text-2xl font-bold text-foreground mb-2">
                Edição automática inteligente
              </h1>
              <p className="text-muted-foreground text-sm">
                Remova silêncios, adicione legendas e exporte em segundos.
              </p>
            </div>
            <Uploader onFile={handleFile} />
          </div>
        ) : (
          /* ── Editor layout ── */
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-0 h-full">
            {/* Left: player + timeline */}
            <div className="flex flex-col gap-4 p-4 min-w-0 overflow-y-auto">
              {/* Error banner */}
              {state.error && (
                <div className="flex items-center gap-2 rounded-lg bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{state.error}</span>
                  <button
                    className="ml-auto"
                    onClick={() => patch({ error: null })}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}

              {/* Success banner */}
              {state.progressLabel && !isBusy && !state.error && (
                <div className="flex items-center gap-2 rounded-lg bg-green-500/10 border border-green-500/30 px-4 py-3 text-sm text-green-400">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>{state.progressLabel}</span>
                  <button
                    className="ml-auto"
                    onClick={() => patch({ progressLabel: '' })}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}

              {/* Processing overlay */}
              {isBusy && (
                <ProcessingOverlay
                  label={state.progressLabel}
                  progress={state.progress}
                />
              )}

              {/* Preview player */}
              {!isBusy && (
                <PreviewPlayer
                  videoUrl={state.videoUrl!}
                  subtitles={state.subtitles}
                  subtitleOptions={state.subtitleOptions}
                  keepSegments={state.keepSegments}
                  onTimeUpdate={setCurrentTime}
                  onDurationChange={(d) => patch({ duration: d })}
                />
              )}

              {/* Timeline */}
              {!isBusy && (
                <Timeline
                  audioUrl={state.videoUrl!}
                  silences={state.silences}
                  keepSegments={state.keepSegments}
                  currentTime={currentTime}
                  duration={state.duration}
                />
              )}

              {/* Stats row */}
              {hasSegments && !isBusy && (
                <div className="grid grid-cols-3 gap-3 text-center">
                  {[
                    {
                      label: 'Original',
                      value: fmtDuration(state.duration),
                      color: 'text-muted-foreground',
                    },
                    {
                      label: 'Removido',
                      value: fmtDuration(savedTime),
                      color: 'text-red-400',
                    },
                    {
                      label: 'Final',
                      value: fmtDuration(totalKeptDuration(state.keepSegments)),
                      color: 'text-green-400',
                    },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="rounded-xl bg-card border border-border py-3 px-2"
                    >
                      <p className={`text-lg font-bold ${item.color}`}>{item.value}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{item.label}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Right: control panel */}
            <div className="border-l border-border bg-card/30 p-4 overflow-y-auto">
              <ControlPanel
                mode={state.mode}
                onModeChange={(m) => patch({ mode: m })}
                onAutoCut={handleAutoCut}
                onGenerateSubtitles={handleGenerateSubtitles}
                onExport={handleExport}
                subtitleOptions={state.subtitleOptions}
                onSubtitleOptionsChange={handleSubtitleOptionsChange}
                hasVideo={hasVideo}
                hasSegments={hasSegments}
                hasSubtitles={hasSubtitles}
                isAnalyzing={isAnalyzing}
                isTranscribing={isTranscribing}
                isExporting={isExporting}
                embedSubtitles={embedSubtitles}
                onEmbedSubtitlesChange={setEmbedSubtitles}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ViralCut;
