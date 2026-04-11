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

export const ASPECT_RATIOS: Record<Project['aspectRatio'], { w: number; h: number; label: string; desc: string }> = {
  '16:9': { w: 1920, h: 1080, label: '16:9', desc: 'YouTube / Horizontal' },
  '9:16': { w: 1080, h: 1920, label: '9:16', desc: 'TikTok / Reels / Shorts' },
  '1:1':  { w: 1080, h: 1080, label: '1:1',  desc: 'Instagram Square' },
  '4:5':  { w: 1080, h: 1350, label: '4:5',  desc: 'Instagram Feed' },
  '4:3':  { w: 1440, h: 1080, label: '4:3',  desc: 'Clássico / LinkedIn' },
  '3:4':  { w: 1080, h: 1440, label: '3:4',  desc: 'Retrato clássico' },
  '2:1':  { w: 1920, h:  960, label: '2:1',  desc: 'Banner / Twitter' },
  '21:9': { w: 2560, h: 1080, label: '21:9', desc: 'Cinemascope' },
};
