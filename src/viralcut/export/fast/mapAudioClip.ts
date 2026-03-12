// ============================================================
// ViralCut – Audio Clip Mapper
// Converts a ViralCut TrackItem (audio) into a core.AudioClip.
// ============================================================
import * as core from '@diffusionstudio/core';
import { TrackItem } from '@/viralcut/types';
import { SourceMap } from './loadSourceMap';

export async function mapAudioClip(
  item: TrackItem,
  sourceMap: SourceMap
): Promise<core.AudioClip | null> {
  const source = sourceMap.get(item.mediaId) as core.AudioSource | undefined;
  if (!source) {
    console.warn(`[mapAudioClip] Source not found for mediaId: ${item.mediaId}`);
    return null;
  }

  const ad = item.audioDetails;
  const duration = item.endTime - item.startTime;

  const clip = new core.AudioClip(source, {
    range: [item.mediaStart, item.mediaEnd] as [number, number],
    delay: item.startTime,
    duration,
    volume: ad?.volume ?? 1,
  });

  if (ad?.playbackRate !== undefined && Math.abs(ad.playbackRate - 1) > 0.01) {
    // @ts-expect-error playbackRate extension
    clip.playbackRate = ad.playbackRate;
  }

  return clip;
}
