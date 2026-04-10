// ============================================================
// ViralCut Export3 – Video Frame Cache (v10 — fast precise seeking)
//
// Draws the browser-decoded <video> element directly onto canvas.
// No createImageBitmap, no rotation, no metadata.
// The browser already handles orientation correctly for display.
//
// v10: Tight seek epsilon for precision, lightweight seek flow
//      for speed. No requestVideoFrameCallback (adds vsync delay).
// ============================================================

const SEEK_EPSILON_SEC = 1 / 500;  // ~2ms — tight enough for 60fps
const SEEK_TIMEOUT_MS  = 3000;     // 3s timeout

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

  /** Seek and wait for the browser to decode the frame. */
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

  /** Seek to `time` and return the HTMLVideoElement for direct canvas drawing. */
  async getVideoElement(id: string, time: number): Promise<HTMLVideoElement | null> {
    const el = this.videos.get(id);
    if (!el) return null;

    let targetTime = Math.max(0, Math.min(time, Math.max(0, (el.duration || 9999) - 0.001)));

    // Anti-duplicate: if target would land on the same time as last frame, nudge +1ms
    const lastTime = this.lastSeekTime.get(id) ?? -1;
    if (lastTime >= 0 && Math.abs(targetTime - lastTime) > SEEK_EPSILON_SEC && Math.abs(el.currentTime - lastTime) < SEEK_EPSILON_SEC) {
      targetTime += 0.001;
    }

    await this.waitSeek(el, targetTime);
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
