// ============================================================
// ViralCut Export3 – Video Frame Cache (v9 — precise seeking)
//
// Draws the browser-decoded <video> element directly onto canvas.
// No createImageBitmap, no rotation, no metadata.
// The browser already handles orientation correctly for display.
//
// v9: Tight seek epsilon + requestVideoFrameCallback for precise
//     frame-by-frame extraction (fixes FPS loss on re-exported videos).
// ============================================================

const SEEK_EPSILON_SEC = 1 / 500;  // ~2ms — tight enough for 60fps (16.6ms per frame)
const SEEK_TIMEOUT_MS  = 4000;     // 4s generous timeout

export class VideoFrameCache {
  private videos = new Map<string, HTMLVideoElement>();
  private lastSeekTime = new Map<string, number>(); // track last captured time per video

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
    this.lastSeekTime.set(id, -1);
    console.log('[VideoFrameCache] prepared', id,
      el.videoWidth, 'x', el.videoHeight,
      el.videoHeight > el.videoWidth ? 'portrait' : 'landscape'
    );
  }

  /**
   * Wait for seek to complete. Uses requestVideoFrameCallback when available
   * to ensure the browser has actually decoded a new frame (not just seeked
   * to the nearest keyframe). This is critical for re-exported H.264 videos
   * where keyframe-only seeking causes duplicate frames.
   */
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
        el.removeEventListener('seeked', onSeeked);
        el.removeEventListener('error',  finish);
        resolve();
      };

      const timer = setTimeout(finish, SEEK_TIMEOUT_MS);
      el.addEventListener('error', finish, { once: true });

      const onSeeked = () => {
        if (done) return;
        // If requestVideoFrameCallback is available, wait for the actual
        // frame to be presented — this ensures we get the decoded frame,
        // not just a keyframe approximation
        if ('requestVideoFrameCallback' in el) {
          (el as any).requestVideoFrameCallback(() => finish());
        } else {
          finish();
        }
      };

      el.addEventListener('seeked', onSeeked, { once: true });
      el.currentTime = time;
    });
  }

  /** Seek to `time` and return the HTMLVideoElement for direct canvas drawing. */
  async getVideoElement(id: string, time: number): Promise<HTMLVideoElement | null> {
    const el = this.videos.get(id);
    if (!el) return null;

    const targetTime = Math.max(0, Math.min(time, Math.max(0, (el.duration || 9999) - 0.001)));
    await this.waitSeek(el, targetTime);

    // Anti-duplicate: if after seeking the currentTime hasn't moved from the
    // last captured frame, nudge forward by 1ms to force a new frame decode
    const lastTime = this.lastSeekTime.get(id) ?? -1;
    if (lastTime >= 0 && Math.abs(el.currentTime - lastTime) < SEEK_EPSILON_SEC && Math.abs(targetTime - lastTime) > SEEK_EPSILON_SEC) {
      const nudged = targetTime + 0.001;
      await this.waitSeek(el, nudged);
    }

    this.lastSeekTime.set(id, el.currentTime);

    if (el.videoWidth === 0 || el.videoHeight === 0) return null;
    return el;
  }

  dispose() {
    this.videos.forEach((el) => {
      try { el.pause(); el.removeAttribute('src'); el.load(); } catch { /* ignore */ }
    });
    this.videos.clear();
    this.lastSeekTime.clear();
  }
}
