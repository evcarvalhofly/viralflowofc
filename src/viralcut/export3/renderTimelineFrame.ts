// ============================================================
// ViralCut Export3 – Per-frame deterministic renderer (v13)
//
// RULES:
//   - Canvas is ALWAYS created with the correct final size.
//   - Use contain-fit (letterbox) — no stretching ever.
//   - Rotation is corrected ONLY at draw time when the ImageBitmap
//     orientation disagrees with MediaFile.orientation (single source of truth).
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

/**
 * Detects whether the ImageBitmap needs a 90° rotation to match the MediaFile's
 * declared orientation (which was locked at import time).
 *
 * Some high-quality phone videos are decoded by the browser with swapped
 * width/height even though the MediaFile orientation is correctly set,
 * causing the frame to arrive "sideways".
 */
function detectFrameRotation(
  media: MediaFile,
  frameWidth: number,
  frameHeight: number
): 0 | 90 {
  if (!media.width || !media.height) return 0;

  const mediaIsPortrait = media.height > media.width;
  const mediaIsLandscape = media.width > media.height;
  const frameIsPortrait  = frameHeight > frameWidth;
  const frameIsLandscape = frameWidth > frameHeight;

  // Square cases — never rotate
  if (!mediaIsPortrait && !mediaIsLandscape) return 0;
  if (!frameIsPortrait && !frameIsLandscape) return 0;

  // Mismatch → rotate 90°
  return mediaIsPortrait !== frameIsPortrait ? 90 : 0;
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

/** Log throttle — only log once per unique mediaId per session to avoid flooding. */
const _loggedIds = new Set<string>();

/**
 * Draws a video frame applying:
 *  1. Visual filters (brightness / contrast / saturation)
 *  2. Flip (H/V)
 *  3. Opacity
 *  4. Rotation correction when frame orientation disagrees with MediaFile orientation
 */
function drawVideoFrameCorrected(
  ctx:      CanvasRenderingContext2D,
  frame:    ImageBitmap,
  media:    MediaFile,
  canvasW:  number,
  canvasH:  number,
  flipH:    boolean,
  flipV:    boolean,
  opacity:  number,
  filters:  string
) {
  const rotation = detectFrameRotation(media, frame.width, frame.height);

  if (!_loggedIds.has(media.id)) {
    _loggedIds.add(media.id);
    console.log('[FrameRotationCheck]', {
      mediaId:        media.id,
      mediaWidth:     media.width,
      mediaHeight:    media.height,
      frameWidth:     frame.width,
      frameHeight:    frame.height,
      appliedRotation: rotation,
    });
  }

  ctx.save();
  ctx.globalAlpha = opacity;
  if (filters) (ctx as CanvasRenderingContext2D & { filter: string }).filter = filters;

  if (rotation === 90) {
    // Translate to center, rotate, then contain-fit using swapped canvas dims
    ctx.translate(canvasW / 2, canvasH / 2);

    if (flipH || flipV) {
      ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
    }

    ctx.rotate(Math.PI / 2);

    // After rotation, canvas width/height are swapped in the rotated space
    const rotW = canvasH;
    const rotH = canvasW;

    drawContain(ctx, frame, frame.width, frame.height, rotW, rotH, -rotW / 2, -rotH / 2);
  } else {
    if (flipH || flipV) {
      ctx.translate(flipH ? canvasW : 0, flipV ? canvasH : 0);
      ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
    }

    drawContain(ctx, frame, frame.width, frame.height, canvasW, canvasH);
  }

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
    const media = assets.mediaMap.get(videoItem.mediaId);

    if (frame && media) {
      const vd      = videoItem.videoDetails;
      const filters: string[] = [];
      if (vd?.brightness != null && vd.brightness !== 1) filters.push(`brightness(${vd.brightness})`);
      if (vd?.contrast   != null && vd.contrast   !== 1) filters.push(`contrast(${vd.contrast})`);
      if (vd?.saturation != null && vd.saturation !== 1) filters.push(`saturate(${vd.saturation})`);

      drawVideoFrameCorrected(
        ctx,
        frame,
        media,
        width,
        height,
        vd?.flipH   ?? false,
        vd?.flipV   ?? false,
        vd?.opacity ?? 1,
        filters.join(' ')
      );
    } else if (frame) {
      // Fallback: no MediaFile available — draw as-is (no rotation correction)
      drawContain(ctx, frame, frame.width, frame.height, width, height);
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
