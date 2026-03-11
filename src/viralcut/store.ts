// ============================================================
// ViralCut – Editor Store (Zustand-like with React state)
// ============================================================
import { createContext, useContext } from 'react';
import { MediaFile, Track, TrackItem, Project } from './types';

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
    ],
    duration: 0,
    fps: 30,
    width: 1920,
    height: 1080,
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
