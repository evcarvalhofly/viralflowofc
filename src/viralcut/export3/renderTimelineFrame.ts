// ============================================================
// ViralCut Export3 – Per-frame deterministic renderer (v9)
//
// ROTATION STRATEGY (definitive — fixes 4K portrait bug):
//
// The problem: createImageBitmap() can behave differently at probe
// time vs render time, especially on Chrome mobile/desktop for 4K.
// Probe may see encoded dims (3840×2160) but actual render frames
// may come back already rotated (2160×3840). If we naively apply
// 90° rotation based on probe metadata, we get double-rotation.
//
// FIX: At render time, compare the actual bitmap dimensions
// against the stored encoded dims from meta to determine
// whether the browser applied rotation to THIS specific bitmap.
// This overrides the probe-time browserAutoRotates flag.
//
// CASE A: bitmap is portrait (height > width) AND meta says
//         video was encoded landscape (encodedWidth > encodedHeight):
//         → Browser rotated the bitmap already → apply 0° rotation
//
// CASE B: bitmap is landscape (width >= height) AND rotationDeg=90|270
//         → Browser did NOT rotate → apply 90° to correct
//
// CASE C: no meta → fallback orientation comparison
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
 * Determines whether the browser has auto-rotated THIS specific bitmap
 * by comparing its actual dimensions against the stored encoded dimensions.
 *
 * This is the definitive check — it runs on the actual bitmap being drawn,
 * not on a probe bitmap from earlier. This prevents the double-rotation bug
 * where the probe sees encoded dims but the export frame is already rotated.
 */
function isBitmapAlreadyRotatedByBrowser(
  frame: ImageBitmap,
  meta: VideoFrameMeta
): boolean {
  const { encodedWidth, encodedHeight, rotationDeg } = meta;

  // Only relevant for 90/270 degree rotations
  if (rotationDeg !== 90 && rotationDeg !== 270) return false;

  // The encoded video is landscape (width > height)
  const tol = Math.max(4, Math.round(Math.max(encodedWidth, encodedHeight) * 0.015));

  // If the bitmap dimensions match the SWAPPED (display) orientation,
  // the browser already applied the rotation
  const bitmapMatchesDisplayOrientation =
    Math.abs(frame.width  - encodedHeight) <= tol &&
    Math.abs(frame.height - encodedWidth)  <= tol;

  return bitmapMatchesDisplayOrientation;
}

/**
 * Determines the rotation to apply to a bitmap before drawing it onto the canvas.
 *
 * Uses live bitmap dimensions compared to stored meta for authoritative detection.
 * This prevents double-rotation bugs where probe and render-time behavior differ.
 *
 * Additional safety fallback: if metadata says rotationDeg=0 but the canvas is
 * portrait and the bitmap arrives landscape while displayDims say portrait,
 * apply 90° manually (handles cases where rotation probe ran after export started).
 */
function resolveRotation(
  frame: ImageBitmap,
  canvasW: number,
  canvasH: number,
  meta: VideoFrameMeta | null
): 0 | 90 {
  const canvasIsPortrait  = canvasH > canvasW;
  const bitmapIsPortrait  = frame.height > frame.width;

  if (meta) {
    const rDeg = meta.rotationDeg ?? 0;
    const displayIsPortrait =
      (meta.displayHeight ?? 0) > (meta.displayWidth ?? 0);

    if (rDeg === 90 || rDeg === 270) {
      const alreadyRotated = isBitmapAlreadyRotatedByBrowser(frame, meta);

      console.log('[ViralCut][render] resolveRotation quarter-turn', {
        rotationDeg: rDeg,
        frameWidth: frame.width, frameHeight: frame.height,
        canvasW, canvasH,
        encodedWidth: meta.encodedWidth, encodedHeight: meta.encodedHeight,
        displayWidth: meta.displayWidth, displayHeight: meta.displayHeight,
        alreadyRotated,
      });

      return alreadyRotated ? 0 : 90;
    }

    // Safety fallback: metadata says rotationDeg=0, but canvas is portrait,
    // bitmap arrived landscape, and display dimensions confirm portrait.
    // This can happen when the export started before probeAndPatchRotation finished.
    if (rDeg === 0 && canvasIsPortrait && !bitmapIsPortrait && displayIsPortrait) {
      console.log('[ViralCut][render] safety rotation fallback applied', {
        rotationDeg: rDeg,
        frameWidth: frame.width, frameHeight: frame.height,
        canvasW, canvasH,
        displayWidth: meta.displayWidth, displayHeight: meta.displayHeight,
      });
      return 90;
    }

    return 0;
  }

  // ── Generic fallback when meta is missing ──────────────────
  if (bitmapIsPortrait !== canvasIsPortrait) {
    console.log('[ViralCut][render] generic orientation fallback applied', {
      frameWidth: frame.width, frameHeight: frame.height, canvasW, canvasH,
    });
    return 90;
  }

  return 0;
}

/**
 * Draws a video frame onto the canvas.
 * Uses live bitmap dimension analysis for rotation when meta is available.
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

  // After rotation, visual dimensions are the post-rotation view of the frame
  // visW/visH represent how the frame appears visually after rotation
  const visW = isRotated ? frame.height : frame.width;
  const visH = isRotated ? frame.width  : frame.height;

  // Contain-fit: scale to fill canvas without stretching
  const scale = Math.min(canvasW / visW, canvasH / visH);
  const dw = visW * scale;
  const dh = visH * scale;

  ctx.translate(canvasW / 2, canvasH / 2);
  if (rotation !== 0) ctx.rotate((rotation * Math.PI) / 180);
  if (flipH || flipV) ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);

  // After 90° rotation, the canvas coordinate system is transposed.
  // We draw using encoded (pre-rotation) dimensions scaled to dh×dw.
  if (isRotated) {
    // In rotated space: horizontal axis = original vertical, vertical = -original horizontal
    // The frame (encodedW × encodedH) = (landscape W × H) must fill dh × dw in rotated space
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
