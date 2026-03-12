import type { TimelineTrack } from "./timeline";

export type AspectRatio = "16:9" | "9:16" | "1:1" | "4:3" | "3:4";

export interface CanvasSize {
  width: number;
  height: number;
}

export interface ProjectSettings {
  fps: number;
  canvasSize: CanvasSize;
  aspectRatio: AspectRatio;
}

export interface TProject {
  id: string;
  name: string;
  tracks: TimelineTrack[];
  settings: ProjectSettings;
  duration: number;
  createdAt: string;
  updatedAt: string;
}

export interface TProjectMetadata {
  id: string;
  name: string;
  duration: number;
  aspectRatio: AspectRatio;
  createdAt: string;
  updatedAt: string;
  thumbnail?: string;
}

export const DEFAULT_PROJECT_SETTINGS: ProjectSettings = {
  fps: 30,
  canvasSize: { width: 1920, height: 1080 },
  aspectRatio: "16:9",
};

export const ASPECT_RATIO_MAP: Record<AspectRatio, CanvasSize> = {
  "16:9": { width: 1920, height: 1080 },
  "9:16": { width: 1080, height: 1920 },
  "1:1": { width: 1080, height: 1080 },
  "4:3": { width: 1440, height: 1080 },
  "3:4": { width: 1080, height: 1440 },
};
