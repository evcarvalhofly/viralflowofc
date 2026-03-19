// ============================================================
// ViralCut Export3 – Scene Exporter (v7 — clean, trust browser)
//
// ORIENTATION RULE (definitive):
//   Use ONLY video.videoWidth / video.videoHeight from VideoFrameCache.
//   The browser already returns visually-correct dimensions.
//   No rotationDeg. No FFmpeg. No metadata heuristics.
//
// CANVAS SIZE:
//   1. Read displayWidth/displayHeight from VideoFrameCache (browser-reported).
//   2. Determine portrait/landscape from those values.
//   3. Set canvas = { longSide × shortSide } in correct orientation.
//   4. NEVER resize canvas after this point.
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
  projectName?: string;
}

export type ProgressCallback = (progress: number, label: string) => void;

function log(...a: unknown[]) { console.log('[ViralCut Export]', ...a); }

/**
 * Returns final canvas size based on video's VISUAL orientation.
 * displayWidth/displayHeight come from video.videoWidth/videoHeight — already correct.
 */
function getCanvasSize(
  displayWidth:  number,
  displayHeight: number,
  resolution:    '720p' | '1080p'
): { width: number; height: number } {
  const longSide  = resolution === '1080p' ? 1920 : 1280;
  const shortSide = resolution === '1080p' ? 1080 : 720;

  const isPortrait = displayHeight > displayWidth;
  const isSquare   = Math.abs(displayWidth - displayHeight) / Math.max(displayWidth, displayHeight) < 0.05;

  if (isSquare)    return { width: shortSide, height: shortSide };
  if (isPortrait)  return { width: shortSide, height: longSide  };
  return           { width: longSide,  height: shortSide };
}

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

  // ── 2. Find first video media ID ───────────────────────────
  const firstVideoTrack = project.tracks.find((t) => t.type === 'video' && !t.muted);
  const firstVideoMediaId = firstVideoTrack?.items[0]?.mediaId ?? null;

  // ── 3. Initial canvas (will be corrected in step 4) ────────
  onProgress(6, 'Inicializando renderer…');
  // Start with a reasonable default; VideoFrameCache will reveal true dims
  const renderer = new CanvasRenderer({ width: 1280, height: 720 });

  await renderer.prepare(project, mediaMap, (msg) => onProgress(10, msg));

  if (signal?.aborted) { renderer.dispose(); throw new Error('Exportação cancelada.'); }

  // ── 4. Determine correct canvas size from video dimensions ──
  // VideoFrameCache reports video.videoWidth/videoHeight from the HTMLVideoElement
  // which the browser returns ALREADY rotation-corrected.
  onProgress(14, 'Verificando dimensões do vídeo…');

  let finalWidth  = 1280;
  let finalHeight = 720;

  if (firstVideoMediaId) {
    const meta = renderer.getVideoMeta(firstVideoMediaId);
    const vw   = meta?.displayWidth  ?? 0;
    const vh   = meta?.displayHeight ?? 0;

    log('Video dimensions from browser:', { vw, vh, mediaId: firstVideoMediaId });

    if (vw > 0 && vh > 0) {
      const size = getCanvasSize(vw, vh, opts.resolution);
      finalWidth  = size.width;
      finalHeight = size.height;
      log(`Canvas: ${finalWidth}×${finalHeight} (${finalHeight > finalWidth ? 'portrait' : 'landscape'})`);
    } else {
      // Fallback: use project aspect ratio
      const { aspectRatio } = project;
      const is1080 = opts.resolution === '1080p';
      if (aspectRatio === '9:16') { finalWidth = is1080 ? 1080 : 720; finalHeight = is1080 ? 1920 : 1280; }
      else if (aspectRatio === '1:1') { finalWidth = finalHeight = is1080 ? 1080 : 720; }
      else if (aspectRatio === '4:5') { finalWidth = is1080 ? 1080 : 720; finalHeight = is1080 ? 1350 : 900; }
      else { finalWidth = is1080 ? 1920 : 1280; finalHeight = is1080 ? 1080 : 720; }
      log(`Canvas (fallback from aspectRatio ${aspectRatio}): ${finalWidth}×${finalHeight}`);
    }
  }

  renderer.resize(finalWidth, finalHeight);

  log(`Final canvas: ${finalWidth}×${finalHeight} @ ${FPS}fps`);
  log('orientation:', finalHeight > finalWidth ? 'portrait' : 'landscape');
  log('duration:', totalDuration.toFixed(2), 's');
  log('frames:', Math.ceil(totalDuration * FPS));

  // ── 5. Detect best codec/container ─────────────────────────
  onProgress(16, 'Detectando suporte de codec…');
  const config = await detectBestExportConfig(finalWidth, finalHeight, FPS);
  log('Codec config:', config);

  if (signal?.aborted) { renderer.dispose(); throw new Error('Exportação cancelada.'); }

  // ── 6. Build offline audio buffer ───────────────────────────
  onProgress(20, 'Processando áudio…');
  const audioBuffer = await createTimelineAudioBuffer(
    project, mediaMap, (msg) => onProgress(22, msg)
  );
  log(`Audio: ${audioBuffer ? `${audioBuffer.duration.toFixed(2)}s` : 'none'}`);

  if (signal?.aborted) { renderer.dispose(); throw new Error('Exportação cancelada.'); }

  // ── 7. Set up MediaBunny output ────────────────────────────
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

  // ── 8. Add audio (offline, instant) ─────────────────────────
  if (audioSource && audioBuffer) {
    onProgress(30, 'Adicionando áudio…');
    await audioSource.add(audioBuffer);
    audioSource.close();
    log('Audio added and closed');
  }

  // ── 9. Frame-by-frame render loop ───────────────────────────
  const totalFrames  = Math.ceil(totalDuration * FPS);
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
  const blob     = new Blob([arrayBuffer], { type: mimeType });

  const elapsed = ((performance.now() - t0) / 1000).toFixed(1);
  log(`Concluído em ${elapsed}s | ${(blob.size / 1024 / 1024).toFixed(2)}MB | ${totalFrames} frames`);

  onProgress(100, 'Pronto!');
  return blob;
}
