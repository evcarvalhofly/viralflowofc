// ============================================================
// ViralCut – Video Clip Mapper
// Converts a ViralCut TrackItem (video) into a core.VideoClip.
// ============================================================
import * as core from '@diffusionstudio/core';
import { TrackItem } from '@/viralcut/types';
import { SourceMap } from './loadSourceMap';

export async function mapVideoClip(
  item: TrackItem,
  sourceMap: SourceMap
): Promise<core.VideoClip | null> {
  const source = sourceMap.get(item.mediaId) as core.VideoSource | undefined;
  if (!source) {
    console.warn(`[mapVideoClip] Source not found for mediaId: ${item.mediaId}`);
    return null;
  }

  const vd = item.videoDetails;
  const duration = item.endTime - item.startTime;

  const clip = new core.VideoClip(source, {
    // trim into the source media
    range: [item.mediaStart, item.mediaEnd] as [number, number],
    // position on the composition timeline
    delay: item.startTime,
    duration,
    // visual
    opacity: vd?.opacity ?? 1,
    volume: vd?.volume ?? 1,
    position: 'center',
  });

  // Apply CSS filter effects
  const effects: core.Effect[] = [];

  if (vd?.brightness !== undefined && Math.abs(vd.brightness - 1) > 0.01) {
    effects.push(new core.BrightnessEffect({ brightness: vd.brightness }));
  }
  if (vd?.contrast !== undefined && Math.abs(vd.contrast - 1) > 0.01) {
    effects.push(new core.ContrastEffect({ contrast: vd.contrast }));
  }
  if (vd?.saturation !== undefined && Math.abs(vd.saturation - 1) > 0.01) {
    effects.push(new core.SaturationEffect({ saturation: vd.saturation }));
  }

  if (effects.length > 0) {
    clip.filters = effects;
  }

  // Flip transforms
  if (vd?.flipH) clip.scale(-1, 1);
  if (vd?.flipV) clip.scale(1, -1);

  // Playback rate
  if (vd?.playbackRate !== undefined && Math.abs(vd.playbackRate - 1) > 0.01) {
    // @ts-expect-error playbackRate may not be in types but is supported at runtime
    clip.playbackRate = vd.playbackRate;
  }

  return clip;
}
