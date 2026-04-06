// ============================================================
// ViralCut Export3 – Scene Exporter (v8 — MediaFile orientation)
//
// ORIENTATION RULE (definitive):
//   Canvas size is decided ONCE using MediaFile.orientation,
//   which is locked at import time from video.videoWidth/videoHeight.
//   The export NEVER re-discovers orientation.
//
// AUDIO RULE:
//   Audio processing is skipped entirely when there is no
//   audible media in the timeline.
// ============================================================

import {
  Output,
  Mp4OutputFormat,
  WebMOutputFormat,
  BufferTarget,
  CanvasSource,
  AudioBufferSource,
} from 'mediabunny';

import { Project, MediaFile } from '../types';
import { sanitizeProject } from '../utils/sanitize';
import { CanvasRenderer } from './canvasRenderer';
import { createTimelineAudioBuffer } from './createTimelineAudioBuffer';
import { detectBestExportConfig } from './mediaBunnyUtils';

export interface SceneExportOptions {
  resolution:   '720p' | '1080p';
  fps:          30 | 60;
  format?:      'mp4' | 'webm';
  quality?:     'low' | 'medium' | 'high';
  projectName?: string;
}

export type ProgressCallback = (progress: number, label: string) => void;

function log(...a: unknown[]) { console.log('[ViralCut Export]', ...a); }

// ── Helpers ──────────────────────────────────────────────────

/**
 * Returns the first video MediaFile used in the timeline.
 * Sorted by clip start time so we always pick the earliest clip.
 */
function getPrimaryVideoMedia(
  project:  Project,
  mediaMap: Map<string, MediaFile>
): MediaFile | null {
  for (const track of project.tracks) {
    if (track.type !== 'video' || track.muted) continue;
    const sorted = [...track.items].sort((a, b) => a.startTime - b.startTime);
    for (const item of sorted) {
      const media = mediaMap.get(item.mediaId);
      if (media?.type === 'video') return media;
    }
  }
  return null;
}

/**
 * Returns export canvas dimensions based on the locked orientation
 * from MediaFile, which was set at import time.
 *
 * This is the ONLY place where canvas size is decided.
 * It is NEVER changed after this point.
 */
function getExportSize(
  resolution:  '720p' | '1080p',
  orientation: 'portrait' | 'landscape' | 'square'
): { width: number; height: number } {
  if (resolution === '1080p') {
    if (orientation === 'portrait') return { width: 1080, height: 1920 };
    if (orientation === 'square')   return { width: 1080, height: 1080 };
    return { width: 1920, height: 1080 };
  }
  if (orientation === 'portrait') return { width: 720, height: 1280 };
  if (orientation === 'square')   return { width: 720,  height: 720  };
  return { width: 1280, height: 720 };
}

/**
 * Resolve orientation from primary video or fall back to project aspect ratio.
 */
function resolveExportOrientation(
  primaryVideo: MediaFile | null,
  project:      Project
): 'portrait' | 'landscape' | 'square' {
  if (primaryVideo?.orientation) return primaryVideo.orientation;

  // Fallback to project aspect ratio
  const { aspectRatio } = project;
  if (aspectRatio === '9:16')  return 'portrait';
  if (aspectRatio === '1:1')   return 'square';
  if (aspectRatio === '4:5')   return 'portrait';
  return 'landscape';
}

/**
 * Returns true if the project has at least one unmuted audio/video track
 * with actual content. Used to skip audio processing when unnecessary.
 */
function projectHasAudibleMedia(project: Project): boolean {
  return project.tracks.some((track) => {
    if (track.muted) return false;
    if (track.type !== 'audio' && track.type !== 'video') return false;
    return track.items.some((item) => item.endTime > item.startTime);
  });
}

// ── Main export function ─────────────────────────────────────

export async function exportScene(
  rawProject:  Project,
  media:       MediaFile[],
  opts:        SceneExportOptions,
  onProgress:  ProgressCallback,
  signal?:     AbortSignal
): Promise<Blob> {
  const t0 = performance.now();
  log('Export started', opts);

  // ── 1. Sanitize ─────────────────────────────────────────────
  onProgress(2, 'Sanitizando timeline…');
  const project       = sanitizeProject(rawProject);
  const totalDuration = project.duration;
  if (totalDuration <= 0) throw new Error('Timeline vazia. Adicione clipes antes de exportar.');

  const mediaMap = new Map(media.map((m) => [m.id, m]));
  const FPS      = opts.fps;

  // ── 2. Determine canvas size from MediaFile (locked at import) ──
  const primaryVideo  = getPrimaryVideoMedia(project, mediaMap);
  const orientation   = resolveExportOrientation(primaryVideo, project);
  const { width: finalWidth, height: finalHeight } = getExportSize(opts.resolution, orientation);

  log('Primary media:', {
    id:          primaryVideo?.id,
    name:        primaryVideo?.name,
    width:       primaryVideo?.width,
    height:      primaryVideo?.height,
    orientation: primaryVideo?.orientation,
  });
  log('Export size:', { width: finalWidth, height: finalHeight, resolution: opts.resolution, orientation });

  // ── 3. Initialize renderer with final canvas size ────────────
  onProgress(6, 'Inicializando renderer…');
  const renderer = new CanvasRenderer({ width: finalWidth, height: finalHeight });

  await renderer.prepare(project, mediaMap, (msg) => onProgress(10, msg));

  if (signal?.aborted) { renderer.dispose(); throw new Error('Exportação cancelada.'); }

  log(`Canvas: ${finalWidth}×${finalHeight} @ ${FPS}fps | duration: ${totalDuration.toFixed(2)}s | frames: ${Math.ceil(totalDuration * FPS)}`);

  // ── 4. Detect best codec/container ─────────────────────────
  onProgress(16, 'Detectando suporte de codec…');
  const autoConfig = await detectBestExportConfig(finalWidth, finalHeight, FPS, opts.quality);
  const config = opts.format === 'webm'
    ? { ...autoConfig, videoCodec: 'vp9' as const, audioCodec: 'opus' as const, container: 'webm' as const }
    : opts.format === 'mp4'
    ? { ...autoConfig, videoCodec: 'avc' as const, audioCodec: 'aac' as const, container: 'mp4' as const }
    : autoConfig;
  log('Codec config:', config);

  if (signal?.aborted) { renderer.dispose(); throw new Error('Exportação cancelada.'); }

  // ── 5. Build offline audio buffer (only if needed) ──────────
  let audioBuffer: AudioBuffer | null = null;

  if (projectHasAudibleMedia(project)) {
    onProgress(20, 'Processando áudio…');
    try {
      audioBuffer = await createTimelineAudioBuffer(
        project, mediaMap, (msg) => onProgress(22, msg)
      );
    } catch (err) {
      log('Audio processing failed (non-fatal):', err);
    }
    log(`Audio: ${audioBuffer ? `${audioBuffer.duration.toFixed(2)}s` : 'none'}`);
  } else {
    onProgress(20, 'Sem áudio para processar');
    log('Audio: skipped (no audible media)');
  }

  if (signal?.aborted) { renderer.dispose(); throw new Error('Exportação cancelada.'); }

  // ── 6. Set up MediaBunny output ────────────────────────────
  onProgress(28, 'Configurando exportador…');

  const outputFormat = config.container === 'mp4'
    ? new Mp4OutputFormat()
    : new WebMOutputFormat();

  const target  = new BufferTarget();
  const output  = new Output({ format: outputFormat, target });

  const videoSource = new CanvasSource(renderer.canvas, {
    codec:   config.videoCodec,
    bitrate: config.videoBitrate,
  });
  output.addVideoTrack(videoSource, { frameRate: FPS });

  let audioSource: AudioBufferSource | null = null;
  if (audioBuffer) {
    audioSource = new AudioBufferSource({
      codec:   config.audioCodec as 'aac' | 'opus',
      bitrate: config.audioBitrate,
    });
    output.addAudioTrack(audioSource);
  }

  await output.start();
  log('MediaBunny output started');

  if (signal?.aborted) {
    await output.cancel().catch(() => {});
    renderer.dispose();
    throw new Error('Exportação cancelada.');
  }

  // ── 7. Add audio (offline, instant) ─────────────────────────
  if (audioSource && audioBuffer) {
    onProgress(30, 'Adicionando áudio…');
    await audioSource.add(audioBuffer);
    audioSource.close();
    log('Audio added and closed');
  }

  // ── 8. Frame-by-frame render loop ───────────────────────────
  const totalFrames   = Math.ceil(totalDuration * FPS);
  const frameDuration = 1 / FPS;

  log(`Rendering ${totalFrames} frames @ ${FPS}fps`);

  for (let frameIdx = 0; frameIdx < totalFrames; frameIdx++) {
    if (signal?.aborted) {
      await output.cancel().catch(() => {});
      renderer.dispose();
      throw new Error('Exportação cancelada.');
    }

    const timeSec = frameIdx * frameDuration;

    await renderer.renderFrame(project, timeSec);
    await videoSource.add(timeSec, frameDuration);

    if (frameIdx % Math.max(1, Math.floor(totalFrames / 100)) === 0) {
      const pct = 30 + Math.round((frameIdx / totalFrames) * 65);
      onProgress(
        Math.min(95, pct),
        `Renderizando… ${timeSec.toFixed(1)}s / ${totalDuration.toFixed(1)}s`
      );
    }
  }

  log('Frame render complete');
  videoSource.close();

  // ── 9. Finalize ──────────────────────────────────────────────
  onProgress(96, 'Finalizando arquivo…');
  await output.finalize();
  log('Output finalized');

  const arrayBuffer = target.buffer;
  if (!arrayBuffer || arrayBuffer.byteLength < 2000) {
    renderer.dispose();
    throw new Error('Arquivo exportado muito pequeno. Verifique se há vídeo na timeline.');
  }

  renderer.dispose();

  const mimeType = config.container === 'mp4' ? 'video/mp4' : 'video/webm';
  const blob     = new Blob([arrayBuffer], { type: mimeType });

  const elapsed = ((performance.now() - t0) / 1000).toFixed(1);
  log(`Concluído em ${elapsed}s | ${(blob.size / 1024 / 1024).toFixed(2)}MB | ${totalFrames} frames`);

  onProgress(100, 'Pronto!');
  return blob;
}
