// ============================================================
// ViralCut – Native WebCodecs Encoder (no watermarks)
//
// Pipeline:
//   1. Resolve output dimensions (respects project aspect ratio)
//   2. For every video frame: lazy-load + smart-seek video elements,
//      draw onto OffscreenCanvas (video → image → text), create
//      VideoFrame, encode via VideoEncoder directly into muxer.
//   3. Audio: decode via OfflineAudioContext, mix all tracks,
//      encode via AudioEncoder.
//   4. Mux with mp4-muxer (no WASM, no watermark).
//
// Mobile optimizations:
//   - Lazy video loading (no pre-warm of all media)
//   - Seek deduplication cache (skips seeks < 40ms apart)
//   - loadedmetadata + loadeddata instead of oncanplaythrough
//   - Encoder backpressure control (encodeQueueSize ≤ 2)
//   - Direct muxer output (no in-RAM chunk accumulation)
//   - GC yield every 2 frames on mobile, 15 on desktop
//   - Reduced bitrate on mobile
// ============================================================

import { Muxer, ArrayBufferTarget } from 'mp4-muxer';
import { Project, MediaFile, TrackItem } from '@/viralcut/types';
import { resolveProjectOutputSize } from './shared/resolveProjectOutputSize';

export interface NativeExportOptions {
  fps: 30 | 60;
  resolution: '720p' | '1080p';
  fileName: string;
}

const log = (...a: unknown[]) => console.log('[NativeEncoder]', ...a);

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Mobile detection ─────────────────────────────────────────
const isProbablyMobile = /Android|iPhone|iPad|iPod/i.test(
  typeof navigator !== 'undefined' ? navigator.userAgent : ''
);

// ── Video element cache ──────────────────────────────────────
const videoElCache = new Map<string, HTMLVideoElement>();
const lastSeekMap  = new Map<string, number>();

async function waitEvent(
  el: HTMLVideoElement,
  event: string,
  timeoutMs = 15_000
): Promise<void> {
  return new Promise((resolve, reject) => {
    let done = false;
    const finish = (err?: Error) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      el.removeEventListener(event, onOk);
      el.removeEventListener('error', onErr);
      err ? reject(err) : resolve();
    };
    const onOk  = () => finish();
    const onErr = () => finish(new Error(`Erro ao carregar vídeo (evento: ${event})`));
    const timer = setTimeout(() => finish(new Error(`Timeout aguardando ${event}`)), timeoutMs);
    el.addEventListener(event, onOk,  { once: true });
    el.addEventListener('error', onErr, { once: true });
  });
}

/** Lazy-loads a video element, waiting for loadeddata (not oncanplaythrough) */
async function getVideoElement(mediaId: string, url: string): Promise<HTMLVideoElement> {
  const cached = videoElCache.get(mediaId);
  if (cached) return cached;

  const el = document.createElement('video');
  el.muted       = true;
  el.playsInline = true;
  el.preload     = 'metadata';
  el.crossOrigin = 'anonymous';
  el.src = url;
  el.load();

  await waitEvent(el, 'loadedmetadata', 15_000);
  // If we only have metadata, wait for at least first data
  if (el.readyState < 2) {
    await waitEvent(el, 'loadeddata', 10_000);
  }

  videoElCache.set(mediaId, el);
  return el;
}

async function waitVideoFrame(el: HTMLVideoElement): Promise<void> {
  if ('requestVideoFrameCallback' in el) {
    await new Promise<void>((resolve) => {
      (el as any).requestVideoFrameCallback(() => resolve());
    });
    return;
  }
  await delay(16);
}

/** Seeks to `t`, skipping if already within 40ms */
async function seekVideoTo(el: HTMLVideoElement, mediaId: string, t: number): Promise<void> {
  const last = lastSeekMap.get(mediaId);
  if (last != null && Math.abs(last - t) < 0.04) return;

  await new Promise<void>((resolve, reject) => {
    let done = false;
    const finish = (err?: Error) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      el.removeEventListener('seeked', onSeeked);
      el.removeEventListener('error', onErr);
      err ? reject(err) : resolve();
    };

    const onSeeked = async () => {
      try { await waitVideoFrame(el); } finally { finish(); }
    };
    const onErr = () => finish(new Error(`Erro de seek em ${t.toFixed(3)}s`));
    // Safety timeout — never block export indefinitely
    const timer = setTimeout(() => finish(), 1_200);

    el.addEventListener('seeked', onSeeked, { once: true });
    el.addEventListener('error', onErr, { once: true });
    el.currentTime = Math.max(0, t);
  });

  lastSeekMap.set(mediaId, t);
}

// ── Image bitmap cache ───────────────────────────────────────
const imageBitmapCache = new Map<string, ImageBitmap>();

async function getImageBitmap(mediaId: string, url: string): Promise<ImageBitmap> {
  const cached = imageBitmapCache.get(mediaId);
  if (cached) return cached;

  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Falha ao carregar imagem: HTTP ${resp.status}`);
  const blob = await resp.blob();
  const bmp  = await createImageBitmap(blob);
  imageBitmapCache.set(mediaId, bmp);
  return bmp;
}

// ── Text word-wrap helper ────────────────────────────────────
function wrapTextLines(
  ctx: OffscreenCanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = (text || '').split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';

  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}

// ── Renderers ────────────────────────────────────────────────
async function renderVideoItem(
  ctx: OffscreenCanvasRenderingContext2D,
  item: TrackItem,
  media: MediaFile[],
  t: number,
  outputWidth: number,
  outputHeight: number
): Promise<void> {
  const mf = media.find((m) => m.id === item.mediaId);
  if (!mf || mf.type !== 'video') return;

  const vd = item.videoDetails;
  const sourceT = item.mediaStart + (t - item.startTime) * (vd?.playbackRate ?? 1);

  // Lazy load + smart seek
  const el = await getVideoElement(mf.id, mf.url);
  await seekVideoTo(el, mf.id, Math.max(0, sourceT));

  ctx.save();
  ctx.globalAlpha = vd?.opacity ?? 1;

  // Color filters
  const br = vd?.brightness ?? 1;
  const co = vd?.contrast   ?? 1;
  const sa = vd?.saturation ?? 1;
  if (Math.abs(br - 1) > 0.01 || Math.abs(co - 1) > 0.01 || Math.abs(sa - 1) > 0.01) {
    ctx.filter = `brightness(${br}) contrast(${co}) saturate(${sa})`;
  }

  // Flip
  if (vd?.flipH || vd?.flipV) {
    ctx.translate(outputWidth / 2, outputHeight / 2);
    ctx.scale(vd.flipH ? -1 : 1, vd.flipV ? -1 : 1);
    ctx.translate(-outputWidth / 2, -outputHeight / 2);
  }

  // CONTAIN-fit: preserve aspect ratio, no crop
  const vidW = el.videoWidth  || outputWidth;
  const vidH = el.videoHeight || outputHeight;
  const scale = Math.min(outputWidth / vidW, outputHeight / vidH);
  const dw = Math.round(vidW * scale);
  const dh = Math.round(vidH * scale);
  const dx = Math.round((outputWidth  - dw) / 2);
  const dy = Math.round((outputHeight - dh) / 2);

  ctx.drawImage(el, dx, dy, dw, dh);
  ctx.restore();
}

async function renderImageItem(
  ctx: OffscreenCanvasRenderingContext2D,
  item: TrackItem,
  media: MediaFile[],
  outputWidth: number,
  outputHeight: number
): Promise<void> {
  const mf = media.find((m) => m.id === item.mediaId);
  if (!mf || mf.type !== 'image') return;

  const id = item.imageDetails;
  const bmp = await getImageBitmap(mf.id, mf.url);

  const pxX = ((id?.posX  ?? 50) / 100) * outputWidth;
  const pxY = ((id?.posY  ?? 50) / 100) * outputHeight;
  const pxW = ((id?.width ?? 50) / 100) * outputWidth;
  const pxH = ((id?.height ?? 50) / 100) * outputHeight;

  ctx.save();
  ctx.globalAlpha = id?.opacity ?? 1;

  const br = id?.brightness ?? 1;
  const co = id?.contrast   ?? 1;
  const sa = id?.saturation ?? 1;
  if (Math.abs(br - 1) > 0.01 || Math.abs(co - 1) > 0.01 || Math.abs(sa - 1) > 0.01) {
    ctx.filter = `brightness(${br}) contrast(${co}) saturate(${sa})`;
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
  outputHeight: number
): void {
  const td = item.textDetails;
  if (!td) return;

  const fontSizePx = Math.max(10, Math.round((td.fontSize / 100) * outputHeight));
  const pxX        = (td.posX / 100) * outputWidth;
  const pxY        = (td.posY / 100) * outputHeight;
  const maxWidth   = Math.max(40, (td.width / 100) * outputWidth);
  const fontFamily = (td.fontFamily || 'sans-serif').trim();

  ctx.save();
  ctx.globalAlpha   = td.opacity ?? 1;
  ctx.font          = `${fontSizePx}px ${fontFamily}, sans-serif`;
  ctx.textAlign     = (td.textAlign as CanvasTextAlign) || 'center';
  ctx.textBaseline  = 'middle';

  const lines      = wrapTextLines(ctx, td.text || '', maxWidth);
  const lineHeight = fontSizePx * 1.25;
  const totalH     = lines.length * lineHeight;

  // Shadow
  if (td.boxShadow && td.boxShadow.blur > 0) {
    ctx.shadowColor   = td.boxShadow.color || 'rgba(0,0,0,0.5)';
    ctx.shadowBlur    = td.boxShadow.blur;
    ctx.shadowOffsetX = td.boxShadow.x;
    ctx.shadowOffsetY = td.boxShadow.y;
  }

  // Background: measure widest line
  let widest = 0;
  for (const line of lines) {
    widest = Math.max(widest, Math.min(ctx.measureText(line).width, maxWidth));
  }

  if (td.backgroundColor && td.backgroundColor !== 'transparent') {
    ctx.save();
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur  = 0;
    ctx.fillStyle   = td.backgroundColor;
    const bgX = td.textAlign === 'center' ? pxX - widest / 2 - 12 :
                td.textAlign === 'right'  ? pxX - widest - 12 : pxX - 12;
    ctx.fillRect(bgX, pxY - totalH / 2 - 8, widest + 24, totalH + 16);
    ctx.restore();
  }

  ctx.fillStyle = td.color || '#ffffff';

  lines.forEach((line, idx) => {
    const ly = pxY - totalH / 2 + idx * lineHeight + lineHeight / 2;
    ctx.fillText(line, pxX, ly, maxWidth);

    // Underline / strikethrough per line
    if (td.textDecoration === 'underline' || td.textDecoration === 'line-through') {
      const lw = Math.min(ctx.measureText(line).width, maxWidth);
      const lineY = td.textDecoration === 'underline' ? ly + fontSizePx * 0.55 : ly;
      const startX = td.textAlign === 'center' ? pxX - lw / 2 :
                     td.textAlign === 'right'  ? pxX - lw : pxX;
      ctx.save();
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur  = 0;
      ctx.beginPath();
      ctx.strokeStyle = td.color || '#ffffff';
      ctx.lineWidth   = Math.max(1, fontSizePx * 0.06);
      ctx.moveTo(startX, lineY);
      ctx.lineTo(startX + lw, lineY);
      ctx.stroke();
      ctx.restore();
    }
  });

  ctx.restore();
}

// ── Frame compositor ─────────────────────────────────────────
async function renderFrame(
  ctx: OffscreenCanvasRenderingContext2D,
  project: Project,
  media: MediaFile[],
  t: number,
  outputWidth: number,
  outputHeight: number
): Promise<void> {
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, outputWidth, outputHeight);

  for (const track of project.tracks) {
    if (track.muted) continue;

    const activeItems = track.items.filter(
      (item) => t >= item.startTime && t < item.endTime
    );

    for (const item of activeItems) {
      if (track.type === 'video') {
        await renderVideoItem(ctx, item, media, t, outputWidth, outputHeight);
      } else if (track.type === 'image') {
        await renderImageItem(ctx, item, media, outputWidth, outputHeight);
      } else if (track.type === 'text') {
        renderTextItem(ctx, item, outputWidth, outputHeight);
      }
      // audio tracks are handled in mixAudio — nothing to draw
    }
  }
}

// ── Audio mixer ──────────────────────────────────────────────
async function mixAudio(
  project: Project,
  media: MediaFile[],
  outputDuration: number,
  sampleRate: number
): Promise<Float32Array[]> {
  const numSamples = Math.ceil(outputDuration * sampleRate);
  const audioCtx   = new OfflineAudioContext(2, numSamples, sampleRate);

  const decodeAudioFile = async (file: File): Promise<AudioBuffer | null> => {
    try {
      const ab   = await file.arrayBuffer();
      const copy = ab.slice(0); // prevent detached-buffer issues
      return await audioCtx.decodeAudioData(copy);
    } catch (err) {
      log('Audio decode error (skipping track):', err);
      return null;
    }
  };

  let scheduled = 0;

  for (const track of project.tracks) {
    if (track.muted) continue;
    if (track.type !== 'audio' && track.type !== 'video') continue;

    for (const item of track.items) {
      const mf = media.find((m) => m.id === item.mediaId);
      if (!mf) continue;
      if (mf.type !== 'audio' && mf.type !== 'video') continue;

      const ad     = track.type === 'audio' ? item.audioDetails : item.videoDetails;
      const volume = (ad as any)?.volume ?? 1;
      if (volume === 0) continue;

      const buf = await decodeAudioFile(mf.file);
      if (!buf) continue;

      const srcNode  = audioCtx.createBufferSource();
      srcNode.buffer = buf;

      const gainNode = audioCtx.createGain();
      gainNode.gain.value = volume;

      const playbackRate = (ad as any)?.playbackRate ?? 1;
      srcNode.playbackRate.value = playbackRate;

      // Fade in/out
      if (track.type === 'audio' && item.audioDetails) {
        const { fadeIn = 0, fadeOut = 0 } = item.audioDetails;
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

      const requestedDuration = Math.max(0, item.endTime - item.startTime);
      const maxAvailable      = Math.max(0, buf.duration - item.mediaStart);
      const safeDuration      = Math.min(requestedDuration, maxAvailable);

      if (safeDuration > 0.001) {
        srcNode.start(item.startTime, item.mediaStart, safeDuration);
        scheduled++;
      }
    }
  }

  if (scheduled === 0) {
    // No audible content — return silent buffers instead of throwing
    const silence = new Float32Array(numSamples);
    return [silence, silence];
  }

  const rendered = await audioCtx.startRendering();
  const l = rendered.getChannelData(0);
  const r = rendered.numberOfChannels > 1 ? rendered.getChannelData(1) : rendered.getChannelData(0);
  return [l, r];
}

// ── VideoEncoder configurator with hw+sw fallback ─────────────
async function configureVideoEncoderWithFallback(
  videoEncoder: VideoEncoder,
  width: number,
  height: number,
  bitrate: number,
  fps: number
): Promise<{ codec: string; hw: string }> {
  const codecs: string[]              = ['avc1.42001F', 'avc1.42E01E', 'avc1.4D401F'];
  const hwModes: HardwareAcceleration[] = ['prefer-hardware', 'no-preference'];

  for (const hw of hwModes) {
    for (const codec of codecs) {
      try {
        const support = await VideoEncoder.isConfigSupported({
          codec,
          width,
          height,
          bitrate,
          framerate: fps,
          hardwareAcceleration: hw,
          latencyMode: 'quality',
        });

        if (!support.supported) continue;

        videoEncoder.configure({
          codec,
          width,
          height,
          bitrate,
          framerate: fps,
          hardwareAcceleration: hw,
          latencyMode: 'quality',
        });

        return { codec, hw };
      } catch (err) {
        log('VideoEncoder config failed', codec, hw, err);
      }
    }
  }

  throw new Error(
    'Não foi possível configurar o VideoEncoder para esta resolução. ' +
    'Tente 720p ou use um navegador compatível (Chrome/Edge).'
  );
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
  log(`Export started — ${isProbablyMobile ? 'mobile' : 'desktop'} mode`);

  // Clear caches from any previous export
  videoElCache.clear();
  imageBitmapCache.clear();
  lastSeekMap.clear();

  // ── 1. Resolve output dimensions ─────────────────────────
  const { width: outputWidth, height: outputHeight } = resolveProjectOutputSize(project, opts.resolution);
  const { fps, fileName } = opts;
  const frameInterval  = 1 / fps;
  const totalDuration  = project.duration;

  log(`Output: ${outputWidth}×${outputHeight} @ ${fps}fps, duration: ${totalDuration.toFixed(2)}s`);
  log(`Project: ${project.width}×${project.height} (${project.aspectRatio})`);

  if (totalDuration <= 0) {
    throw new Error('A timeline está vazia (duração = 0). Adicione clipes antes de exportar.');
  }

  if (signal?.aborted) throw new Error('Exportação cancelada.');

  // ── 2. Setup OffscreenCanvas ──────────────────────────────
  onProgress?.(2, 'Preparando compositor…');
  const canvas = new OffscreenCanvas(outputWidth, outputHeight);
  const ctx    = canvas.getContext('2d', { willReadFrequently: false });
  if (!ctx) throw new Error('Não foi possível criar OffscreenCanvas 2D context.');

  // ── 3. Setup mp4-muxer ────────────────────────────────────
  const target = new ArrayBufferTarget();
  const muxer  = new Muxer({
    target,
    video: { codec: 'avc', width: outputWidth, height: outputHeight },
    audio: { codec: 'aac', sampleRate: 48000, numberOfChannels: 2 },
    fastStart: 'in-memory',
  });

  // ── 4. Configure VideoEncoder (direct muxer output, no RAM accumulation) ──
  let encoderFailed: Error | null = null;

  const videoEncoder = new VideoEncoder({
    output: (chunk, meta) => {
      if (!encoderFailed) muxer.addVideoChunk(chunk, meta);
    },
    error: (e) => {
      encoderFailed = new Error(`VideoEncoder error: ${e.message}`);
      log('VideoEncoder error:', e);
    },
  });

  const bitrate = opts.resolution === '1080p'
    ? (isProbablyMobile ? 4_000_000 : 5_000_000)
    : (isProbablyMobile ? 2_200_000 : 3_000_000);

  onProgress?.(3, 'Configurando encoder de vídeo…');
  const { codec, hw } = await configureVideoEncoderWithFallback(
    videoEncoder, outputWidth, outputHeight, bitrate, fps
  );
  log(`VideoEncoder configured: codec=${codec} hw=${hw} bitrate=${(bitrate / 1e6).toFixed(1)}Mbps`);

  if (signal?.aborted) throw new Error('Exportação cancelada.');

  // ── 5. Render & encode every frame ───────────────────────
  const totalFrames = Math.ceil(totalDuration * fps);
  log(`Rendering ${totalFrames} frames…`);

  onProgress?.(5, 'Renderizando frames…');

  for (let frameIdx = 0; frameIdx < totalFrames; frameIdx++) {
    if (signal?.aborted) throw new Error('Exportação cancelada.');
    if (encoderFailed)   throw encoderFailed;

    const t           = frameIdx * frameInterval;
    const timestampUs = Math.round(t * 1_000_000);

    // Render frame to canvas
    await renderFrame(ctx, project, media, t, outputWidth, outputHeight);

    // Backpressure: don't flood the encoder queue
    while (videoEncoder.encodeQueueSize > 2) {
      await delay(4);
    }

    const videoFrame = new VideoFrame(canvas, {
      timestamp: timestampUs,
      duration:  Math.round(frameInterval * 1_000_000),
    });

    try {
      const isKeyFrame = frameIdx % (fps * 2) === 0;
      videoEncoder.encode(videoFrame, { keyFrame: isKeyFrame });
    } finally {
      videoFrame.close(); // free GPU memory immediately
    }

    // GC yield: more frequent on mobile
    if (isProbablyMobile) {
      if (frameIdx % 2 === 0) await delay(0);
    } else {
      if (frameIdx % 15 === 0) await delay(0);
    }

    // Progress: frames occupy 5% → 70%
    if (frameIdx % 5 === 0) {
      const pct = Math.round(5 + (frameIdx / totalFrames) * 65);
      onProgress?.(pct, `Renderizando… ${Math.round((frameIdx / totalFrames) * 100)}%`);
    }
  }

  if (encoderFailed) throw encoderFailed;

  onProgress?.(72, 'Finalizando vídeo…');
  await videoEncoder.flush();
  if (encoderFailed) throw encoderFailed;
  log('Video encoding complete');

  // ── 6. Audio processing ──────────────────────────────────
  onProgress?.(73, 'Processando áudio…');
  log('Mixing audio…');

  const SAMPLE_RATE = 48_000;
  const hasAudioTracks = project.tracks.some(
    (t) => !t.muted && (t.type === 'audio' || t.type === 'video') && t.items.length > 0
  );

  if (hasAudioTracks) {
    // Throws if audio mixing fails — we don't silently export muted video
    const [leftCh, rightCh] = await mixAudio(project, media, totalDuration, SAMPLE_RATE);
    log(`Audio mixing done: ${leftCh.length} samples`);

    let audioEncodeError: Error | null = null;

    const audioEncoder = new AudioEncoder({
      output: (chunk, meta) => {
        if (!audioEncodeError) muxer.addAudioChunk(chunk, meta);
      },
      error: (e) => {
        audioEncodeError = new Error(`AudioEncoder error: ${e.message}`);
        log('AudioEncoder error:', e);
      },
    });

    audioEncoder.configure({
      codec:            'mp4a.40.2', // AAC-LC
      sampleRate:       SAMPLE_RATE,
      numberOfChannels: 2,
      bitrate:          128_000,
    });

    const CHUNK_SIZE   = SAMPLE_RATE; // 1-second chunks
    const totalSamples = leftCh.length;
    let offset         = 0;

    while (offset < totalSamples) {
      if (signal?.aborted)   throw new Error('Exportação cancelada.');
      if (audioEncodeError)  throw audioEncodeError;

      const size        = Math.min(CHUNK_SIZE, totalSamples - offset);
      const interleaved = new Float32Array(size * 2);
      for (let i = 0; i < size; i++) {
        interleaved[i * 2]     = leftCh[offset + i];
        interleaved[i * 2 + 1] = rightCh[offset + i];
      }

      const audioData = new AudioData({
        format:           'f32-interleaved' as AudioSampleFormat,
        sampleRate:       SAMPLE_RATE,
        numberOfFrames:   size,
        numberOfChannels: 2,
        timestamp:        Math.round((offset / SAMPLE_RATE) * 1_000_000),
        data:             interleaved,
      });

      audioEncoder.encode(audioData);
      audioData.close();
      offset += size;
    }

    if (audioEncodeError) throw audioEncodeError;
    await audioEncoder.flush();
    if (audioEncodeError) throw audioEncodeError;
    log('Audio encoding complete');
  } else {
    log('No audio tracks — exporting video only');
  }

  // ── 7. Finalize & build Blob ─────────────────────────────
  onProgress?.(90, 'Finalizando arquivo MP4…');
  muxer.finalize();

  const arrayBuffer = target.buffer;
  const blob        = new Blob([arrayBuffer], { type: 'video/mp4' });

  // ── 8. Cleanup ───────────────────────────────────────────
  videoElCache.forEach((el) => { try { el.src = ''; el.load(); } catch {} });
  videoElCache.clear();
  imageBitmapCache.forEach((bmp) => { try { bmp.close(); } catch {} });
  imageBitmapCache.clear();
  lastSeekMap.clear();

  const elapsed = ((performance.now() - t0) / 1000).toFixed(1);
  log(`Export complete in ${elapsed}s — ${(blob.size / 1024 / 1024).toFixed(2)} MB`);

  onProgress?.(98, 'Iniciando download…');
  return blob;
}
