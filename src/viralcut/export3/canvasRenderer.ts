// ============================================================
// ViralCut Export3 – Canvas Renderer (v3)
//
// v3 changes:
// - Added getVideoMeta() to expose probed VideoFrameMeta
// - Added resize() to allow sceneExporter to correct canvas
//   dimensions after VideoFrameCache probes the first frame.
// ============================================================

import { Project, MediaFile } from '../types';
import { VideoFrameCache, VideoFrameMeta } from './videoFrameCache';
import { renderTimelineFrame, FrameRenderAssets } from './renderTimelineFrame';

export interface CanvasRendererOptions {
  width: number;
  height: number;
}

export class CanvasRenderer {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private frameCache: VideoFrameCache;
  private images = new Map<string, ImageBitmap>();
  private videoMeta = new Map<string, VideoFrameMeta>();

  constructor(opts: CanvasRendererOptions) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = opts.width;
    this.canvas.height = opts.height;
    this.ctx = this.canvas.getContext('2d', { alpha: false })!;
    this.ctx.fillStyle = '#000';
    this.ctx.fillRect(0, 0, opts.width, opts.height);
    this.frameCache = new VideoFrameCache();
  }

  /**
   * Resize the canvas. Call this after prepare() if probed metadata
   * reveals the initial dimensions were wrong (e.g. due to un-probed rotation).
   */
  resize(w: number, h: number): void {
    this.canvas.width  = w;
    this.canvas.height = h;
    this.ctx = this.canvas.getContext('2d', { alpha: false })!;
    this.ctx.fillStyle = '#000';
    this.ctx.fillRect(0, 0, w, h);
  }

  /**
   * Returns the probed VideoFrameMeta for a given media ID.
   * Available after prepare() has been called.
   */
  getVideoMeta(mediaId: string): VideoFrameMeta | null {
    return this.videoMeta.get(mediaId) ?? null;
  }

  /**
   * Pre-load all media needed by the project.
   * Must be called before renderFrame().
   */
  async prepare(
    project: Project,
    mediaMap: Map<string, MediaFile>,
    onProgress: (msg: string) => void
  ): Promise<void> {
    const videoIds = new Set<string>();
    const imageIds = new Set<string>();

    for (const track of project.tracks) {
      for (const item of track.items) {
        if (!item.mediaId) continue;
        if (track.type === 'video' || track.type === 'audio') videoIds.add(item.mediaId);
        else if (track.type === 'image') imageIds.add(item.mediaId);
      }
    }

    const vArr = [...videoIds];
    const iArr = [...imageIds];
    const total = vArr.length + iArr.length;
    let loaded = 0;

    for (const id of vArr) {
      const mf = mediaMap.get(id);
      if (!mf?.url) continue;
      onProgress(`Carregando vídeo ${++loaded}/${total}…`);
      // Pass the MediaFile so VideoFrameCache can use rotationDeg as fallback
      await this.frameCache.prepare(id, mf.url, mf);

      // Cache the probed metadata (includes probe-detected display dimensions)
      const meta = this.frameCache.getMeta(id);
      if (meta) this.videoMeta.set(id, meta);
    }

    for (const id of iArr) {
      const mf = mediaMap.get(id);
      if (!mf?.url) continue;
      onProgress(`Carregando imagem ${++loaded}/${total}…`);
      const bmp = await this._loadImage(mf.url);
      if (bmp) this.images.set(id, bmp);
    }
  }

  /**
   * Renders the timeline state at `timeSec` onto the canvas.
   */
  async renderFrame(project: Project, timeSec: number): Promise<void> {
    const { width, height } = this.canvas;

    let activeVideoMediaId: string | null = null;
    let activeVideoTime = 0;

    for (const track of project.tracks) {
      if (track.type !== 'video' || track.muted) continue;
      for (const item of track.items) {
        if (timeSec >= item.startTime && timeSec < item.endTime) {
          activeVideoMediaId = item.mediaId;
          const playbackRate = item.videoDetails?.playbackRate ?? 1;
          const clipOffset = timeSec - item.startTime;
          activeVideoTime = (item.mediaStart ?? 0) + clipOffset * playbackRate;
          break;
        }
      }
      if (activeVideoMediaId) break;
    }

    const videoFrames = new Map<string, ImageBitmap | null>();
    if (activeVideoMediaId !== null) {
      const frame = await this.frameCache.getFrame(
        activeVideoMediaId,
        activeVideoTime,
        width,
        height
      );
      videoFrames.set(activeVideoMediaId, frame);
    }

    const assets: FrameRenderAssets = {
      videoFrames,
      videoMeta: this.videoMeta,
      images: this.images,
    };

    renderTimelineFrame({
      ctx: this.ctx,
      timeSec,
      width,
      height,
      project,
      assets,
    });
  }

  private _loadImage(url: string): Promise<ImageBitmap | null> {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => createImageBitmap(img).then(resolve).catch(() => resolve(null));
      img.onerror = () => resolve(null);
      img.src = url;
    });
  }

  dispose() {
    this.frameCache.dispose();
    this.images.forEach((bmp) => { try { bmp.close(); } catch { /* ignore */ } });
    this.images.clear();
    this.videoMeta.clear();
  }
}
