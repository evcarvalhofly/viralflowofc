// ============================================================
// ViralCut Export3 – Canvas Renderer (v7)
//
// Draws HTMLVideoElement directly — no ImageBitmap for video.
// Audio tracks are NOT loaded into VideoFrameCache.
// ============================================================

import { Project, MediaFile } from '../types';
import { VideoFrameCache } from './videoFrameCache';
import { renderTimelineFrame, FrameRenderAssets } from './renderTimelineFrame';

export interface CanvasRendererOptions {
  width:  number;
  height: number;
}

export class CanvasRenderer {
  readonly canvas: HTMLCanvasElement;
  private ctx:        CanvasRenderingContext2D;
  private frameCache: VideoFrameCache;
  private images    = new Map<string, ImageBitmap>();
  private mediaMap  = new Map<string, MediaFile>();

  constructor(opts: CanvasRendererOptions) {
    this.canvas        = document.createElement('canvas');
    this.canvas.width  = opts.width;
    this.canvas.height = opts.height;
    this.ctx           = this.canvas.getContext('2d', { alpha: false })!;
    this.frameCache    = new VideoFrameCache();
    this._clear();
  }

  private _clear() {
    this.ctx.fillStyle = '#000';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  /**
   * Pre-load all media needed by the project.
   * Must be called before renderFrame().
   * Audio tracks are intentionally excluded from VideoFrameCache.
   */
  async prepare(
    project:    Project,
    mediaMap:   Map<string, MediaFile>,
    onProgress: (msg: string) => void
  ): Promise<void> {
    this.mediaMap = mediaMap;

    const videoIds = new Set<string>();
    const imageIds = new Set<string>();

    for (const track of project.tracks) {
      for (const item of track.items) {
        if (!item.mediaId) continue;
        if (track.type === 'video') {
          videoIds.add(item.mediaId);
        } else if (track.type === 'image') {
          imageIds.add(item.mediaId);
        }
      }
    }

    const vArr  = [...videoIds];
    const iArr  = [...imageIds];
    const total = vArr.length + iArr.length;
    let loaded  = 0;

    for (const id of vArr) {
      const mf = mediaMap.get(id);
      if (!mf?.url) continue;
      onProgress(`Carregando vídeo ${++loaded}/${total}…`);
      await this.frameCache.prepare(id, mf.url);
    }

    for (const id of iArr) {
      const mf = mediaMap.get(id);
      if (!mf?.url) continue;
      onProgress(`Carregando imagem ${++loaded}/${total}…`);
      const bmp = await this._loadImage(mf.url);
      if (bmp) this.images.set(id, bmp);
    }

    // Ensure Google Fonts (and any other web fonts) are fully loaded before canvas rendering
    await document.fonts.ready;
  }

  /** Renders the timeline state at `timeSec` onto the canvas. */
  async renderFrame(project: Project, timeSec: number): Promise<void> {
    const { width, height } = this.canvas;

    // Collect the active video element for each active video track item
    const videoFrames = new Map<string, HTMLVideoElement | null>();

    for (const track of project.tracks) {
      if (track.type !== 'video' || track.muted) continue;
      for (const item of track.items) {
        if (timeSec >= item.startTime && timeSec < item.endTime) {
          const playbackRate = item.videoDetails?.playbackRate ?? 1;
          const mediaTime    = (item.mediaStart ?? 0) + (timeSec - item.startTime) * playbackRate;
          const videoEl      = await this.frameCache.getVideoElement(item.mediaId, mediaTime);
          videoFrames.set(item.id, videoEl); // Use item.id to support duplicate media inputs
          break;
        }
      }
    }

    const assets: FrameRenderAssets = {
      videoFrames,
      images:   this.images,
      mediaMap: this.mediaMap,
    };

    renderTimelineFrame({ ctx: this.ctx, timeSec, width, height, project, assets });
  }

  private _loadImage(url: string): Promise<ImageBitmap | null> {
    return new Promise((resolve) => {
      const img        = new Image();
      img.crossOrigin  = 'anonymous';
      img.onload  = () => createImageBitmap(img).then(resolve).catch(() => resolve(null));
      img.onerror = () => resolve(null);
      img.src = url;
    });
  }

  dispose() {
    this.frameCache.dispose();
    this.images.forEach((bmp) => { try { bmp.close(); } catch { /* ignore */ } });
    this.images.clear();
    this.mediaMap.clear();
  }
}
