// ============================================================
// ViralCut – Fast Export Engine (WebCodecs via @diffusionstudio/core)
//
// Architecture:
//   1. Build a core.Composition from the ViralCut project
//   2. Create a core.Encoder with the desired settings
//   3. Use showSaveFilePicker for direct-to-disk writing (no RAM blob)
//   4. Fall back to a Blob download if the File System API is unavailable
//
// Why this is faster than ffmpeg.wasm:
//   ✅ Decoding + encoding via hardware-accelerated WebCodecs
//   ✅ No virtual FS — works directly on source object URLs
//   ✅ No single-threaded WASM bottleneck
//   ✅ Texts, images, and overlays are rendered natively on Canvas2D
// ============================================================
import * as core from '@diffusionstudio/core';
import { Project, MediaFile } from '@/viralcut/types';
import { buildDiffusionComposition } from './buildDiffusionComposition';

export interface FastExportOptions {
  fps: 30 | 60;
  resolution: '720p' | '1080p';
  fileName: string;
}

const log = (...args: unknown[]) => console.log('[ViralCut FastExport]', ...args);

export async function exportTimelineFast(
  project: Project,
  media: MediaFile[],
  opts: FastExportOptions,
  onProgress?: (progress: number, label: string) => void,
  signal?: AbortSignal
): Promise<void> {
  const t0 = performance.now();
  log('Export started (WebCodecs engine)');

  onProgress?.(2, 'Construindo composição…');
  const composition = await buildDiffusionComposition(project, media);

  if (signal?.aborted) throw new Error('Exportação cancelada.');

  onProgress?.(10, 'Inicializando encoder…');

  // Resolution multiplier: 1 = original, 2 = 2x
  // For 1080p, we scale to match the project width/height (already set on composition)
  const fpsValue = opts.fps;

  const encoder = new core.Encoder(composition, {
    video: {
      fps: fpsValue,
    },
  });

  // Wire progress callback
  encoder.onProgress = (event: { progress: number; total: number }) => {
    if (!onProgress) return;
    const total = event.total || 1;
    const pct = Math.min(95, Math.round(10 + (event.progress / total) * 85));
    onProgress(pct, `Exportando… ${Math.round((event.progress / total) * 100)}%`);
  };

  // Wire abort
  if (signal) {
    signal.addEventListener('abort', () => {
      try { encoder.cancel(); } catch { /* ignore */ }
    });
  }

  const suggestedName = opts.fileName.endsWith('.mp4')
    ? opts.fileName
    : `${opts.fileName}.mp4`;

  // Try showSaveFilePicker (Chromium) → direct-to-disk, no RAM spike
  const supportsFilePicker =
    typeof window !== 'undefined' && 'showSaveFilePicker' in window;

  if (supportsFilePicker) {
    try {
      const handle = await (window as any).showSaveFilePicker({
        suggestedName,
        types: [
          {
            description: 'Arquivo de Vídeo MP4',
            accept: { 'video/mp4': ['.mp4'] },
          },
        ],
      });

      log('Using showSaveFilePicker for direct-to-disk export');
      onProgress?.(12, 'Exportando…');
      await encoder.render(handle, signal);
    } catch (err: any) {
      // User cancelled the file picker
      if (err?.name === 'AbortError') {
        throw new Error('Exportação cancelada.');
      }
      // Picker not available in this browser — fall back to blob
      log('showSaveFilePicker failed, falling back to blob:', err?.message);
      await exportWithBlobFallback(encoder, suggestedName, signal);
    }
  } else {
    log('showSaveFilePicker not available, using blob fallback');
    await exportWithBlobFallback(encoder, suggestedName, signal);
  }

  const elapsed = ((performance.now() - t0) / 1000).toFixed(1);
  log(`Export complete in ${elapsed}s`);
  onProgress?.(100, 'Download iniciado!');
}

async function exportWithBlobFallback(
  encoder: core.Encoder,
  fileName: string,
  signal?: AbortSignal
): Promise<void> {
  // When showSaveFilePicker is unavailable, render to a Blob then trigger download
  const chunks: Uint8Array[] = [];

  // render() without a file handle is not directly supported,
  // so we fall through to a WritableStream-based approach
  const writableStream = new WritableStream<Uint8Array>({
    write(chunk) {
      chunks.push(chunk);
    },
  });

  await encoder.render(writableStream as any, signal);

  const blob = new Blob(chunks, { type: 'video/mp4' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
