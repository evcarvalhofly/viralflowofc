// ============================================================
// ViralCut Export3 – Per-frame deterministic renderer (v6)
//
// THE CORE PROBLEM:
// createImageBitmap(videoEl) behaviour varies by browser:
//   • Chrome/Chromium: DOES apply container rotation → bitmap is already in display orientation
//     e.g. phone video (encoded 3840×2160, rotDeg=90) → bitmap is 2160×3840 (portrait ✓)
//   • Some browsers: does NOT apply → bitmap stays encoded 3840×2160 (landscape ✗)
//
// SOLUTION: Compare the actual bitmap dimensions against the KNOWN display dimensions
// from VideoFrameMeta (which stores the correct display W/H after the FFmpeg probe).
// If the bitmap already matches display orientation → no rotation needed.
// If the bitmap matches encoded orientation → rotation IS needed.
//
// This approach is deterministic and browser-agnostic.
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
 * Determines the effective rotation to apply to a bitmap before drawing.
 *
 * createImageBitmap() may or may not apply container rotation depending on the browser.
 * We detect this by comparing the actual bitmap dimensions to the known
 * display dimensions from the VideoFrameMeta (FFmpeg-probed).
 *
 * Logic:
 *  - If bitmap dimensions ≈ display dimensions → browser already rotated → apply 0°
 *  - If bitmap dimensions ≈ encoded (swapped) dimensions → browser did NOT rotate → apply rotationDeg
 *  - If no metadata (rotDeg=0) → no rotation at all (video was recorded upright)
 */
function resolveEffectiveRotation(
  frame: ImageBitmap,
  meta: VideoFrameMeta | null | undefined
): 0 | 90 | 180 | 270 {
  if (!meta || meta.rotationDeg === 0) return 0;
  if (meta.rotationDeg === 180) return 180;

  // Only for 90/270 rotation: check if browser already applied it
  const { displayWidth, displayHeight, encodedWidth, encodedHeight, rotationDeg } = meta;

  // Tolerance for dimension comparison (1% or 4px, whichever is larger)
  const tol = Math.max(4, Math.round(Math.max(frame.width, frame.height) * 0.01));

  const matchesDisplay =
    Math.abs(frame.width  - displayWidth)  <= tol &&
    Math.abs(frame.height - displayHeight) <= tol;

  const matchesEncoded =
    Math.abs(frame.width  - encodedWidth)  <= tol &&
    Math.abs(frame.height - encodedHeight) <= tol;

  console.log(
    `[ViralCut][render] bitmap=${frame.width}×${frame.height}` +
    ` display=${displayWidth}×${displayHeight}` +
    ` encoded=${encodedWidth}×${encodedHeight}` +
    ` rotDeg=${rotationDeg}` +
    ` matchesDisplay=${matchesDisplay} matchesEncoded=${matchesEncoded}`
  );

  if (matchesDisplay) {
    // Browser already applied rotation to the bitmap → we must NOT rotate again
    return 0;
  }

  if (matchesEncoded) {
    // Browser did NOT apply rotation → we must apply it
    return rotationDeg as 90 | 270;
  }

  // Fallback: compare orientations (portrait vs landscape)
  // If the bitmap's orientation already matches the display orientation → no rotation
  const bitmapIsPortrait  = frame.height  > frame.width;
  const displayIsPortrait = displayHeight > displayWidth;

  if (bitmapIsPortrait === displayIsPortrait) {
    return 0; // orientation already correct
  }

  return rotationDeg as 90 | 270; // needs rotation
}

/**
 * Draws a video frame onto the canvas with correct orientation and contain-fit scaling.
 * Never stretches the image. Handles browser-specific rotation application automatically.
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
  meta: VideoFrameMeta | null | undefined
) {
  if (!frame.width || !frame.height) return;

  ctx.save();
  ctx.globalAlpha = opacity;
  if (filters) (ctx as CanvasRenderingContext2D & { filter: string }).filter = filters;

  // Determine how much (if any) rotation to apply
  const effectiveRotation = resolveEffectiveRotation(frame, meta);
  const isRotated = effectiveRotation === 90 || effectiveRotation === 270;

  // Visual display dimensions AFTER the effective rotation
  const visW = isRotated ? frame.height : frame.width;
  const visH = isRotated ? frame.width  : frame.height;

  // Contain-fit: scale to fill the canvas without stretching
  const scale = Math.min(canvasW / visW, canvasH / visH);
  const dw = visW * scale;
  const dh = visH * scale;

  console.log(
    `[ViralCut][render] effectiveRot=${effectiveRotation}° ` +
    `visuals=${Math.round(visW)}×${Math.round(visH)} ` +
    `canvas=${canvasW}×${canvasH} ` +
    `draw=${Math.round(dw)}×${Math.round(dh)}`
  );

  // Translate to canvas center, then apply rotation and flip
  ctx.translate(canvasW / 2, canvasH / 2);
  if (effectiveRotation !== 0) ctx.rotate((effectiveRotation * Math.PI) / 180);
  if (flipH || flipV) ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);

  // After 90/270° rotation, canvas X and Y axes are swapped.
  // drawImage size must use encoded (pre-rotation) dimensions scaled to fit.
  // The contain-fit was computed in visual (post-rotation) space:
  //   visual dw = encoded dh_scaled, visual dh = encoded dw_scaled
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

      // Pass full meta so drawVideoFrame can auto-detect browser rotation behaviour
      drawVideoFrame(
        ctx,
        frame,
        width,
        height,
        vd?.flipH ?? false,
        vd?.flipV ?? false,
        vd?.opacity ?? 1,
        filters.join(' '),
        meta ?? null
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
