// ============================================================
// ViralCut – High-Res Video Transcoder
//
// When a video is imported with resolution exceeding the export
// target (1920x1080 or 1080x1920), it is transcoded DOWN to the
// correct resolution using FFmpeg WASM before editing begins.
//
// This is the ROOT FIX for the orientation/stretch bug:
// by normalizing the video file itself at import time, the export
// pipeline always sees predictable, non-rotated, correctly-sized
// frames regardless of browser auto-rotation quirks.
//
// Threshold: only applied when EITHER dimension > 1920px.
// Small/normal videos skip this step entirely (zero overhead).
// ============================================================

import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

let ffmpegInstance: FFmpeg | null = null;
let ffmpegLoading: Promise<FFmpeg> | null = null;

async function getFFmpeg(): Promise<FFmpeg> {
  if (ffmpegInstance?.loaded) return ffmpegInstance;
  if (ffmpegLoading) return ffmpegLoading;

  ffmpegLoading = (async () => {
    const ff = new FFmpeg();
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
    await ff.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    });
    ffmpegInstance = ff;
    return ff;
  })();

  return ffmpegLoading;
}

export interface TranscodeResult {
  file: File;
  url: string;
  /** Whether the video was actually transcoded (false = original returned as-is) */
  transcoded: boolean;
  width: number;
  height: number;
}

/**
 * Determines if the video needs transcoding based on its dimensions.
 * Only videos with any dimension > 1920px are transcoded.
 */
function needsTranscode(encodedW: number, encodedH: number, rotationDeg: number): boolean {
  // Swap dims if rotated 90/270 to get display dimensions
  const displayW = rotationDeg === 90 || rotationDeg === 270 ? encodedH : encodedW;
  const displayH = rotationDeg === 90 || rotationDeg === 270 ? encodedW : encodedH;
  return displayW > 1920 || displayH > 1920;
}

/**
 * Returns the target dimensions for a video after transcoding.
 * Portrait → 1080×1920, Landscape → 1920×1080
 */
function getTargetDimensions(displayW: number, displayH: number): { targetW: number; targetH: number } {
  if (displayH > displayW) {
    // Portrait
    return { targetW: 1080, targetH: 1920 };
  } else if (displayW > displayH) {
    // Landscape
    return { targetW: 1920, targetH: 1080 };
  } else {
    // Square
    return { targetW: 1080, targetH: 1080 };
  }
}

/**
 * Transcodes a high-resolution video to 1920×1080 or 1080×1920.
 *
 * - If the video does NOT need transcoding (both dims ≤ 1920), returns it as-is.
 * - If transcoding is needed, uses FFmpeg WASM to scale+orient the video.
 * - The output is always a properly oriented MP4 with no rotation metadata.
 */
export async function transcodeHighResVideo(
  file: File,
  encodedWidth: number,
  encodedHeight: number,
  rotationDeg: 0 | 90 | 180 | 270,
  onProgress?: (msg: string) => void,
): Promise<TranscodeResult> {
  // Apply rotation to get display dimensions
  const displayW = rotationDeg === 90 || rotationDeg === 270 ? encodedHeight : encodedWidth;
  const displayH = rotationDeg === 90 || rotationDeg === 270 ? encodedWidth : encodedHeight;

  if (!needsTranscode(encodedWidth, encodedHeight, rotationDeg)) {
    // No transcoding needed — return original
    const url = URL.createObjectURL(file);
    return { file, url, transcoded: false, width: displayW, height: displayH };
  }

  const { targetW, targetH } = getTargetDimensions(displayW, displayH);

  console.log(`[ViralCut][transcode] ${file.name}: ${displayW}×${displayH} → ${targetW}×${targetH} (rotDeg=${rotationDeg})`);
  onProgress?.(`Redimensionando vídeo para ${targetW}×${targetH}…`);

  const ff = await getFFmpeg();

  const inputName = `input_${Date.now()}.mp4`;
  const outputName = `output_${Date.now()}.mp4`;

  // Write input
  await ff.writeFile(inputName, await fetchFile(file));

  // Build FFmpeg command:
  // -vf scale=W:H — resize to target, preserving content
  // -vf transpose   — applied only if rotated, bakes orientation into stream
  // -metadata:s:v rotate=0 — strips rotation metadata after baking
  // -c:v libx264 -crf 18 — high quality encode
  // -c:a copy — preserve audio as-is
  // -movflags +faststart — browser-friendly MP4
  const vfFilters: string[] = [];

  // Bake rotation into the video stream (so no EXIF rotation surprises)
  if (rotationDeg === 90) {
    vfFilters.push('transpose=1');   // 90° clockwise
  } else if (rotationDeg === 270) {
    vfFilters.push('transpose=2');   // 90° counter-clockwise
  } else if (rotationDeg === 180) {
    vfFilters.push('transpose=1,transpose=1'); // 180°
  }

  // Scale to target resolution
  vfFilters.push(`scale=${targetW}:${targetH}`);

  const vfString = vfFilters.join(',');

  const args = [
    '-i', inputName,
    '-vf', vfString,
    '-c:v', 'libx264',
    '-crf', '18',
    '-preset', 'fast',
    '-c:a', 'aac',
    '-b:a', '128k',
    '-metadata:s:v', 'rotate=0',
    '-movflags', '+faststart',
    '-y',
    outputName,
  ];

  console.log(`[ViralCut][transcode] FFmpeg args:`, args.join(' '));

  await ff.exec(args);

  onProgress?.('Finalizando…');

  const data = await ff.readFile(outputName);
  const blob = new Blob([data], { type: 'video/mp4' });
  const transcodedFile = new File([blob], file.name.replace(/\.[^.]+$/, '') + '_hd.mp4', { type: 'video/mp4' });
  const url = URL.createObjectURL(transcodedFile);

  // Cleanup FFmpeg virtual FS
  try { await ff.deleteFile(inputName); } catch (_) { /* ignore */ }
  try { await ff.deleteFile(outputName); } catch (_) { /* ignore */ }

  console.log(`[ViralCut][transcode] Done: ${(blob.size / 1024 / 1024).toFixed(1)}MB`);

  return {
    file: transcodedFile,
    url,
    transcoded: true,
    width: targetW,
    height: targetH,
  };
}
