// ============================================================
// ViralCut Export3 – Video Frame Cache (v5)
//
// v5: Deep fix for high-quality 4K portrait videos.
//
// ROOT CAUSE of the landscape bug:
//   For large 4K files, createImageBitmap(el) at t=0.001 often
//   returns the bitmap in ENCODED orientation (landscape 3840×2160)
//   because the browser hasn't decoded enough frames yet to apply
//   the container rotation. The probe then incorrectly concludes
//   browserAutoRotates=false AND displayWidth=3840 (landscape).
//
// FIX STRATEGY (multi-layer):
//   1. Retry probe up to 5 times at increasing seek positions
//      until the bitmap dimensions differ from encoded (swap detected)
//      OR we get a stable non-zero result.
//   2. If after all retries the probe still matches encoded dims
//      (no swap detected), ALWAYS fall back to rotationDeg from
//      MediaFile metadata as the authoritative rotation source.
//   3. rotationDeg=90|270 means display is portrait even if the
//      bitmap probe returned landscape — this wins over the probe.
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

// Probe seek positions to try (seconds into video)
const PROBE_SEEK_POSITIONS = [0.001, 0.1, 0.5, 1.0, 2.0];

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

    let displayWidth  = encodedWidth;
    let displayHeight = encodedHeight;
    let browserAutoRotates = false;

    // The rotationDeg from MediaFile metadata (set by FFmpeg probe at import)
    const knownRotationDeg = (mediaFile?.rotationDeg ?? 0) as 0 | 90 | 180 | 270;

    if (encodedWidth > 0 && encodedHeight > 0) {
      // ── Multi-attempt probe ────────────────────────────────────
      // Try up to N seek positions. We stop early if we detect a
      // browser swap (best-case scenario). If we never detect a swap,
      // we fall back to knownRotationDeg as the authoritative source.
      const tol = Math.max(4, Math.round(Math.max(encodedWidth, encodedHeight) * 0.01));

      let probeResolved = false;

      for (const seekPos of PROBE_SEEK_POSITIONS) {
        const maxSeek = el.duration > 0 ? Math.min(seekPos, el.duration - 0.001) : seekPos;
        if (maxSeek < 0) continue;

        try {
          // Seek to position
          if (Math.abs(el.currentTime - maxSeek) > SEEK_EPSILON_SEC) {
            el.currentTime = maxSeek;
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

          // Skip degenerate bitmaps (0-size or clearly invalid)
          if (bw === 0 || bh === 0) {
            console.log(`[ViralCut][frame-cache] Probe at t=${maxSeek}: degenerate bitmap (${bw}×${bh}), retrying...`);
            continue;
          }

          const browserSwapped =
            Math.abs(bw - encodedHeight) <= tol &&
            Math.abs(bh - encodedWidth)  <= tol;

          const browserNotSwapped =
            Math.abs(bw - encodedWidth)  <= tol &&
            Math.abs(bh - encodedHeight) <= tol;

          if (browserSwapped) {
            // Browser auto-rotated: bitmap is already in display orientation (portrait)
            displayWidth      = bw;
            displayHeight     = bh;
            browserAutoRotates = true;
            probeResolved = true;
            console.log(`[ViralCut][frame-cache] Probe at t=${maxSeek}: browser auto-rotated. display: ${bw}×${bh}`);
            break; // definitive — stop retrying
          } else if (browserNotSwapped) {
            // Bitmap matches encoded dims exactly.
            // The browser did NOT apply rotation.
            // Trust rotationDeg metadata to determine true display dims.
            browserAutoRotates = false;
            probeResolved = true;
            console.log(`[ViralCut][frame-cache] Probe at t=${maxSeek}: no browser rotation detected. rotationDeg=${knownRotationDeg}`);
            break; // also definitive — stop retrying
          } else {
            // Unexpected dims (partial decode, CORS, etc.) — retry
            console.log(`[ViralCut][frame-cache] Probe at t=${maxSeek}: unexpected dims ${bw}×${bh} (encoded: ${encodedWidth}×${encodedHeight}), retrying...`);
          }
        } catch (e) {
          console.warn(`[ViralCut][frame-cache] Probe at t=${seekPos} failed:`, e);
        }
      }

      // ── Apply rotationDeg as primary truth for display dims ────
      // Regardless of probe outcome, rotationDeg from the MediaFile
      // (set by FFmpeg probe at import) is the authoritative source
      // for whether to swap display dimensions.
      //
      // If browserAutoRotates=true, the bitmap is already portrait —
      // displayWidth/Height are already correct from the probe.
      //
      // If browserAutoRotates=false, use rotationDeg to derive display dims.
      if (!browserAutoRotates) {
        if (knownRotationDeg === 90 || knownRotationDeg === 270) {
          // Container says rotate 90/270: display is portrait
          displayWidth  = encodedHeight;
          displayHeight = encodedWidth;
          console.log(`[ViralCut][frame-cache] rotationDeg=${knownRotationDeg} → display: ${displayWidth}×${displayHeight} (portrait)`);
        } else {
          // No rotation: display matches encoded
          displayWidth  = encodedWidth;
          displayHeight = encodedHeight;
        }
      }

      if (!probeResolved) {
        console.warn(`[ViralCut][frame-cache] All probe attempts failed — using rotationDeg=${knownRotationDeg} fallback`);
      }
    }

    const meta: VideoFrameMeta = {
      encodedWidth,
      encodedHeight,
      displayWidth:  displayWidth  || encodedWidth,
      displayHeight: displayHeight || encodedHeight,
      rotationDeg:   knownRotationDeg,
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
