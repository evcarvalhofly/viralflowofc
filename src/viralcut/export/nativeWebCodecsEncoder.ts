// ============================================================
// ViralCut – Native WebCodecs Encoder (no external lib watermarks)
//
// Pipeline:
//   1. Resolve output dimensions from chosen resolution
//   2. For every video frame interval: seek HTML video elements
//      to the correct source offset, draw onto OffscreenCanvas
//      (composite: video → images → text), create VideoFrame,
//      encode via VideoEncoder.
//   3. For audio: decode via AudioContext, mix all audio tracks
//      into a single AudioBuffer, slice into AudioData chunks,
//      encode via AudioEncoder.
//   4. Mux video + audio chunks into a proper MP4 with mp4-muxer
//      (no WASM, no watermark, pure JS).
// ============================================================

import { Muxer, ArrayBufferTarget } from 'mp4-muxer';
import { Project, MediaFile, TrackItem } from '@/viralcut/types';

export interface NativeExportOptions {
  fps: 30 | 60;
  resolution: '720p' | '1080p';
  fileName: string;
}

const log = (...a: unknown[]) => console.log('[NativeEncoder]', ...a);

// ── Dimension resolver ──────────────────────────────────────
function resolveOutputDimensions(
  projectWidth: number,
  projectHeight: number,
  resolution: '720p' | '1080p'
): { width: number; height: number } {
  const ar = projectWidth / projectHeight;
  const baseSize = resolution === '1080p' ? 1920 : 1280;

  let w: number, h: number;
  if (ar >= 1) {
    w = baseSize;
    h = Math.round(baseSize / ar);
  } else {
    h = baseSize;
    w = Math.round(baseSize * ar);
  }
  // Ensure even dimensions (codec requirement)
  return {
    width: Math.round(w / 2) * 2,
    height: Math.round(h / 2) * 2,
  };
}

// ── HTMLVideoElement cache ──────────────────────────────────
type VideoEl = { el: HTMLVideoElement; mediaId: string; ready: boolean };
const videoElCache = new Map<string, VideoEl>();

async function getVideoElement(mediaId: string, url: string): Promise<HTMLVideoElement> {
  if (!videoElCache.has(mediaId)) {
    const el = document.createElement('video');
    el.muted = true;
    el.playsInline = true;
    el.preload = 'auto';
    el.crossOrigin = 'anonymous';
    el.src = url;
    await new Promise<void>((res, rej) => {
      const t = setTimeout(() => rej(new Error('Video load timeout')), 15_000);
      el.oncanplaythrough = () => { clearTimeout(t); res(); };
      el.onerror = () => { clearTimeout(t); rej(new Error(`Video load error: ${url}`)); };
      el.load();
    });
    videoElCache.set(mediaId, { el, mediaId, ready: true });
  }
  return videoElCache.get(mediaId)!.el;
}

async function seekVideoTo(el: HTMLVideoElement, t: number): Promise<void> {
  return new Promise((res) => {
    if (Math.abs(el.currentTime - t) < 0.001) { res(); return; }
    const onSeeked = () => { el.removeEventListener('seeked', onSeeked); res(); };
    el.addEventListener('seeked', onSeeked);
    el.currentTime = t;
    setTimeout(res, 300); // safety bail
  });
}

// ── Image cache ─────────────────────────────────────────────
const imageBitmapCache = new Map<string, ImageBitmap>();

async function getImageBitmap(mediaId: string, url: string): Promise<ImageBitmap> {
  if (!imageBitmapCache.has(mediaId)) {
    const resp = await fetch(url);
    const blob = await resp.blob();
    const bmp = await createImageBitmap(blob);
    imageBitmapCache.set(mediaId, bmp);
  }
  return imageBitmapCache.get(mediaId)!;
}

// ── Canvas rendering ─────────────────────────────────────────
async function renderFrame(
  ctx: OffscreenCanvasRenderingContext2D,
  project: Project,
  media: MediaFile[],
  t: number,
  outputWidth: number,
  outputHeight: number
): Promise<void> {
  // Background
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, outputWidth, outputHeight);

  const scaleX = outputWidth / project.width;
  const scaleY = outputHeight / project.height;

  for (const track of project.tracks) {
    if (track.muted) continue;

    // Sort items so they render in chronological z-order
    const activeItems = track.items.filter(
      (item) => t >= item.startTime && t < item.endTime
    );

    for (const item of activeItems) {
      try {
        if (track.type === 'video') {
          await renderVideoItem(ctx, item, media, t, outputWidth, outputHeight, scaleX, scaleY);
        } else if (track.type === 'image') {
          await renderImageItem(ctx, item, media, outputWidth, outputHeight, scaleX, scaleY);
        } else if (track.type === 'text') {
          renderTextItem(ctx, item, outputWidth, outputHeight, scaleX, scaleY);
        }
      } catch (err) {
        log(`Frame render error for item "${item.name}":`, err);
      }
    }
  }
}

async function renderVideoItem(
  ctx: OffscreenCanvasRenderingContext2D,
  item: TrackItem,
  media: MediaFile[],
  t: number,
  outputWidth: number,
  outputHeight: number,
  scaleX: number,
  scaleY: number
): Promise<void> {
  const mf = media.find((m) => m.id === item.mediaId);
  if (!mf || mf.type !== 'video') return;

  const vd = item.videoDetails;
  const sourceT = item.mediaStart + (t - item.startTime) * (vd?.playbackRate ?? 1);

  try {
    const el = await getVideoElement(mf.id, mf.url);
    await seekVideoTo(el, Math.max(0, sourceT));

    ctx.save();
    const opacity = vd?.opacity ?? 1;
    ctx.globalAlpha = opacity;

    // Filters (brightness, contrast, saturation)
    const brightness = vd?.brightness ?? 1;
    const contrast = vd?.contrast ?? 1;
    const saturation = vd?.saturation ?? 1;
    if (
      Math.abs(brightness - 1) > 0.01 ||
      Math.abs(contrast - 1) > 0.01 ||
      Math.abs(saturation - 1) > 0.01
    ) {
      ctx.filter = `brightness(${brightness}) contrast(${contrast}) saturate(${saturation})`;
    }

    // Flip transforms
    if (vd?.flipH || vd?.flipV) {
      ctx.translate(outputWidth / 2, outputHeight / 2);
      ctx.scale(vd.flipH ? -1 : 1, vd.flipV ? -1 : 1);
      ctx.translate(-outputWidth / 2, -outputHeight / 2);
    }

    // Cover-fit video into output canvas (letterbox/pillarbox)
    const vidW = el.videoWidth || outputWidth;
    const vidH = el.videoHeight || outputHeight;
    const vidAr = vidW / vidH;
    const canvasAr = outputWidth / outputHeight;
    let dw: number, dh: number, dx: number, dy: number;
    if (vidAr > canvasAr) {
      dh = outputHeight;
      dw = dh * vidAr;
      dx = (outputWidth - dw) / 2;
      dy = 0;
    } else {
      dw = outputWidth;
      dh = dw / vidAr;
      dx = 0;
      dy = (outputHeight - dh) / 2;
    }

    ctx.drawImage(el, dx, dy, dw, dh);
    ctx.restore();
  } catch (err) {
    log('Video render error:', err);
  }
}

async function renderImageItem(
  ctx: OffscreenCanvasRenderingContext2D,
  item: TrackItem,
  media: MediaFile[],
  outputWidth: number,
  outputHeight: number,
  scaleX: number,
  scaleY: number
): Promise<void> {
  const mf = media.find((m) => m.id === item.mediaId);
  if (!mf || mf.type !== 'image') return;

  const id = item.imageDetails;
  const bmp = await getImageBitmap(mf.id, mf.url);

  const pxX = ((id?.posX ?? 50) / 100) * outputWidth;
  const pxY = ((id?.posY ?? 50) / 100) * outputHeight;
  const pxW = ((id?.width ?? 50) / 100) * outputWidth;
  const pxH = ((id?.height ?? 50) / 100) * outputHeight;

  ctx.save();
  ctx.globalAlpha = id?.opacity ?? 1;

  const brightness = id?.brightness ?? 1;
  const contrast = id?.contrast ?? 1;
  const saturation = id?.saturation ?? 1;
  if (
    Math.abs(brightness - 1) > 0.01 ||
    Math.abs(contrast - 1) > 0.01 ||
    Math.abs(saturation - 1) > 0.01
  ) {
    ctx.filter = `brightness(${brightness}) contrast(${contrast}) saturate(${saturation})`;
  }

  if (id?.flipH || id?.flipV) {
    ctx.translate(pxX, pxY);
    ctx.scale(id.flipH ? -1 : 1, id.flipV ? -1 : 1);
    ctx.translate(-pxX, -pxY);
  }

  ctx.drawImage(bmp, pxX - pxW / 2, pxY - pxH / 2, pxW, pxH);
  ctx.restore();
}

function renderTextItem(
  ctx: OffscreenCanvasRenderingContext2D,
  item: TrackItem,
  outputWidth: number,
  outputHeight: number,
  scaleX: number,
  scaleY: number
): void {
  const td = item.textDetails;
  if (!td) return;

  const fontSizePx = Math.round((td.fontSize / 100) * outputHeight);
  const pxX = (td.posX / 100) * outputWidth;
  const pxY = (td.posY / 100) * outputHeight;
  const maxWidth = (td.width / 100) * outputWidth;

  ctx.save();
  ctx.globalAlpha = td.opacity ?? 1;
  ctx.font = `${fontSizePx}px ${td.fontFamily || 'sans-serif'}`;
  ctx.textAlign = (td.textAlign as CanvasTextAlign) || 'center';
  ctx.textBaseline = 'middle';

  // Shadow
  if (td.boxShadow && td.boxShadow.blur > 0) {
    ctx.shadowColor = td.boxShadow.color || 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = td.boxShadow.blur;
    ctx.shadowOffsetX = td.boxShadow.x;
    ctx.shadowOffsetY = td.boxShadow.y;
  }

  // Background
  if (td.backgroundColor && td.backgroundColor !== 'transparent') {
    const metrics = ctx.measureText(td.text);
    const textW = Math.min(metrics.width, maxWidth);
    ctx.fillStyle = td.backgroundColor;
    ctx.fillRect(pxX - textW / 2 - 8, pxY - fontSizePx / 2 - 4, textW + 16, fontSizePx + 8);
  }

  // Text
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.fillStyle = td.color || '#ffffff';
  ctx.fillText(td.text, pxX, pxY, maxWidth);

  // Underline / strikethrough
  if (td.textDecoration === 'underline' || td.textDecoration === 'line-through') {
    const metrics = ctx.measureText(td.text);
    const lineY =
      td.textDecoration === 'underline'
        ? pxY + fontSizePx * 0.55
        : pxY;
    ctx.beginPath();
    ctx.strokeStyle = td.color || '#ffffff';
    ctx.lineWidth = Math.max(1, fontSizePx * 0.06);
    const lx = td.textAlign === 'center' ? pxX - metrics.width / 2 : pxX;
    ctx.moveTo(lx, lineY);
    ctx.lineTo(lx + metrics.width, lineY);
    ctx.stroke();
  }

  ctx.restore();
}

// ── Audio mixing ─────────────────────────────────────────────
async function mixAudio(
  project: Project,
  media: MediaFile[],
  outputDuration: number,
  sampleRate: number
): Promise<Float32Array[]> {
  const numSamples = Math.ceil(outputDuration * sampleRate);
  const left = new Float32Array(numSamples);
  const right = new Float32Array(numSamples);

  const audioCtx = new OfflineAudioContext(2, numSamples, sampleRate);

  const decodeAudioFile = async (file: File): Promise<AudioBuffer | null> => {
    try {
      const ab = await file.arrayBuffer();
      return await audioCtx.decodeAudioData(ab);
    } catch (err) {
      log('Audio decode error:', err);
      return null;
    }
  };

  // Process all audio-producing tracks: audio tracks + video tracks (their audio)
  for (const track of project.tracks) {
    if (track.muted) continue;
    if (track.type !== 'audio' && track.type !== 'video') continue;

    for (const item of track.items) {
      const mf = media.find((m) => m.id === item.mediaId);
      if (!mf) continue;
      if (mf.type !== 'audio' && mf.type !== 'video') continue;

      const ad = track.type === 'audio' ? item.audioDetails : item.videoDetails;
      const volume = (ad as any)?.volume ?? 1;
      if (volume === 0) continue;

      const buf = await decodeAudioFile(mf.file);
      if (!buf) continue;

      const srcNode = audioCtx.createBufferSource();
      srcNode.buffer = buf;

      const gainNode = audioCtx.createGain();
      gainNode.gain.value = volume;

      const playbackRate = (ad as any)?.playbackRate ?? 1;
      srcNode.playbackRate.value = playbackRate;

      // Fade in/out for audio clips
      if (track.type === 'audio') {
        const fadeIn = item.audioDetails?.fadeIn ?? 0;
        const fadeOut = item.audioDetails?.fadeOut ?? 0;
        if (fadeIn > 0) {
          gainNode.gain.setValueAtTime(0, item.startTime);
          gainNode.gain.linearRampToValueAtTime(volume, item.startTime + fadeIn);
        }
        if (fadeOut > 0) {
          gainNode.gain.setValueAtTime(volume, item.endTime - fadeOut);
          gainNode.gain.linearRampToValueAtTime(0, item.endTime);
        }
      }

      srcNode.connect(gainNode).connect(audioCtx.destination);
      srcNode.start(item.startTime, item.mediaStart, item.endTime - item.startTime);
    }
  }

  const rendered = await audioCtx.startRendering();

  // Return as interleaved stereo channels
  const l = rendered.getChannelData(0);
  const r = rendered.numberOfChannels > 1 ? rendered.getChannelData(1) : rendered.getChannelData(0);
  return [l, r];
}

// ── Main export function ─────────────────────────────────────
export async function exportTimelineNativeWebCodecs(
  project: Project,
  media: MediaFile[],
  opts: NativeExportOptions,
  onProgress?: (progress: number, label: string) => void,
  signal?: AbortSignal
): Promise<Blob> {
  const t0 = performance.now();
  log('Export started (native WebCodecs + mp4-muxer)');

  // Clear caches from previous export
  videoElCache.clear();
  imageBitmapCache.clear();

  const { width: outputWidth, height: outputHeight } = resolveOutputDimensions(
    project.width,
    project.height,
    opts.resolution
  );
  const { fps, fileName } = opts;
  const frameInterval = 1 / fps;
  const totalDuration = project.duration;

  log(`Output: ${outputWidth}×${outputHeight} @ ${fps}fps, duration: ${totalDuration.toFixed(2)}s`);

  if (totalDuration <= 0) {
    throw new Error('A timeline está vazia (duração = 0). Adicione clipes antes de exportar.');
  }

  onProgress?.(3, 'Preparando encoder de vídeo…');

  // ── Create OffscreenCanvas ──────────────────────────────────
  const canvas = new OffscreenCanvas(outputWidth, outputHeight);
  const ctx = canvas.getContext('2d', { willReadFrequently: false });
  if (!ctx) throw new Error('Não foi possível criar OffscreenCanvas 2D context.');

  // ── Setup mp4-muxer ─────────────────────────────────────────
  const target = new ArrayBufferTarget();
  const muxer = new Muxer({
    target,
    video: {
      codec: 'avc',
      width: outputWidth,
      height: outputHeight,
    },
    audio: {
      codec: 'aac',
      sampleRate: 48000,
      numberOfChannels: 2,
    },
    fastStart: 'in-memory',
  });

  // ── Video Encoder ───────────────────────────────────────────
  const videoChunks: { chunk: EncodedVideoChunk; meta?: EncodedVideoChunkMetadata }[] = [];

  const videoEncoder = new VideoEncoder({
    output: (chunk, meta) => videoChunks.push({ chunk, meta }),
    error: (e) => { throw new Error(`VideoEncoder error: ${e.message}`); },
  });

  await videoEncoder.configure({
    codec: 'avc1.42001F', // H.264 Baseline Level 3.1
    width: outputWidth,
    height: outputHeight,
    bitrate: opts.resolution === '1080p' ? 6_000_000 : 3_500_000,
    framerate: fps,
    hardwareAcceleration: 'prefer-hardware',
    latencyMode: 'quality',
  });

  // ── Render & encode each video frame ──────────────────────
  const totalFrames = Math.ceil(totalDuration * fps);
  log(`Rendering ${totalFrames} frames…`);

  onProgress?.(5, 'Renderizando frames de vídeo…');

  // Pre-warm: load all needed video elements
  const neededMedia = new Set<string>();
  for (const track of project.tracks) {
    if (track.muted) continue;
    for (const item of track.items) {
      if (item.mediaId) neededMedia.add(item.mediaId);
    }
  }
  for (const mediaId of neededMedia) {
    const mf = media.find((m) => m.id === mediaId);
    if (mf && mf.type === 'video') {
      await getVideoElement(mf.id, mf.url).catch(() => {});
    }
  }

  for (let frameIdx = 0; frameIdx < totalFrames; frameIdx++) {
    if (signal?.aborted) throw new Error('Exportação cancelada.');

    const t = frameIdx * frameInterval;
    const timestampUs = Math.round(t * 1_000_000); // microseconds

    await renderFrame(ctx, project, media, t, outputWidth, outputHeight);

    const videoFrame = new VideoFrame(canvas, {
      timestamp: timestampUs,
      duration: Math.round(frameInterval * 1_000_000),
    });

    const isKeyFrame = frameIdx % (fps * 2) === 0; // keyframe every 2s
    videoEncoder.encode(videoFrame, { keyFrame: isKeyFrame });
    videoFrame.close();

    // Report progress (frames are 5%→70%)
    if (frameIdx % 5 === 0) {
      const pct = Math.round(5 + (frameIdx / totalFrames) * 65);
      onProgress?.(pct, `Renderizando… ${Math.round((frameIdx / totalFrames) * 100)}%`);
    }
  }

  await videoEncoder.flush();
  log(`Video encoding done — ${videoChunks.length} chunks`);

  // Feed video chunks to muxer
  for (const { chunk, meta } of videoChunks) {
    muxer.addVideoChunk(chunk, meta);
  }

  // ── Audio processing ─────────────────────────────────────
  onProgress?.(72, 'Processando áudio…');
  log('Mixing audio…');

  const SAMPLE_RATE = 48000;
  const hasAudio = project.tracks.some(
    (t) => !t.muted && (t.type === 'audio' || t.type === 'video') && t.items.length > 0
  );

  if (hasAudio) {
    try {
      const [leftCh, rightCh] = await mixAudio(project, media, totalDuration, SAMPLE_RATE);
      const CHUNK_SIZE = SAMPLE_RATE; // 1s chunks

      const audioEncoder = new AudioEncoder({
        output: (chunk, meta) => muxer.addAudioChunk(chunk, meta),
        error: (e) => log('AudioEncoder error:', e),
      });

      audioEncoder.configure({
        codec: 'mp4a.40.2', // AAC-LC
        sampleRate: SAMPLE_RATE,
        numberOfChannels: 2,
        bitrate: 128_000,
      });

      const totalSamples = leftCh.length;
      let offset = 0;
      while (offset < totalSamples) {
        if (signal?.aborted) throw new Error('Exportação cancelada.');

        const size = Math.min(CHUNK_SIZE, totalSamples - offset);
        const interleaved = new Float32Array(size * 2);
        for (let i = 0; i < size; i++) {
          interleaved[i * 2] = leftCh[offset + i];
          interleaved[i * 2 + 1] = rightCh[offset + i];
        }

        const audioData = new AudioData({
          format: 'f32-interleaved',
          sampleRate: SAMPLE_RATE,
          numberOfFrames: size,
          numberOfChannels: 2,
          timestamp: Math.round((offset / SAMPLE_RATE) * 1_000_000),
          data: interleaved,
        });

        audioEncoder.encode(audioData);
        audioData.close();
        offset += size;
      }

      await audioEncoder.flush();
      log('Audio encoding done');
    } catch (audioErr) {
      log('Audio mix error (continuing without audio):', audioErr);
    }
  }

  // ── Finalize & build Blob ───────────────────────────────
  onProgress?.(90, 'Finalizando arquivo MP4…');
  muxer.finalize();

  const arrayBuffer = target.buffer;
  const blob = new Blob([arrayBuffer], { type: 'video/mp4' });

  // Clean up
  videoElCache.forEach((v) => { try { v.el.src = ''; } catch {} });
  videoElCache.clear();
  imageBitmapCache.forEach((bmp) => bmp.close());
  imageBitmapCache.clear();

  const elapsed = ((performance.now() - t0) / 1000).toFixed(1);
  log(`Export complete in ${elapsed}s — ${(blob.size / 1024 / 1024).toFixed(2)} MB`);

  onProgress?.(98, 'Iniciando download…');
  return blob;
}
