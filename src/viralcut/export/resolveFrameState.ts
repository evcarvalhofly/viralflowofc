// ============================================================
// ViralCut – Timeline frame-state resolver
// Returns exactly what should be visible/audible at a given time.
// Uses pre-sorted items for O(n) with early-exit.
// ============================================================
import { Project, TrackItem } from '../types';

export interface ResolvedFrameState {
  videoItem: TrackItem | null;
  imageItems: TrackItem[];
  textItems: TrackItem[];
  audioItems: TrackItem[];
}

/**
 * Resolves the active items at `time` seconds.
 * Assumes track items are already sorted by startTime (sanitizer guarantees this).
 */
export function resolveFrameStateAtTime(
  project: Project,
  time: number
): ResolvedFrameState {
  let videoItem: TrackItem | null = null;
  const imageItems: TrackItem[] = [];
  const textItems: TrackItem[] = [];
  const audioItems: TrackItem[] = [];

  for (const track of project.tracks) {
    if (track.muted) continue;
    for (const item of track.items) {
      // Items are sorted: if we've passed the start, check overlap
      if (time < item.startTime) break; // early-exit — no more items can be active
      if (time < item.endTime) {
        if (track.type === 'video' && !videoItem) videoItem = item;
        else if (track.type === 'image') imageItems.push(item);
        else if (track.type === 'text') textItems.push(item);
        else if (track.type === 'audio') audioItems.push(item);
      }
    }
  }

  return { videoItem, imageItems, textItems, audioItems };
}
