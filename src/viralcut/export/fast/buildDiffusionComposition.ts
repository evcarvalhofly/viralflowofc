// ============================================================
// ViralCut – Diffusion Composition Builder
// Converts the ViralCut Project + MediaFile[] into a
// @diffusionstudio/core Composition ready for encoding.
//
// IMPORTANT: outputWidth/outputHeight come from the user's chosen
// export resolution — NOT from project.width/project.height.
// This ensures 720p → 1280×720 and 1080p → 1920×1080 always.
// ============================================================
import * as core from '@diffusionstudio/core';
import { Project, MediaFile } from '@/viralcut/types';
import { loadSourceMap } from './loadSourceMap';
import { mapVideoClip } from './mapVideoClip';
import { mapAudioClip } from './mapAudioClip';
import { mapImageClip } from './mapImageClip';
import { mapTextClip } from './mapTextClip';

const log = (...args: unknown[]) => console.log('[ViralCut FastExport]', ...args);

export interface CompositionOptions {
  /** Final output width in pixels (from user's resolution choice) */
  outputWidth: number;
  /** Final output height in pixels (from user's resolution choice) */
  outputHeight: number;
}

export async function buildDiffusionComposition(
  project: Project,
  media: MediaFile[],
  compositionOpts: CompositionOptions
): Promise<core.Composition> {
  const { outputWidth, outputHeight } = compositionOpts;

  log(`Building Diffusion composition — output: ${outputWidth}×${outputHeight}`);

  const composition = new core.Composition({
    width: outputWidth,
    height: outputHeight,
    background: '#000000',
  });

  // Load all source files once
  log('Loading source files…');
  const sourceMap = await loadSourceMap(media);
  log(`Sources loaded: ${sourceMap.size}`);

  // Build a scaled project so image/text mappers scale coordinates
  // from the original project dimensions to the output dimensions.
  const scaledProject: Project = {
    ...project,
    width: outputWidth,
    height: outputHeight,
  };

  // Process tracks in order (bottom → top for layering)
  for (const track of project.tracks) {
    if (track.muted) {
      log(`Skipping muted track: ${track.id} (${track.type})`);
      continue;
    }

    const sortedItems = [...track.items].sort((a, b) => a.startTime - b.startTime);
    if (sortedItems.length === 0) continue;

    // VIDEO tracks: SEQUENTIAL mode so cuts play in order without overlap
    // AUDIO/IMAGE/TEXT tracks: DEFAULT mode (clips placed by delay/offset)
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
          clip = await mapImageClip(item, sourceMap, scaledProject);
        } else if (track.type === 'text') {
          clip = await mapTextClip(item, scaledProject);
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
