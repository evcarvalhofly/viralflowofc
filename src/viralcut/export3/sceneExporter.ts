// ============================================================
// ViralCut Export3 – Scene Exporter (MediaBunny integration)
//
// Frame-by-frame export using MediaBunny's CanvasSource and
// AudioBufferSource. Completely offline and deterministic.
//
// Canvas orientation fix (v6 — definitive):
//
// Root cause of the 4K portrait bug:
//   createImageBitmap() can return different results at probe time
//   vs render time (browser may progressively decode large files).
//   All previous heuristics were unreliable.
//
// DEFINITIVE STRATEGY — priority order:
//
//   1. MediaFile.encodedWidth/encodedHeight + rotationDeg
//      (set by FFmpeg probe at import — most reliable source)
//      If rotationDeg=90|270 → portrait (swap encoded dims)
//      If rotationDeg=0|180  → landscape (use encoded dims as-is)
//
//   2. MediaFile.displayWidth/displayHeight
//      (set after FFmpeg probe)
//
//   3. VideoFrameCache probe (last resort)
//
//   4. Project metadata (aspectRatio) — only if no video media
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
  log(`Initial canvas estimate: ${width}×${height} (will be corrected after media analysis)`);

  // ── 3. Prepare canvas renderer ──────────────────────────────
  onProgress(6, 'Inicializando renderer…');
  const renderer = new CanvasRenderer({ width, height });
  await renderer.prepare(
    project,
    mediaMap,
    (msg) => onProgress(10, msg)
  );

  if (signal?.aborted) { renderer.dispose(); throw new Error('Exportação cancelada.'); }

  // ── 4. Determine correct canvas orientation ──────────────────
  // DEFINITIVE LOGIC: Use FFmpeg-probed metadata as primary source.
  // This is set at import time and is the most reliable orientation signal.
  onProgress(14, 'Verificando orientação do vídeo…');

  if (firstVideoMediaId) {
    const is1080 = opts.resolution === '1080p';
    const longSide  = is1080 ? 1920 : 1280;
    const shortSide = is1080 ? 1080 : 720;

    const mediaFileEntry = mediaMap.get(firstVideoMediaId);
    log('MediaFile entry:', {
      rotationDeg: mediaFileEntry?.rotationDeg,
      encodedWidth: mediaFileEntry?.encodedWidth,
      encodedHeight: mediaFileEntry?.encodedHeight,
      displayWidth: mediaFileEntry?.displayWidth,
      displayHeight: mediaFileEntry?.displayHeight,
      orientation: mediaFileEntry?.orientation,
    });

    let isPortrait = false;
    let orientationSource = 'unknown';

    // ── Priority 1: encodedDims + rotationDeg (FFmpeg probe — most reliable) ──
    const rotDeg = mediaFileEntry?.rotationDeg ?? 0;
    const encW = mediaFileEntry?.encodedWidth ?? 0;
    const encH = mediaFileEntry?.encodedHeight ?? 0;

    if (encW > 0 && encH > 0) {
      if (rotDeg === 90 || rotDeg === 270) {
        // Rotation metadata says portrait — swap encoded dims
        isPortrait = true;
        orientationSource = `encodedDims+rotationDeg (encoded: ${encW}×${encH}, rotDeg: ${rotDeg})`;
      } else if (rotDeg === 0 || rotDeg === 180) {
        // No rotation — use encoded dims as-is
        isPortrait = encH > encW;
        orientationSource = `encodedDims+rotationDeg=0 (encoded: ${encW}×${encH})`;
      }
    }

    // ── Priority 2: displayWidth/displayHeight (set after FFmpeg probe) ──
    if (orientationSource === 'unknown' || (encW === 0 && encH === 0)) {
      const dispW = mediaFileEntry?.displayWidth ?? 0;
      const dispH = mediaFileEntry?.displayHeight ?? 0;
      if (dispW > 0 && dispH > 0) {
        isPortrait = dispH > dispW;
        orientationSource = `displayDims (${dispW}×${dispH})`;
      }
    }

    // ── Priority 3: VideoFrameCache probe (last resort for video) ──
    if (orientationSource === 'unknown') {
      const probeMeta = renderer.getVideoMeta(firstVideoMediaId);
      if (probeMeta && probeMeta.displayWidth > 0 && probeMeta.displayHeight > 0) {
        isPortrait = probeMeta.displayHeight > probeMeta.displayWidth;
        orientationSource = `frameProbe (${probeMeta.displayWidth}×${probeMeta.displayHeight})`;
      }
    }

    // ── Priority 4: project.aspectRatio (set at import and patched by background probe) ──
    // This is a strong signal because probeAndPatchRotation also updates the project
    // aspect ratio after detecting rotation. If we still don't know, trust the project.
    if (orientationSource === 'unknown') {
      const ar = project.aspectRatio;
      if (ar === '9:16' || ar === '4:5') {
        isPortrait = true;
        orientationSource = `projectAspectRatio (${ar})`;
      } else if (ar === '16:9') {
        isPortrait = false;
        orientationSource = `projectAspectRatio (${ar})`;
      } else if (ar === '1:1') {
        isPortrait = false; // square — use landscape canvas (equal sides)
        orientationSource = `projectAspectRatio (${ar} — square)`;
      }
    }

    log(`Orientation decision: isPortrait=${isPortrait} via [${orientationSource}]`);

    // For 1:1 square projects, use equal sides
    const isSquare = project.aspectRatio === '1:1';
    const correctedW = isSquare ? shortSide : (isPortrait ? shortSide : longSide);
    const correctedH = isSquare ? shortSide : (isPortrait ? longSide  : shortSide);

    log(`Canvas: ${width}×${height} → ${correctedW}×${correctedH}`);
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
