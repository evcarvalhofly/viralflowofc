import { Segment, SilenceRange } from '../types';

/**
 * Converts silence ranges + duration into the segments we KEEP.
 * Applies padding so speech edges aren't clipped.
 */
export function buildKeepSegments(
  duration: number,
  silences: SilenceRange[],
  paddingMs = 120,
  mergeGap = 0.08
): Segment[] {
  const padding = paddingMs / 1000;
  const keep: Segment[] = [];
  let cursor = 0;

  // Sort silences just in case
  const sorted = [...silences].sort((a, b) => a.start - b.start);

  for (const s of sorted) {
    const keepEnd = Math.max(cursor, s.start - padding);
    if (keepEnd > cursor + 0.01) {
      keep.push({ start: cursor, end: keepEnd });
    }
    cursor = Math.min(duration, s.end + padding);
  }

  if (cursor < duration - 0.01) {
    keep.push({ start: cursor, end: duration });
  }

  return mergeCloseSegments(keep, mergeGap);
}

export function mergeCloseSegments(
  segments: Segment[],
  gapThreshold = 0.08
): Segment[] {
  if (!segments.length) return [];

  const sorted = [...segments].sort((a, b) => a.start - b.start);
  const merged: Segment[] = [{ ...sorted[0] }];

  for (let i = 1; i < sorted.length; i++) {
    const prev = merged[merged.length - 1];
    const curr = sorted[i];

    if (curr.start - prev.end <= gapThreshold) {
      prev.end = Math.max(prev.end, curr.end);
    } else {
      merged.push({ ...curr });
    }
  }

  // Filter out tiny segments (< 0.1s)
  return merged.filter((s) => s.end - s.start >= 0.1);
}

/**
 * Total kept duration in seconds
 */
export function totalKeptDuration(segments: Segment[]): number {
  return segments.reduce((acc, s) => acc + (s.end - s.start), 0);
}

/**
 * Given keepSegments, maps a "virtual time" (in the cut video) to
 * real source time. Useful for subtitle sync.
 */
export function virtualToRealTime(
  virtualTime: number,
  segments: Segment[]
): number {
  let elapsed = 0;
  for (const seg of segments) {
    const dur = seg.end - seg.start;
    if (virtualTime <= elapsed + dur) {
      return seg.start + (virtualTime - elapsed);
    }
    elapsed += dur;
  }
  return segments[segments.length - 1]?.end ?? 0;
}
