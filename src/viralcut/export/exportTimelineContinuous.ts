// ============================================================
// ViralCut – Continuous Single-Pass Export Engine (v2)
//
// ARCHITECTURE FIXES vs v1:
//
//  ❌ v1: Audio via createMediaElementSource — dies after a few cuts
//  ✅ v2: Audio pre-decoded + scheduled with AudioBufferSourceNode.start(when,offset,dur)
//         → completely independent of video element seek timing
//
//  ❌ v1: drawImage immediately after currentTime = t (race condition)
//  ✅ v2: seekVideoPrecisely() awaits 'seeked' + requestVideoFrameCallback
//         → only draws when the frame is genuinely ready
//
//  ❌ v1: Real-time RAF loop — can't pause to wait for seeks
//  ✅ v2: Frame-by-frame async loop — each frame fully awaited before next
//         → guaranteed frame accuracy even with rapid cuts
//
//  ❌ v1: Black canvas during seek transition
//  ✅ v2: Hold last valid frame in an offscreen buffer during seek
//         → no black flashes between cuts
//
//  ❌ v1: Audio source re-created on every clip change → breaks the chain
//  ✅ v2: All audio pre-scheduled before recording starts → zero interruptions
// ============================================================

import { Project, TrackItem, MediaFile } from '../types';
import { sanitizeProject } from '../utils/sanitize';
import { validateProjectForContinuousExport, EXPORT_MIN_CLIP_DURATION } from './validateProjectForExport';
import { resolveFrameStateAtTime } from './resolveFrameState';
import { prepareMediaForExport } from './prepareMediaForExport';
import { pickBestMimeType } from './pickBestMimeType';
import { buildAudioTimeline } from './buildAudioTimeline';
import { seekVideoPrecisely, getMediaTimeForTimelineTime } from './seekVideo';

const DEBUG_EXPORT = true;
function exportLog(...args: unknown[]) {
  if (DEBUG_EXPORT) console.log('[ViralCut Export]', ...args);
}

export interface ExportProgressCallback {
  (progress: number, label: string): void;
}

export interface ExportOptions {
  resolution: '1080p' | '720p';
  fps: 30 | 60;
  projectName: string;
}

// ── Canvas text rendering ────────────────────────────────────
function drawTextItem(
  ctx: CanvasRenderingContext2D,
  item: TrackItem,
  outW: number,
  outH: number
) {
  const td = item.textDetails;
  if (!td) return;
  const x = (td.posX / 100) * outW;
  const y = (td.posY / 100) * outH;
  const maxW = (td.width / 100) * outW;
  const fontSize = Math.round((td.fontSize / 100) * outH);
  ctx.save();
  ctx.globalAlpha = td.opacity ?? 1;
  (ctx as any).filter = 'none';
  if (td.backgroundColor && td.backgroundColor !== 'transparent') {
    ctx.fillStyle = td.backgroundColor;
    ctx.fillRect(x - maxW / 2, y - fontSize * 1.2, maxW, fontSize * 1.5);
  }
  if (td.boxShadow?.blur > 0) {
    ctx.shadowColor = td.boxShadow.color;
    ctx.shadowOffsetX = td.boxShadow.x;
    ctx.shadowOffsetY = td.boxShadow.y;
    ctx.shadowBlur = td.boxShadow.blur;
  }
  ctx.font = `bold ${fontSize}px ${td.fontFamily || 'Inter, sans-serif'}`;
  ctx.fillStyle = td.color || '#ffffff';
  ctx.textAlign = (td.textAlign as CanvasTextAlign) || 'center';
  ctx.textBaseline = 'middle';
  const words = (td.text || '').split(' ');
  let line = '';
  const lineHeight = fontSize * 1.35;
  const lines: string[] = [];
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = word; }
    else line = test;
  }
  if (line) lines.push(line);
  const totalH = lines.length * lineHeight;
  lines.forEach((l, li) => {
    ctx.fillText(l, x, y - totalH / 2 + li * lineHeight + lineHeight / 2, maxW);
  });
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.restore();
}

// ── Frame-accurate session tracker ──────────────────────────
// Reuses the same video element while on the same clip.
// Only replaces the element when the clip (mediaId) actually changes.
interface VideoSession {
  itemId: string;
  mediaId: string;
  el: HTMLVideoElement;
}

// ── Offscreen "last valid frame" buffer ─────────────────────
// While we're seeking to a new clip, we paint the previous frame
// so the canvas (and therefore the MediaRecorder stream) never
// shows a black gap.
function holdLastFrame(
  ctx: CanvasRenderingContext2D,
  holdCanvas: HTMLCanvasElement,
  outW: number,
  outH: number
) {
  try {
    ctx.drawImage(holdCanvas, 0, 0, outW, outH);
  } catch {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, outW, outH);
  }
}

function captureCurrentFrame(
  src: HTMLVideoElement | HTMLCanvasElement,
  holdCanvas: HTMLCanvasElement
) {
  const hCtx = holdCanvas.getContext('2d')!;
  hCtx.drawImage(src, 0, 0, holdCanvas.width, holdCanvas.height);
}

// ── Main export function ─────────────────────────────────────
export async function exportTimelineContinuous(
  rawProject: Project,
  media: MediaFile[],
  opts: ExportOptions,
  onProgress: ExportProgressCallback,
  signal?: AbortSignal
): Promise<Blob> {
  const t0 = performance.now();
  exportLog('Export started');

  // ── 1. Sanitize & validate ─────────────────────────────────
  onProgress(2, 'Sanitizando timeline…');
  const project = sanitizeProject(rawProject);

  const cleanedProject: Project = {
    ...project,
    tracks: project.tracks.map((track) => ({
      ...track,
      items: track.items.filter((item) => {
        const dur = item.endTime - item.startTime;
        if (dur < EXPORT_MIN_CLIP_DURATION) {
          exportLog(`Micro-clip removido: "${item.name}" (${dur.toFixed(3)}s)`);
          return false;
        }
        return true;
      }),
    })),
  };

  validateProjectForContinuousExport(cleanedProject, media);

  const totalDuration = cleanedProject.duration;
  exportLog(`Duração total: ${totalDuration.toFixed(2)}s`);

  // ── 2. Build mediaMap ──────────────────────────────────────
  const mediaMap = new Map(media.map((m) => [m.id, m]));

  const allVideoItems: TrackItem[] = cleanedProject.tracks
    .filter((t) => t.type === 'video' && !t.muted)
    .flatMap((t) => t.items)
    .sort((a, b) => a.startTime - b.startTime);

  exportLog(`Clips de vídeo: ${allVideoItems.length}`);

  // ── 3. Output dimensions ───────────────────────────────────
  const firstMf = mediaMap.get(allVideoItems[0]?.mediaId ?? '');
  const srcW = firstMf?.width ?? 1920;
  const srcH = firstMf?.height ?? 1080;
  const targetLongSide = opts.resolution === '1080p' ? 1920 : 1280;
  const exportScale = Math.min(targetLongSide / Math.max(srcW, srcH), 1);
  const outW = Math.max(2, Math.round((srcW * exportScale) / 2) * 2);
  const outH = Math.max(2, Math.round((srcH * exportScale) / 2) * 2);
  const FPS = opts.fps;
  const bitrate = opts.resolution === '1080p' ? 6_000_000 : 3_000_000;
  const totalFrames = Math.ceil(totalDuration * FPS);

  exportLog(`Resolução: ${outW}×${outH} @ ${FPS}fps | ${totalFrames} frames`);

  // ── 4. Pre-load all video elements ────────────────────────
  onProgress(5, 'Pré-carregando vídeos…');
  const videoElMap = await prepareMediaForExport(
    allVideoItems,
    mediaMap,
    (msg) => onProgress(5, msg)
  );

  if (signal?.aborted) throw new Error('Exportação cancelada.');

  // ── 5. Setup canvas ───────────────────────────────────────
  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d', { alpha: false })!;

  // Offscreen buffer to hold the last valid rendered frame
  const holdCanvas = document.createElement('canvas');
  holdCanvas.width = outW;
  holdCanvas.height = outH;

  // Draw initial black frame
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, outW, outH);

  // ── 6. Setup AudioContext + schedule full audio timeline ───
  onProgress(10, 'Preparando áudio…');

  // We create the context now but will resume it after starting the recorder
  const audioCtx = new AudioContext();

  // Start MediaRecorder FIRST so it's already running when we resume audio
  const mimeType = pickBestMimeType();
  exportLog(`MimeType: ${mimeType}`);

  const canvasStream = canvas.captureStream(FPS);
  const chunks: BlobPart[] = [];

  // We'll inject the audio tracks after audio is built
  let recorder: MediaRecorder;
  let audioDispose: (() => void) | null = null;

  try {
    // Decode + schedule all audio — startAt is the AudioContext time when
    // frame 0 of the timeline will play. We'll compute this after .start()
    onProgress(12, 'Decodificando e agendando áudio…');
    // Temporarily suspend scheduling until we know the real startAt
    // We'll call buildAudioTimeline with the correct startAt below.

    // Build audio stream (scheduling happens later once we know startAt)
    const audioResult = await buildAudioTimeline(
      audioCtx,
      cleanedProject,
      mediaMap,
      0, // placeholder — we'll re-call with correct time below
      (msg) => onProgress(12, msg)
    );
    // We won't use this result since startAt=0 may be off.
    // Close and re-build once we know the exact recorder start time.
    audioResult.dispose();
    await audioCtx.close().catch(() => {});

  } catch (err) {
    exportLog('Audio pre-check failed, continuing video-only:', err);
  }

  if (signal?.aborted) throw new Error('Exportação cancelada.');

  // ── Rebuild AudioContext and schedule audio precisely ──────
  // We use a fresh AudioContext so we can control startAt precisely.
  const audioCtx2 = new AudioContext();

  // Ensure context is running
  if (audioCtx2.state === 'suspended') {
    await audioCtx2.resume().catch(() => {});
  }

  // Build combined stream with audio destination
  let finalStream: MediaStream;
  try {
    const audioResult2 = await buildAudioTimeline(
      audioCtx2,
      cleanedProject,
      mediaMap,
      // startAt: We want audio to start slightly in the future so the
      // MediaRecorder has time to start. We'll use currentTime + 0.3s.
      audioCtx2.currentTime + 0.5,
      (msg) => onProgress(14, msg)
    );
    audioDispose = audioResult2.dispose;

    finalStream = new MediaStream([
      ...canvasStream.getVideoTracks(),
      ...audioResult2.destination.stream.getAudioTracks(),
    ]);

    exportLog('Audio scheduled successfully');
  } catch (err) {
    exportLog('Audio scheduling failed, exporting video-only:', err);
    finalStream = canvasStream;
  }

  // ── 7. Start single MediaRecorder ─────────────────────────
  onProgress(16, 'Iniciando gravação…');

  recorder = new MediaRecorder(finalStream, {
    mimeType,
    videoBitsPerSecond: bitrate,
  });
  recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

  const recorderStopped = new Promise<void>((res) => { recorder.onstop = () => res(); });
  recorder.start(100);

  // Record when recording actually started
  const recordingStartedAt = audioCtx2.currentTime;
  exportLog(`Recorder started. AudioContext.currentTime = ${recordingStartedAt.toFixed(3)}`);

  // ── 8. Frame-by-frame render loop ─────────────────────────
  // This is the KEY fix: we process each frame in sequence,
  // waiting for seeks to fully complete before drawing.
  // The canvas stream stays live the whole time — the recorder
  // captures whatever is on the canvas at each captureStream tick.
  onProgress(18, 'Renderizando frames…');

  let currentSession: VideoSession | null = null;
  let framesRendered = 0;

  // Helper: ensure correct video element is loaded and seeked
  const ensureVideoFrame = async (
    videoItem: TrackItem,
    exportTime: number
  ): Promise<HTMLVideoElement | null> => {
    const el = videoElMap.get(videoItem.mediaId);
    if (!el) return null;

    const playRate = Math.min(Math.max(videoItem.videoDetails?.playbackRate ?? 1, 0.1), 16);
    const mediaTime = getMediaTimeForTimelineTime(
      videoItem.startTime,
      videoItem.mediaStart,
      playRate,
      exportTime
    );
    const safeMediaTime = Math.min(
      Math.max(0, mediaTime),
      (el.duration || 9999) - 0.01
    );

    const clipChanged =
      !currentSession ||
      currentSession.itemId !== videoItem.id;

    if (clipChanged) {
      exportLog(`Clip change at ${exportTime.toFixed(3)}s → "${videoItem.name}" mediaTime=${safeMediaTime.toFixed(3)}`);
      currentSession = { itemId: videoItem.id, mediaId: videoItem.mediaId, el };

      // Seek and wait for the frame to be ready
      await seekVideoPrecisely(el, safeMediaTime);
      exportLog(`Seek complete for "${videoItem.name}" @ ${el.currentTime.toFixed(3)}`);
    } else {
      // Same clip — check if we need to correct drift
      const drift = Math.abs(el.currentTime - safeMediaTime);
      if (drift > 0.1) {
        exportLog(`Drift correction: ${drift.toFixed(3)}s on "${videoItem.name}"`);
        await seekVideoPrecisely(el, safeMediaTime);
      }
    }

    return el;
  };

  // Helper: draw one frame to canvas
  const drawFrame = async (exportTime: number) => {
    const { videoItem, textItems } = resolveFrameStateAtTime(cleanedProject, exportTime);

    if (videoItem) {
      const el = await ensureVideoFrame(videoItem, exportTime);
      if (el && el.readyState >= 2) {
        const vd = videoItem.videoDetails;
        ctx.save();

        // CSS filters
        const filters: string[] = [];
        if (vd?.brightness && vd.brightness !== 1) filters.push(`brightness(${vd.brightness})`);
        if (vd?.contrast && vd.contrast !== 1) filters.push(`contrast(${vd.contrast})`);
        if (vd?.saturation && vd.saturation !== 1) filters.push(`saturate(${vd.saturation})`);
        if (filters.length) (ctx as any).filter = filters.join(' ');

        ctx.globalAlpha = vd?.opacity ?? 1;

        if (vd?.flipH || vd?.flipV) {
          ctx.translate(vd.flipH ? outW : 0, vd.flipV ? outH : 0);
          ctx.scale(vd.flipH ? -1 : 1, vd.flipV ? -1 : 1);
        }

        ctx.drawImage(el, 0, 0, outW, outH);
        ctx.restore();
        (ctx as any).filter = 'none';
        ctx.globalAlpha = 1;

        // Capture this frame as the "last valid" fallback
        captureCurrentFrame(canvas, holdCanvas);
      } else {
        // Video not ready — hold last valid frame
        holdLastFrame(ctx, holdCanvas, outW, outH);
      }
    } else {
      // No video at this time — black frame (gap)
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, outW, outH);
    }

    // Draw text overlays on top
    for (const textItem of textItems) {
      drawTextItem(ctx, textItem, outW, outH);
    }
  };

  // ── Main frame loop ────────────────────────────────────────
  // We use a small yield (setTimeout 0) every N frames to allow
  // the browser to breathe and process events (including abort).
  const YIELD_EVERY = 15; // yield every N frames

  for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
    if (signal?.aborted) {
      exportLog('Export cancelled by user');
      recorder.stop();
      audioDispose?.();
      audioCtx2.close().catch(() => {});
      throw new Error('Exportação cancelada.');
    }

    const exportTime = frameIndex / FPS;
    await drawFrame(exportTime);
    framesRendered++;

    // Progress update (18–65%)
    if (frameIndex % 10 === 0) {
      const pct = 18 + Math.round((frameIndex / totalFrames) * 47);
      onProgress(Math.min(65, pct), `Renderizando… ${exportTime.toFixed(1)}s / ${totalDuration.toFixed(1)}s`);
    }

    // Yield to browser periodically
    if (frameIndex % YIELD_EVERY === 0) {
      await new Promise<void>((r) => setTimeout(r, 0));
    }
  }

  exportLog(`Rendered ${framesRendered} frames`);

  // ── 9. Stop recorder ─────────────────────────────────────
  onProgress(66, 'Finalizando gravação…');

  // Pause all video elements
  videoElMap.forEach((el) => { try { el.pause(); el.src = ''; } catch {} });

  // Stop audio
  audioDispose?.();
  audioCtx2.close().catch(() => {});

  recorder.stop();
  await recorderStopped;

  const webmBlob = new Blob(chunks, { type: mimeType });
  exportLog(`WebM blob: ${(webmBlob.size / 1024 / 1024).toFixed(2)}MB | chunks: ${chunks.length}`);

  if (signal?.aborted) throw new Error('Exportação cancelada.');
  if (webmBlob.size < 1000) {
    throw new Error('Arquivo de exportação vazio. Verifique se há vídeo na timeline.');
  }

  // ── 10. OTIMIZAÇÃO: Retornar WebM diretamente, sem recodificação FFmpeg ──
  // A conversão WebM→MP4 dobrava o tempo de exportação sem ganho perceptível.
  // WebM (VP8/VP9 + Opus) é suportado por todos os navegadores modernos,
  // Android, e a maioria dos players de desktop. Se o usuário precisar
  // especificamente de MP4/H.264, use o motor WebCodecs (exportTimelineFast).
  const elapsed = ((performance.now() - t0) / 1000).toFixed(1);
  exportLog(`Export concluído em ${elapsed}s (WebM direto, sem FFmpeg) | ${(webmBlob.size / 1024 / 1024).toFixed(2)}MB`);

  onProgress(99, 'Preparando download…');
  return webmBlob;
}
