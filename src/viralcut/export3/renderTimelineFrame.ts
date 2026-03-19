// ============================================================
// ViralCut Export3 – Per-frame deterministic renderer (v10)
//
// ROTATION STRATEGY (definitive v10 — fixes high-quality portrait bug):
//
// v9 tried to detect rotation by comparing live bitmap dims vs stored
// encoded dims. This was unreliable because:
//   - High-quality videos may return downscaled bitmaps during export
//   - createImageBitmap() can return different sizes at different times
//   - The comparison thresholds could fail for unusual resolutions
//
// v10 DEFINITIVE STRATEGY:
//   Use VideoFrameMeta.browserAutoRotates (set authoritatively during
//   the multi-attempt probe in VideoFrameCache) to decide rotation.
//
//   If browserAutoRotates=true              → bitmap is already portrait → draw as-is (0°)
//   If browserAutoRotates=false, deg=90|270 → browser did NOT rotate    → apply 90° manually
//   If browserAutoRotates=false, deg=0|180  → no rotation needed        → draw as-is (0°)
//
//   Fallback (no meta): compare bitmap aspect vs canvas aspect
// ============================================================

import { Project, TrackItem } from '../types';
import { drawTextItemOnCanvas } from './textLayout';
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
 * Determines whether to apply a 90° manual rotation when drawing this frame.
 *
 * v10: Uses VideoFrameMeta.browserAutoRotates as the PRIMARY source of truth.
 * This field is set by a multi-attempt probe during VideoFrameCache.prepare()
 * and is NOT affected by varying bitmap sizes at render time.
 *
 * Decision table:
 *   meta.browserAutoRotates=true              → 0  (browser already rotated)
 *   meta.browserAutoRotates=false, deg=90|270 → 90 (must rotate manually)
 *   meta.browserAutoRotates=false, deg=0|180  → 0  (no rotation needed)
 *   no meta, bitmap portrait ≠ canvas portrait → 90 (orientation heuristic)
 *   no meta, same orientation                  → 0
 */
function resolveRotation(
  frame: ImageBitmap,
  canvasW: number,
  canvasH: number,
  meta: VideoFrameMeta | null
): 0 | 90 {
  if (meta) {
    const { rotationDeg, browserAutoRotates } = meta;

    // Only 90/270 degree rotations require a 90° canvas transform
    if (rotationDeg !== 90 && rotationDeg !== 270) return 0;

    if (browserAutoRotates) {
      // Browser already applied the rotation — bitmap is in display orientation
      return 0;
    } else {
      // Browser did NOT rotate — bitmap is still in encoded (landscape) orientation
      // We must rotate manually to correct it
      return 90;
    }
  }

  // ── Fallback: orientation-based heuristic (no meta available) ──────────────
  const bitmapIsPortrait = frame.height > frame.width;
  const canvasIsPortrait = canvasH > canvasW;
  if (bitmapIsPortrait !== canvasIsPortrait) return 90;
  return 0;
}

/**
 * Draws a video frame onto the canvas with correct orientation.
 *
 * Uses contain-fit scaling (letterbox) to prevent stretching.
 * Rotation is determined by resolveRotation() using authoritative metadata.
 *
 * Math explanation for 90° rotation case:
 *   After ctx.rotate(90°), the coordinate system is transposed:
 *     - x-axis now points DOWN in screen space
 *     - y-axis now points LEFT in screen space
 *
 *   We want the final frame to occupy dw×dh in SCREEN space (portrait).
 *   In ROTATED coordinate space, this means drawing:
 *     width = dh  (the screen-height becomes the draw-width in rotated space)
 *     height = dw (the screen-width becomes the draw-height in rotated space)
 *
 *   This correctly maps a landscape bitmap to fill a portrait canvas.
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

  // visW/visH: the visual dimensions of the frame AFTER rotation is applied.
  // For a landscape bitmap (fw=3840, fh=2160) with 90° rotation:
  //   visW = fh = 2160  (the frame's height becomes the horizontal extent)
  //   visH = fw = 3840  (the frame's width becomes the vertical extent)
  const visW = isRotated ? frame.height : frame.width;
  const visH = isRotated ? frame.width  : frame.height;

  // Contain-fit: scale uniformly so the entire frame fits within the canvas
  const scale = Math.min(canvasW / visW, canvasH / visH);
  const dw = visW * scale;  // final display width on screen canvas
  const dh = visH * scale;  // final display height on screen canvas

  // Center the frame on the canvas
  ctx.translate(canvasW / 2, canvasH / 2);

  if (isRotated) {
    ctx.rotate(Math.PI / 2);
    // Apply flips before drawing in rotated space
    if (flipH || flipV) ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
    // Draw in rotated coordinate space: width=dh, height=dw
    // This fills dw×dh (portrait) in screen space correctly
    ctx.drawImage(frame, -dh / 2, -dw / 2, dh, dw);
  } else {
    if (flipH || flipV) ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
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
