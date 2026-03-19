// ============================================================
// ViralCut Export3 – Video Frame Cache (v6 — clean)
//
// SINGLE SOURCE OF TRUTH: video.videoWidth / video.videoHeight
//
// The browser always returns visually-correct display dimensions
// from videoWidth/videoHeight — rotation metadata is already applied
// by the browser's decoder. We NEVER read rotationDeg here.
//
// No FFmpeg. No metadata. No rotation heuristics.
// ============================================================

const SEEK_EPSILON_SEC = 0.001;
const SEEK_TIMEOUT_MS  = 5000;

export interface VideoFrameMeta {
  displayWidth:  number;   // Browser-reported, already rotation-corrected
  displayHeight: number;
}

interface VideoEntry {
  el:               HTMLVideoElement;
  lastDecodedTime:  number;
  lastBitmap:       ImageBitmap | null;
  meta:             VideoFrameMeta;
}

export class VideoFrameCache {
  private cache = new Map<string, VideoEntry>();

  async prepare(mediaId: string, url: string): Promise<void> {
    if (this.cache.has(mediaId)) return;

    const el = document.createElement('video');
    el.muted       = true;
    el.playsInline = true;
    el.crossOrigin = 'anonymous';
    el.preload     = 'auto';

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
      el.addEventListener('canplay',        done, { once: true });
      el.addEventListener('error',          done, { once: true });
      el.src = url;
      el.load();
    });

    // Trust browser completely — videoWidth/videoHeight are already display-correct
    const displayWidth  = el.videoWidth  || 0;
    const displayHeight = el.videoHeight || 0;

    const meta: VideoFrameMeta = { displayWidth, displayHeight };

    console.log('[ViralCut][frame-cache] prepared', { mediaId, displayWidth, displayHeight });

    this.cache.set(mediaId, { el, lastDecodedTime: -1, lastBitmap: null, meta });
  }

  getMeta(mediaId: string): VideoFrameMeta | null {
    return this.cache.get(mediaId)?.meta ?? null;
  }

  async getFrame(
    mediaId:      string,
    timeInMedia:  number,
  ): Promise<ImageBitmap | null> {
    const entry = this.cache.get(mediaId);
    if (!entry) return null;

    const { el } = entry;
    const targetTime = Math.max(
      0,
      Math.min(timeInMedia, Math.max(0, (el.duration || 9999) - 0.001))
    );

    // Reuse cached bitmap when time hasn't changed
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

    if (el.videoWidth === 0 || el.videoHeight === 0) return null;

    let bitmap: ImageBitmap | null = null;
    try {
      bitmap = await createImageBitmap(el);
    } catch {
      return null;
    }

    if (entry.lastBitmap) {
      try { entry.lastBitmap.close(); } catch { /* ignore */ }
    }

    entry.lastDecodedTime = targetTime;
    entry.lastBitmap      = bitmap;

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
        el.removeEventListener('error',  onError);
        resolve();
      };

      const timer   = setTimeout(finish, SEEK_TIMEOUT_MS);
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
