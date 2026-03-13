// ============================================================
// ViralCut Export2 – Per-frame renderer
//
// Called every frame tick during export.
// Draws: holdCanvas (if no ready video) → video → image overlays → text
//
// Key fix: never clear to black unconditionally.
// If videoEl is not ready, draw holdCanvas instead.
// ============================================================
import { Project, TrackItem } from '../types';
import { PreparedExportAssets } from './prepareExportAssets';
import { drawTextItemOnCanvas } from './textLayout';

export interface RenderFrameParams {
  ctx: CanvasRenderingContext2D;
  timeSec: number;
  width: number;
  height: number;
  project: Project;
  assets: PreparedExportAssets;
  /** Holds the last successfully rendered frame to avoid black on gaps */
  holdCanvas?: HTMLCanvasElement | null;
}

// Resolve which items are active at timeSec (non-video layers)
function getOverlayItems(project: Project, timeSec: number) {
  const imageItems: TrackItem[] = [];
  const textItems: TrackItem[] = [];

  for (const track of project.tracks) {
    if (track.muted) continue;
    for (const item of track.items) {
      if (timeSec < item.startTime) continue;
      if (timeSec >= item.endTime) continue;
      if (track.type === 'image') imageItems.push(item);
      else if (track.type === 'text') textItems.push(item);
    }
  }

  return { imageItems, textItems };
}

// Find the active video item and its element
function getActiveVideoEl(
  project: Project,
  assets: PreparedExportAssets,
  timeSec: number
): { item: TrackItem; el: HTMLVideoElement } | null {
  for (const track of project.tracks) {
    if (track.type !== 'video' || track.muted) continue;
    for (const item of track.items) {
      if (timeSec < item.startTime || timeSec >= item.endTime) continue;
      const el = assets.videos.get(item.mediaId);
      if (el) return { item, el };
    }
  }
  return null;
}

export function renderTimelineFrame({
  ctx,
  timeSec,
  width,
  height,
  project,
  assets,
  holdCanvas,
}: RenderFrameParams) {
  const activeVideo = getActiveVideoEl(project, assets, timeSec);
  const videoReady = !!(activeVideo && activeVideo.el.readyState >= 2);

  // ── Background ────────────────────────────────────────────
  // Use black only when video is ready (it will cover it).
  // When not ready, draw the held frame to avoid ANY black flash.
  if (videoReady) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, width, height);
  } else if (holdCanvas) {
    ctx.drawImage(holdCanvas, 0, 0, width, height);
  } else {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, width, height);
  }

  // ── Active video clip ─────────────────────────────────────
  if (activeVideo && videoReady) {
    const { item: videoItem, el: videoEl } = activeVideo;
    const vd = videoItem.videoDetails;
    ctx.save();

    ctx.globalAlpha = vd?.opacity ?? 1;

    const filters: string[] = [];
    if (vd?.brightness != null && vd.brightness !== 1) filters.push(`brightness(${vd.brightness})`);
    if (vd?.contrast   != null && vd.contrast   !== 1) filters.push(`contrast(${vd.contrast})`);
    if (vd?.saturation != null && vd.saturation !== 1) filters.push(`saturate(${vd.saturation})`);
    if (filters.length) (ctx as any).filter = filters.join(' ');

    if (vd?.flipH || vd?.flipV) {
      ctx.translate(vd.flipH ? width : 0, vd.flipV ? height : 0);
      ctx.scale(vd.flipH ? -1 : 1, vd.flipV ? -1 : 1);
    }

    // Cover-fit
    const vw = videoEl.videoWidth || width;
    const vh = videoEl.videoHeight || height;
    const scale = Math.max(width / vw, height / vh);
    const dw = vw * scale;
    const dh = vh * scale;
    const dx = (width - dw) / 2;
    const dy = (height - dh) / 2;
    ctx.drawImage(videoEl, dx, dy, dw, dh);

    (ctx as any).filter = 'none';
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  const { imageItems, textItems } = getOverlayItems(project, timeSec);

  // ── Image overlays ────────────────────────────────────────
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

  // ── Text overlays ─────────────────────────────────────────
  for (const textItem of textItems) {
    drawTextItemOnCanvas(ctx, textItem, width, height);
  }
}
