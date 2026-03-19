// ============================================================
// ViralCut Export3 – Per-frame deterministic renderer (v11 — clean)
//
// RULE: The canvas is ALWAYS the correct size for the output orientation.
//       The bitmap from the browser is ALWAYS display-correct (already rotated).
//       Therefore we NEVER apply any rotation transform here.
//
// Drawing strategy: contain-fit (letterbox) — no stretching, ever.
// ============================================================

import { Project, TrackItem } from '../types';
import { drawTextItemOnCanvas } from './textLayout';
import { VideoFrameMeta } from './videoFrameCache';

export interface FrameRenderAssets {
  videoFrames: Map<string, ImageBitmap | null>;
  videoMeta:   Map<string, VideoFrameMeta>;
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
 * Draw a bitmap onto the canvas using contain-fit (letterbox).
 *
 * The browser's createImageBitmap() already returns the frame in display
 * orientation — no rotation needed here. We simply scale the bitmap to
 * fit inside the canvas while preserving its aspect ratio.
 */
function drawVideoFrame(
  ctx:      CanvasRenderingContext2D,
  frame:    ImageBitmap,
  canvasW:  number,
  canvasH:  number,
  flipH:    boolean,
  flipV:    boolean,
  opacity:  number,
  filters:  string
) {
  if (!frame.width || !frame.height) return;

  const fw = frame.width;
  const fh = frame.height;

  // Contain-fit: uniform scale so the entire frame is visible
  const scale = Math.min(canvasW / fw, canvasH / fh);
  const dw = fw * scale;
  const dh = fh * scale;

  // Debug log — first frame only (avoids spam)
  // Uncomment if needed:
  // console.log('[render] frame', fw, fh, '→ canvas', canvasW, canvasH, '→ draw', dw, dh);

  ctx.save();
  ctx.globalAlpha = opacity;
  if (filters) (ctx as CanvasRenderingContext2D & { filter: string }).filter = filters;

  ctx.translate(canvasW / 2, canvasH / 2);
  if (flipH || flipV) ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
  ctx.drawImage(frame, -dw / 2, -dh / 2, dw, dh);

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

      drawVideoFrame(
        ctx,
        frame,
        width,
        height,
        vd?.flipH    ?? false,
        vd?.flipV    ?? false,
        vd?.opacity  ?? 1,
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
