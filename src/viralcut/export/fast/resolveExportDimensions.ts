// ============================================================
// resolveExportDimensions – Maps user-chosen resolution string
// to exact pixel dimensions used for the composition + encoder.
// ============================================================

export type ExportResolution = '720p' | '1080p';

export interface ExportDimensions {
  width: number;
  height: number;
}

export function resolveExportDimensions(resolution: ExportResolution): ExportDimensions {
  switch (resolution) {
    case '720p':  return { width: 1280, height: 720 };
    case '1080p': return { width: 1920, height: 1080 };
    default:      return { width: 1280, height: 720 };
  }
}
