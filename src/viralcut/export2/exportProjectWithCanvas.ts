// ============================================================
// ViralCut Export2 – Universal Canvas → MediaRecorder pipeline
//
// Architecture:
//   1. Pre-load all media assets (video elements + image bitmaps)
//   2. Connect video elements to an AudioContext for clean mixing
//   3. Create canvas + captureStream(fps)
//   4. Combine canvas video track + AudioContext audio track
//   5. Start a SINGLE MediaRecorder — never stop/restart between cuts
//   6. Run requestAnimationFrame render loop for the full duration
//   7. On finish, stop recorder → fix WebM duration → return Blob
//
// Flash-black fix:
//   - holdCanvas keeps the last successfully rendered video frame
//   - On clip change, we seek+wait before drawing the new frame
//   - During seek, holdCanvas content is drawn instead of black
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

  // holdCanvas retains the last good frame to avoid black flashes during clip transitions
  const holdCanvas = document.createElement('canvas');
  holdCanvas.width = width;
  holdCanvas.height = height;
  const holdCtx = holdCanvas.getContext('2d')!;
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

  // ── 8. Real-time render loop ──────────────────────────────
  onProgress(22, 'Renderizando…');

  const startWall = performance.now();
  const durationMs = totalDuration * 1000;

  // Track the active clip key to detect cut changes
  let currentClipKey: string | null = null;

  // Pending seek promise — we await this before drawing on transitions
  let seekPending: Promise<void> | null = null;

  await new Promise<void>((resolve, reject) => {
    function step(now: number) {
      if (signal?.aborted) {
        recorder.stop();
        reject(new Error('Exportação cancelada.'));
        return;
      }

      const elapsed = now - startWall;
      const timeSec = Math.min(elapsed / 1000, totalDuration);

      // ── Identify active video item ───────────────────────
      let activeVideoId: string | null = null;
      let activeClipKey: string | null = null;

      for (const track of project.tracks) {
        if (track.type !== 'video' || track.muted) continue;
        for (const item of track.items) {
          if (timeSec >= item.startTime && timeSec < item.endTime) {
            activeVideoId = item.mediaId;
            activeClipKey = `${item.id}:${item.mediaId}`;

            const el = assets.videos.get(item.mediaId);
            if (el) {
              const rate = item.videoDetails?.playbackRate ?? 1;
              const mediaTime = item.mediaStart + (timeSec - item.startTime) * rate;

              if (activeClipKey !== currentClipKey) {
                // ── Clip changed: pause old, seek new synchronously ──
                if (currentClipKey) {
                  // Pause previous
                  const [, prevMediaId] = currentClipKey.split(':');
                  assets.videos.get(prevMediaId)?.pause();
                }
                currentClipKey = activeClipKey;
                el.playbackRate = Math.min(Math.max(rate, 0.1), 16);

                // Fire seek asynchronously; hold current frame until it resolves
                seekPending = seekVideoPrecisely(el, mediaTime).then(() => {
                  el.play().catch(() => {});
                  seekPending = null;
                  log(`Clip ready at ${timeSec.toFixed(2)}s → ${item.name}`);
                });
                log(`Clip change at ${timeSec.toFixed(2)}s → ${item.name}`);
              } else {
                // Same clip — correct drift if needed
                const drift = Math.abs(el.currentTime - mediaTime);
                if (drift > 0.3) {
                  el.currentTime = Math.max(0, Math.min(mediaTime, (el.duration || 9999) - 0.01));
                }
              }

              // Update volume gain
              const gainNode = gainNodes.get(item.mediaId);
              if (gainNode) {
                gainNode.gain.value = track.muted ? 0 : (item.videoDetails?.volume ?? 1);
              }
            }
            break;
          }
        }
        if (activeVideoId) break;
      }

      // Pause if nothing is active
      if (!activeVideoId && currentClipKey) {
        const [, prevMediaId] = currentClipKey.split(':');
        assets.videos.get(prevMediaId)?.pause();
        currentClipKey = null;
      }

      // ── Render frame ─────────────────────────────────────
      // If a seek is in flight, draw the held frame (no black flash)
      const useHold = seekPending !== null;

      try {
        renderTimelineFrame({
          ctx,
          timeSec,
          width,
          height,
          project,
          assets,
          holdCanvas: useHold ? holdCanvas : null,
        });
      } catch (err) {
        recorder.stop();
        reject(err);
        return;
      }

      // Capture hold frame only when video was actually drawn (not hold-mode)
      if (!useHold) {
        captureHoldFrame(canvas, holdCanvas);
      }

      // ── Progress (22–95%) ─────────────────────────────────
      const pct = 22 + Math.round((elapsed / durationMs) * 73);
      if (Math.floor(elapsed / 500) !== Math.floor((elapsed - 16) / 500)) {
        onProgress(Math.min(95, pct), `Renderizando… ${timeSec.toFixed(1)}s / ${totalDuration.toFixed(1)}s`);
      }

      if (elapsed >= durationMs) {
        log(`Render complete — ${(elapsed / 1000).toFixed(2)}s rendered`);
        recorder.stop();
        resolve();
        return;
      }

      requestAnimationFrame(step);
    }

    requestAnimationFrame(step);
  });

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
