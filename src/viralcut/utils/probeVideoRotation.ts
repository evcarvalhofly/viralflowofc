// ============================================================
// ViralCut – probeVideoRotation
//
// Detects the real rotation metadata stored in a video file's
// container (e.g. iPhone/Android rotation tag) by running
// `ffmpeg -i <file>` and parsing the log output.
//
// ⚡ PERFORMANCE FIX (v2):
//   Previously wrote the FULL file (4K = 500MB+) to FFmpeg WASM
//   memory, causing a 2-minute freeze before export.
//
//   Now we slice ONLY the first few megabytes of the file.
//   The container header (where rotation metadata lives) is always
//   in the first ~1MB of MP4/MOV/HEVC files. FFmpeg can read it
//   from a truncated file and still emit the stream info log.
//   If the slice is too small to parse, we expand up to 20MB.
//
// This runs ONLY at import time, never during export.
// ============================================================

import { FFmpeg } from '@ffmpeg/ffmpeg';

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
 * Read the first `bytes` of a File as a Uint8Array without loading the whole file.
 */
function sliceFileHead(file: File, bytes: number): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const slice = file.slice(0, bytes);
    const reader = new FileReader();
    reader.onload  = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(slice);
  });
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

  // ── Strategy 1: Native HTMLVideoElement (no FFmpeg, instant) ────────────
  // Modern browsers (Chrome 111+, Safari 17+) expose video.videoWidth/Height
  // AFTER rotation correction. If the browser already tells us the display
  // orientation, we can derive rotation without FFmpeg at all.
  const nativeResult = await probeRotationViaBrowser(file);
  if (nativeResult !== null) {
    console.log('[ViralCut][probe] native browser probe succeeded:', nativeResult);
    return nativeResult;
  }

  // ── Strategy 2: FFmpeg on a small slice of the file ─────────────────────
  // Container metadata (moov atom in MP4/MOV) is almost always in the first
  // few MB. We try increasing slice sizes to avoid loading the whole file.
  let ffmpeg: FFmpeg;
  try {
    ffmpeg = await getFFmpeg();
  } catch (err) {
    console.warn('[ViralCut][probe] FFmpeg failed to load:', err);
    return 0;
  }

  // Probe with increasing slice sizes until we get a result or give up
  const sliceSizes = [
    2 * 1024 * 1024,   //  2 MB – catches most phone videos
    8 * 1024 * 1024,   //  8 MB – extra-large moov atoms
    20 * 1024 * 1024,  // 20 MB – worst-case fallback (still << full 4K file)
  ];

  for (const sliceBytes of sliceSizes) {
    // Never slice beyond actual file size
    const actualSize = Math.min(sliceBytes, file.size);
    const inputName = `probe-${Date.now()}.tmp`;
    const logs: string[] = [];
    const onLog = ({ message }: { message: string }) => logs.push(message);
    ffmpeg.on('log', onLog);

    try {
      console.log(`[ViralCut][probe] Trying FFmpeg slice: ${(actualSize / 1024 / 1024).toFixed(1)}MB of ${(file.size / 1024 / 1024).toFixed(1)}MB`);
      const headData = await sliceFileHead(file, actualSize);
      await ffmpeg.writeFile(inputName, headData);

      try {
        await ffmpeg.exec(['-i', inputName, '-f', 'null', '-']);
      } catch {
        // Expected — FFmpeg errors when no output muxer is provided
      }

      const text = logs.join('\n');

      // ── Pattern 1: "rotate          : 90" ──
      const rotateKeyMatch = text.match(/rotate\s*:\s*(-?\d+)/i);
      if (rotateKeyMatch) {
        const deg = normalizeRotation(parseInt(rotateKeyMatch[1], 10));
        console.log(`[ViralCut][probe] FFmpeg rotate key: ${deg}°`);
        return deg;
      }

      // ── Pattern 2: "rotation of -90.00 degrees" ──
      const displayMatrixMatch = text.match(/rotation of\s*(-?\d+(?:\.\d+)?)\s*degrees/i);
      if (displayMatrixMatch) {
        const deg = normalizeRotation(Math.round(Number(displayMatrixMatch[1])));
        console.log(`[ViralCut][probe] FFmpeg displayMatrix: ${deg}°`);
        return deg;
      }

      // If we got stream info (contains "Duration:") but no rotation tag, rotation = 0
      if (text.includes('Duration:')) {
        console.log('[ViralCut][probe] FFmpeg: no rotation tag found → 0°');
        return 0;
      }

      // Slice too small to parse — try a larger slice
      console.log(`[ViralCut][probe] Slice too small to parse, expanding…`);
    } catch (err) {
      console.warn('[ViralCut][probe] FFmpeg slice probe error:', err);
    } finally {
      try { ffmpeg.off('log', onLog); } catch { /* ignore */ }
      try { await ffmpeg.deleteFile(inputName); } catch { /* ignore */ }
    }

    // Already at max file size — no point trying larger slices
    if (actualSize >= file.size) break;
  }

  console.warn('[ViralCut][probe] All probe strategies failed → 0°');
  return 0;
}

/**
 * Attempt to detect rotation purely from the browser's video element.
 *
 * Some browsers (Chrome 111+) expose getVideoPlaybackQuality() or
 * automatically apply container rotation to videoWidth/videoHeight.
 * If the browser-reported dimensions are swapped relative to the
 * encoded dimensions, we can infer the rotation.
 *
 * Returns null if the browser cannot determine rotation.
 */
async function probeRotationViaBrowser(file: File): Promise<0 | 90 | 180 | 270 | null> {
  return new Promise((resolve) => {
    const objUrl = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'metadata';

    const cleanup = () => {
      URL.revokeObjectURL(objUrl);
      video.src = '';
    };

    const timeout = setTimeout(() => {
      cleanup();
      resolve(null); // timed out — fall through to FFmpeg
    }, 5000);

    video.onloadedmetadata = () => {
      clearTimeout(timeout);
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      cleanup();

      if (!vw || !vh) {
        resolve(null);
        return;
      }

      // We can't reliably tell rotation from videoWidth/videoHeight alone
      // without knowing the encoded dims. Return null to let FFmpeg decide.
      // This path is kept for future enhancement (e.g. VideoDecoder API).
      resolve(null);
    };

    video.onerror = () => {
      clearTimeout(timeout);
      cleanup();
      resolve(null);
    };

    video.src = objUrl;
  });
}

function normalizeRotation(raw: number): 0 | 90 | 180 | 270 {
  const n = ((raw % 360) + 360) % 360;
  if (n === 90)  return 90;
  if (n === 180) return 180;
  if (n === 270) return 270;
  return 0;
}

