// ============================================================
// ViralCut Export2 – Universal Canvas → MediaRecorder pipeline
//
// Architecture (pre-seek + natural playback):
//   1. Pre-load all media assets
//   2. PRE-SEEK every clip to its entry mediaTime (before recording)
//   3. Connect audio elements to AudioContext for clean mixing
//   4. Create canvas + captureStream(fps)
//   5. Combine canvas video + AudioContext audio → MediaRecorder
//   6. rAF loop (NO in-flight seeks):
//        a. Resolve active clip by wall-clock time
//        b. On clip CHANGE → switch to pre-prepared element (already at right frame)
//        c. No drift correction — let natural playback run
//        d. holdCanvas prevents any black flash on transition frame
//   7. Stop recorder → fix WebM duration → return Blob
//
// KEY DESIGN DECISION:
//   Seeks happen ONLY twice per clip:
//     (a) Pre-seek phase (before recording) → positions first frame
//     (b) "Upcoming cut" preload → ~0.3s before a cut, background-seek next clip
//   During recording, NO seeks are performed. The video plays naturally.
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

function resolveNextVideoItem(project: Project, timeSec: number) {
  // Find the clip that starts AFTER timeSec
  let next: { startTime: number; item: ReturnType<typeof resolveActiveVideoItem> } | null = null;
  for (const track of project.tracks) {
    if (track.type !== 'video' || track.muted) continue;
    for (const item of track.items) {
      if (item.startTime > timeSec) {
        if (!next || item.startTime < next.startTime) {
          next = { startTime: item.startTime, item: { item, track } };
        }
      }
    }
  }
  return next;
}

// ── Build ordered list of all video clips ─────────────────────

function buildClipSchedule(project: Project) {
  const clips: Array<{
    key: string;
    mediaId: string;
    startTime: number;
    endTime: number;
    mediaStart: number;
    playbackRate: number;
    volume: number;
    trackMuted: boolean;
  }> = [];

  for (const track of project.tracks) {
    if (track.type !== 'video') continue;
    for (const item of track.items) {
      clips.push({
        key: `${item.id}:${item.mediaId}`,
        mediaId: item.mediaId,
        startTime: item.startTime,
        endTime: item.endTime,
        mediaStart: item.mediaStart ?? 0,
        playbackRate: item.videoDetails?.playbackRate ?? 1,
        volume: item.videoDetails?.volume ?? 1,
        trackMuted: track.muted ?? false,
      });
    }
  }

  clips.sort((a, b) => a.startTime - b.startTime);
  return clips;
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

  // ── 4. PRE-SEEK all clips to their entry frame ────────────
  // This is the KEY change: every clip is positioned BEFORE recording starts.
  // During recording, we never seek again — videos play naturally from here.
  onProgress(12, 'Pré-carregando frames de entrada…');
  const clipSchedule = buildClipSchedule(project);
  log(`Clips encontrados: ${clipSchedule.length}`);

  // Mute all videos before pre-seeking (audio only flows during playback)
  assets.videos.forEach((el) => {
    el.muted = true;
    el.pause();
  });

  // Pre-seek each unique clip to its entry point
  // We do them sequentially per element to avoid overloading mobile decoders
  const seenForPreseek = new Set<string>();
  for (const clip of clipSchedule) {
    if (signal?.aborted) throw new Error('Exportação cancelada.');
    if (seenForPreseek.has(clip.key)) continue;
    seenForPreseek.add(clip.key);

    const el = assets.videos.get(clip.mediaId);
    if (!el) continue;

    el.playbackRate = clip.playbackRate;
    log(`Pre-seeking ${clip.mediaId} → ${clip.mediaStart.toFixed(3)}s`);
    await seekVideoPrecisely(el, clip.mediaStart);
  }
  log('Pre-seek completo');
  if (signal?.aborted) throw new Error('Exportação cancelada.');

  // ── 5. Canvas setup ───────────────────────────────────────
  onProgress(15, 'Preparando canvas…');
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { alpha: false })!;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, width, height);

  // holdCanvas: retains the last successfully-drawn frame
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
        // Start all gains at 0 — the loop will activate the right one
        gain.gain.value = 0;
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
  recorder.start(500); // 500ms chunks — less pressure on mobile
  log('Recorder started');

  // ── 9. rAF loop — NO in-flight seeks ─────────────────────
  // Clips are already pre-seeked. When a clip becomes active:
  //   - call el.play() once
  //   - let it run until the next cut
  //   - on cut: pause previous, play next (already pre-seeked via preload)
  // The "upcoming cut preload" runs ~PRELOAD_AHEAD seconds before the cut.
  onProgress(22, 'Renderizando…');

  const PRELOAD_AHEAD = 0.35; // seconds before a cut to background-seek next clip
  const exportStart = performance.now();

  let activeClipKey: string | null = null;
  let activeMediaId: string | null = null;

  // Track which clips have already been background-preloaded
  const preloadedKeys = new Set<string>(seenForPreseek); // all already pre-seeked

  await new Promise<void>((resolve, reject) => {
    function tick() {
      if (signal?.aborted) {
        recorder.stop();
        reject(new Error('Exportação cancelada.'));
        return;
      }

      const elapsed = (performance.now() - exportStart) / 1000;
      const timeSec = Math.min(elapsed, totalDuration);

      // ── (a) Resolve active clip ───────────────────────────
      const activeResult = resolveActiveVideoItem(project, timeSec);

      if (activeResult) {
        const { item, track } = activeResult;
        const clipKey = `${item.id}:${item.mediaId}`;
        const el = assets.videos.get(item.mediaId);

        if (el) {
          if (clipKey !== activeClipKey) {
            // ── Clip transition ───────────────────────────────
            // Pause previous clip and silence it
            if (activeMediaId && activeMediaId !== item.mediaId) {
              const prevEl = assets.videos.get(activeMediaId);
              if (prevEl) prevEl.pause();
              const prevGain = gainNodes.get(activeMediaId);
              if (prevGain) prevGain.gain.value = 0;
            }

            log(`Cut at ${timeSec.toFixed(2)}s → "${item.name}" (${item.mediaId})`);
            activeClipKey = clipKey;
            activeMediaId = item.mediaId;

            // Unmute / set gain for new active clip
            const gain = gainNodes.get(item.mediaId);
            if (gain) {
              gain.gain.value = track.muted ? 0 : (item.videoDetails?.volume ?? 1);
            }

            // Start playback from current position (pre-seeked or background-seeked)
            el.playbackRate = item.videoDetails?.playbackRate ?? 1;
            el.play().catch(() => {});

          } else {
            // ── Same clip — just keep gain in sync ────────────
            const gain = gainNodes.get(item.mediaId);
            if (gain) {
              gain.gain.value = track.muted ? 0 : (item.videoDetails?.volume ?? 1);
            }
          }
        }
      } else {
        // Gap — silence everything, stop active video
        if (activeMediaId) {
          const prevEl = assets.videos.get(activeMediaId);
          if (prevEl) prevEl.pause();
          const prevGain = gainNodes.get(activeMediaId);
          if (prevGain) prevGain.gain.value = 0;
        }
        activeClipKey = null;
        activeMediaId = null;
      }

      // ── (b) Background preload upcoming cut ───────────────
      // ~PRELOAD_AHEAD seconds before a cut, silently seek the next clip
      // so it's frame-ready when the cut arrives.
      const upcoming = resolveNextVideoItem(project, timeSec);
      if (upcoming && upcoming.startTime - timeSec <= PRELOAD_AHEAD) {
        const nextClip = upcoming.item;
        if (nextClip) {
          const nextKey = `${nextClip.item.id}:${nextClip.item.mediaId}`;
          if (!preloadedKeys.has(nextKey)) {
            preloadedKeys.add(nextKey);
            const nextEl = assets.videos.get(nextClip.item.mediaId);
            if (nextEl && nextEl !== assets.videos.get(activeMediaId ?? '')) {
              const targetTime = nextClip.item.mediaStart ?? 0;
              log(`Background pre-seek: ${nextClip.item.mediaId} → ${targetTime.toFixed(3)}s`);
              seekVideoPrecisely(nextEl, targetTime).catch(() => {});
            }
          }
        }
      }

      // ── (c) Render frame ──────────────────────────────────
      renderTimelineFrame({
        ctx,
        timeSec,
        width,
        height,
        project,
        assets,
        holdCanvas,
      });

      // ── (d) Capture hold frame ────────────────────────────
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

      requestAnimationFrame(tick);
    }

    requestAnimationFrame(tick);
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
