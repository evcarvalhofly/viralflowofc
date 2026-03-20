// ============================================================
// ViralCut Export3 – Per-frame deterministic renderer (v15)
//
// Video frames are drawn directly from HTMLVideoElement.
// No createImageBitmap, no manual rotation — the browser's
// own decoder already produces a correctly-oriented image.
// Contain-fit (letterbox) is still applied. No stretching.
// ============================================================

import { Project, MediaFile, TrackItem } from '../types';
import { drawTextItemOnCanvas } from './textLayout';

export interface FrameRenderAssets {
  videoFrames: Map<string, HTMLVideoElement | ImageBitmap | null>;
  images:      Map<string, ImageBitmap>;
  mediaMap:    Map<string, MediaFile>;
}

export interface RenderFrameParams {
  ctx:      CanvasRenderingContext2D;
  timeSec:  number;
  width:    number;
  height:   number;
  project:  Project;
  assets:   FrameRenderAssets;
}

// ── Helpers ────────────────────────────────────────────────

function getActiveVideoItem(project: Project, timeSec: number): TrackItem | null {
  const videoTracks = project.tracks.filter(t => t.type === 'video' && !t.muted);
  const baseTrack = videoTracks.length > 0 ? videoTracks[0] : null;
  if (!baseTrack) return null;
  for (const item of baseTrack.items) {
    if (timeSec >= item.startTime && timeSec < item.endTime) return item;
  }
  return null;
}

function getOverlayItems(project: Project, timeSec: number) {
  const imageItems: TrackItem[] = [];
  const textItems:  TrackItem[] = [];
  const videoOverlays: TrackItem[] = [];

  const videoTracks = project.tracks.filter(t => t.type === 'video' && !t.muted);
  const overlayTracks = videoTracks.length > 1 ? videoTracks.slice(1) : [];

  for (const track of project.tracks) {
    if (track.muted) continue;
    for (const item of track.items) {
      if (timeSec < item.startTime || timeSec >= item.endTime) continue;
      if (track.type === 'image') imageItems.push(item);
      else if (track.type === 'text') textItems.push(item);
    }
  }

  for (const track of overlayTracks) {
    for (const item of track.items) {
      if (timeSec >= item.startTime && timeSec < item.endTime) videoOverlays.push(item);
    }
  }

  return { imageItems, textItems, videoOverlays };
}

/**
 * Contain-fit draw — scales source to fit dest proportionally, centered.
 * No stretching ever.
 */
function drawContain(
  ctx:   CanvasRenderingContext2D,
  source: CanvasImageSource,
  srcW:  number,
  srcH:  number,
  destW: number,
  destH: number,
  offsetX = 0,
  offsetY = 0
) {
  if (!srcW || !srcH) return;
  const scale = Math.min(destW / srcW, destH / srcH);
  const dw    = srcW * scale;
  const dh    = srcH * scale;
  const dx    = (destW - dw) / 2 + offsetX;
  const dy    = (destH - dh) / 2 + offsetY;
  ctx.drawImage(source, 0, 0, srcW, srcH, dx, dy, dw, dh);
}

// ── Main export ────────────────────────────────────────────

export function renderTimelineFrame({
  ctx,
  timeSec,
  width,
  height,
  project,
  assets,
}: RenderFrameParams) {
  // ── Background ─────────────────────────────────────────────
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, width, height);

  // ── Active video frame ─────────────────────────────────────
  const videoItem = getActiveVideoItem(project, timeSec);
  if (videoItem) {
    const videoEl = assets.videoFrames.get(videoItem.id);

    if (videoEl) {
      const vd = videoItem.videoDetails;
      const filters: string[] = [];
      if (vd?.brightness != null && vd.brightness !== 1) filters.push(`brightness(${vd.brightness})`);
      if (vd?.contrast   != null && vd.contrast   !== 1) filters.push(`contrast(${vd.contrast})`);
      if (vd?.saturation != null && vd.saturation !== 1) filters.push(`saturate(${vd.saturation})`);

      const srcW = ('videoWidth' in videoEl ? videoEl.videoWidth : videoEl.width) || width;
      const srcH = ('videoHeight' in videoEl ? videoEl.videoHeight : videoEl.height) || height;

      console.log('[DrawVideoElement]', {
        mediaId:     videoItem.mediaId,
        videoWidth:  srcW,
        videoHeight: srcH,
        canvasWidth: width,
        canvasHeight: height,
      });

      ctx.save();
      ctx.globalAlpha = vd?.opacity ?? 1;
      if (filters.length) {
        (ctx as CanvasRenderingContext2D & { filter: string }).filter = filters.join(' ');
      }

      if (vd?.flipH || vd?.flipV) {
        ctx.translate(vd?.flipH ? width : 0, vd?.flipV ? height : 0);
        ctx.scale(vd?.flipH ? -1 : 1, vd?.flipV ? -1 : 1);
      }

      drawContain(ctx, videoEl, srcW, srcH, width, height);

      if (filters.length) {
        (ctx as CanvasRenderingContext2D & { filter: string }).filter = 'none';
      }
      ctx.restore();
      ctx.globalAlpha = 1;
    }
  }

  const { imageItems, textItems, videoOverlays } = getOverlayItems(project, timeSec);

  // ── Image overlays ─────────────────────────────────────────
  for (const imgItem of imageItems) {
    const bmp = assets.images.get(imgItem.mediaId);
    if (!bmp) continue;
    const id = imgItem.imageDetails;
    const srcW = bmp.width;
    const srcH = bmp.height;
    
    const ox = ((id?.posX   ?? 50) / 100) * width;
    const oy = ((id?.posY   ?? 50) / 100) * height;
    const dw = ((id?.width  ?? 50) / 100) * width;
    const dh = dw * (srcH / srcW);

    ctx.save();
    ctx.globalAlpha = id?.opacity ?? 1;
    if (id?.flipH || id?.flipV) {
      ctx.translate(id.flipH ? ox * 2 : 0, id.flipV ? oy * 2 : 0);
      ctx.scale(id.flipH ? -1 : 1, id.flipV ? -1 : 1);
    }
    ctx.drawImage(bmp, ox - dw / 2, oy - dh / 2, dw, dh);
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  // ── Video overlays ─────────────────────────────────────────
  for (const vidItem of videoOverlays) {
    const videoEl = assets.videoFrames.get(vidItem.id);
    if (!videoEl) continue;
    
    const vd = vidItem.videoDetails;
    const srcW = ('videoWidth' in videoEl ? videoEl.videoWidth : videoEl.width) || width;
    const srcH = ('videoHeight' in videoEl ? videoEl.videoHeight : videoEl.height) || height;

    const ox = ((vd?.posX   ?? 50) / 100) * width;
    const oy = ((vd?.posY   ?? 50) / 100) * height;
    const dw = ((vd?.width  ?? 50) / 100) * width;
    const dh = dw * (srcH / srcW);

    ctx.save();
    ctx.globalAlpha = vd?.opacity ?? 1;
    
    const filters: string[] = [];
    if (vd?.brightness != null && vd.brightness !== 1) filters.push(`brightness(${vd.brightness})`);
    if (vd?.contrast   != null && vd.contrast   !== 1) filters.push(`contrast(${vd.contrast})`);
    if (vd?.saturation != null && vd.saturation !== 1) filters.push(`saturate(${vd.saturation})`);
    if (filters.length) {
      (ctx as CanvasRenderingContext2D & { filter: string }).filter = filters.join(' ');
    }

    if (vd?.flipH || vd?.flipV) {
      ctx.translate(vd.flipH ? ox * 2 : 0, vd.flipV ? oy * 2 : 0);
      ctx.scale(vd.flipH ? -1 : 1, vd.flipV ? -1 : 1);
    }
    
    ctx.drawImage(videoEl, ox - dw / 2, oy - dh / 2, dw, dh);
    
    if (filters.length) {
      (ctx as CanvasRenderingContext2D & { filter: string }).filter = 'none';
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  // ── Text overlays ──────────────────────────────────────────
  for (const textItem of textItems) {
    drawTextItemOnCanvas(ctx, textItem, width, height);
  }
}
