// ============================================================
// ViralCut Export3 – Video Frame Cache (v3)
//
// Decodes video frames deterministically for export.
// Uses a hidden HTMLVideoElement per mediaId, seeking to the
// exact frame time needed, then captures via createImageBitmap.
//
// v3 changes:
//  - SEEK_EPSILON_SEC = 0.001 (was 0.04) → frame-accurate at 30/60fps
//  - Prioritizes mediaFile.displayWidth/Height and rotationDeg
// ============================================================

import { MediaFile } from '../types';

// Only reuse when time is virtually identical (avoids duplicate frames at 30/60fps)
const SEEK_EPSILON_SEC = 0.001;
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

    // ── Resolve geometry from MediaFile metadata (priority) ──
    const encodedWidth  = el.videoWidth  || 0;
    const encodedHeight = el.videoHeight || 0;

    // PRIORITY 1: use resolved rotation from MediaFile (set at import time)
    const rotationDeg: 0 | 90 | 180 | 270 = mediaFile?.rotationDeg ?? 0;

    // PRIORITY 2: use displayWidth/displayHeight from MediaFile if available
    const resolvedDisplayW =
      mediaFile?.displayWidth && mediaFile.displayWidth > 0
        ? mediaFile.displayWidth
        : (rotationDeg === 90 || rotationDeg === 270 ? encodedHeight : encodedWidth);

    const resolvedDisplayH =
      mediaFile?.displayHeight && mediaFile.displayHeight > 0
        ? mediaFile.displayHeight
        : (rotationDeg === 90 || rotationDeg === 270 ? encodedWidth : encodedHeight);

    const meta: VideoFrameMeta = {
      encodedWidth,
      encodedHeight,
      displayWidth:  resolvedDisplayW  || encodedWidth,
      displayHeight: resolvedDisplayH || encodedHeight,
      rotationDeg,
    };

    // TEMP DEBUG
    console.log('[ViralCut][frame-cache] resolved meta', {
      mediaId,
      encodedWidth,
      encodedHeight,
      displayWidth:  meta.displayWidth,
      displayHeight: meta.displayHeight,
      rotationDeg,
    });

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

    const { el } = entry;
    const targetTime = Math.max(
      0,
      Math.min(timeInMedia, Math.max(0, (el.duration || 9999) - 0.001))
    );

    // ── Reuse only when time is virtually identical (frame-accurate) ──
    if (
      entry.lastBitmap !== null &&
      entry.lastDecodedTime >= 0 &&
      Math.abs(entry.lastDecodedTime - targetTime) <= SEEK_EPSILON_SEC
    ) {
      return entry.lastBitmap;
    }

    // ── Seek only if needed ─────────────────────────────────────
    const needsSeek =
      entry.lastDecodedTime < 0 ||
      Math.abs(el.currentTime - targetTime) > SEEK_EPSILON_SEC ||
      el.readyState < 2;

    if (needsSeek) {
      await this._seekTo(el, targetTime);
    }

    // ── Capture frame using encoded dimensions (no aggressive resize) ──
    const vw = el.videoWidth;
    const vh = el.videoHeight;
    if (vw === 0 || vh === 0) return null;

    let bitmap: ImageBitmap | null = null;
    try {
      // Capture raw frame without resizing — rotation is handled by renderer
      bitmap = await createImageBitmap(el);
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
      if (Math.abs(el.currentTime - time) <= SEEK_EPSILON_SEC && el.readyState >= 2) {
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
