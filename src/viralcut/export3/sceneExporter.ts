// ============================================================
// ViralCut Export3 – Scene Exporter (MediaBunny integration)
//
// Drives frame-by-frame export using MediaBunny's CanvasSource
// and AudioBufferSource. Completely offline and deterministic.
// No MediaRecorder. No captureStream. No real-time playback.
// ============================================================

import {
  Output,
  Mp4OutputFormat,
  WebMOutputFormat,
  BufferTarget,
  CanvasSource,
  AudioBufferSource,
  QUALITY_HIGH,
} from 'mediabunny';
import { Project, MediaFile } from '../types';
import { sanitizeProject } from '../utils/sanitize';
import { CanvasRenderer } from './canvasRenderer';
import { createTimelineAudioBuffer } from './createTimelineAudioBuffer';
import { getExportDimensions, detectBestExportConfig, resolveProjectOrientation } from './mediaBunnyUtils';

export interface SceneExportOptions {
  resolution: '720p' | '1080p';
  fps: 30 | 60;
  projectName?: string;
}

export type ProgressCallback = (progress: number, label: string) => void;

const DEBUG = true;
function log(...a: unknown[]) { if (DEBUG) console.log('[ViralCut Export3]', ...a); }

export async function exportScene(
  rawProject: Project,
  media: MediaFile[],
  opts: SceneExportOptions,
  onProgress: ProgressCallback,
  signal?: AbortSignal
): Promise<Blob> {
  const t0 = performance.now();
  log('Export3 started', opts);

  // ── 1. Sanitize ─────────────────────────────────────────────
  onProgress(2, 'Sanitizando timeline…');
  const project = sanitizeProject(rawProject);
  const totalDuration = project.duration;
  if (totalDuration <= 0) throw new Error('Timeline vazia. Adicione clipes antes de exportar.');

  const mediaMap = new Map(media.map((m) => [m.id, m]));
  const FPS = opts.fps;

  // ── 2. Detect orientation from project (not from raw media dims) ──
  // IMPORTANT: The project's width/height may be stale if the background FFmpeg rotation
  // probe hasn't finished by the time the user opens export. As a fallback, we check
  // the first video media file's displayWidth/displayHeight (or encoded + rotationDeg)
  // and use that to correctly set portrait/landscape.
  const orientation = resolveProjectOrientation(project);

  // Build a corrected project snapshot for dimension calculation
  let dimensionProject = project as { aspectRatio?: string; width?: number; height?: number };

  if (orientation === 'landscape') {
    // Double-check: if the first video clip's media file says it's actually portrait,
    // override the project dimensions for the canvas (probe race condition safety).
    const firstVideoTrack = project.tracks.find((t) => t.type === 'video' && !t.muted);
    const firstItem = firstVideoTrack?.items[0];
    if (firstItem) {
      const mf = mediaMap.get(firstItem.mediaId);
      if (mf) {
        // Resolve display dimensions considering rotationDeg
        const rDeg = mf.rotationDeg ?? 0;
        const isRotated90 = rDeg === 90 || rDeg === 270;
        const displayW = mf.displayWidth ?? (isRotated90 ? mf.encodedHeight : mf.encodedWidth) ?? mf.width;
        const displayH = mf.displayHeight ?? (isRotated90 ? mf.encodedWidth : mf.encodedHeight) ?? mf.height;
        if (displayW && displayH && displayH > displayW) {
          // Media is actually portrait — override project for dimension calc
          log(`Orientation override: media is portrait (${displayW}×${displayH}) but project says landscape. Fixing.`);
          dimensionProject = { aspectRatio: '9:16', width: displayW, height: displayH };
        }
      }
    }
  }

  const { width, height } = getExportDimensions(dimensionProject, opts.resolution);

  log(`Output: ${width}×${height} @ ${FPS}fps, orientation=${orientation}`);

  // ── 3. Detect best codec/container ─────────────────────────
  onProgress(4, 'Detectando suporte de codec…');
  const config = await detectBestExportConfig(width, height, FPS);
  log('Export config:', config);

  if (signal?.aborted) throw new Error('Exportação cancelada.');

  // ── 4. Prepare canvas renderer ──────────────────────────────
  onProgress(6, 'Inicializando renderer…');
  const renderer = new CanvasRenderer({ width, height });
  await renderer.prepare(
    project,
    mediaMap,
    (msg) => onProgress(10, msg)
  );

  if (signal?.aborted) { renderer.dispose(); throw new Error('Exportação cancelada.'); }

  // ── 5. Build offline audio buffer ───────────────────────────
  onProgress(20, 'Processando áudio…');
  const audioBuffer = await createTimelineAudioBuffer(
    project,
    mediaMap,
    (msg) => onProgress(22, msg)
  );
  log(`Audio buffer: ${audioBuffer ? `${audioBuffer.duration.toFixed(2)}s` : 'none (silent)'}`);

  if (signal?.aborted) { renderer.dispose(); throw new Error('Exportação cancelada.'); }

  // ── 6. Set up MediaBunny output ────────────────────────────
  onProgress(28, 'Configurando exportador…');

  const outputFormat = config.container === 'mp4'
    ? new Mp4OutputFormat()
    : new WebMOutputFormat();

  const target = new BufferTarget();
  const output = new Output({ format: outputFormat, target });

  // Video track backed by canvas
  const videoSource = new CanvasSource(renderer.canvas, {
    codec: config.videoCodec,
    bitrate: config.videoBitrate,
  });
  output.addVideoTrack(videoSource, { frameRate: FPS });

  // Audio track from offline AudioBuffer (if present)
  let audioSource: AudioBufferSource | null = null;
  if (audioBuffer) {
    audioSource = new AudioBufferSource({
      codec: config.audioCodec as 'aac' | 'opus',
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

  // ── 7. Add audio buffer (offline, instant) ──────────────────
  if (audioSource && audioBuffer) {
    onProgress(30, 'Adicionando áudio…');
    await audioSource.add(audioBuffer);
    audioSource.close();
    log('Audio added and closed');
  }

  // ── 8. Frame-by-frame render loop ──────────────────────────
  const totalFrames = Math.ceil(totalDuration * FPS);
  const frameDuration = 1 / FPS;

  log(`Rendering ${totalFrames} frames @ ${FPS}fps, frameDuration=${frameDuration.toFixed(6)}s`);

  for (let frameIdx = 0; frameIdx < totalFrames; frameIdx++) {
    if (signal?.aborted) {
      await output.cancel().catch(() => {});
      renderer.dispose();
      throw new Error('Exportação cancelada.');
    }

    // Deterministic timestamp – no real-time dependency whatsoever
    const timeSec = frameIdx * frameDuration;

    console.log(`[ViralCut Export3] Frame time`, timeSec.toFixed(4));

    // Render frame onto canvas
    await renderer.renderFrame(project, timeSec);

    // Add canvas snapshot to video track using exact deterministic timestamp
    await videoSource.add(timeSec, frameDuration);

    // Progress: 30% → 95% during render
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

  // ── 9. Finalize ─────────────────────────────────────────────
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
  const blob = new Blob([arrayBuffer], { type: mimeType });

  const elapsed = ((performance.now() - t0) / 1000).toFixed(1);
  log(`Export3 concluído em ${elapsed}s | ${(blob.size / 1024 / 1024).toFixed(2)}MB | ${totalFrames} frames`);

  onProgress(100, 'Pronto!');
  return blob;
}
