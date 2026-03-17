// ============================================================
// ViralCut Export3 – Per-frame deterministic renderer (v3)
//
// Renders one frame at a given time into a CanvasRenderingContext2D.
// Receives pre-decoded ImageBitmaps from VideoFrameCache plus
// rotation metadata so vertical phone footage renders correctly.
//
// v3: getEffectiveRotation() detects when the bitmap is "transposed"
// (e.g. 2160x3840 encoded as 3840x2160) and auto-applies 90° rotation.
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

// Helper: contain-fit draw (shows full frame, may have black bars)
function drawContainFit(
  ctx: CanvasRenderingContext2D,
  frame: CanvasImageSource,
  canvasW: number,
  canvasH: number,
  srcW: number,
  srcH: number
) {
  if (!srcW || !srcH || !canvasW || !canvasH) return;
  const scale = Math.min(canvasW / srcW, canvasH / srcH);
  const dw = srcW * scale;
  const dh = srcH * scale;
  const dx = (canvasW - dw) / 2;
  const dy = (canvasH - dh) / 2;
  ctx.drawImage(frame, dx, dy, dw, dh);
}

// Helper: contain-fit draw centered at origin (for rotated canvas contexts)
function drawContainFitCentered(
  ctx: CanvasRenderingContext2D,
  frame: CanvasImageSource,
  boxW: number,
  boxH: number,
  srcW: number,
  srcH: number
) {
  if (!srcW || !srcH || !boxW || !boxH) return;
  const scale = Math.min(boxW / srcW, boxH / srcH);
  const dw = srcW * scale;
  const dh = srcH * scale;
  ctx.drawImage(frame, -dw / 2, -dh / 2, dw, dh);
}

/**
 * Detects when the raw bitmap dimensions are "transposed" relative to
 * the declared display aspect ratio (e.g. a 2160x3840 video delivered by
 * the browser as a 3840x2160 ImageBitmap). In that case we apply a 90°
 * rotation so the frame is drawn upright.
 */
function getEffectiveRotation(
  frame: ImageBitmap,
  meta?: VideoFrameMeta
): 0 | 90 | 180 | 270 {
  const declaredRotation = meta?.rotationDeg ?? 0;
  if (declaredRotation !== 0) return declaredRotation;

  const displayW = meta?.displayWidth ?? frame.width;
  const displayH = meta?.displayHeight ?? frame.height;

  if (!displayW || !displayH || !frame.width || !frame.height) return 0;

  const frameAspect   = frame.width  / frame.height;
  const displayAspect = displayW / displayH;
  const swappedAspect = displayH / displayW;

  const directDiff  = Math.abs(frameAspect - displayAspect);
  const swappedDiff = Math.abs(frameAspect - swappedAspect);

  // If the bitmap fits much better when the display aspect is transposed,
  // the frame came in sideways – apply a quarter-turn correction.
  if (swappedDiff + 0.02 < directDiff) {
    return 90;
  }

  return 0;
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

      // Visual display dimensions (describe the intended visual size)
      const displayW = (meta?.displayWidth  ?? 0) > 0 ? meta!.displayWidth  : (frame.width  || width);
      const displayH = (meta?.displayHeight ?? 0) > 0 ? meta!.displayHeight : (frame.height || height);

      // Effective rotation – auto-detects transposed bitmaps (e.g. 2160x3840 phones)
      const rotationDeg = getEffectiveRotation(frame, meta);

      // Raw source dimensions of the bitmap (used for rotated draw paths)
      const srcW = frame.width;
      const srcH = frame.height;

      // TEMP DEBUG
      console.log('[ViralCut][render] draw video', {
        mediaId: videoItem.mediaId,
        frameWidth: frame.width,
        frameHeight: frame.height,
        displayW,
        displayH,
        declaredRotation: meta?.rotationDeg ?? 0,
        effectiveRotation: rotationDeg,
      });

      ctx.save();
      ctx.globalAlpha = vd?.opacity ?? 1;

      // CSS-style filter string
      const filters: string[] = [];
      if (vd?.brightness != null && vd.brightness !== 1) filters.push(`brightness(${vd.brightness})`);
      if (vd?.contrast   != null && vd.contrast   !== 1) filters.push(`contrast(${vd.contrast})`);
      if (vd?.saturation != null && vd.saturation !== 1) filters.push(`saturate(${vd.saturation})`);
      if (filters.length) (ctx as CanvasRenderingContext2D & { filter: string }).filter = filters.join(' ');

      const flipScaleX = vd?.flipH ? -1 : 1;
      const flipScaleY = vd?.flipV ? -1 : 1;

      if (rotationDeg === 0) {
        // ── No rotation – standard cover-fit using display dimensions ──
        if (vd?.flipH || vd?.flipV) {
          ctx.translate(vd.flipH ? width : 0, vd.flipV ? height : 0);
          ctx.scale(flipScaleX, flipScaleY);
        }
        drawCoverFit(ctx, frame, width, height, displayW, displayH);

      } else if (rotationDeg === 90 || rotationDeg === 270) {
        // ── 90° / 270° rotation ──────────────────────────────
        // The raw bitmap is landscape but represents portrait content.
        // Rotate the canvas and cover-fit using raw frame dims (srcW/srcH).
        ctx.translate(width / 2, height / 2);
        const rad = rotationDeg === 90 ? Math.PI / 2 : -Math.PI / 2;
        ctx.rotate(rad);
        ctx.scale(flipScaleX, flipScaleY);

        // After 90° rotation: effective canvas becomes (height × width).
        const rotatedCanvasW = height;
        const rotatedCanvasH = width;
        const scale = Math.max(rotatedCanvasW / srcW, rotatedCanvasH / srcH);
        const dw = srcW * scale;
        const dh = srcH * scale;
        ctx.drawImage(frame, -dw / 2, -dh / 2, dw, dh);

      } else if (rotationDeg === 180) {
        // ── 180° rotation ────────────────────────────────────
        ctx.translate(width / 2, height / 2);
        ctx.rotate(Math.PI);
        ctx.scale(flipScaleX, flipScaleY);
        ctx.translate(-width / 2, -height / 2);
        drawCoverFit(ctx, frame, width, height, displayW, displayH);
      }

      (ctx as CanvasRenderingContext2D & { filter: string }).filter = 'none';
      ctx.restore();
      ctx.globalAlpha = 1;
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
