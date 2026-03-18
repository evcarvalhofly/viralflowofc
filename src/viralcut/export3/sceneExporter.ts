// ============================================================
// ViralCut Export3 – Scene Exporter (MediaBunny integration)
//
// Frame-by-frame export using MediaBunny's CanvasSource and
// AudioBufferSource. Completely offline and deterministic.
//
// Canvas orientation fix (v4):
// The canvas dimensions are now corrected AFTER renderer.prepare()
// using the VideoFrameCache's probe-detected display dimensions.
// This ensures portrait videos are always exported as portrait
// even when the background FFmpeg rotation probe hasn't finished.
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
import { getExportDimensions, detectBestExportConfig } from './mediaBunnyUtils';

export interface SceneExportOptions {
  resolution: '720p' | '1080p';
  fps: 30 | 60;
  projectName?: string;
}

export type ProgressCallback = (progress: number, label: string) => void;

function log(...a: unknown[]) { console.log('[ViralCut Export3]', ...a); }

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

  // ── 2. Initial dimension estimate ──────────────────────────
  // Use project metadata as a ROUGH estimate only.
  // This WILL be corrected in step 4 after VideoFrameCache probes
  // the actual decoded bitmap — that is the only ground truth.
  const firstVideoTrack = project.tracks.find((t) => t.type === 'video' && !t.muted);
  const firstItem = firstVideoTrack?.items[0];
  const firstVideoMediaId = firstItem?.mediaId ?? null;

  let { width, height } = getExportDimensions(project, opts.resolution);
  log(`Initial canvas estimate: ${width}×${height} (will be corrected after probe)`);

  // ── 3. Prepare canvas renderer ──────────────────────────────
  onProgress(6, 'Inicializando renderer…');
  const renderer = new CanvasRenderer({ width, height });
  await renderer.prepare(
    project,
    mediaMap,
    (msg) => onProgress(10, msg)
  );

  if (signal?.aborted) { renderer.dispose(); throw new Error('Exportação cancelada.'); }

  // ── 4. Correct canvas dimensions using PROBED metadata ──────
  // VideoFrameCache.prepare() captures a probe frame at load time
  // and detects whether the browser auto-applied rotation.
  // This is the ground truth — use it to override canvas dimensions.
  onProgress(14, 'Verificando orientação do vídeo…');
  if (firstVideoMediaId) {
    const meta = renderer.getVideoMeta(firstVideoMediaId);
    if (meta && meta.displayWidth > 0 && meta.displayHeight > 0) {
      const corrected = getExportDimensions(
        { width: meta.displayWidth, height: meta.displayHeight },
        opts.resolution
      );
      if (corrected.width !== width || corrected.height !== height) {
        log(`Canvas corrected via probe: ${width}×${height} → ${corrected.width}×${corrected.height}`);
        renderer.resize(corrected.width, corrected.height);
        width  = corrected.width;
        height = corrected.height;
      } else {
        log(`Canvas confirmed correct: ${width}×${height}`);
      }
    }
  }

  log(`Final canvas: ${width}×${height} @ ${FPS}fps`);

  // ── 5. Detect best codec/container ─────────────────────────
  onProgress(16, 'Detectando suporte de codec…');
  const config = await detectBestExportConfig(width, height, FPS);
  log('Export config:', config);

  if (signal?.aborted) { renderer.dispose(); throw new Error('Exportação cancelada.'); }

  // ── 6. Build offline audio buffer ───────────────────────────
  onProgress(20, 'Processando áudio…');
  const audioBuffer = await createTimelineAudioBuffer(
    project,
    mediaMap,
    (msg) => onProgress(22, msg)
  );
  log(`Audio: ${audioBuffer ? `${audioBuffer.duration.toFixed(2)}s` : 'none'}`);

  if (signal?.aborted) { renderer.dispose(); throw new Error('Exportação cancelada.'); }

  // ── 7. Set up MediaBunny output ────────────────────────────
  onProgress(28, 'Configurando exportador…');

  const outputFormat = config.container === 'mp4'
    ? new Mp4OutputFormat()
    : new WebMOutputFormat();

  const target = new BufferTarget();
  const output = new Output({ format: outputFormat, target });

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

  // ── 8. Add audio buffer (offline, instant) ──────────────────
  if (audioSource && audioBuffer) {
    onProgress(30, 'Adicionando áudio…');
    await audioSource.add(audioBuffer);
    audioSource.close();
    log('Audio added and closed');
  }

  // ── 9. Frame-by-frame render loop ──────────────────────────
  const totalFrames = Math.ceil(totalDuration * FPS);
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

  // ── 10. Finalize ─────────────────────────────────────────────
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
  log(`Concluído em ${elapsed}s | ${(blob.size / 1024 / 1024).toFixed(2)}MB | ${totalFrames} frames`);

  onProgress(100, 'Pronto!');
  return blob;
}
