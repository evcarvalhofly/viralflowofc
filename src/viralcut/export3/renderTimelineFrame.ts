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
 * STRATEGY: We receive both the raw ImageBitmap and the metadata rotationDeg.
 * The browser may or may not apply EXIF rotation when calling createImageBitmap().
 * We use a heuristic: if the bitmap's aspect ratio is the OPPOSITE of the canvas
 * aspect ratio (one is portrait and the other landscape), we apply 90° rotation
 * regardless of rotationDeg. This safely handles:
 *   - Browser that DOESN'T apply EXIF rotation (bitmap stays 3840×2160, canvas is 1080×1920)
 *   - Browser that DOES apply EXIF rotation (bitmap is 2160×3840, canvas is 1080×1920)
 *
 * In both cases, the video fills the portrait canvas correctly.
 */
function drawVideoFrame(
  ctx: CanvasRenderingContext2D,
  frame: ImageBitmap,
  canvasW: number,
  canvasH: number,
  flipH: boolean,
  flipV: boolean,
  opacity: number,
  filters: string,
  rotationDeg: number
) {
  if (!frame.width || !frame.height) return;

  ctx.save();
  ctx.globalAlpha = opacity;
  if (filters) (ctx as CanvasRenderingContext2D & { filter: string }).filter = filters;

  // ── Smart rotation detection ─────────────────────────────
  // Compare bitmap orientation vs canvas orientation.
  // If they are mismatched (one portrait, one landscape), force rotation to 90°.
  const bitmapIsLandscape = frame.width >= frame.height;
  const canvasIsLandscape = canvasW >= canvasH;
  const orientationMismatch = bitmapIsLandscape !== canvasIsLandscape;

  // Use explicit rotationDeg if non-zero, otherwise auto-detect from mismatch
  let effectiveRotation = rotationDeg;
  if (effectiveRotation === 0 && orientationMismatch) {
    effectiveRotation = 90; // force rotation to align bitmap with canvas
  }
  // If rotationDeg says rotate but bitmap is already correct orientation, skip rotation
  if ((effectiveRotation === 90 || effectiveRotation === 270) && !orientationMismatch) {
    effectiveRotation = 0; // browser already applied EXIF rotation to bitmap
  }

  const isRotated = effectiveRotation === 90 || effectiveRotation === 270;

  // Visual dimensions after effective rotation
  const vW = isRotated ? frame.height : frame.width;
  const vH = isRotated ? frame.width : frame.height;

  // Contain-fit scale (never stretch)
  const scale = Math.min(canvasW / vW, canvasH / vH);
  const dw = vW * scale;
  const dh = vH * scale;

  // Center, rotate, flip
  ctx.translate(canvasW / 2, canvasH / 2);
  if (effectiveRotation !== 0) ctx.rotate((effectiveRotation * Math.PI) / 180);
  if (flipH || flipV) ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);

  // Draw — when rotated 90/270 the canvas axes are swapped, so use original bitmap dims
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
      const meta = assets.videoMeta.get(videoItem.mediaId);

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
        filters.join(' '),
        meta?.rotationDeg ?? 0
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
