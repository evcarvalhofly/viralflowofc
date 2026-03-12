// ============================================================
// ViralCut – Diffusion Composition Builder
// Converts the ViralCut Project + MediaFile[] into a
// @diffusionstudio/core Composition ready for encoding.
// ============================================================
import * as core from '@diffusionstudio/core';
import { Project, MediaFile } from '@/viralcut/types';
import { loadSourceMap } from './loadSourceMap';
import { mapVideoClip } from './mapVideoClip';
import { mapAudioClip } from './mapAudioClip';
import { mapImageClip } from './mapImageClip';
import { mapTextClip } from './mapTextClip';

const log = (...args: unknown[]) => console.log('[ViralCut FastExport]', ...args);

export async function buildDiffusionComposition(
  project: Project,
  media: MediaFile[]
): Promise<core.Composition> {
  log('Building Diffusion composition…');

  const composition = new core.Composition({
    width: project.width,
    height: project.height,
    background: '#000000',
  });

  // Load all source files once
  log('Loading source files…');
  const sourceMap = await loadSourceMap(media);
  log(`Sources loaded: ${sourceMap.size}`);

  // Process tracks in order (bottom → top for layering)
  for (const track of project.tracks) {
    if (track.muted) {
      log(`Skipping muted track: ${track.id} (${track.type})`);
      continue;
    }

    const sortedItems = [...track.items].sort((a, b) => a.startTime - b.startTime);
    if (sortedItems.length === 0) continue;

    // Create a layer for each track
    // VIDEO tracks: use SEQUENTIAL mode so cuts play in order without overlap
    // AUDIO/IMAGE/TEXT tracks: use default mode (clips placed by delay/offset)
    const layerMode = track.type === 'video' ? 'SEQUENTIAL' : 'DEFAULT';
    const layer = await composition.add(new core.Layer({ mode: layerMode as any }));

    log(`Track ${track.type} → Layer (mode=${layerMode}), ${sortedItems.length} item(s)`);

    for (const item of sortedItems) {
      try {
        let clip: core.VideoClip | core.AudioClip | core.ImageClip | core.TextClip | null = null;

        if (track.type === 'video') {
          clip = await mapVideoClip(item, sourceMap);
        } else if (track.type === 'audio') {
          clip = await mapAudioClip(item, sourceMap);
        } else if (track.type === 'image') {
          clip = await mapImageClip(item, sourceMap, project);
        } else if (track.type === 'text') {
          clip = await mapTextClip(item, project);
        }

        if (clip) {
          await layer.add(clip as any);
          log(`  + ${track.type} clip: "${item.name}" [${item.startTime.toFixed(2)}s → ${item.endTime.toFixed(2)}s]`);
        }
      } catch (err) {
        console.warn(`[buildDiffusionComposition] Failed to add clip "${item.name}":`, err);
      }
    }
  }

  log('Composition built successfully');
  return composition;
}
