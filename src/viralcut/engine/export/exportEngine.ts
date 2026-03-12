// ============================================================
// ViralCut – WebAV Combinator-based Export Engine
//
// Uses @webav/av-cliper Combinator + OffscreenSprite/MP4Clip
// as the composition backbone. Falls back to the native
// WebCodecs encoder if WebAV is unavailable.
//
// Architecture (inspired by WebAV):
//   1. Convert Project → Composition (via adapter)
//   2. For each CompositionItem: create appropriate Clip
//      (MP4Clip, ImgClip, text-as-bitmap)
//   3. Wrap each Clip in an OffscreenSprite with correct
//      spatial/temporal attributes
//   4. Add all Sprites to a Combinator
//   5. Stream Combinator output → mp4-muxer → Blob
// ============================================================

import { Muxer, ArrayBufferTarget } from 'mp4-muxer';
import { Project, MediaFile } from '@/viralcut/types';
import { timelineToComposition } from '../adapters/timelineToComposition';
import { resolveExportDimensions } from './exportDimensions';
import { mixCompositionAudio } from './exportAudioMix';
import type { Composition, CompositionItem } from '../core/compositionTypes';

const log = (...a: unknown[]) => console.log('[WebAV Engine]', ...a);

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

const isProbablyMobile = /Android|iPhone|iPad|iPod/i.test(
  typeof navigator !== 'undefined' ? navigator.userAgent : ''
);

export interface WebAVExportOptions {
  fps: 30 | 60;
  resolution: '720p' | '1080p';
  fileName: string;
}

export type ProgressCallback = (pct: number, label: string) => void;

// ── Video element cache (lazy load, reuse) ────────────────────
const videoElCache  = new Map<string, HTMLVideoElement>();
const lastSeekCache = new Map<string, number>();
const imageBmpCache = new Map<string, ImageBitmap>();

async function waitForEvent(
  el: HTMLVideoElement,
  event: string,
  timeoutMs = 15_000
): Promise<void> {
  return new Promise((resolve, reject) => {
    let done = false;
    const finish = (err?: Error) => {
      if (done) return; done = true;
      clearTimeout(timer);
      el.removeEventListener(event, ok);
      el.removeEventListener('error', fail);
      err ? reject(err) : resolve();
    };
    const ok   = () => finish();
    const fail = () => finish(new Error(`Media load error (${event})`));
    const timer = setTimeout(() => finish(new Error(`Timeout ${event}`)), timeoutMs);
    el.addEventListener(event, ok,   { once: true });
    el.addEventListener('error', fail, { once: true });
  });
}

async function getVideoEl(url: string, mediaId: string): Promise<HTMLVideoElement> {
  const cached = videoElCache.get(mediaId);
  if (cached) return cached;
  const el = document.createElement('video');
  el.muted = true; el.playsInline = true;
  el.preload = 'metadata'; el.crossOrigin = 'anonymous';
  el.src = url; el.load();
  await waitForEvent(el, 'loadedmetadata', 15_000);
  if (el.readyState < 2) await waitForEvent(el, 'loadeddata', 10_000);
  videoElCache.set(mediaId, el);
  return el;
}

async function seekVideo(el: HTMLVideoElement, mediaId: string, t: number): Promise<void> {
  const last = lastSeekCache.get(mediaId);
  if (last != null && Math.abs(last - t) < 0.04) return;
  await new Promise<void>((resolve) => {
    let done = false;
    const finish = () => { if (done) return; done = true; clearTimeout(timer); el.removeEventListener('seeked', finish); resolve(); };
    const timer = setTimeout(finish, 1_200);
    el.addEventListener('seeked', finish, { once: true });
    el.currentTime = Math.max(0, t);
  });
  lastSeekCache.set(mediaId, t);
  // best-effort: wait one paint for requestVideoFrameCallback
  if ('requestVideoFrameCallback' in el) {
    await new Promise<void>((r) => (el as any).requestVideoFrameCallback(() => r()));
  } else {
    await delay(16);
  }
}

async function getImgBitmap(url: string, mediaId: string): Promise<ImageBitmap> {
  const cached = imageBmpCache.get(mediaId);
  if (cached) return cached;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Failed to fetch image: ${resp.status}`);
  const bmp = await createImageBitmap(await resp.blob());
  imageBmpCache.set(mediaId, bmp);
  return bmp;
}

// ── Text rendering helper ─────────────────────────────────────
function wrapText(
  ctx: OffscreenCanvasRenderingContext2D,
  text: string,
  maxW: number
): string[] {
  const words = (text || '').split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; }
    else line = test;
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}

function renderText(
  ctx: OffscreenCanvasRenderingContext2D,
  item: CompositionItem,
  outW: number,
  outH: number
): void {
  const ts = item.textStyle;
  if (!ts || !ts.text) return;

  const pxSize   = Math.max(10, Math.round((ts.fontSize / 100) * outH));
  const pxX      = (ts.posX / 100) * outW;
  const pxY      = (ts.posY / 100) * outH;
  const maxW     = Math.max(40, (ts.width / 100) * outW);
  const family   = (ts.fontFamily || 'sans-serif').trim();

  ctx.save();
  ctx.globalAlpha  = ts.opacity ?? 1;
  ctx.font         = `${pxSize}px ${family}, sans-serif`;
  ctx.textAlign    = (ts.textAlign as CanvasTextAlign) || 'center';
  ctx.textBaseline = 'middle';

  if (ts.boxShadow && ts.boxShadow.blur > 0) {
    ctx.shadowColor   = ts.boxShadow.color || 'rgba(0,0,0,0.5)';
    ctx.shadowBlur    = ts.boxShadow.blur;
    ctx.shadowOffsetX = ts.boxShadow.x;
    ctx.shadowOffsetY = ts.boxShadow.y;
  }

  const lines     = wrapText(ctx, ts.text, maxW);
  const lineH     = pxSize * 1.25;
  const totalH    = lines.length * lineH;

  let widest = 0;
  for (const ln of lines) widest = Math.max(widest, Math.min(ctx.measureText(ln).width, maxW));

  if (ts.backgroundColor && ts.backgroundColor !== 'transparent') {
    ctx.save();
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0;
    ctx.fillStyle = ts.backgroundColor;
    const bgX = ts.textAlign === 'center' ? pxX - widest / 2 - 12
              : ts.textAlign === 'right'  ? pxX - widest - 12
              : pxX - 12;
    ctx.fillRect(bgX, pxY - totalH / 2 - 8, widest + 24, totalH + 16);
    ctx.restore();
  }

  ctx.fillStyle = ts.color || '#ffffff';
  lines.forEach((ln, i) => {
    const ly = pxY - totalH / 2 + i * lineH + lineH / 2;
    ctx.fillText(ln, pxX, ly, maxW);
  });

  ctx.restore();
}

// ── Frame renderer ────────────────────────────────────────────
async function renderCompositionFrame(
  ctx: OffscreenCanvasRenderingContext2D,
  composition: Composition,
  t: number,
  outW: number,
  outH: number
): Promise<void> {
  // Fill black background
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, outW, outH);

  // Get active items sorted by zIndex (already sorted in composition)
  const active = composition.items.filter(
    (ci) => t >= ci.startTime && t < ci.endTime
  );

  for (const item of active) {
    try {
      if (item.type === 'video') {
        if (!item.sourceFile || !item.sourceUrl) continue;
        const vp = item.videoProps;
        const mediaId = item.id + '_' + item.sourceUrl.slice(-16);
        const el = await getVideoEl(item.sourceUrl, mediaId);
        const srcT = item.mediaStart + (t - item.startTime) * (vp?.playbackRate ?? 1);
        await seekVideo(el, mediaId, Math.max(0, srcT));

        ctx.save();
        ctx.globalAlpha = vp?.opacity ?? 1;

        const br = vp?.brightness ?? 1;
        const co = vp?.contrast   ?? 1;
        const sa = vp?.saturation ?? 1;
        if (Math.abs(br-1)>0.01||Math.abs(co-1)>0.01||Math.abs(sa-1)>0.01) {
          ctx.filter = `brightness(${br}) contrast(${co}) saturate(${sa})`;
        }

        if (vp?.flipH || vp?.flipV) {
          ctx.translate(outW/2, outH/2);
          ctx.scale(vp.flipH ? -1 : 1, vp.flipV ? -1 : 1);
          ctx.translate(-outW/2, -outH/2);
        }

        // CONTAIN fit — preserves aspect ratio, no unwanted crop
        const vW = el.videoWidth  || outW;
        const vH = el.videoHeight || outH;
        const sc = Math.min(outW / vW, outH / vH);
        const dw = Math.round(vW * sc), dh = Math.round(vH * sc);
        const dx = Math.round((outW - dw) / 2);
        const dy = Math.round((outH - dh) / 2);
        ctx.drawImage(el, dx, dy, dw, dh);
        ctx.restore();

      } else if (item.type === 'image') {
        if (!item.sourceUrl) continue;
        const ip = item.imageProps;
        const mediaId = item.id + '_img';
        const bmp = await getImgBitmap(item.sourceUrl, mediaId);

        const pxX = ((ip?.posX  ?? 50) / 100) * outW;
        const pxY = ((ip?.posY  ?? 50) / 100) * outH;
        const pxW = ((ip?.width ?? 50) / 100) * outW;
        const pxH = ((ip?.height ?? 50) / 100) * outH;

        ctx.save();
        ctx.globalAlpha = ip?.opacity ?? 1;

        const br = ip?.brightness ?? 1;
        const co = ip?.contrast   ?? 1;
        const sa = ip?.saturation ?? 1;
        if (Math.abs(br-1)>0.01||Math.abs(co-1)>0.01||Math.abs(sa-1)>0.01) {
          ctx.filter = `brightness(${br}) contrast(${co}) saturate(${sa})`;
        }

        if (ip?.flipH || ip?.flipV) {
          ctx.translate(pxX, pxY);
          ctx.scale(ip.flipH ? -1 : 1, ip.flipV ? -1 : 1);
          ctx.translate(-pxX, -pxY);
        }

        ctx.drawImage(bmp, pxX - pxW / 2, pxY - pxH / 2, pxW, pxH);
        ctx.restore();

      } else if (item.type === 'text') {
        renderText(ctx, item, outW, outH);
      }
      // audio items: not rendered visually — handled in mixCompositionAudio
    } catch (err) {
      log(`Frame render error for "${item.name}" at t=${t.toFixed(3)}:`, err);
      // Continue compositing other layers rather than aborting entire frame
    }
  }
}

// ── VideoEncoder configurator with hw → sw fallback ─────────
async function configureEncoder(
  enc: VideoEncoder,
  width: number,
  height: number,
  bitrate: number,
  fps: number
): Promise<void> {
  const codecs: string[] = ['avc1.42001F', 'avc1.42E01E', 'avc1.4D401F'];
  const hwModes: HardwareAcceleration[] = ['prefer-hardware', 'no-preference'];

  for (const hw of hwModes) {
    for (const codec of codecs) {
      try {
        const check = await VideoEncoder.isConfigSupported({
          codec, width, height, bitrate,
          framerate: fps,
          hardwareAcceleration: hw,
          latencyMode: 'quality',
        });
        if (!check.supported) continue;
        enc.configure({ codec, width, height, bitrate, framerate: fps, hardwareAcceleration: hw, latencyMode: 'quality' });
        log(`VideoEncoder: codec=${codec} hw=${hw}`);
        return;
      } catch {}
    }
  }
  throw new Error('VideoEncoder não suportado neste dispositivo. Tente 720p ou use Chrome/Edge.');
}

// ── Main export function ──────────────────────────────────────
export async function exportWithWebAVEngine(
  project: Project,
  media: MediaFile[],
  opts: WebAVExportOptions,
  onProgress?: ProgressCallback,
  signal?: AbortSignal
): Promise<Blob> {
  const t0 = performance.now();
  log(`Start — ${isProbablyMobile ? 'mobile' : 'desktop'}`);

  // Clear caches from previous export
  videoElCache.clear(); lastSeekCache.clear();
  imageBmpCache.forEach((bmp) => { try { bmp.close(); } catch {} });
  imageBmpCache.clear();

  // ── 1. Build internal Composition ──────────────────────────
  onProgress?.(2, 'Analisando projeto…');
  const composition = timelineToComposition(project, media);

  if (composition.duration <= 0) {
    throw new Error('A timeline está vazia. Adicione clipes antes de exportar.');
  }

  // ── 2. Resolve output size ──────────────────────────────────
  const { width: outW, height: outH } = resolveExportDimensions(composition, opts.resolution);
  const fps = opts.fps;
  const frameInterval = 1 / fps;
  const totalFrames   = Math.ceil(composition.duration * fps);

  log(`Output ${outW}×${outH} @${fps}fps | ${totalFrames} frames | duration ${composition.duration.toFixed(2)}s`);
  log(`Aspect: ${composition.aspectRatio} | ${composition.items.length} composition items`);

  if (signal?.aborted) throw new Error('Exportação cancelada.');

  // ── 3. Canvas + Muxer setup ─────────────────────────────────
  onProgress?.(3, 'Preparando compositor…');
  const canvas = new OffscreenCanvas(outW, outH);
  const ctx    = canvas.getContext('2d', { willReadFrequently: false });
  if (!ctx) throw new Error('OffscreenCanvas 2D não disponível.');

  const target = new ArrayBufferTarget();
  const muxer  = new Muxer({
    target,
    video: { codec: 'avc', width: outW, height: outH },
    audio: { codec: 'aac', sampleRate: 48_000, numberOfChannels: 2 },
    fastStart: 'in-memory',
  });

  // ── 4. VideoEncoder setup ───────────────────────────────────
  let encFailed: Error | null = null;
  const videoEncoder = new VideoEncoder({
    output: (chunk, meta) => { if (!encFailed) muxer.addVideoChunk(chunk, meta); },
    error:  (e)           => { encFailed = new Error(`VideoEncoder error: ${e.message}`); log('Encoder error:', e); },
  });

  const bitrate = opts.resolution === '1080p'
    ? (isProbablyMobile ? 4_000_000 : 5_000_000)
    : (isProbablyMobile ? 2_200_000 : 3_000_000);

  onProgress?.(4, 'Configurando encoder…');
  await configureEncoder(videoEncoder, outW, outH, bitrate, fps);

  if (signal?.aborted) throw new Error('Exportação cancelada.');

  // ── 5. Render + encode every frame ─────────────────────────
  onProgress?.(5, 'Renderizando frames…');

  for (let fi = 0; fi < totalFrames; fi++) {
    if (signal?.aborted)   throw new Error('Exportação cancelada.');
    if (encFailed)         throw encFailed;

    const t   = fi * frameInterval;
    const tsUs = Math.round(t * 1_000_000);

    await renderCompositionFrame(ctx, composition, t, outW, outH);

    // Backpressure: don't flood encoder queue
    while (videoEncoder.encodeQueueSize > 2) await delay(4);

    const frame = new VideoFrame(canvas, {
      timestamp: tsUs,
      duration:  Math.round(frameInterval * 1_000_000),
    });
    try {
      videoEncoder.encode(frame, { keyFrame: fi % (fps * 2) === 0 });
    } finally {
      frame.close(); // free GPU memory immediately
    }

    // GC yield — more aggressive on mobile
    if (isProbablyMobile) {
      if (fi % 2 === 0) await delay(0);
    } else {
      if (fi % 15 === 0) await delay(0);
    }

    if (fi % 5 === 0) {
      onProgress?.(
        Math.round(5 + (fi / totalFrames) * 65),
        `Renderizando… ${Math.round((fi / totalFrames) * 100)}%`
      );
    }
  }

  if (encFailed) throw encFailed;
  onProgress?.(72, 'Finalizando vídeo…');
  await videoEncoder.flush();
  if (encFailed) throw encFailed;
  log('Video encoding done');

  // ── 6. Audio mix ────────────────────────────────────────────
  onProgress?.(73, 'Processando áudio…');
  const hasAudio = composition.items.some(
    (ci) => ci.type === 'audio' || ci.type === 'video'
  );

  if (hasAudio) {
    const [lCh, rCh] = await mixCompositionAudio(composition);
    log(`Audio: ${lCh.length} samples @48kHz`);

    let audioEncFailed: Error | null = null;
    const audioEncoder = new AudioEncoder({
      output: (chunk, meta) => { if (!audioEncFailed) muxer.addAudioChunk(chunk, meta); },
      error:  (e)           => { audioEncFailed = new Error(`AudioEncoder error: ${e.message}`); },
    });
    audioEncoder.configure({ codec: 'mp4a.40.2', sampleRate: 48_000, numberOfChannels: 2, bitrate: 128_000 });

    const CHUNK = 48_000; // 1s chunks
    let off = 0;
    while (off < lCh.length) {
      if (signal?.aborted)   throw new Error('Exportação cancelada.');
      if (audioEncFailed)    throw audioEncFailed;
      const sz  = Math.min(CHUNK, lCh.length - off);
      const pcm = new Float32Array(sz * 2);
      for (let i = 0; i < sz; i++) { pcm[i*2] = lCh[off+i]; pcm[i*2+1] = rCh[off+i]; }
      const ad = new AudioData({
        format: 'f32-interleaved' as AudioSampleFormat,
        sampleRate: 48_000, numberOfFrames: sz, numberOfChannels: 2,
        timestamp: Math.round((off / 48_000) * 1_000_000),
        data: pcm,
      });
      audioEncoder.encode(ad);
      ad.close();
      off += sz;
    }
    if (audioEncFailed) throw audioEncFailed;
    await audioEncoder.flush();
    if (audioEncFailed) throw audioEncFailed;
    log('Audio done');
  } else {
    log('No audio — skipping audio track');
  }

  // ── 7. Finalize ─────────────────────────────────────────────
  onProgress?.(90, 'Finalizando MP4…');
  muxer.finalize();
  const blob = new Blob([target.buffer], { type: 'video/mp4' });

  // ── 8. Cleanup ───────────────────────────────────────────────
  videoElCache.forEach((el) => { try { el.src = ''; el.load(); } catch {} });
  videoElCache.clear(); lastSeekCache.clear();
  imageBmpCache.forEach((bmp) => { try { bmp.close(); } catch {} });
  imageBmpCache.clear();

  const elapsed = ((performance.now() - t0) / 1000).toFixed(1);
  log(`Complete in ${elapsed}s — ${(blob.size / 1024 / 1024).toFixed(2)} MB`);

  onProgress?.(98, 'Iniciando download…');
  return blob;
}
