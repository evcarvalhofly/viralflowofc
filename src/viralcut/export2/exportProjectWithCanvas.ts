// ============================================================
// ViralCut Export2 – Universal Canvas → MediaRecorder pipeline
//
// Architecture (frame-by-frame deterministic):
//   1. Pre-load all media assets
//   2. Connect video elements to AudioContext for clean mixing
//   3. Create canvas + captureStream(fps)
//   4. Combine canvas video track + AudioContext audio track
//   5. Start a SINGLE MediaRecorder
//   6. For each frame tick:
//        a. Identify active video item
//        b. AWAIT seekVideoPrecisely → frame guaranteed ready
//        c. renderTimelineFrame (no black flash possible)
//        d. Capture holdFrame
//        e. yield one rAF so captureStream grabs the frame
//   7. Stop recorder → fix WebM duration → return Blob
// ============================================================

import { Project, MediaFile } from '../types';
import { sanitizeProject } from '../utils/sanitize';
import { prepareExportAssets, disposeExportAssets } from './prepareExportAssets';
import { renderTimelineFrame } from './renderTimelineFrame';
import { pickBestMimeType, pickBitrate, getExportDimensions } from './mediaRecorderUtils';
import { seekVideoPrecisely } from './seekVideoPrecisely';
import { fixWebmDuration } from './fixWebmDuration';

const DEBUG = true;
function log(...a: unknown[]) { if (DEBUG) console.log('[ViralCut Export2]', ...a); }

export interface ExportProgressCallback {
  (progress: number, label: string): void;
}

export interface CanvasExportOptions {
  resolution: '720p' | '1080p';
  fps: 30 | 60;
  projectName?: string;
}

// ── Hold-frame helpers ────────────────────────────────────────

function captureHoldFrame(
  sourceCanvas: HTMLCanvasElement,
  holdCanvas: HTMLCanvasElement
) {
  const hctx = holdCanvas.getContext('2d')!;
  hctx.clearRect(0, 0, holdCanvas.width, holdCanvas.height);
  hctx.drawImage(sourceCanvas, 0, 0);
}

/** Yield one animation frame so captureStream can grab the current canvas */
function yieldFrame(): Promise<void> {
  return new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}

// ── Resolve active video item at a given time ─────────────────

function resolveActiveVideoItem(project: Project, timeSec: number) {
  for (const track of project.tracks) {
    if (track.type !== 'video' || track.muted) continue;
    for (const item of track.items) {
      if (timeSec >= item.startTime && timeSec < item.endTime) {
        return { item, track };
      }
    }
  }
  return null;
}

// ── Main export ───────────────────────────────────────────────

export async function exportProjectWithCanvas(
  rawProject: Project,
  media: MediaFile[],
  opts: CanvasExportOptions,
  onProgress: ExportProgressCallback,
  signal?: AbortSignal
): Promise<Blob> {
  const t0 = performance.now();
  log('Export started', opts);

  // ── 1. Sanitize ───────────────────────────────────────────
  onProgress(2, 'Sanitizando timeline…');
  const project = sanitizeProject(rawProject);

  const totalDuration = project.duration;
  if (totalDuration <= 0) throw new Error('Timeline vazia. Adicione clipes antes de exportar.');
  log(`Duração: ${totalDuration.toFixed(2)}s`);

  // ── 2. Output dimensions ──────────────────────────────────
  const mediaMap = new Map(media.map((m) => [m.id, m]));

  let isPortrait = false;
  outer:
  for (const track of project.tracks) {
    if (track.type !== 'video') continue;
    for (const item of track.items) {
      const mf = mediaMap.get(item.mediaId);
      if (mf?.width && mf?.height) {
        isPortrait = mf.height > mf.width;
        break outer;
      }
    }
  }

  const { width, height } = getExportDimensions(isPortrait, opts.resolution);
  const FPS = opts.fps;
  const mimeType = pickBestMimeType();
  const bitrate = pickBitrate(width, height, FPS);
  log(`Saída: ${width}×${height} @ ${FPS}fps | mime: ${mimeType} | bitrate: ${bitrate}`);

  // ── 3. Pre-load assets ────────────────────────────────────
  onProgress(5, 'Carregando mídias…');
  const assets = await prepareExportAssets(
    project,
    mediaMap,
    (msg) => onProgress(10, msg)
  );
  if (signal?.aborted) throw new Error('Exportação cancelada.');

  // ── 4. Canvas setup ───────────────────────────────────────
  onProgress(15, 'Preparando canvas…');
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { alpha: false })!;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, width, height);

  // holdCanvas retains the last good frame to avoid black flashes during transitions
  const holdCanvas = document.createElement('canvas');
  holdCanvas.width = width;
  holdCanvas.height = height;
  const holdCtx = holdCanvas.getContext('2d', { alpha: false })!;
  holdCtx.fillStyle = '#000';
  holdCtx.fillRect(0, 0, width, height);

  // ── 5. Audio setup ────────────────────────────────────────
  onProgress(18, 'Configurando áudio…');
  const audioCtx = new AudioContext({ sampleRate: 44100 });
  const destination = audioCtx.createMediaStreamDestination();
  const masterGain = audioCtx.createGain();
  masterGain.gain.value = 1;
  masterGain.connect(destination);

  const connectedElements = new Set<string>();
  const gainNodes = new Map<string, GainNode>();

  for (const track of project.tracks) {
    if (track.type !== 'video' && track.type !== 'audio') continue;
    for (const item of track.items) {
      const { mediaId } = item;
      if (!mediaId || connectedElements.has(mediaId)) continue;
      const el = assets.videos.get(mediaId);
      if (!el) continue;
      try {
        el.muted = false;
        const src = audioCtx.createMediaElementSource(el);
        const gain = audioCtx.createGain();
        const vol = track.muted ? 0 : (item.videoDetails?.volume ?? item.audioDetails?.volume ?? 1);
        gain.gain.value = vol;
        src.connect(gain);
        gain.connect(masterGain);
        gainNodes.set(mediaId, gain);
        connectedElements.add(mediaId);
        log(`Audio connected: ${mediaId} vol=${vol}`);
      } catch {
        // createMediaElementSource can only be called once; silently skip
      }
    }
  }

  // ── 6. Build combined stream ──────────────────────────────
  const canvasStream = canvas.captureStream(FPS);
  const combinedStream = new MediaStream([
    ...canvasStream.getVideoTracks(),
    ...destination.stream.getAudioTracks(),
  ]);

  // ── 7. Start MediaRecorder ────────────────────────────────
  onProgress(20, 'Iniciando gravação…');
  const chunks: BlobPart[] = [];

  const recorder = new MediaRecorder(combinedStream, {
    mimeType,
    videoBitsPerSecond: bitrate,
  });
  recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

  const recorderDone = new Promise<void>((res) => { recorder.onstop = () => res(); });

  await audioCtx.resume().catch(() => {});
  recorder.start(100);
  log('Recorder started');

  // ── 8. Deterministic frame-by-frame render loop ───────────
  // Unlike the old rAF loop, each tick:
  //   (a) awaits seekVideoPrecisely → frame is guaranteed decoded
  //   (b) renders the frame (no black can appear)
  //   (c) yields one rAF so captureStream grabs it
  // This makes the loop slower than real-time for long videos,
  // but eliminates all black-flash possibilities.
  onProgress(22, 'Renderizando…');

  const frameDuration = 1 / FPS;         // seconds per frame
  const totalFrames = Math.ceil(totalDuration * FPS);

  let lastVideoMediaId: string | null = null;

  for (let frameIndex = 0; frameIndex <= totalFrames; frameIndex++) {
    if (signal?.aborted) {
      recorder.stop();
      throw new Error('Exportação cancelada.');
    }

    const timeSec = Math.min(frameIndex * frameDuration, totalDuration);

    // ── (a) Identify & sync active video ─────────────────
    const activeResult = resolveActiveVideoItem(project, timeSec);

    if (activeResult) {
      const { item, track } = activeResult;
      const el = assets.videos.get(item.mediaId);

      if (el) {
        const rate = item.videoDetails?.playbackRate ?? 1;
        const mediaTime = item.mediaStart + (timeSec - item.startTime) * rate;

        // Update gain
        const gainNode = gainNodes.get(item.mediaId);
        if (gainNode) {
          gainNode.gain.value = track.muted ? 0 : (item.videoDetails?.volume ?? 1);
        }

        // Seek precisely — this AWAITS the seeked event + frame callback
        // so the canvas is never drawn with a stale/unready frame
        await seekVideoPrecisely(el, mediaTime);

        if (item.mediaId !== lastVideoMediaId) {
          log(`Clip change at ${timeSec.toFixed(2)}s → ${item.name}`);
          lastVideoMediaId = item.mediaId;
        }
      }
    } else {
      // Gap in timeline — silence audio
      for (const [, gain] of gainNodes) {
        gain.gain.value = 0;
      }
      lastVideoMediaId = null;
    }

    // ── (b) Render frame ──────────────────────────────────
    renderTimelineFrame({
      ctx,
      timeSec,
      width,
      height,
      project,
      assets,
      holdCanvas,
    });

    // ── (c) Capture hold frame (for potential gaps) ───────
    captureHoldFrame(canvas, holdCanvas);

    // ── (d) Yield so captureStream grabs this frame ───────
    await yieldFrame();

    // ── Progress (22–95%) ─────────────────────────────────
    if (frameIndex % 15 === 0) {
      const pct = 22 + Math.round((frameIndex / totalFrames) * 73);
      onProgress(
        Math.min(95, pct),
        `Renderizando… ${timeSec.toFixed(1)}s / ${totalDuration.toFixed(1)}s`
      );
    }
  }

  log(`Render complete — ${totalFrames} frames rendered`);
  recorder.stop();

  // ── 9. Finalize ───────────────────────────────────────────
  onProgress(96, 'Finalizando arquivo…');
  await recorderDone;

  assets.videos.forEach((el) => { try { el.pause(); } catch { /* ignore */ } });
  masterGain.disconnect();
  audioCtx.close().catch(() => {});

  let finalBlob = new Blob(chunks, { type: mimeType || 'video/webm' });

  // Fix WebM duration metadata (shows as 0s on some mobile galleries)
  onProgress(98, 'Corrigindo metadados…');
  finalBlob = await fixWebmDuration(finalBlob, totalDuration);

  const elapsed = ((performance.now() - t0) / 1000).toFixed(1);
  log(
    `Export concluído em ${elapsed}s | ${(finalBlob.size / 1024 / 1024).toFixed(2)}MB | ${chunks.length} chunks`
  );

  if (finalBlob.size < 2000) {
    throw new Error('Arquivo exportado muito pequeno. Verifique se há vídeo na timeline.');
  }

  disposeExportAssets(assets);

  onProgress(100, 'Pronto!');
  return finalBlob;
}
