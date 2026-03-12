// ============================================================
// ViralCut – Image Clip Mapper
// Converts a ViralCut TrackItem (image) into a core.ImageClip.
// posX/posY are % of canvas dimensions in ViralCut.
// ============================================================
import * as core from '@diffusionstudio/core';
import { TrackItem, Project } from '@/viralcut/types';
import { SourceMap } from './loadSourceMap';

export async function mapImageClip(
  item: TrackItem,
  sourceMap: SourceMap,
  project: Project
): Promise<core.ImageClip | null> {
  const source = sourceMap.get(item.mediaId) as core.ImageSource | undefined;
  if (!source) {
    console.warn(`[mapImageClip] Source not found for mediaId: ${item.mediaId}`);
    return null;
  }

  const id = item.imageDetails;
  const duration = item.endTime - item.startTime;

  const pxX = ((id?.posX ?? 50) / 100) * project.width;
  const pxY = ((id?.posY ?? 50) / 100) * project.height;
  const pxW = Math.round(((id?.width ?? 50) / 100) * project.width);
  const pxH = Math.round(((id?.height ?? 50) / 100) * project.height);

  const clip = new core.ImageClip(source, {
    delay: item.startTime,
    duration,
    x: pxX,
    y: pxY,
    width: pxW,
    height: pxH,
    opacity: id?.opacity ?? 1,
  });

  const effects: core.Effect[] = [];
  if (id?.brightness !== undefined && Math.abs(id.brightness - 1) > 0.01) {
    effects.push(new core.BrightnessEffect({ brightness: id.brightness }));
  }
  if (id?.contrast !== undefined && Math.abs(id.contrast - 1) > 0.01) {
    effects.push(new core.ContrastEffect({ contrast: id.contrast }));
  }
  if (id?.saturation !== undefined && Math.abs(id.saturation - 1) > 0.01) {
    effects.push(new core.SaturationEffect({ saturation: id.saturation }));
  }
  if (effects.length > 0) {
    clip.filters = effects;
  }

  if (id?.flipH) clip.scale(-1, 1);
  if (id?.flipV) clip.scale(1, -1);

  return clip;
}
