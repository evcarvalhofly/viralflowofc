// ============================================================
// ViralCut Export2 – MediaRecorder utilities
// ============================================================

/** Best supported mime-type for MediaRecorder — prefers MP4 when available */
export function pickBestMimeType(): string {
  const candidates = [
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    'video/mp4',
    'video/webm;codecs=vp8,opus',
    'video/webm',
    'video/webm;codecs=vp9,opus',
  ];
  for (const type of candidates) {
    try {
      if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    } catch {
      // some browsers throw on bad types
    }
  }
  return 'video/webm';
}

/** Bitrate based on output resolution + fps */
export function pickBitrate(width: number, height: number, fps: number): number {
  const pixels = width * height;
  if (pixels >= 1920 * 1080) return fps >= 60 ? 16_000_000 : 10_000_000;
  if (pixels >= 1280 * 720)  return fps >= 60 ? 10_000_000 : 6_000_000;
  return 4_000_000;
}

/** Portrait/landscape dimensions respecting user resolution choice */
export function getExportDimensions(
  isPortrait: boolean,
  resolution: '720p' | '1080p'
): { width: number; height: number } {
  if (isPortrait) {
    return resolution === '1080p' ? { width: 1080, height: 1920 } : { width: 720, height: 1280 };
  }
  return resolution === '1080p' ? { width: 1920, height: 1080 } : { width: 1280, height: 720 };
}
