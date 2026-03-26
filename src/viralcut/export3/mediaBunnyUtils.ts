// ============================================================
// ViralCut Export3 – MediaBunny output configuration helpers
// ============================================================

/**
 * Returns the best video codec supported by the current browser
 * via WebCodecs VideoEncoder (used internally by MediaBunny).
 * Prefers AVC (H.264) for MP4 compatibility, falls back to VP9/VP8.
 */
export type SupportedVideoCodec = 'avc' | 'vp9' | 'vp8';
export type SupportedAudioCodec = 'aac' | 'opus';
export type ExportContainer = 'mp4' | 'webm';

export interface ExportConfig {
  videoCodec: SupportedVideoCodec;
  audioCodec: SupportedAudioCodec;
  container: ExportContainer;
  videoBitrate: number;
  audioBitrate: number;
}

export type ProjectOrientation = 'portrait' | 'landscape' | 'square';

export function resolveProjectOrientation(project: { aspectRatio?: string; width?: number; height?: number }): ProjectOrientation {
  if (project.aspectRatio === '9:16' || project.aspectRatio === '4:5') return 'portrait';
  if (project.aspectRatio === '16:9') return 'landscape';
  if (project.aspectRatio === '1:1') return 'square';
  if (project.height != null && project.width != null) {
    if (project.height > project.width) return 'portrait';
    if (project.width > project.height) return 'landscape';
  }
  return 'square';
}

/**
 * Returns export canvas dimensions based on project aspect ratio and chosen resolution.
 * Preserves orientation (portrait/landscape/square) calculated from project width/height ratio.
 * Max long-side: 1920 for 1080p, 1280 for 720p.
 */
export function getExportDimensions(
  project: { aspectRatio?: string; width?: number; height?: number },
  resolution: '720p' | '1080p'
): { width: number; height: number } {
  const is1080 = resolution === '1080p';
  const baseSize = is1080 ? 1920 : 1280;

  // 1. Use explicit aspect ratio presets first
  if (project.aspectRatio === '9:16') {
    return is1080 ? { width: 1080, height: 1920 } : { width: 720, height: 1280 };
  }
  if (project.aspectRatio === '4:5') {
    return is1080 ? { width: 1080, height: 1350 } : { width: 720, height: 900 };
  }
  if (project.aspectRatio === '1:1') {
    return is1080 ? { width: 1080, height: 1080 } : { width: 720, height: 720 };
  }
  if (project.aspectRatio === '16:9') {
    return is1080 ? { width: 1920, height: 1080 } : { width: 1280, height: 720 };
  }

  // 2. Fallback: derive from project pixel dimensions (handles any custom ratio)
  if (project.width && project.height) {
    const ratio = project.width / project.height;
    if (ratio >= 1) {
      // Landscape or square: long side = width
      return {
        width: baseSize,
        height: Math.round(baseSize / ratio),
      };
    } else {
      // Portrait: long side = height
      return {
        width: Math.round(baseSize * ratio),
        height: baseSize,
      };
    }
  }

  // 3. Default: 16:9 Landscape
  return is1080 ? { width: 1920, height: 1080 } : { width: 1280, height: 720 };
}

export function getVideoBitrate(width: number, height: number, fps: number): number {
  const pixels = width * height;
  // Short social-media clips — slightly lower CBR still looks great
  if (pixels >= 1920 * 1080) return fps >= 60 ? 10_000_000 : 6_000_000;
  if (pixels >= 1280 * 720)  return fps >= 60 ? 7_000_000  : 4_000_000;
  return 2_500_000;
}

/**
 * Detect best export config by probing WebCodecs VideoEncoder support.
 * AVC → MP4 is strongly preferred (universal playback + correct duration).
 * Falls back to VP9 → WebM if AVC is not hardware-available.
 */
export async function detectBestExportConfig(
  width: number,
  height: number,
  fps: number
): Promise<ExportConfig> {
  const videoBitrate = getVideoBitrate(width, height, fps);

  // Try AVC / H.264
  if (typeof VideoEncoder !== 'undefined') {
    try {
      const avcResult = await VideoEncoder.isConfigSupported({
        codec: 'avc1.42E01E',
        width,
        height,
        bitrate: videoBitrate,
        framerate: fps,
      });
      if (avcResult.supported) {
        return {
          videoCodec: 'avc',
          audioCodec: 'aac',
          container: 'mp4',
          videoBitrate,
          audioBitrate: 128_000,
        };
      }
    } catch { /* not supported */ }

    // Try VP9
    try {
      const vp9Result = await VideoEncoder.isConfigSupported({
        codec: 'vp09.00.10.08',
        width,
        height,
        bitrate: videoBitrate,
        framerate: fps,
      });
      if (vp9Result.supported) {
        return {
          videoCodec: 'vp9',
          audioCodec: 'opus',
          container: 'webm',
          videoBitrate,
          audioBitrate: 128_000,
        };
      }
    } catch { /* not supported */ }
  }

  // Default fallback
  return {
    videoCodec: 'avc',
    audioCodec: 'aac',
    container: 'mp4',
    videoBitrate,
    audioBitrate: 128_000,
  };
}
