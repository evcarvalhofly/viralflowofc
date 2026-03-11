import { useState, useCallback, useRef } from 'react';
import { Scissors, X, RotateCcw, CheckCircle2, AlertCircle, SlidersHorizontal } from 'lucide-react';
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
  const [showMobilePanel, setShowMobilePanel] = useState(false);
  const abortRef = useRef(false);

  const patch = (partial: Partial<ViralCutState>) =>
    setState((s) => ({ ...s, ...partial }));

  // ── Upload ────────────────────────────────────────────────────
  const handleFile = useCallback((file: File) => {
    if (state.videoUrl) URL.revokeObjectURL(state.videoUrl);
    if (state.audioUrl) URL.revokeObjectURL(state.audioUrl);
    const videoUrl = URL.createObjectURL(file);
    patch({ ...DEFAULT_STATE, file, videoUrl, step: 'ready' });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleReset = () => {
    if (state.videoUrl) URL.revokeObjectURL(state.videoUrl);
    setState(DEFAULT_STATE);
    setCurrentTime(0);
    setShowMobilePanel(false);
  };

  // ── Auto Cut ─────────────────────────────────────────────────
  const handleAutoCut = async () => {
    if (!state.file) return;
    abortRef.current = false;
    setShowMobilePanel(false);
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
      patch({ step: 'ready', error: err?.message ?? 'Erro ao analisar áudio', progress: 0 });
    }
  };

  // ── Subtitles ─────────────────────────────────────────────────
  const handleGenerateSubtitles = async () => {
    if (!state.file) return;
    setShowMobilePanel(false);
    patch({ step: 'transcribing', progress: 0, progressLabel: 'Preparando transcrição…', error: null });

    try {
      const subtitles = await transcribeFile(state.file, (label) => {
        patch({ progressLabel: label, progress: 30 });
      });

      // Auto-enable embed when subtitles are freshly generated
      setEmbedSubtitles(true);

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
    setShowMobilePanel(false);
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
      patch({ step: 'analyzed', progress: 100, progressLabel: 'Exportação concluída!' });
    } catch (err: any) {
      patch({ step: 'analyzed', error: err?.message ?? 'Erro durante exportação', progress: 0 });
    }
  };

  const handleSubtitleOptionsChange = (partial: Partial<SubtitleOptions>) => {
    patch({ subtitleOptions: { ...state.subtitleOptions, ...partial } });
  };

  // ── Manual silence edit from timeline ────────────────────────
  const handleSilencesChange = useCallback((newSilences: SilenceRange[]) => {
    const config = getAutoCutConfig(state.mode);
    const newKeep = buildKeepSegments(
      state.duration,
      newSilences,
      config.paddingMs,
      config.mergeGap
    );
    patch({ silences: newSilences, keepSegments: newKeep });
  }, [state.duration, state.mode]);

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

  const controlPanelProps = {
    mode: state.mode,
    onModeChange: (m: AutoCutMode) => patch({ mode: m }),
    onAutoCut: handleAutoCut,
    onGenerateSubtitles: handleGenerateSubtitles,
    onExport: handleExport,
    subtitleOptions: state.subtitleOptions,
    onSubtitleOptionsChange: handleSubtitleOptionsChange,
    hasVideo,
    hasSegments,
    hasSubtitles,
    isAnalyzing,
    isTranscribing,
    isExporting,
    embedSubtitles,
    onEmbedSubtitlesChange: setEmbedSubtitles,
  };

  return (
    <div className="h-full flex flex-col bg-background overflow-hidden">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-border bg-card/50">
        <div className="flex items-center gap-2">
          <Scissors className="h-5 w-5 text-primary" />
          <span className="font-bold text-foreground text-base">ViralCut</span>
          <span className="text-xs text-muted-foreground ml-1 hidden sm:inline">
            Editor automático de vídeo
          </span>
        </div>

        {hasVideo && (
          <div className="flex items-center gap-2">
            {hasSegments && (
              <span className="hidden sm:inline text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
                {fmtDuration(totalKeptDuration(state.keepSegments))} mantido
                {savedTime > 0 && (
                  <span className="text-primary ml-1">(−{fmtDuration(savedTime)})</span>
                )}
              </span>
            )}
            {/* Mobile tools button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowMobilePanel(true)}
              disabled={isBusy}
              className="lg:hidden h-8 px-2.5 gap-1.5"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span className="text-xs">Ferramentas</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReset}
              disabled={isBusy}
              className="text-muted-foreground hover:text-foreground h-8 px-2"
            >
              <RotateCcw className="h-4 w-4" />
              <span className="hidden sm:inline ml-1">Novo vídeo</span>
            </Button>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {!hasVideo ? (
          /* ── Upload screen ── */
          <div className="flex flex-col items-center justify-center h-full p-6 max-w-xl mx-auto overflow-y-auto">
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
          <div className="h-full flex flex-col lg:flex-row overflow-hidden">

            {/* ── Main content (player + timeline) ── */}
            <div className="flex-1 min-h-0 min-w-0 flex flex-col overflow-y-auto">
              <div className="flex flex-col gap-3 p-3 sm:p-4">
                {/* Banners */}
                {state.error && (
                  <div className="flex items-center gap-2 rounded-lg bg-destructive/10 border border-destructive/30 px-3 py-2.5 text-sm text-destructive">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span className="flex-1 min-w-0 text-xs sm:text-sm">{state.error}</span>
                    <button onClick={() => patch({ error: null })}>
                      <X className="h-4 w-4 shrink-0" />
                    </button>
                  </div>
                )}

                {state.progressLabel && !isBusy && !state.error && (
                  <div className="flex items-center gap-2 rounded-lg bg-primary/10 border border-primary/30 px-3 py-2.5 text-sm text-primary">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    <span className="flex-1 min-w-0 text-xs sm:text-sm">{state.progressLabel}</span>
                    <button onClick={() => patch({ progressLabel: '' })}>
                      <X className="h-4 w-4 shrink-0" />
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

                {/* Preview player — always rendered, just hidden when busy to preserve state */}
                <div className={isBusy ? 'hidden' : undefined}>
                  <PreviewPlayer
                    videoUrl={state.videoUrl!}
                    subtitles={state.subtitles}
                    subtitleOptions={state.subtitleOptions}
                    keepSegments={state.keepSegments}
                    onTimeUpdate={setCurrentTime}
                    onDurationChange={(d) => patch({ duration: d })}
                  />
                </div>

                {/* Timeline */}
                {!isBusy && (
                  <Timeline
                    audioUrl={state.videoUrl!}
                    silences={state.silences}
                    keepSegments={state.keepSegments}
                    currentTime={currentTime}
                    duration={state.duration}
                    onSilencesChange={hasSegments ? handleSilencesChange : undefined}
                  />
                )}

                {/* Stats row */}
                {hasSegments && !isBusy && (
                  <div className="grid grid-cols-3 gap-2 text-center">
                    {[
                      { label: 'Original', value: fmtDuration(state.duration), color: 'text-muted-foreground' },
                      { label: 'Removido', value: fmtDuration(savedTime), color: 'text-destructive' },
                      { label: 'Final', value: fmtDuration(totalKeptDuration(state.keepSegments)), color: 'text-primary' },
                    ].map((item) => (
                      <div key={item.label} className="rounded-xl bg-card border border-border py-2.5 px-2">
                        <p className={`text-base sm:text-lg font-bold ${item.color}`}>{item.value}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{item.label}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Mobile: inline control panel at bottom (visible only on mobile when panel is NOT open as sheet) */}
                <div className="lg:hidden pb-2">
                  <ControlPanel {...controlPanelProps} />
                </div>
              </div>
            </div>

            {/* ── Desktop sidebar ── */}
            <div className="hidden lg:flex lg:w-[300px] xl:w-[320px] shrink-0 flex-col border-l border-border bg-card/30 overflow-y-auto">
              <div className="p-4">
                <ControlPanel {...controlPanelProps} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Mobile bottom sheet overlay ── */}
      {showMobilePanel && hasVideo && (
        <div className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowMobilePanel(false)}
          />
          {/* Sheet */}
          <div className="relative z-10 bg-card border-t border-border rounded-t-2xl max-h-[80vh] flex flex-col">
            {/* Handle */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
              <span className="text-sm font-semibold text-foreground">Ferramentas</span>
              <button
                onClick={() => setShowMobilePanel(false)}
                className="text-muted-foreground hover:text-foreground p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="overflow-y-auto p-4">
              <ControlPanel {...controlPanelProps} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ViralCut;
