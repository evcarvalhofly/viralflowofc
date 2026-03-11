// ============================================================
// ViralCut – Store helpers
// ============================================================
import { Track, TrackItem, Project } from './types';

export function createId() {
  return Math.random().toString(36).slice(2, 10);
}

export function createDefaultProject(): Project {
  return {
    id: createId(),
    name: 'Projeto sem título',
    tracks: [
      { id: createId(), type: 'video', items: [], locked: false, muted: false },
      { id: createId(), type: 'audio', items: [], locked: false, muted: false },
      { id: createId(), type: 'text', items: [], locked: false, muted: false },
    ],
    duration: 0,
    fps: 30,
    width: 1920,
    height: 1080,
    aspectRatio: '16:9',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

export function calcProjectDuration(tracks: Track[]): number {
  let max = 0;
  for (const t of tracks) {
    for (const item of t.items) {
      if (item.endTime > max) max = item.endTime;
    }
  }
  return max;
}

export const ASPECT_RATIOS: Record<Project['aspectRatio'], { w: number; h: number; label: string }> = {
  '16:9': { w: 1920, h: 1080, label: '16:9 Paisagem' },
  '9:16': { w: 1080, h: 1920, label: '9:16 Retrato (Reels)' },
  '1:1': { w: 1080, h: 1080, label: '1:1 Quadrado' },
  '4:5': { w: 1080, h: 1350, label: '4:5 Feed' },
};
