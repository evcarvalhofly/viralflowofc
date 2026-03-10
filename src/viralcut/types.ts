// ============================================================
// ViralCut – Core Types
// ============================================================

export type AutoCutMode = 'suave' | 'medio' | 'agressivo';

export interface SilenceRange {
  start: number; // seconds
  end: number;   // seconds
}

export interface Segment {
  start: number; // seconds
  end: number;   // seconds
}

export interface AutoCutConfig {
  threshold: number;
  minSilenceMs: number;
  frameMs: number;
  paddingMs: number;
  mergeGap: number;
}

export interface SubtitleItem {
  start: number;
  end: number;
  text: string;
}

export type SubtitleStyle = 'padrao' | 'caixa-alta' | 'destaque';
export type SubtitlePosition = 'top' | 'middle' | 'bottom';

export interface SubtitleOptions {
  style: SubtitleStyle;
  color: string;
  fontSize: number;
  position: SubtitlePosition;
  background: boolean;
}

export type ViralCutStep =
  | 'idle'
  | 'uploading'
  | 'ready'
  | 'analyzing'
  | 'analyzed'
  | 'transcribing'
  | 'exporting';

export interface ViralCutState {
  step: ViralCutStep;
  file: File | null;
  videoUrl: string | null;
  audioUrl: string | null;
  duration: number;
  silences: SilenceRange[];
  keepSegments: Segment[];
  subtitles: SubtitleItem[];
  subtitleOptions: SubtitleOptions;
  mode: AutoCutMode;
  progress: number;
  progressLabel: string;
  error: string | null;
}
