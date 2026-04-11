// ============================================================
// ViralCut – Core Types
// ============================================================

export type MediaType = 'video' | 'audio' | 'image';

export interface MediaFile {
  id: string;
  name: string;
  type: MediaType;
  file: File;
  url: string;
  duration: number;
  thumbnail?: string;
  // Visual dimensions from browser (already rotation-corrected)
  width?: number;
  height?: number;
  // Orientation locked at import time — single source of truth for export
  orientation?: 'portrait' | 'landscape' | 'square';
}

export type TrackType = 'video' | 'audio' | 'text' | 'image';

export interface BoxShadow {
  color: string;
  x: number;
  y: number;
  blur: number;
}

export interface TextDetails {
  text: string;
  fontSize: number;
  fontFamily: string;
  color: string;
  textAlign: 'left' | 'center' | 'right';
  textDecoration: 'none' | 'underline' | 'line-through';
  opacity: number;
  backgroundColor: string;
  borderWidth: number;
  borderColor: string;
  boxShadow: BoxShadow;
  posX: number;
  posY: number;
  width: number;
  strokeWidth?: number;   // text outline (webkit-text-stroke)
  strokeColor?: string;
  fontWeight?: string;
  rotation?: number;      // degrees
}

export interface VideoDetails {
  volume: number;
  opacity: number;
  flipH: boolean;
  flipV: boolean;
  playbackRate: number;
  borderWidth: number;
  borderColor: string;
  borderRadius: number;
  boxShadow: BoxShadow;
  brightness: number;
  contrast: number;
  saturation: number;
  // Overlay properties
  posX?: number;
  posY?: number;
  width?: number;
  height?: number;
  rotation?: number;      // degrees
  // When true, render using posX/posY/width/height/rotation instead of contain-fit
  useTransform?: boolean;
}

export interface AudioDetails {
  volume: number;
  playbackRate: number;
  fadeIn: number;
  fadeOut: number;
}

export interface ImageDetails {
  opacity: number;
  flipH: boolean;
  flipV: boolean;
  borderWidth: number;
  borderColor: string;
  borderRadius: number;
  boxShadow: BoxShadow;
  brightness: number;
  contrast: number;
  saturation: number;
  posX: number;
  posY: number;
  width: number;
  height: number;
  rotation?: number;      // degrees
}

export type AnimationPreset = 'none' | 'fadeIn' | 'fadeOut' | 'slideLeft' | 'slideRight' | 'slideUp' | 'slideDown' | 'zoomIn' | 'zoomOut';
export type TransitionType = 'none' | 'fade' | 'wipe' | 'slide' | 'zoom';

export interface TrackItem {
  id: string;
  mediaId: string;        // empty string for text items
  trackId: string;
  startTime: number;
  endTime: number;
  mediaStart: number;
  mediaEnd: number;
  name: string;
  type: TrackType;
  // Optional details per type
  textDetails?: TextDetails;
  videoDetails?: VideoDetails;
  audioDetails?: AudioDetails;
  imageDetails?: ImageDetails;
  // Animation
  animationIn?: AnimationPreset;
  animationOut?: AnimationPreset;
  transitionIn?: TransitionType;
  transitionOut?: TransitionType;
  // Flag para identificar legendas geradas automaticamente
  isSubtitle?: boolean;
}

export interface Track {
  id: string;
  type: TrackType;
  items: TrackItem[];
  locked: boolean;
  muted: boolean;
}

export interface Project {
  id: string;
  name: string;
  tracks: Track[];
  duration: number;
  fps: number;
  width: number;
  height: number;
  aspectRatio: '16:9' | '9:16' | '1:1' | '4:5' | '4:3' | '3:4' | '2:1' | '21:9';
  createdAt: number;
  updatedAt: number;
}

export type ExportStatus = 'idle' | 'preparing' | 'encoding' | 'done' | 'error';

export interface ExportState {
  status: ExportStatus;
  progress: number;
  label: string;
  error?: string;
}

// ── Defaults ────────────────────────────────────────────────
export const DEFAULT_VIDEO_DETAILS: VideoDetails = {
  volume: 1,
  opacity: 1,
  flipH: false,
  flipV: false,
  playbackRate: 1,
  borderWidth: 0,
  borderColor: '#000000',
  borderRadius: 0,
  boxShadow: { color: '#000000', x: 0, y: 0, blur: 0 },
  brightness: 1,
  contrast: 1,
  saturation: 1,
  posX: 50,
  posY: 50,
  width: 50,
  height: 50,
};

export const DEFAULT_AUDIO_DETAILS: AudioDetails = {
  volume: 1,
  playbackRate: 1,
  fadeIn: 0,
  fadeOut: 0,
};

export const DEFAULT_TEXT_DETAILS: TextDetails = {
  text: 'Texto aqui',
  // fontSize is stored as % of canvas HEIGHT (e.g. 3.5 = 3.5% of height)
  fontSize: 3.5,
  fontFamily: 'Inter, sans-serif',
  color: '#ffffff',
  textAlign: 'center',
  textDecoration: 'none',
  opacity: 1,
  backgroundColor: 'transparent',
  borderWidth: 0,
  borderColor: '#000000',
  boxShadow: { color: '#000000', x: 2, y: 2, blur: 4 },
  posX: 50,
  posY: 80,
  width: 80,
};

export const DEFAULT_IMAGE_DETAILS: ImageDetails = {
  opacity: 1,
  flipH: false,
  flipV: false,
  borderWidth: 0,
  borderColor: '#000000',
  borderRadius: 0,
  boxShadow: { color: '#000000', x: 0, y: 0, blur: 0 },
  brightness: 1,
  contrast: 1,
  saturation: 1,
  posX: 50,
  posY: 50,
  width: 50,
  height: 50,
};
