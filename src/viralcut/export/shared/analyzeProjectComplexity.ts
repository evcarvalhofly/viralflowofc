// ============================================================
// ViralCut – Project Complexity Analyzer
//
// Determines whether a project requires the native WebCodecs
// compositor (text overlays, image layers, simultaneous clips)
// or can be handled by the simpler FFmpeg pipeline.
// ============================================================
import { Project } from '@/viralcut/types';

export interface ProjectComplexity {
  hasText: boolean;
  hasImage: boolean;
  hasVisualOverlap: boolean;
  visualItemsCount: number;
  /** true if the project MUST use the native compositor */
  isComplex: boolean;
}

export function analyzeProjectComplexity(project: Project): ProjectComplexity {
  const visualTracks = project.tracks.filter(
    (t) => !t.muted && (t.type === 'video' || t.type === 'image' || t.type === 'text')
  );

  interface Slot { id: string; type: string; startTime: number; endTime: number }
  const items: Slot[] = visualTracks.flatMap((t) =>
    t.items.map((i) => ({
      id: i.id,
      type: i.type,
      startTime: i.startTime,
      endTime: i.endTime,
    }))
  );

  const hasText  = items.some((i) => i.type === 'text');
  const hasImage = items.some((i) => i.type === 'image');

  // Check if any two visual items overlap in time
  let hasVisualOverlap = false;
  outer: for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i];
      const b = items[j];
      if (a.startTime < b.endTime && b.startTime < a.endTime) {
        hasVisualOverlap = true;
        break outer;
      }
    }
  }

  return {
    hasText,
    hasImage,
    hasVisualOverlap,
    visualItemsCount: items.length,
    isComplex: hasText || hasImage || hasVisualOverlap,
  };
}
