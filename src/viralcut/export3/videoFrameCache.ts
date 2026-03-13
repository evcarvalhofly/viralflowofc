// ============================================================
// ViralCut Export3 – Video Frame Cache (v2)
//
// Decodes video frames deterministically for export.
// Uses a hidden HTMLVideoElement per mediaId, seeking to the
// exact frame time needed, then captures via createImageBitmap.
//
// Improvements over v1:
//  - Stores rotation metadata per video (for cellphone footage)
//  - Sequential frame reuse: skips seek + createImageBitmap when
//    the requested time is within SEEK_THRESHOLD_SEC of the last
//    decoded frame, returning the cached bitmap instead
//  - Only creates new ImageBitmap when the frame actually changes
// ============================================================

import { MediaFile } from '../types';

const SEEK_THRESHOLD_SEC = 0.04; // Reduced from 0.1 → avoids duplicate frames
const SEEK_TIMEOUT_MS = 3000;

export interface VideoFrameMeta {
  encodedWidth: number;
  encodedHeight: number;
  displayWidth: number;
  displayHeight: number;
  rotationDeg: 0 | 90 | 180 | 270;
}

interface VideoEntry {
  el: HTMLVideoElement;
  lastDecodedTime: number;
  lastBitmap: ImageBitmap | null;
  meta: VideoFrameMeta;
}

export class VideoFrameCache {
  private cache = new Map<string, VideoEntry>();

  async prepare(mediaId: string, url: string, mediaFile?: MediaFile): Promise<void> {
    if (this.cache.has(mediaId)) return;

    const el = document.createElement('video');
    el.muted = true;
    el.playsInline = true;
    el.crossOrigin = 'anonymous';
    el.preload = 'auto';

    await new Promise<void>((resolve) => {
      let settled = false;
      const done = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve();
      };
      const timer = setTimeout(done, 15_000);
      el.addEventListener('canplaythrough', done, { once: true });
      el.addEventListener('canplay', done, { once: true });
      el.addEventListener('error', done, { once: true });
      el.src = url;
      el.load();
    });

    // ── Detect rotation from encoded vs declared dimensions ──
    const encodedWidth = el.videoWidth || 0;
    const encodedHeight = el.videoHeight || 0;

    // declared dimensions from MediaFile (set when user imports media)
    const declaredWidth = mediaFile?.width ?? encodedWidth;
    const declaredHeight = mediaFile?.height ?? encodedHeight;

    let rotationDeg: 0 | 90 | 180 | 270 = 0;

    // Heuristic: if the declared dimensions say portrait but the
    // encoded element comes out landscape → the stream was recorded
    // rotated 90° and the container carries a rotation matrix.
    if (
      declaredHeight > declaredWidth &&
      encodedWidth > encodedHeight &&
      encodedWidth > 0 &&
      encodedHeight > 0
    ) {
      rotationDeg = 90;
    } else if (
      declaredWidth > declaredHeight &&
      encodedHeight > encodedWidth &&
      encodedWidth > 0 &&
      encodedHeight > 0
    ) {
      rotationDeg = 270;
    }

    // displayWidth/displayHeight reflect the correct visual orientation
    const displayWidth  = (rotationDeg === 90 || rotationDeg === 270) ? encodedHeight : encodedWidth;
    const displayHeight = (rotationDeg === 90 || rotationDeg === 270) ? encodedWidth  : encodedHeight;

    const meta: VideoFrameMeta = {
      encodedWidth,
      encodedHeight,
      displayWidth: displayWidth  || declaredWidth,
      displayHeight: displayHeight || declaredHeight,
      rotationDeg,
    };

    console.log('[VideoFrameCache] Video meta', mediaId, meta);

    this.cache.set(mediaId, {
      el,
      lastDecodedTime: -1,
      lastBitmap: null,
      meta,
    });
  }

  getMeta(mediaId: string): VideoFrameMeta | null {
    return this.cache.get(mediaId)?.meta ?? null;
  }

  async getFrame(
    mediaId: string,
    timeInMedia: number,
    outWidth: number,
    outHeight: number
  ): Promise<ImageBitmap | null> {
    const entry = this.cache.get(mediaId);
    if (!entry) return null;

    const { el, meta } = entry;
    const targetTime = Math.max(
      0,
      Math.min(timeInMedia, Math.max(0, (el.duration || 9999) - 0.001))
    );

    // ── Sequential reuse: skip seek + decode if time is close ──
    if (
      entry.lastBitmap !== null &&
      entry.lastDecodedTime >= 0 &&
      Math.abs(entry.lastDecodedTime - targetTime) < SEEK_THRESHOLD_SEC
    ) {
      return entry.lastBitmap;
    }

    // ── Seek only if needed ─────────────────────────────────────
    const needsSeek =
      entry.lastDecodedTime < 0 ||
      Math.abs(el.currentTime - targetTime) > SEEK_THRESHOLD_SEC ||
      el.readyState < 2;

    if (needsSeek) {
      await this._seekTo(el, targetTime);
    }

    // ── Capture frame ──────────────────────────────────────────
    const vw = el.videoWidth || outWidth;
    const vh = el.videoHeight || outHeight;
    if (vw === 0 || vh === 0) return null;

    let bitmap: ImageBitmap | null = null;
    try {
      bitmap = await createImageBitmap(el, 0, 0, vw, vh);
    } catch {
      return null;
    }

    // Close the previous cached bitmap before replacing
    if (entry.lastBitmap) {
      try { entry.lastBitmap.close(); } catch { /* ignore */ }
    }

    entry.lastDecodedTime = targetTime;
    entry.lastBitmap = bitmap;

    return bitmap;
  }

  private _seekTo(el: HTMLVideoElement, time: number): Promise<void> {
    return new Promise<void>((resolve) => {
      // Already there
      if (Math.abs(el.currentTime - time) < 0.01 && el.readyState >= 2) {
        resolve();
        return;
      }

      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        el.removeEventListener('seeked', onSeeked);
        el.removeEventListener('error', onError);
        resolve();
      };

      const timer = setTimeout(finish, SEEK_TIMEOUT_MS);
      const onSeeked = () => finish();
      const onError = () => finish();

      el.addEventListener('seeked', onSeeked, { once: true });
      el.addEventListener('error', onError, { once: true });
      el.currentTime = time;
    });
  }

  dispose() {
    this.cache.forEach(({ el, lastBitmap }) => {
      try { el.pause(); el.src = ''; } catch { /* ignore */ }
      if (lastBitmap) { try { lastBitmap.close(); } catch { /* ignore */ } }
    });
    this.cache.clear();
  }
}
