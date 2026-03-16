// ============================================================
// ViralCut – probeVideoRotation
//
// Detects the real rotation metadata stored in a video file's
// container (e.g. iPhone/Android rotation tag) by running
// `ffmpeg -i <file>` and parsing the log output.
//
// This runs ONLY at import time, never during export.
// ============================================================

import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';

let ffmpegInstance: FFmpeg | null = null;
let ffmpegLoading: Promise<FFmpeg> | null = null;

async function getFFmpeg(): Promise<FFmpeg> {
  if (ffmpegInstance) return ffmpegInstance;
  if (ffmpegLoading) return ffmpegLoading;

  ffmpegLoading = (async () => {
    const ffmpeg = new FFmpeg();
    await ffmpeg.load();
    ffmpegInstance = ffmpeg;
    return ffmpeg;
  })();

  return ffmpegLoading;
}

/**
 * Returns the rotation (in degrees, clockwise) stored in the video container.
 * Returns 0 if no rotation tag is found or if the file is not a video.
 *
 * Common patterns in ffmpeg log output:
 *   "rotate          : 90"           (Stream metadata, newer FFmpeg builds)
 *   "rotation of -90.00 degrees"     (displaymatrix side data, older builds)
 */
export async function probeVideoRotation(file: File): Promise<0 | 90 | 180 | 270> {
  if (!file.type.startsWith('video/')) return 0;

  let ffmpeg: FFmpeg;
  try {
    ffmpeg = await getFFmpeg();
  } catch (err) {
    console.warn('[ViralCut][probe] FFmpeg failed to load:', err);
    return 0;
  }

  const inputName = `probe-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const logs: string[] = [];

  const onLog = ({ message }: { message: string }) => logs.push(message);
  ffmpeg.on('log', onLog);

  try {
    await ffmpeg.writeFile(inputName, await fetchFile(file));

    // Run with no output – ffmpeg will "error" but still emit stream info logs
    try {
      await ffmpeg.exec(['-i', inputName, '-f', 'null', '-']);
    } catch {
      // Expected: FFmpeg exits with error when no output muxer is given
    }

    const text = logs.join('\n');

    // ── Pattern 1: "rotate          : 90" (metadata key in Stream info) ──
    const rotateKeyMatch = text.match(/rotate\s*:\s*(-?\d+)/i);
    if (rotateKeyMatch) {
      return normalizeRotation(parseInt(rotateKeyMatch[1], 10));
    }

    // ── Pattern 2: "rotation of -90.00 degrees" (displaymatrix side data) ──
    const displayMatrixMatch = text.match(/rotation of\s*(-?\d+(?:\.\d+)?)\s*degrees/i);
    if (displayMatrixMatch) {
      return normalizeRotation(Math.round(Number(displayMatrixMatch[1])));
    }

    return 0;
  } catch (err) {
    console.warn('[ViralCut][probe] probeVideoRotation error:', err);
    return 0;
  } finally {
    try { ffmpeg.off('log', onLog); } catch { /* ignore */ }
    try { await ffmpeg.deleteFile(inputName); } catch { /* ignore */ }
  }
}

function normalizeRotation(raw: number): 0 | 90 | 180 | 270 {
  const n = ((raw % 360) + 360) % 360;
  if (n === 90)  return 90;
  if (n === 180) return 180;
  if (n === 270) return 270;
  return 0;
}
