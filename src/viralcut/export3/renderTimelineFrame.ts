// ============================================================
// ViralCut Export3 – Per-frame deterministic renderer (v12 — clean)
//
// RULES:
//   - The canvas is ALWAYS created with the correct final size.
//   - Bitmaps from the browser are ALREADY display-correct.
//   - NEVER apply rotation transforms.
//   - Use contain-fit (letterbox) — no stretching ever.
// ============================================================

import { Project, TrackItem } from '../types';
import { drawTextItemOnCanvas } from './textLayout';

export interface FrameRenderAssets {
  videoFrames: Map<string, ImageBitmap | null>;
  images:      Map<string, ImageBitmap>;
}

export interface RenderFrameParams {
  ctx:      CanvasRenderingContext2D;
  timeSec:  number;
  width:    number;
  height:   number;
  project:  Project;
  assets:   FrameRenderAssets;
}

function getActiveVideoItem(project: Project, timeSec: number): TrackItem | null {
  for (const track of project.tracks) {
    if (track.type !== 'video' || track.muted) continue;
    for (const item of track.items) {
      if (timeSec >= item.startTime && timeSec < item.endTime) return item;
    }
  }
  return null;
}

function getOverlayItems(project: Project, timeSec: number) {
  const imageItems: TrackItem[] = [];
  const textItems:  TrackItem[] = [];
  for (const track of project.tracks) {
    if (track.muted) continue;
    for (const item of track.items) {
      if (timeSec < item.startTime || timeSec >= item.endTime) continue;
      if (track.type === 'image') imageItems.push(item);
      else if (track.type === 'text') textItems.push(item);
    }
  }
  return { imageItems, textItems };
}

/**
 * Contain-fit: scale source uniformly to fit within dest, centered, no stretch.
 * Source can be any CanvasImageSource with natural width/height.
 */
function drawContain(
  ctx:      CanvasRenderingContext2D,
  source:   CanvasImageSource,
  srcW:     number,
  srcH:     number,
  destW:    number,
  destH:    number,
  flipH:    boolean,
  flipV:    boolean,
  opacity:  number,
  filters:  string
) {
  if (!srcW || !srcH) return;

  const scale = Math.min(destW / srcW, destH / srcH);
  const dw    = srcW * scale;
  const dh    = srcH * scale;
  const dx    = (destW - dw) / 2;
  const dy    = (destH - dh) / 2;

  ctx.save();
  ctx.globalAlpha = opacity;
  if (filters) (ctx as CanvasRenderingContext2D & { filter: string }).filter = filters;

  if (flipH || flipV) {
    ctx.translate(flipH ? destW : 0, flipV ? destH : 0);
    ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
  }

  ctx.drawImage(source, 0, 0, srcW, srcH, flipH ? destW - dx - dw : dx, flipV ? destH - dy - dh : dy, dw, dh);

  if (filters) (ctx as CanvasRenderingContext2D & { filter: string }).filter = 'none';
  ctx.restore();
  ctx.globalAlpha = 1;
}

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
    const frame = assets.videoFrames.get(videoItem.mediaId);
    if (frame) {
      const vd      = videoItem.videoDetails;
      const filters: string[] = [];
      if (vd?.brightness != null && vd.brightness !== 1) filters.push(`brightness(${vd.brightness})`);
      if (vd?.contrast   != null && vd.contrast   !== 1) filters.push(`contrast(${vd.contrast})`);
      if (vd?.saturation != null && vd.saturation !== 1) filters.push(`saturate(${vd.saturation})`);

      drawContain(
        ctx,
        frame,
        frame.width,
        frame.height,
        width,
        height,
        vd?.flipH   ?? false,
        vd?.flipV   ?? false,
        vd?.opacity ?? 1,
        filters.join(' ')
      );
    }
  }

  const { imageItems, textItems } = getOverlayItems(project, timeSec);

  // ── Image overlays ─────────────────────────────────────────
  for (const imgItem of imageItems) {
    const bmp = assets.images.get(imgItem.mediaId);
    if (!bmp) continue;
    const id = imgItem.imageDetails;
    const ox = ((id?.posX   ?? 50) / 100) * width;
    const oy = ((id?.posY   ?? 50) / 100) * height;
    const dw = ((id?.width  ?? 50) / 100) * width;
    const dh = ((id?.height ?? 50) / 100) * height;

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

  // ── Text overlays ──────────────────────────────────────────
  for (const textItem of textItems) {
    drawTextItemOnCanvas(ctx, textItem, width, height);
  }
}
