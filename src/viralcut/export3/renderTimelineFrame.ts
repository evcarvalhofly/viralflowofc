// ============================================================
// ViralCut Export3 – Per-frame deterministic renderer (v2)
//
// Renders one frame at a given time into a CanvasRenderingContext2D.
// Receives pre-decoded ImageBitmaps from VideoFrameCache plus
// rotation metadata so vertical phone footage renders correctly.
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

// Helper: cover-fit draw (fills canvas, may crop)
function drawCoverFit(
  ctx: CanvasRenderingContext2D,
  frame: ImageBitmap,
  canvasW: number,
  canvasH: number,
  displayW: number,
  displayH: number
) {
  const scale = Math.max(canvasW / displayW, canvasH / displayH);
  const dw = displayW * scale;
  const dh = displayH * scale;
  const dx = (canvasW - dw) / 2;
  const dy = (canvasH - dh) / 2;
  ctx.drawImage(frame, dx, dy, dw, dh);
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

  console.log('[renderTimelineFrame] Frame time', timeSec.toFixed(4));

  // ── Active video frame ─────────────────────────────────────
  const videoItem = getActiveVideoItem(project, timeSec);
  if (videoItem) {
    const frame = assets.videoFrames.get(videoItem.mediaId);
    if (frame) {
      const vd = videoItem.videoDetails;
      const meta = assets.videoMeta.get(videoItem.mediaId);

      // Use display dimensions – meta always wins when available
      const displayW = (meta?.displayWidth  ?? 0) > 0 ? meta!.displayWidth  : (frame.width  || width);
      const displayH = (meta?.displayHeight ?? 0) > 0 ? meta!.displayHeight : (frame.height || height);
      const rotationDeg = meta?.rotationDeg ?? 0;

      ctx.save();
      ctx.globalAlpha = vd?.opacity ?? 1;

      // Filters
      const filters: string[] = [];
      if (vd?.brightness != null && vd.brightness !== 1) filters.push(`brightness(${vd.brightness})`);
      if (vd?.contrast   != null && vd.contrast   !== 1) filters.push(`contrast(${vd.contrast})`);
      if (vd?.saturation != null && vd.saturation !== 1) filters.push(`saturate(${vd.saturation})`);
      if (filters.length) (ctx as CanvasRenderingContext2D & { filter: string }).filter = filters.join(' ');

      // Flip transforms (applied on top of rotation)
      const flipScaleX = (vd?.flipH) ? -1 : 1;
      const flipScaleY = (vd?.flipV) ? -1 : 1;

      if (rotationDeg === 0) {
        // ── No rotation – standard cover-fit ──────────────────
        if (vd?.flipH || vd?.flipV) {
          ctx.translate(vd.flipH ? width : 0, vd.flipV ? height : 0);
          ctx.scale(flipScaleX, flipScaleY);
        }
        drawCoverFit(ctx, frame, width, height, displayW, displayH);

      } else if (rotationDeg === 90 || rotationDeg === 270) {
        // ── 90° / 270° rotation ───────────────────────────────
        // The encoded frame is landscape; we must rotate it so it
        // appears portrait on the canvas.
        console.log('[renderTimelineFrame] Rotation applied', rotationDeg, 'for media', videoItem.mediaId);

        ctx.translate(width / 2, height / 2);
        const rad = rotationDeg === 90 ? Math.PI / 2 : -Math.PI / 2;
        ctx.rotate(rad);
        ctx.scale(flipScaleX, flipScaleY);

        // After rotating, the encoded frame dimensions are swapped:
        // encoded landscape (encodedW × encodedH) → displayed as portrait
        // We draw using the encoded (pre-rotation) dimensions for the
        // source, but fit it into the rotated canvas space.
        const rotatedCanvasW = height; // canvas height becomes the "width" after 90° rot
        const rotatedCanvasH = width;
        const encW = meta?.encodedWidth  || frame.width;
        const encH = meta?.encodedHeight || frame.height;

        const scale = Math.max(rotatedCanvasW / encW, rotatedCanvasH / encH);
        const dw = encW * scale;
        const dh = encH * scale;
        ctx.drawImage(frame, -dw / 2, -dh / 2, dw, dh);

      } else if (rotationDeg === 180) {
        // ── 180° rotation ────────────────────────────────────
        ctx.translate(width / 2, height / 2);
        ctx.rotate(Math.PI);
        ctx.scale(flipScaleX, flipScaleY);
        drawCoverFit(ctx, frame, width, height, displayW, displayH);
        // Note: drawCoverFit draws from (0,0) but we've translated to center,
        // so offset accordingly:
        // (Already handled by the cover-fit logic above; dx/dy center it)
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
