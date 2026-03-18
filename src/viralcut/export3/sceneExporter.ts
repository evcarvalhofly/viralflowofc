// ============================================================
// ViralCut Export3 – Scene Exporter (MediaBunny integration)
//
// Frame-by-frame export using MediaBunny's CanvasSource and
// AudioBufferSource. Completely offline and deterministic.
//
// Canvas orientation fix (v5):
// Uses a 3-layer fallback strategy to determine the correct
// export canvas orientation:
//
// Layer 1 (primary): VideoFrameCache probe bitmap dimensions.
//                    If the probe detected browser auto-rotation,
//                    use the bitmap's display dims directly.
//
// Layer 2 (secondary): MediaFile.rotationDeg from mediaMap.
//                      If the probe returned landscape dims but
//                      the MediaFile says rotationDeg=90|270,
//                      force portrait orientation. This handles
//                      4K videos where the probe bitmap wasn't
//                      rotated by the browser.
//
// Layer 3 (fallback): Project metadata (aspectRatio, width, height).
//                     Only used when no video media is found.
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

  // ── 2. Find first video media ID ───────────────────────────
  const firstVideoTrack = project.tracks.find((t) => t.type === 'video' && !t.muted);
  const firstItem = firstVideoTrack?.items[0];
  const firstVideoMediaId = firstItem?.mediaId ?? null;

  // Initial rough estimate from project metadata
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

  // ── 4. Correct canvas orientation (3-layer strategy) ────────
  onProgress(14, 'Verificando orientação do vídeo…');

  if (firstVideoMediaId) {
    const is1080 = opts.resolution === '1080p';
    const longSide  = is1080 ? 1920 : 1280;
    const shortSide = is1080 ? 1080 : 720;

    // Layer 1: VideoFrameCache probe
    const probeMeta = renderer.getVideoMeta(firstVideoMediaId);
    log('Probe meta from frame cache:', probeMeta);

    // Layer 2: MediaFile rotationDeg (set by FFmpeg probe at import time)
    const mediaFileEntry = mediaMap.get(firstVideoMediaId);
    const fileRotationDeg = mediaFileEntry?.rotationDeg ?? 0;
    log('MediaFile rotationDeg:', fileRotationDeg);

    // Determine whether the video is portrait or landscape using all available signals
    let isPortrait = false;

    if (probeMeta && probeMeta.displayWidth > 0 && probeMeta.displayHeight > 0) {
      const probeIsPortrait = probeMeta.displayHeight > probeMeta.displayWidth;

      // Check if the probe result conflicts with the rotationDeg metadata.
      // If probe says landscape BUT rotationDeg says 90/270 (portrait), the probe
      // was unreliable (e.g. 4K browser failed to auto-rotate the bitmap).
      // In that case, trust the rotationDeg metadata instead.
      const rotationSaysPortrait = fileRotationDeg === 90 || fileRotationDeg === 270;

      if (!probeIsPortrait && rotationSaysPortrait) {
        // Probe returned landscape dims but rotation metadata says portrait
        // → rotationDeg is more reliable here (probe failed for 4K video)
        isPortrait = true;
        log(`Probe/rotation conflict: probe=${probeMeta.displayWidth}×${probeMeta.displayHeight} (landscape) but rotationDeg=${fileRotationDeg} → forcing portrait`);
      } else if (probeIsPortrait) {
        isPortrait = true;
        log(`Probe confirms portrait: ${probeMeta.displayWidth}×${probeMeta.displayHeight}`);
      } else {
        // Both probe and rotation agree on landscape
        isPortrait = false;
        log(`Both probe and rotation agree: landscape (probe: ${probeMeta.displayWidth}×${probeMeta.displayHeight}, rotationDeg=${fileRotationDeg})`);
      }
    } else {
      // Layer 1 failed — fall back to rotationDeg only
      isPortrait = fileRotationDeg === 90 || fileRotationDeg === 270;
      log(`Probe meta unavailable — using rotationDeg=${fileRotationDeg} → isPortrait=${isPortrait}`);
    }

    // Also check MediaFile's stored displayWidth/displayHeight (set at import)
    if (mediaFileEntry?.displayWidth && mediaFileEntry?.displayHeight) {
      const mediaFilePortrait = mediaFileEntry.displayHeight > mediaFileEntry.displayWidth;
      if (mediaFilePortrait !== isPortrait) {
        log(`MediaFile display dims (${mediaFileEntry.displayWidth}×${mediaFileEntry.displayHeight}) override — isPortrait=${mediaFilePortrait}`);
        isPortrait = mediaFilePortrait;
      }
    }

    let correctedW: number;
    let correctedH: number;

    if (isPortrait) {
      correctedW = shortSide;
      correctedH = longSide;
    } else {
      correctedW = longSide;
      correctedH = shortSide;
    }

    log(`Canvas set: ${width}×${height} → ${correctedW}×${correctedH} (isPortrait=${isPortrait})`);
    renderer.resize(correctedW, correctedH);
    width  = correctedW;
    height = correctedH;
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
