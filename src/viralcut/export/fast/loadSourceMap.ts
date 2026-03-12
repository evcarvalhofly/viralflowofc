// ============================================================
// ViralCut – Source Map Loader
// Loads each unique MediaFile into a @diffusionstudio/core
// Source object exactly once to avoid redundant fetches.
// ============================================================
import * as core from '@diffusionstudio/core';
import { MediaFile } from '@/viralcut/types';

export type SourceMap = Map<string, core.VideoSource | core.AudioSource | core.ImageSource>;

export async function loadSourceMap(media: MediaFile[]): Promise<SourceMap> {
  const map: SourceMap = new Map();

  await Promise.all(
    media.map(async (m) => {
      try {
        if (m.type === 'video') {
          const src = await core.Source.from<core.VideoSource>(m.url);
          map.set(m.id, src);
        } else if (m.type === 'audio') {
          const src = await core.Source.from<core.AudioSource>(m.url);
          map.set(m.id, src);
        } else if (m.type === 'image') {
          const src = await core.Source.from<core.ImageSource>(m.url);
          map.set(m.id, src);
        }
      } catch (err) {
        console.warn(`[ViralCut FastExport] Failed to load source for "${m.name}":`, err);
      }
    })
  );

  return map;
}
