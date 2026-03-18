// ============================================================
// ViralCut Export3 – Per-frame deterministic renderer (v5)
//
// CORE STRATEGY:
// createImageBitmap(videoEl) returns the RAW ENCODED frame — it does NOT
// apply EXIF/container rotation. So for a phone video encoded as 3840×2160
// with rotationDeg=90, the bitmap is 3840×2160 (landscape) but visually it
// should be shown as 2160×3840 (portrait).
//
// We MUST rotate the canvas by rotationDeg to display it correctly.
// We NEVER use orientation-mismatch heuristics — they are unreliable.
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
 * Draws a raw encoded video frame onto the canvas, applying rotation
 * and contain-fit scaling to preserve aspect ratio without stretching.
 *
 * KEY RULE: createImageBitmap() does NOT apply container rotation.
 * The bitmap is always in ENCODED dimensions (e.g. 3840×2160 for a
 * portrait phone video with rotationDeg=90). We apply the rotation
 * ourselves via canvas transform so the display is correct.
 *
 * We NEVER use orientation-mismatch heuristics. We trust rotationDeg
 * which comes from the FFmpeg probe stored in MediaFile.
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

  // ── Step 1: Visual dimensions after applying rotationDeg ────────
  // For rotationDeg=90 or 270, width and height are swapped visually.
  const isRotated = rotationDeg === 90 || rotationDeg === 270;
  const displayW = isRotated ? frame.height : frame.width;
  const displayH = isRotated ? frame.width : frame.height;

  // ── Step 2: Contain-fit scale into the canvas (never stretch) ───
  const scale = Math.min(canvasW / displayW, canvasH / displayH);
  const dw = displayW * scale;
  const dh = displayH * scale;

  console.log(`[ViralCut][render] bitmap=${frame.width}×${frame.height} rotDeg=${rotationDeg} canvas=${canvasW}×${canvasH} display=${displayW}×${displayH} scale=${scale.toFixed(4)} final=${Math.round(dw)}×${Math.round(dh)}`);

  // ── Step 3: Translate to center, then rotate ────────────────────
  ctx.translate(canvasW / 2, canvasH / 2);
  if (rotationDeg !== 0) ctx.rotate((rotationDeg * Math.PI) / 180);
  if (flipH || flipV) ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);

  // ── Step 4: Draw ────────────────────────────────────────────────
  // After rotation, the canvas axes are swapped for 90/270.
  // So the drawImage destination size uses ENCODED dims scaled to fit.
  // encoded width maps to the rotated canvas X axis, encoded height to Y.
  // The contain-fit was computed in display space (dw×dh),
  // so: encW_scaled = dh, encH_scaled = dw (axes swapped by rotation).
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
