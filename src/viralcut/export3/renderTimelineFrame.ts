// ============================================================
// ViralCut Export3 – Per-frame deterministic renderer (v8)
//
// ROTATION STRATEGY (authoritative, not guessing):
//
// We receive VideoFrameMeta for each video which contains:
//   - browserAutoRotates: whether Chrome already applied rotation
//     to the bitmap returned by createImageBitmap()
//   - rotationDeg: the container rotation from FFmpeg probe
//
// CASE 1: browserAutoRotates = true
//   → The bitmap is already in display orientation (portrait).
//   → Apply 0° rotation when drawing — canvas is also portrait.
//
// CASE 2: browserAutoRotates = false AND rotationDeg = 90|270
//   → The bitmap is in encoded orientation (landscape 3840×2160).
//   → Canvas is portrait (1080×1920).
//   → Apply 90° rotation to correct it.
//
// CASE 3: browserAutoRotates = false AND rotationDeg = 0|180
//   → No rotation needed at all.
//
// FALLBACK (no meta available):
//   → Compare bitmap vs canvas orientation as before.
//   This handles natively portrait videos (rotationDeg=0).
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
 * Determines the rotation to apply to a bitmap before drawing it onto the canvas.
 *
 * Uses VideoFrameMeta (authoritative) when available:
 *   - browserAutoRotates=true  → browser already rotated, draw as-is (0°)
 *   - browserAutoRotates=false + rotationDeg=90|270 → apply 90° to correct
 *   - browserAutoRotates=false + rotationDeg=0|180  → no rotation (0°)
 *
 * Falls back to orientation comparison when no meta is available.
 */
function resolveRotation(
  frame: ImageBitmap,
  canvasW: number,
  canvasH: number,
  meta: VideoFrameMeta | null
): 0 | 90 {
  if (meta) {
    if (meta.browserAutoRotates) {
      // Browser already applied rotation to the bitmap — draw as-is
      return 0;
    }
    const rDeg = meta.rotationDeg;
    if (rDeg === 90 || rDeg === 270) {
      // Browser did NOT rotate, but the video needs 90° — apply it
      return 90;
    }
    // rotationDeg = 0 or 180: no 90° rotation needed
    return 0;
  }

  // ── Fallback: orientation-based heuristic ──────────────────
  // Used for natively portrait videos or when meta is unavailable.
  const bitmapIsPortrait = frame.height > frame.width;
  const canvasIsPortrait = canvasH > canvasW;
  if (bitmapIsPortrait !== canvasIsPortrait) return 90;
  return 0;
}

/**
 * Draws a video frame onto the canvas.
 * Uses authoritative VideoFrameMeta for rotation when available.
 * Falls back to orientation comparison otherwise.
 * Always uses contain-fit to prevent stretching.
 */
function drawVideoFrame(
  ctx: CanvasRenderingContext2D,
  frame: ImageBitmap,
  canvasW: number,
  canvasH: number,
  meta: VideoFrameMeta | null,
  flipH: boolean,
  flipV: boolean,
  opacity: number,
  filters: string
) {
  if (!frame.width || !frame.height) return;

  ctx.save();
  ctx.globalAlpha = opacity;
  if (filters) (ctx as CanvasRenderingContext2D & { filter: string }).filter = filters;

  const rotation = resolveRotation(frame, canvasW, canvasH, meta);
  const isRotated = rotation === 90;

  // After rotation, visual dimensions are swapped
  const visW = isRotated ? frame.height : frame.width;
  const visH = isRotated ? frame.width  : frame.height;

  // Contain-fit: scale to fill canvas without stretching
  const scale = Math.min(canvasW / visW, canvasH / visH);
  const dw = visW * scale;
  const dh = visH * scale;

  ctx.translate(canvasW / 2, canvasH / 2);
  if (rotation !== 0) ctx.rotate((rotation * Math.PI) / 180);
  if (flipH || flipV) ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);

  // After 90° rotation, X and Y axes are swapped in canvas space.
  // Draw using pre-rotation (encoded) dimensions to achieve contain-fit.
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
      const meta = assets.videoMeta.get(videoItem.mediaId) ?? null;
      const filters: string[] = [];
      if (vd?.brightness != null && vd.brightness !== 1) filters.push(`brightness(${vd.brightness})`);
      if (vd?.contrast   != null && vd.contrast   !== 1) filters.push(`contrast(${vd.contrast})`);
      if (vd?.saturation != null && vd.saturation !== 1) filters.push(`saturate(${vd.saturation})`);

      drawVideoFrame(
        ctx,
        frame,
        width,
        height,
        meta,
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
