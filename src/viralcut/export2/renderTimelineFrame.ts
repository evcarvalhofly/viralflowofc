// ============================================================
// ViralCut Export2 – Per-frame renderer
//
// Called every requestAnimationFrame tick during export.
// Draws: background → active video → image overlays → text
// ============================================================
import { Project, TrackItem } from '../types';
import { PreparedExportAssets } from './prepareExportAssets';
import { drawTextItemOnCanvas } from './textLayout';

// Resolve which items are active at timeMs
function getActiveItems(project: Project, timeSec: number) {
  let videoItem: TrackItem | null = null;
  const imageItems: TrackItem[] = [];
  const textItems: TrackItem[] = [];

  for (const track of project.tracks) {
    if (track.muted) continue;
    for (const item of track.items) {
      if (timeSec < item.startTime) continue;
      if (timeSec >= item.endTime) continue;
      if (track.type === 'video' && !videoItem) { videoItem = item; }
      else if (track.type === 'image') { imageItems.push(item); }
      else if (track.type === 'text') { textItems.push(item); }
    }
  }

  return { videoItem, imageItems, textItems };
}

export interface RenderFrameParams {
  ctx: CanvasRenderingContext2D;
  timeSec: number;   // current project time in seconds
  width: number;
  height: number;
  project: Project;
  assets: PreparedExportAssets;
}

export function renderTimelineFrame({
  ctx,
  timeSec,
  width,
  height,
  project,
  assets,
}: RenderFrameParams) {
  // Clear
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, width, height);

  const { videoItem, imageItems, textItems } = getActiveItems(project, timeSec);

  // ── Active video clip ─────────────────────────────────────
  if (videoItem) {
    const el = assets.videos.get(videoItem.mediaId);
    if (el && el.readyState >= 2) {
      const vd = videoItem.videoDetails;
      ctx.save();

      // Opacity
      ctx.globalAlpha = vd?.opacity ?? 1;

      // Filters
      const filters: string[] = [];
      if (vd?.brightness != null && vd.brightness !== 1) filters.push(`brightness(${vd.brightness})`);
      if (vd?.contrast != null && vd.contrast !== 1) filters.push(`contrast(${vd.contrast})`);
      if (vd?.saturation != null && vd.saturation !== 1) filters.push(`saturate(${vd.saturation})`);
      if (filters.length) (ctx as any).filter = filters.join(' ');

      // Flip
      if (vd?.flipH || vd?.flipV) {
        ctx.translate(vd.flipH ? width : 0, vd.flipV ? height : 0);
        ctx.scale(vd.flipH ? -1 : 1, vd.flipV ? -1 : 1);
      }

      // Draw video — cover-fit
      const vw = el.videoWidth || width;
      const vh = el.videoHeight || height;
      const scale = Math.max(width / vw, height / vh);
      const dw = vw * scale;
      const dh = vh * scale;
      const dx = (width - dw) / 2;
      const dy = (height - dh) / 2;
      ctx.drawImage(el, dx, dy, dw, dh);

      (ctx as any).filter = 'none';
      ctx.restore();
      ctx.globalAlpha = 1;
    }
  }

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
