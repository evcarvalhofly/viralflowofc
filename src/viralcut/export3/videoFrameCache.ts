// ============================================================
// ViralCut Export3 – Video Frame Cache (v4)
//
// Key change in v4:
// After the video element loads, we immediately capture a PROBE
// frame via createImageBitmap(el) and compare its dimensions to
// el.videoWidth × el.videoHeight.
//
// WHY: Chrome's createImageBitmap() auto-applies container rotation
// but el.videoWidth/videoHeight always returns the ENCODED dimensions.
// So for a 3840×2160 encoded video with rotationDeg=90:
//   el.videoWidth  = 3840  (encoded)
//   el.videoHeight = 2160  (encoded)
//   probeBitmap.width  = 2160  (display — Chrome rotated it)
//   probeBitmap.height = 3840  (display — Chrome rotated it)
//
// By probing at load time, we know the TRUE display dimensions
// regardless of whether rotationDeg metadata has been probed yet
// (background FFmpeg probe may not have finished).
// ============================================================

import { MediaFile } from '../types';

const SEEK_EPSILON_SEC = 0.001;
const SEEK_TIMEOUT_MS = 3000;

export interface VideoFrameMeta {
  encodedWidth: number;
  encodedHeight: number;
  displayWidth: number;
  displayHeight: number;
  rotationDeg: 0 | 90 | 180 | 270;
  /** True if the browser's createImageBitmap auto-applies rotation */
  browserAutoRotates: boolean;
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

    const encodedWidth  = el.videoWidth  || 0;
    const encodedHeight = el.videoHeight || 0;

    // ── Probe: capture one frame to detect browser's actual bitmap dimensions ──
    // Chrome auto-applies container rotation inside createImageBitmap().
    // By comparing probe dims to videoWidth/videoHeight we know if it happened.
    let displayWidth  = encodedWidth;
    let displayHeight = encodedHeight;
    let browserAutoRotates = false;

    if (encodedWidth > 0 && encodedHeight > 0) {
      try {
        // If video is at time 0 and has not decoded yet, seek slightly forward
        if (el.readyState < 2 || el.currentTime === 0) {
          el.currentTime = 0.001;
          await new Promise<void>((resolve) => {
            const done = () => resolve();
            const t = setTimeout(done, 2000);
            el.addEventListener('seeked', () => { clearTimeout(t); done(); }, { once: true });
            el.addEventListener('timeupdate', () => { clearTimeout(t); done(); }, { once: true });
          });
        }

        const probeBitmap = await createImageBitmap(el);
        const bw = probeBitmap.width;
        const bh = probeBitmap.height;
        probeBitmap.close();

        const tol = Math.max(4, Math.round(Math.max(encodedWidth, encodedHeight) * 0.01));

        // Check if browser swapped W/H (applied 90° or 270° rotation)
        const browserSwapped =
          Math.abs(bw - encodedHeight) <= tol &&
          Math.abs(bh - encodedWidth)  <= tol;

        const browserNotSwapped =
          Math.abs(bw - encodedWidth)  <= tol &&
          Math.abs(bh - encodedHeight) <= tol;

        if (browserSwapped) {
          // Browser auto-rotated: bitmap is already in display orientation
          displayWidth      = bw;
          displayHeight     = bh;
          browserAutoRotates = true;
          console.log('[ViralCut][frame-cache] Browser auto-rotated. display:', bw, '×', bh);
        } else if (browserNotSwapped) {
          // Browser did NOT rotate: use rotationDeg metadata to set display dims
          browserAutoRotates = false;
          const rDeg = mediaFile?.rotationDeg ?? 0;
          if (rDeg === 90 || rDeg === 270) {
            displayWidth  = encodedHeight;
            displayHeight = encodedWidth;
          }
          console.log('[ViralCut][frame-cache] No browser rotation. rDeg=', rDeg, 'display:', displayWidth, '×', displayHeight);
        } else {
          // Probe returned unexpected dims (partial decode, CORS, etc.)
          // Fall back to rotationDeg as the most reliable signal
          browserAutoRotates = false;
          const rDeg = mediaFile?.rotationDeg ?? 0;
          if (rDeg === 90 || rDeg === 270) {
            displayWidth  = encodedHeight;
            displayHeight = encodedWidth;
          }
          console.warn('[ViralCut][frame-cache] Unexpected probe dims:', bw, '×', bh,
            '— falling back to rotationDeg=', rDeg, 'display:', displayWidth, '×', displayHeight);
        }
      } catch (e) {
        // Probe failed — fall back to rotationDeg metadata
        console.warn('[ViralCut][frame-cache] Probe frame failed:', e);
        const rDeg = mediaFile?.rotationDeg ?? 0;
        if (rDeg === 90 || rDeg === 270) {
          displayWidth  = encodedHeight;
          displayHeight = encodedWidth;
        }
      }
    }

    const meta: VideoFrameMeta = {
      encodedWidth,
      encodedHeight,
      displayWidth:  displayWidth  || encodedWidth,
      displayHeight: displayHeight || encodedHeight,
      rotationDeg:   (mediaFile?.rotationDeg ?? 0) as 0 | 90 | 180 | 270,
      browserAutoRotates,
    };

    console.log('[ViralCut][frame-cache] final meta', {
      mediaId,
      encodedWidth,
      encodedHeight,
      displayWidth:  meta.displayWidth,
      displayHeight: meta.displayHeight,
      rotationDeg:   meta.rotationDeg,
      browserAutoRotates,
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

    // Reuse when time is virtually identical (frame-accurate at 30/60fps)
    if (
      entry.lastBitmap !== null &&
      entry.lastDecodedTime >= 0 &&
      Math.abs(entry.lastDecodedTime - targetTime) <= SEEK_EPSILON_SEC
    ) {
      return entry.lastBitmap;
    }

    const needsSeek =
      entry.lastDecodedTime < 0 ||
      Math.abs(el.currentTime - targetTime) > SEEK_EPSILON_SEC ||
      el.readyState < 2;

    if (needsSeek) {
      await this._seekTo(el, targetTime);
    }

    const vw = el.videoWidth;
    const vh = el.videoHeight;
    if (vw === 0 || vh === 0) return null;

    let bitmap: ImageBitmap | null = null;
    try {
      // Capture raw frame — rotation is handled by renderer
      bitmap = await createImageBitmap(el);
    } catch {
      return null;
    }

    if (entry.lastBitmap) {
      try { entry.lastBitmap.close(); } catch { /* ignore */ }
    }

    entry.lastDecodedTime = targetTime;
    entry.lastBitmap = bitmap;

    return bitmap;
  }

  private _seekTo(el: HTMLVideoElement, time: number): Promise<void> {
    return new Promise<void>((resolve) => {
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
      const onError  = () => finish();

      el.addEventListener('seeked', onSeeked, { once: true });
      el.addEventListener('error',  onError,  { once: true });
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
