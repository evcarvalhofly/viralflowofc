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

// Helper: contain-fit draw centered at origin (works for both rotated and non-rotated contexts)
// Always draws centered at (0,0) in local coordinates — caller must translate to center first.
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
 * Detects the effective rotation needed to display the video correctly.
 *
 * Strategy (in priority order):
 *
 * 1. If the bitmap is landscape but the canvas/project is portrait AND
 *    there is a declared rotation of 90/270 → trust declared rotation.
 *
 * 2. If the bitmap is landscape but the canvas/project is portrait and
 *    NO display metadata is available → the browser did NOT auto-correct;
 *    apply 90° (most common phone rotation).
 *
 * 3. If displayWidth/displayHeight ARE set and contradict the bitmap
 *    orientation → apply declared rotation or infer 90/270.
 *
 * 4. If bitmap orientation already matches what we expect → 0 (no rotation).
 *
 * Key insight: when meta.displayWidth/Height are missing, fall back to
 * checking declaredRotation directly instead of treating the bitmap as
 * already-correct — avoids showing a landscape frame in a portrait canvas.
 */
function getEffectiveRotation(
  frame: ImageBitmap,
  meta?: VideoFrameMeta,
  canvasW?: number,
  canvasH?: number
): 0 | 90 | 180 | 270 {
  const declaredRotation = (meta?.rotationDeg ?? 0) as 0 | 90 | 180 | 270;
  const bitmapIsLandscape = frame.width > frame.height;
  const bitmapIsPortrait  = frame.height > frame.width;

  // ── Case A: displayWidth/Height are explicitly known ───────────────────
  const hasDisplayMeta = meta?.displayWidth != null && meta?.displayHeight != null;
  if (hasDisplayMeta) {
    const displayW = meta!.displayWidth!;
    const displayH = meta!.displayHeight!;
    const displayIsPortrait  = displayH > displayW;
    const displayIsLandscape = displayW > displayH;

    if (bitmapIsLandscape && displayIsPortrait) {
      return declaredRotation !== 0 ? declaredRotation : 90;
    }
    if (bitmapIsPortrait && displayIsLandscape) {
      return declaredRotation !== 0 ? declaredRotation : 270;
    }
    // Orientations match → no rotation needed
    return 0;
  }

  // ── Case B: No display metadata — use declared rotation + bitmap shape ─
  // If declared rotation is 90/270 and bitmap is still landscape,
  // browser did NOT auto-correct → we must rotate.
  if ((declaredRotation === 90 || declaredRotation === 270) && bitmapIsLandscape) {
    return declaredRotation;
  }

  // If declared rotation is 90/270 but bitmap is already portrait,
  // browser auto-corrected → no extra rotation needed.
  if ((declaredRotation === 90 || declaredRotation === 270) && bitmapIsPortrait) {
    return 0;
  }

  // ── Case C: Canvas hint — if canvas is portrait but bitmap is landscape ─
  // and no other info is available, apply 90° to correct phone footage.
  if (canvasW != null && canvasH != null) {
    const canvasIsPortrait = canvasH > canvasW;
    if (bitmapIsLandscape && canvasIsPortrait) {
      return declaredRotation !== 0 ? declaredRotation : 90;
    }
  }

  if (declaredRotation === 180) return 180;

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

      // Effective rotation – auto-detects transposed bitmaps (e.g. 2160x3840 phones)
      // Pass canvas dimensions as a last-resort hint when display metadata is absent.
      const rotationDeg = getEffectiveRotation(frame, meta, width, height);

      // Raw bitmap dimensions
      const rawW = frame.width;
      const rawH = frame.height;

      console.log('[ViralCut][render-final]', {
        mediaId: videoItem.mediaId,
        rawW,
        rawH,
        projectW: width,
        projectH: height,
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
        // ── No rotation – contain-fit centered ────────────────
        ctx.translate(width / 2 + (vd?.flipH ? -width / 2 : 0), height / 2 + (vd?.flipV ? -height / 2 : 0));
        ctx.translate(vd?.flipH ? -width / 2 : 0, vd?.flipV ? -height / 2 : 0);
        ctx.scale(flipScaleX, flipScaleY);
        drawContainFitCentered(ctx, frame, width, height, rawW, rawH);

      } else if (rotationDeg === 90 || rotationDeg === 270) {
        // ── 90° / 270° rotation – rotate canvas then contain-fit ──
        ctx.translate(width / 2, height / 2);
        ctx.rotate(rotationDeg === 90 ? Math.PI / 2 : -Math.PI / 2);
        ctx.scale(flipScaleX, flipScaleY);
        // After rotation, visible box is height×width
        drawContainFitCentered(ctx, frame, height, width, rawW, rawH);

      } else if (rotationDeg === 180) {
        // ── 180° rotation – contain-fit ───────────────────────
        ctx.translate(width / 2, height / 2);
        ctx.rotate(Math.PI);
        ctx.scale(flipScaleX, flipScaleY);
        drawContainFitCentered(ctx, frame, width, height, rawW, rawH);
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
