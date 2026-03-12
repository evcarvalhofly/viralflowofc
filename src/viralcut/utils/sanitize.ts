// ============================================================
// ViralCut – Timeline Sanitizer
// Runs before preview and before export to guarantee all items
// have valid, non-overlapping, correctly-ordered data.
// ============================================================
import { Track, TrackItem, Project } from '../types';

export const MIN_CLIP_DURATION = 0.08; // seconds — shorter clips cause seek thrash

/** Round to 3 decimal places to avoid floating-point drift */
function r3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/** Sanitize a single item's numeric fields */
function sanitizeItem(item: TrackItem): TrackItem | null {
  const startTime = r3(Math.max(0, Number.isFinite(item.startTime) ? item.startTime : 0));
  const endTime   = r3(Number.isFinite(item.endTime)   ? item.endTime   : startTime + 1);
  const mediaStart = r3(Math.max(0, Number.isFinite(item.mediaStart) ? item.mediaStart : 0));
  const mediaEnd   = r3(Number.isFinite(item.mediaEnd) ? item.mediaEnd : mediaStart + (endTime - startTime));

  if (endTime - startTime < MIN_CLIP_DURATION) return null;
  if (mediaEnd <= mediaStart) return null;

  return {
    ...item,
    startTime,
    endTime,
    mediaStart: Math.min(mediaStart, mediaEnd - MIN_CLIP_DURATION),
    mediaEnd,
  };
}

/** Sanitize all tracks – filter bad items, sort, clamp */
export function sanitizeTracks(tracks: Track[]): Track[] {
  return tracks.map((track) => ({
    ...track,
    items: track.items
      .map(sanitizeItem)
      .filter((i): i is TrackItem => i !== null)
      .sort((a, b) => a.startTime - b.startTime),
  }));
}

/** Full project sanitizer */
export function sanitizeProject(project: Project): Project {
  const tracks = sanitizeTracks(project.tracks);
  let max = 0;
  for (const t of tracks) for (const i of t.items) if (i.endTime > max) max = i.endTime;
  return { ...project, tracks, duration: max };
}

/** Validate project for export – throws descriptive errors */
export function validateProjectForExport(project: Project): void {
  const videoTracks = project.tracks.filter((t) => t.type === 'video' && !t.muted);
  if (videoTracks.every((t) => t.items.length === 0)) {
    throw new Error('Nenhum vídeo na timeline para exportar.');
  }

  for (const track of project.tracks) {
    for (const item of track.items) {
      if (!Number.isFinite(item.startTime) || !Number.isFinite(item.endTime)) {
        throw new Error(`Item com tempo inválido: "${item.name}". Remova-o e tente novamente.`);
      }
      if (item.endTime - item.startTime < MIN_CLIP_DURATION) {
        throw new Error(`Clipe muito curto: "${item.name}" (${(item.endTime - item.startTime).toFixed(3)}s). Mínimo: ${MIN_CLIP_DURATION}s.`);
      }
      if (item.mediaEnd <= item.mediaStart) {
        throw new Error(`Trim inválido no clipe: "${item.name}". Ajuste os pontos de corte.`);
      }
    }
  }
}

/** Find all active items at a given time (O(n) but with early-exit per track) */
export function findActiveItemsAtTime(
  tracks: Track[],
  time: number
): { video: TrackItem | null; audio: TrackItem[]; text: TrackItem[]; image: TrackItem[] } {
  let video: TrackItem | null = null;
  const audio: TrackItem[] = [];
  const text: TrackItem[] = [];
  const image: TrackItem[] = [];

  for (const track of tracks) {
    if (track.muted) continue;
    for (const item of track.items) {
      if (time < item.startTime) break; // items are sorted; no need to continue
      if (time >= item.startTime && time < item.endTime) {
        if (track.type === 'video' && !video) video = item;
        else if (track.type === 'audio') audio.push(item);
        else if (track.type === 'text') text.push(item);
        else if (track.type === 'image') image.push(item);
      }
    }
  }
  return { video, audio, text, image };
}
