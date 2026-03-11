// ============================================================
// ViralCut – Core Types (OpenCut-compatible)
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
  width?: number;
  height?: number;
}

export type TrackType = 'video' | 'audio';

export interface TrackItem {
  id: string;
  mediaId: string;
  trackId: string;
  startTime: number;   // position on timeline (seconds)
  endTime: number;     // end on timeline (seconds)
  mediaStart: number;  // trim start inside media (seconds)
  mediaEnd: number;    // trim end inside media (seconds)
  name: string;
  type: TrackType;
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
