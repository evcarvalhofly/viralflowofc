// ============================================================
// ViralCut – Video Clip Mapper
// Converts a ViralCut TrackItem (video) into a core.VideoClip.
// Uses the REAL @diffusionstudio/core API:
//   - effects: Effect[] (plain objects with type + value)
//   - scaleX / scaleY (number properties on the clip)
//   - No BrightnessEffect/ContrastEffect classes
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

  // Build effects array using plain Effect objects (not class instances)
  const effects: core.Effect[] = [];

  if (vd?.brightness !== undefined && Math.abs(vd.brightness - 1) > 0.01) {
    // Core uses CSS % values: 1.0 = 100%, 1.5 = 150%
    effects.push({ type: 'brightness', value: vd.brightness * 100 });
  }
  if (vd?.contrast !== undefined && Math.abs(vd.contrast - 1) > 0.01) {
    effects.push({ type: 'contrast', value: vd.contrast * 100 });
  }
  if (vd?.saturation !== undefined && Math.abs(vd.saturation - 1) > 0.01) {
    effects.push({ type: 'saturate', value: vd.saturation * 100 });
  }

  const clip = new core.VideoClip(source, {
    range: [item.mediaStart, item.mediaEnd] as [number, number],
    delay: item.startTime,
    duration,
    opacity: vd?.opacity ?? 1,
    volume: vd?.volume ?? 1,
    position: 'center',
    scaleX: vd?.flipH ? -1 : 1,
    scaleY: vd?.flipV ? -1 : 1,
    effects,
  });

  if (vd?.playbackRate !== undefined && Math.abs(vd.playbackRate - 1) > 0.01) {
    (clip as any).playbackRate = vd.playbackRate;
  }

  return clip;
}
