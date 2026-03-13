// ============================================================
// ViralCut Export2 – Universal Canvas → MediaRecorder pipeline
//
// Architecture (seek-on-entry + natural playback):
//   1. Pre-load all media assets
//   2. NO global pre-seek — videos just sit at currentTime=0
//   3. Connect audio elements to AudioContext for clean mixing
//   4. Create canvas + captureStream(fps)
//   5. Combine canvas video + AudioContext audio → MediaRecorder
//   6. rAF loop (async tick):
//        a. Resolve active clip by wall-clock time
//        b. On clip CHANGE → seekVideoPrecisely ONCE to entry point, then play()
//        c. No drift correction — natural playback runs freely
//        d. holdCanvas prevents black flashes during transitions
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

// ── Helpers ───────────────────────────────────────────────────

function captureHoldFrame(src: HTMLCanvasElement, hold: HTMLCanvasElement) {
  const hctx = hold.getContext('2d')!;
  hctx.clearRect(0, 0, hold.width, hold.height);
  hctx.drawImage(src, 0, 0);
}

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

  // ── 4. Prepare video elements (NO global pre-seek) ────────
  onProgress(12, 'Preparando elementos de vídeo…');
  assets.videos.forEach((el) => {
    el.muted = true;
    el.pause();
    el.currentTime = 0;
  });
  log('Elementos de vídeo preparados (sem pré-seek global)');
  if (signal?.aborted) throw new Error('Exportação cancelada.');

  // ── 5. Canvas setup ───────────────────────────────────────
  onProgress(15, 'Preparando canvas…');
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { alpha: false })!;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, width, height);

  // holdCanvas: retains the last successfully-drawn frame to prevent black flashes
  const holdCanvas = document.createElement('canvas');
  holdCanvas.width = width;
  holdCanvas.height = height;
  const holdCtx = holdCanvas.getContext('2d', { alpha: false })!;
  holdCtx.fillStyle = '#000';
  holdCtx.fillRect(0, 0, width, height);

  // ── 6. Audio setup ────────────────────────────────────────
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
        gain.gain.value = 0; // Start silent; loop activates the right clip
        src.connect(gain);
        gain.connect(masterGain);
        gainNodes.set(mediaId, gain);
        connectedElements.add(mediaId);
        log(`Audio connected: ${mediaId}`);
      } catch {
        // createMediaElementSource can only be called once; skip silently
      }
    }
  }

  // ── 7. Build combined stream ──────────────────────────────
  const canvasStream = canvas.captureStream(FPS);
  const combinedStream = new MediaStream([
    ...canvasStream.getVideoTracks(),
    ...destination.stream.getAudioTracks(),
  ]);

  // ── 8. Start MediaRecorder ────────────────────────────────
  onProgress(20, 'Iniciando gravação…');
  const chunks: BlobPart[] = [];

  const recorder = new MediaRecorder(combinedStream, {
    mimeType,
    videoBitsPerSecond: bitrate,
  });
  recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

  const recorderDone = new Promise<void>((res) => { recorder.onstop = () => res(); });

  await audioCtx.resume().catch(() => {});
  recorder.start(500); // 500ms chunks — reduces pressure on mobile
  log('Recorder started');

  // ── 9. rAF loop — seek ONLY on clip entry ─────────────────
  // timeSec is tracked manually (not wall-clock) so that async seeks
  // don't advance the playhead while awaiting — preventing the loop
  // from jumping past totalDuration and stopping immediately at 22%.
  onProgress(22, 'Renderizando…');

  // We track rendered time ourselves — incremented each rAF tick by the
  // real delta, but paused while we await seekVideoPrecisely.
  let timeSec = 0;
  let lastRafTs: number | null = null;
  let activeClipKey: string | null = null;
  let activeMediaId: string | null = null;

  await new Promise<void>((resolve, reject) => {
    async function tick(rafTs: number) {
      if (signal?.aborted) {
        try { recorder.stop(); } catch { /* ignore */ }
        reject(new Error('Exportação cancelada.'));
        return;
      }

      // ── Advance timeSec by real wall-clock delta (paused during seeks) ──
      if (lastRafTs !== null) {
        const delta = (rafTs - lastRafTs) / 1000;
        timeSec = Math.min(timeSec + delta, totalDuration);
      }
      lastRafTs = rafTs;

      // ── (a) Resolve active clip ───────────────────────────
      const activeResult = resolveActiveVideoItem(project, timeSec);

      if (activeResult) {
        const { item, track } = activeResult;
        const clipKey = `${item.id}:${item.mediaId}`;
        const el = assets.videos.get(item.mediaId);

        if (el) {
          if (clipKey !== activeClipKey) {
            // ── Clip transition: pause previous → seek new entry → play ──
            if (activeMediaId) {
              const prevEl = assets.videos.get(activeMediaId);
              if (prevEl) { try { prevEl.pause(); } catch { /* ignore */ } }
              const prevGain = gainNodes.get(activeMediaId);
              if (prevGain) prevGain.gain.value = 0;
            }

            log(`Cut at ${timeSec.toFixed(2)}s → "${item.name}" (${item.mediaId})`);
            activeClipKey = clipKey;
            activeMediaId = item.mediaId;

            // Calculate correct entry point in source media
            const clipOffset = Math.max(0, timeSec - item.startTime);
            const targetTime = (item.mediaStart ?? 0) + clipOffset * (item.videoDetails?.playbackRate ?? 1);

            el.playbackRate = item.videoDetails?.playbackRate ?? 1;

            // Seek to entry frame — timeSec does NOT advance during this await
            // because we use delta-time from rAF timestamps, not performance.now()
            await seekVideoPrecisely(el, targetTime);

            // After seek completes, reset lastRafTs so the NEXT rAF delta
            // starts fresh (avoids a large jump caused by seek duration)
            lastRafTs = null;

            const gain = gainNodes.get(item.mediaId);
            if (gain) {
              gain.gain.value = track.muted ? 0 : (item.videoDetails?.volume ?? 1);
            }

            try { await el.play(); } catch { el.play().catch(() => {}); }

          } else {
            // ── Same clip — keep gain in sync, NO seek ────────
            const gain = gainNodes.get(item.mediaId);
            if (gain) {
              gain.gain.value = track.muted ? 0 : (item.videoDetails?.volume ?? 1);
            }
          }
        }
      } else {
        // Gap in timeline — silence and pause active clip
        if (activeMediaId) {
          const prevEl = assets.videos.get(activeMediaId);
          if (prevEl) { try { prevEl.pause(); } catch { /* ignore */ } }
          const prevGain = gainNodes.get(activeMediaId);
          if (prevGain) prevGain.gain.value = 0;
        }
        activeClipKey = null;
        activeMediaId = null;
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

      // ── (c) Capture hold frame ────────────────────────────
      captureHoldFrame(canvas, holdCanvas);

      // ── Progress (22–95%) ─────────────────────────────────
      const pct = 22 + Math.round((timeSec / totalDuration) * 73);
      onProgress(
        Math.min(95, pct),
        `Renderizando… ${timeSec.toFixed(1)}s / ${totalDuration.toFixed(1)}s`
      );

      // ── Done? ─────────────────────────────────────────────
      if (timeSec >= totalDuration) {
        recorder.stop();
        resolve();
        return;
      }

      requestAnimationFrame((ts) => {
        tick(ts).catch((err) => {
          try { recorder.stop(); } catch { /* ignore */ }
          reject(err);
        });
      });
    }

    requestAnimationFrame((ts) => {
      tick(ts).catch((err) => {
        try { recorder.stop(); } catch { /* ignore */ }
        reject(err);
      });
    });
  });

  log('Render complete');

  // ── 10. Finalize ──────────────────────────────────────────
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
