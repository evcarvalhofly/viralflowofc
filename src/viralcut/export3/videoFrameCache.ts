// ============================================================
// ViralCut Export3 – Video Frame Cache
//
// Decodes video frames deterministically for export.
// Uses a hidden HTMLVideoElement per mediaId, seeking to the
// exact frame time needed, then captures via drawImage.
//
// Strategy:
//  - One HTMLVideoElement per mediaId (reused across frames)
//  - Sequential playback where possible (no unnecessary seeks)
//  - Forced seek when frame time differs by more than threshold
//  - Returns an ImageBitmap or null if decoding failed
// ============================================================

const SEEK_THRESHOLD_SEC = 0.1; // Only seek if off by more than 100ms
const SEEK_TIMEOUT_MS = 3000;

interface VideoEntry {
  el: HTMLVideoElement;
  lastTime: number;
  ready: boolean;
}

export class VideoFrameCache {
  private cache = new Map<string, VideoEntry>();

  async prepare(mediaId: string, url: string): Promise<void> {
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

    this.cache.set(mediaId, { el, lastTime: -1, ready: true });
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

    const needsSeek =
      entry.lastTime < 0 ||
      Math.abs(el.currentTime - targetTime) > SEEK_THRESHOLD_SEC ||
      el.readyState < 2;

    if (needsSeek) {
      await this._seekTo(el, targetTime);
    }

    entry.lastTime = targetTime;

    // Capture frame into offscreen canvas
    const vw = el.videoWidth || outWidth;
    const vh = el.videoHeight || outHeight;
    if (vw === 0 || vh === 0) return null;

    try {
      return await createImageBitmap(el, 0, 0, vw, vh);
    } catch {
      return null;
    }
  }

  private _seekTo(el: HTMLVideoElement, time: number): Promise<void> {
    return new Promise<void>((resolve) => {
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
    this.cache.forEach(({ el }) => {
      try { el.pause(); el.src = ''; } catch { /* ignore */ }
    });
    this.cache.clear();
  }
}
