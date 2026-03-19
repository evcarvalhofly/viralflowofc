// ============================================================
// ViralCut Export3 – Per-frame deterministic renderer (v14)
//
// RULES:
//   - Canvas is ALWAYS created with the correct final size.
//   - Use contain-fit (letterbox) — no stretching ever.
//   - Rotation is decided by comparing FRAME orientation vs CANVAS orientation.
//     (Not MediaFile vs frame — that was insufficient for some phone videos.)
// ============================================================

import { Project, MediaFile, TrackItem } from '../types';
import { drawTextItemOnCanvas } from './textLayout';

export interface FrameRenderAssets {
  videoFrames: Map<string, ImageBitmap | null>;
  images:      Map<string, ImageBitmap>;
  mediaMap:    Map<string, MediaFile>;
}

export interface RenderFrameParams {
  ctx:      CanvasRenderingContext2D;
  timeSec:  number;
  width:    number;
  height:   number;
  project:  Project;
  assets:   FrameRenderAssets;
}

// ── Helpers ────────────────────────────────────────────────

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

function getOrientation(w: number, h: number): 'portrait' | 'landscape' | 'square' {
  if (h > w) return 'portrait';
  if (w > h) return 'landscape';
  return 'square';
}

/**
 * Decides rotation by comparing the frame's orientation against the TARGET canvas.
 * If the frame is landscape but the canvas is portrait (or vice-versa), rotate 90°.
 * This is the correct single rule — it does NOT depend on MediaFile metadata.
 */
function detectFrameRotationForTarget(
  frameWidth:   number,
  frameHeight:  number,
  targetWidth:  number,
  targetHeight: number
): 0 | 90 {
  const frameOrient  = getOrientation(frameWidth,  frameHeight);
  const targetOrient = getOrientation(targetWidth, targetHeight);

  // Square cases — never rotate
  if (frameOrient === 'square' || targetOrient === 'square') return 0;

  return frameOrient !== targetOrient ? 90 : 0;
}

/**
 * Contain-fit draw: scales source to fill dest proportionally, centered.
 * offsetX/offsetY are added AFTER centering (used when ctx is already translated).
 */
function drawContain(
  ctx:     CanvasRenderingContext2D,
  source:  CanvasImageSource,
  srcW:    number,
  srcH:    number,
  destW:   number,
  destH:   number,
  offsetX  = 0,
  offsetY  = 0
) {
  if (!srcW || !srcH) return;
  const scale = Math.min(destW / srcW, destH / srcH);
  const dw    = srcW * scale;
  const dh    = srcH * scale;
  const dx    = (destW - dw) / 2 + offsetX;
  const dy    = (destH - dh) / 2 + offsetY;
  ctx.drawImage(source, 0, 0, srcW, srcH, dx, dy, dw, dh);
}

/** Log throttle — only log once per unique key per session to avoid flooding. */
const _loggedKeys = new Set<string>();

/**
 * Draws a video frame applying:
 *  1. Rotation correction: frame orientation vs canvas orientation
 *  2. Flip (H/V)
 *  3. Opacity
 *  4. Visual filters (brightness / contrast / saturation)
 */
function drawVideoFrameCorrected(
  ctx:      CanvasRenderingContext2D,
  frame:    ImageBitmap,
  canvasW:  number,
  canvasH:  number,
  flipH:    boolean,
  flipV:    boolean,
  opacity:  number,
  filters:  string
) {
  const rotation = detectFrameRotationForTarget(frame.width, frame.height, canvasW, canvasH);

  const logKey = `${frame.width}x${frame.height}→${canvasW}x${canvasH}`;
  if (!_loggedKeys.has(logKey)) {
    _loggedKeys.add(logKey);
    console.log('[FrameTargetRotationCheck]', {
      frameWidth:   frame.width,
      frameHeight:  frame.height,
      canvasWidth:  canvasW,
      canvasHeight: canvasH,
      rotation,
    });
  }

  ctx.save();
  ctx.globalAlpha = opacity;
  if (filters) (ctx as CanvasRenderingContext2D & { filter: string }).filter = filters;

  // Always translate to center first
  ctx.translate(canvasW / 2, canvasH / 2);

  if (rotation === 90) {
    ctx.rotate(Math.PI / 2);
  }

  // Apply flip AFTER rotation so axes are already correct
  ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);

  // After rotation the target space has swapped dimensions
  const targetW = rotation === 90 ? canvasH : canvasW;
  const targetH = rotation === 90 ? canvasW : canvasH;

  drawContain(ctx, frame, frame.width, frame.height, targetW, targetH, -targetW / 2, -targetH / 2);

  if (filters) (ctx as CanvasRenderingContext2D & { filter: string }).filter = 'none';
  ctx.restore();
  ctx.globalAlpha = 1;
}

// ── Main export ────────────────────────────────────────────

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

      drawVideoFrameCorrected(
        ctx,
        frame,
        width,
        height,
        vd?.flipH   ?? false,
        vd?.flipV   ?? false,
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

