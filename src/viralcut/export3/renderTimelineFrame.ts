// ============================================================
// ViralCut Export3 – Per-frame deterministic renderer (v7)
//
// KEY INSIGHT:
// createImageBitmap(videoEl) in Chrome/Chromium ALREADY applies
// the container rotation metadata. So a video encoded as 3840×2160
// with rotationDeg=90 will produce a bitmap of 2160×3840 (portrait).
//
// Applying rotationDeg again causes double-rotation → stretched output.
//
// SOLUTION: Compare the bitmap's ORIENTATION (portrait/landscape/square)
// against the CANVAS orientation. If they already match → no rotation.
// If they disagree → apply 90° to correct it.
//
// This is robust regardless of browser rotation behaviour.
// ============================================================

import { Project, TrackItem } from '../types';
import { drawTextItemOnCanvas } from '../export2/textLayout';
import { VideoFrameMeta } from './videoFrameCache';

export interface FrameRenderAssets {
  videoFrames: Map<string, ImageBitmap | null>;
  videoMeta: Map<string, VideoFrameMeta>;
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
 * Determines the rotation to apply to the bitmap BEFORE drawing onto the canvas.
 *
 * Chrome's createImageBitmap(videoEl) already applies the container rotation.
 * So for a 3840×2160 encoded video with rotationDeg=90, the bitmap arrives as
 * 2160×3840 (portrait). Applying rotationDeg again would double-rotate it.
 *
 * Strategy: compare bitmap orientation vs canvas orientation.
 * - If they already match → return 0 (no rotation needed).
 * - If they disagree → return 90 (fix orientation mismatch).
 *
 * This is correct in all cases:
 *   - Chrome applies rotation   → bitmap already portrait → canvas portrait → match → 0°  ✓
 *   - Browser does NOT rotate   → bitmap is landscape     → canvas portrait → mismatch → 90° ✓
 *   - Video is natively portrait (rotDeg=0) → both portrait → match → 0° ✓
 *   - Video is natively landscape (rotDeg=0) → both landscape → match → 0° ✓
 */
function resolveRotationForCanvas(
  bitmapW: number,
  bitmapH: number,
  canvasW: number,
  canvasH: number
): 0 | 90 {
  const bitmapIsPortrait  = bitmapH > bitmapW;
  const bitmapIsLandscape = bitmapW > bitmapH;
  const canvasIsPortrait  = canvasH > canvasW;
  const canvasIsLandscape = canvasW > canvasH;

  // Both square → no rotation needed
  if (bitmapW === bitmapH && canvasW === canvasH) return 0;

  // Orientation matches → no rotation needed
  if (bitmapIsPortrait  && canvasIsPortrait)  return 0;
  if (bitmapIsLandscape && canvasIsLandscape) return 0;

  // Orientation mismatch → rotate 90° to correct
  return 90;
}

/**
 * Draws a video frame onto the canvas.
 * - Detects orientation mismatch between bitmap and canvas
 * - Applies rotation only when needed (avoids double-rotation from browser)
 * - Uses contain-fit: scales to fill the canvas without stretching
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
  if (!frame.width || !frame.height) return;

  ctx.save();
  ctx.globalAlpha = opacity;
  if (filters) (ctx as CanvasRenderingContext2D & { filter: string }).filter = filters;

  const rotation = resolveRotationForCanvas(frame.width, frame.height, canvasW, canvasH);
  const isRotated = rotation === 90;

  // After rotation, the bitmap's visual W/H are swapped
  const visW = isRotated ? frame.height : frame.width;
  const visH = isRotated ? frame.width  : frame.height;

  // Contain-fit scale: fit the visual size into the canvas
  const scale = Math.min(canvasW / visW, canvasH / visH);
  const dw = visW * scale;
  const dh = visH * scale;

  // Translate to center, apply rotation, apply flip
  ctx.translate(canvasW / 2, canvasH / 2);
  if (rotation !== 0) ctx.rotate((rotation * Math.PI) / 180);
  if (flipH || flipV) ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);

  // After 90° rotation, X and Y axes are swapped in canvas space.
  // Draw using encoded (pre-rotation) dimensions scaled to achieve visual contain-fit.
  if (isRotated) {
    ctx.drawImage(frame, -dh / 2, -dw / 2, dh, dw);
  } else {
    ctx.drawImage(frame, -dw / 2, -dh / 2, dw, dh);
  }

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
