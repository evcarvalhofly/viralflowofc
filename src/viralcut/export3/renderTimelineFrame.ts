// ============================================================
// ViralCut Export3 – Per-frame deterministic renderer (v4)
//
// SIMPLIFIED APPROACH:
// The browser's createImageBitmap() already applies orientation correction
// from the video metadata. So the bitmap we receive is ALREADY in display
// orientation (e.g. a 2160x3840 portrait bitmap for a phone video).
//
// We simply contain-fit the bitmap into the canvas using its actual
// pixel dimensions. NO rotation heuristics needed.
// ============================================================

import { Project, TrackItem } from '../types';
import { drawTextItemOnCanvas } from '../export2/textLayout';
import { VideoFrameMeta } from './videoFrameCache';

export interface FrameRenderAssets {
  /** mediaId → ImageBitmap of the current frame (fetched externally) */
  videoFrames: Map<string, ImageBitmap | null>;
  /** mediaId → rotation/display metadata */
  videoMeta: Map<string, VideoFrameMeta>;
  /** mediaId → ImageBitmap for static image overlays */
  images: Map<string, ImageBitmap>;
}

export interface RenderFrameParams {
  ctx: CanvasRenderingContext2D;
  timeSec: number;
  width: number;
  height: number;
  project: Project;
  assets: FrameRenderAssets;
}

function getActiveVideoItem(
  project: Project,
  timeSec: number
): TrackItem | null {
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
  const textItems: TrackItem[] = [];
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
 * Draws the frame centered and contain-fitted into the canvas.
 *
 * KEY INSIGHT: createImageBitmap() from a <video> element already returns
 * a bitmap in the DISPLAY orientation — the browser applies EXIF/rotation
 * metadata automatically. So bitmap.width / bitmap.height are the true
 * visual dimensions. We never need to rotate.
 *
 * For a 2160x3840 portrait phone video:
 *   - el.videoWidth = 3840, el.videoHeight = 2160 (encoded)
 *   - bitmap.width = 2160, bitmap.height = 3840 (display) ← browser corrects
 *   OR
 *   - bitmap.width = 3840, bitmap.height = 2160 (browser did NOT correct)
 *
 * We handle both cases by always checking if we need to rotate based purely
 * on whether the bitmap aspect ratio matches the canvas aspect ratio.
 */
function drawVideoFrame(
  ctx: CanvasRenderingContext2D,
  frame: ImageBitmap,
  canvasW: number,
  canvasH: number,
  flipH: boolean,
  flipV: boolean,
  opacity: number,
  filters: string
) {
  const bmpW = frame.width;
  const bmpH = frame.height;

  if (!bmpW || !bmpH) return;

  const canvasIsPortrait = canvasH >= canvasW;
  const bitmapIsPortrait = bmpH >= bmpW;

  // If the bitmap orientation doesn't match the canvas orientation,
  // the browser did NOT auto-rotate — we must apply 90° rotation.
  const needsRotation = canvasIsPortrait !== bitmapIsPortrait;

  ctx.save();
  ctx.globalAlpha = opacity;
  if (filters) (ctx as CanvasRenderingContext2D & { filter: string }).filter = filters;

  ctx.translate(canvasW / 2, canvasH / 2);

  const flipScaleX = flipH ? -1 : 1;
  const flipScaleY = flipV ? -1 : 1;

  if (needsRotation) {
    // Rotate 90° CW then contain-fit into the rotated box (canvasH × canvasW)
    ctx.rotate(Math.PI / 2);
    ctx.scale(flipScaleX, flipScaleY);
    // After 90° CW rotation, the visible box becomes canvasH wide × canvasW tall
    const scale = Math.min(canvasH / bmpW, canvasW / bmpH);
    const dw = bmpW * scale;
    const dh = bmpH * scale;
    ctx.drawImage(frame, -dw / 2, -dh / 2, dw, dh);
  } else {
    // No rotation needed — contain-fit normally
    ctx.scale(flipScaleX, flipScaleY);
    const scale = Math.min(canvasW / bmpW, canvasH / bmpH);
    const dw = bmpW * scale;
    const dh = bmpH * scale;
    ctx.drawImage(frame, -dw / 2, -dh / 2, dw, dh);
  }

  (ctx as CanvasRenderingContext2D & { filter: string }).filter = 'none';
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
      const vd = videoItem.videoDetails;

      const filters: string[] = [];
      if (vd?.brightness != null && vd.brightness !== 1) filters.push(`brightness(${vd.brightness})`);
      if (vd?.contrast   != null && vd.contrast   !== 1) filters.push(`contrast(${vd.contrast})`);
      if (vd?.saturation != null && vd.saturation !== 1) filters.push(`saturate(${vd.saturation})`);

      drawVideoFrame(
        ctx,
        frame,
        width,
        height,
        vd?.flipH ?? false,
        vd?.flipV ?? false,
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
    const ox = ((id?.posX ?? 50) / 100) * width;
    const oy = ((id?.posY ?? 50) / 100) * height;
    const dw = ((id?.width ?? 50) / 100) * width;
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
