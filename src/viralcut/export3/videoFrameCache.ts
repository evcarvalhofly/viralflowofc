// ============================================================
// ViralCut Export3 – Video Frame Cache (v7 — orientation-free)
//
// Single source of truth: video.videoWidth / video.videoHeight
// from the browser decoder — already display-correct.
//
// No rotation. No metadata. No FFmpeg.
// ============================================================

const SEEK_EPSILON_SEC   = 1 / 120;   // ~8ms — skip seek if within this range
const FRAME_REUSE_EPSILON = 1 / 60;   // ~16ms — reuse cached bitmap if within this range
const SEEK_TIMEOUT_MS    = 8000;

interface CachedFrame {
  bitmap: ImageBitmap | null;
  time: number;
}

export class VideoFrameCache {
  private videos     = new Map<string, HTMLVideoElement>();
  private frameCache = new Map<string, CachedFrame>();

  async prepare(id: string, url: string): Promise<void> {
    if (this.videos.has(id)) return;

    const el = document.createElement('video');
    el.crossOrigin = 'anonymous';
    el.muted       = true;
    el.playsInline = true;
    el.preload     = 'auto';
    el.src         = url;

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
      el.addEventListener('loadeddata',     done, { once: true });
      el.addEventListener('error',          done, { once: true });
      el.load();
    });

    this.videos.set(id, el);
    console.log('[VideoFrameCache] prepared', id,
      el.videoWidth, 'x', el.videoHeight,
      el.videoHeight > el.videoWidth ? 'portrait' : 'landscape'
    );
  }

  private waitSeek(el: HTMLVideoElement, time: number): Promise<void> {
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
        el.removeEventListener('seeked', finish);
        el.removeEventListener('error',  finish);
        resolve();
      };

      const timer = setTimeout(finish, SEEK_TIMEOUT_MS);
      el.addEventListener('seeked', finish, { once: true });
      el.addEventListener('error',  finish, { once: true });
      el.currentTime = time;
    });
  }

  async getFrame(id: string, time: number): Promise<ImageBitmap | null> {
    const el = this.videos.get(id);
    if (!el) return null;

    // Reuse cached bitmap when time hasn't changed significantly
    const prev = this.frameCache.get(id);
    if (prev && Math.abs(prev.time - time) <= FRAME_REUSE_EPSILON) {
      return prev.bitmap;
    }

    const targetTime = Math.max(0, Math.min(time, Math.max(0, (el.duration || 9999) - 0.001)));
    await this.waitSeek(el, targetTime);

    if (el.videoWidth === 0 || el.videoHeight === 0) return null;

    let bitmap: ImageBitmap | null = null;
    try {
      bitmap = await createImageBitmap(el);
    } catch {
      return null;
    }

    // Release old bitmap
    const old = this.frameCache.get(id);
    if (old?.bitmap) {
      try { old.bitmap.close(); } catch { /* ignore */ }
    }

    this.frameCache.set(id, { bitmap, time: targetTime });
    return bitmap;
  }

  dispose() {
    this.frameCache.forEach(({ bitmap }) => {
      try { bitmap?.close(); } catch { /* ignore */ }
    });
    this.frameCache.clear();

    this.videos.forEach((el) => {
      try { el.pause(); el.removeAttribute('src'); el.load(); } catch { /* ignore */ }
    });
    this.videos.clear();
  }
}
