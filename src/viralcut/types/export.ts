export type ExportQuality = "360p" | "480p" | "720p" | "1080p";
export type ExportFormat = "mp4" | "webm";

export const EXPORT_QUALITY_VALUES: ExportQuality[] = ["360p", "480p", "720p", "1080p"];
export const EXPORT_FORMAT_VALUES: ExportFormat[] = ["mp4", "webm"];

export interface ExportOptions {
  quality: ExportQuality;
  format: ExportFormat;
  fps: number;
}

export const DEFAULT_EXPORT_OPTIONS: ExportOptions = {
  quality: "720p",
  format: "mp4",
  fps: 30,
};

export const QUALITY_HEIGHTS: Record<ExportQuality, number> = {
  "360p": 360,
  "480p": 480,
  "720p": 720,
  "1080p": 1080,
};
