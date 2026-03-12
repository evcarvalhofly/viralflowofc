// ============================================================
// ViralCut – Fast Export Engine (WebCodecs via @diffusionstudio/core)
//
// Architecture:
//   1. Build a core.Composition from the ViralCut project
//   2. Create a core.Encoder with the desired settings
//   3. Use showSaveFilePicker for direct-to-disk writing (no RAM blob)
//   4. Fall back to a Blob download if the File System API is unavailable
//
// KEY FIX: encoder.render() returns ExportResult:
//   { type: 'success', data: Blob | undefined }
//   { type: 'canceled' }
//   { type: 'error', error: Error }
//
// The previous implementation NEVER checked this result — marking
// success even when encoding silently failed or was canceled.
// ============================================================
import * as core from '@diffusionstudio/core';
import { Project, MediaFile } from '@/viralcut/types';
import { buildDiffusionComposition } from './buildDiffusionComposition';
import { resolveExportDimensions } from './resolveExportDimensions';

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

  // ── Resolve output dimensions from user choice ─────────────
  const { width: outputWidth, height: outputHeight } = resolveExportDimensions(opts.resolution);
  log(`[EXPORT] selected resolution: ${opts.resolution} → ${outputWidth}×${outputHeight}`);
  log(`[EXPORT] selected fps: ${opts.fps}`);

  onProgress?.(2, 'Construindo composição…');
  const composition = await buildDiffusionComposition(project, media, {
    outputWidth,
    outputHeight,
  });

  if (signal?.aborted) throw new Error('Exportação cancelada.');

  // Verify composition has content
  const totalDuration = composition.duration;
  log(`Composition duration: ${totalDuration}s, layers: ${composition.layers.length}`);

  if (totalDuration <= 0) {
    throw new Error('A composição está vazia (duração = 0). Verifique se há clipes na timeline.');
  }

  onProgress?.(10, 'Inicializando encoder…');

  const encoder = new core.Encoder(composition, {
    video: {
      fps: opts.fps,
      // Explicit bitrate targets for each resolution to avoid bloated files
      bitrate: opts.resolution === '1080p' ? 8_000_000 : 5_000_000,
    },
    audio: {
      // AAC 128 kbps — transparent quality, small file size
      bitrate: 128_000,
    },
  });

  // Wire progress callback
  encoder.onProgress = (event: { progress: number; total: number; remaining: Date }) => {
    if (!onProgress) return;
    const total = event.total || 1;
    const pct = Math.min(95, Math.round(10 + (event.progress / total) * 85));
    const pctLabel = Math.round((event.progress / total) * 100);
    onProgress(pct, `Exportando… ${pctLabel}%`);
    log(`Progress: ${event.progress}/${total} (${pctLabel}%)`);
  };

  // Wire abort via encoder.cancel()
  let abortListener: (() => void) | null = null;
  if (signal) {
    abortListener = () => {
      log('Abort signal received — canceling encoder');
      try { encoder.cancel(); } catch { /* ignore */ }
    };
    signal.addEventListener('abort', abortListener);
  }

  const suggestedName = opts.fileName.endsWith('.mp4')
    ? opts.fileName
    : `${opts.fileName}.mp4`;

  try {
    // Try showSaveFilePicker (Chromium) → direct-to-disk, no RAM spike
    const supportsFilePicker =
      typeof window !== 'undefined' && 'showSaveFilePicker' in window;

    if (supportsFilePicker) {
      let handle: FileSystemFileHandle;
      try {
        handle = await (window as any).showSaveFilePicker({
          suggestedName,
          types: [
            {
              description: 'Arquivo de Vídeo MP4',
              accept: { 'video/mp4': ['.mp4'] },
            },
          ],
        });
      } catch (pickerErr: any) {
        if (pickerErr?.name === 'AbortError' || signal?.aborted) {
          throw new Error('Exportação cancelada.');
        }
        // User dismissed or picker not available — fall back to blob
        log('showSaveFilePicker dismissed or unavailable, falling back to blob:', pickerErr?.message);
        await exportWithBlobFallback(encoder, suggestedName, signal, onProgress);
        return;
      }

      if (signal?.aborted) throw new Error('Exportação cancelada.');

      log('Using showSaveFilePicker for direct-to-disk export');
      onProgress?.(12, 'Exportando…');

      // Safety timeout: 10 min max for direct-to-disk render
      const RENDER_TIMEOUT_MS = 10 * 60 * 1000;
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Timeout na exportação WebCodecs (travou após 10 min)')), RENDER_TIMEOUT_MS)
      );
      const result = await Promise.race([encoder.render(handle), timeoutPromise]) as Awaited<ReturnType<typeof encoder.render>>;
      log(`render() result type: ${result.type}`);

      // ── CRITICAL: validate the ExportResult ────────────────
      if (result.type === 'canceled') {
        throw new Error('Exportação cancelada.');
      }
      if (result.type === 'error') {
        throw new Error(`Falha no encoder: ${(result as any).error?.message ?? 'erro desconhecido'}`);
      }
      // type === 'success' with FileSystemFileHandle: data is undefined (written to disk)
      // We trust the file was written — no further blob validation needed
      log('Export to disk complete via showSaveFilePicker');

    } else {
      // No File System Access API — use blob fallback
      log('showSaveFilePicker not available, using blob fallback');
      await exportWithBlobFallback(encoder, suggestedName, signal, onProgress);
    }

  } finally {
    if (abortListener && signal) {
      signal.removeEventListener('abort', abortListener);
    }
  }

  const elapsed = ((performance.now() - t0) / 1000).toFixed(1);
  log(`Export complete in ${elapsed}s`);
  onProgress?.(100, 'Download iniciado!');
}

async function exportWithBlobFallback(
  encoder: core.Encoder,
  fileName: string,
  signal?: AbortSignal,
  onProgress?: (progress: number, label: string) => void,
): Promise<void> {
  log('Rendering to blob…');
  onProgress?.(12, 'Exportando…');

  // render() with no argument returns a Blob in result.data
  // Safety timeout: 10 min max
  const RENDER_TIMEOUT_MS = 10 * 60 * 1000;
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Timeout na exportação WebCodecs (travou após 10 min)')), RENDER_TIMEOUT_MS)
  );
  const result = await Promise.race([encoder.render(), timeoutPromise]) as Awaited<ReturnType<typeof encoder.render>>;
  log(`render() result type: ${result.type}`);

  if (signal?.aborted || result.type === 'canceled') {
    throw new Error('Exportação cancelada.');
  }
  if (result.type === 'error') {
    throw new Error(`Falha no encoder: ${(result as any).error?.message ?? 'erro desconhecido'}`);
  }

  // type === 'success'
  const blob = (result as { type: 'success'; data: Blob | undefined }).data;

  // ── VALIDATE the blob before triggering download ────────
  log(`Result blob size: ${blob?.size ?? 0} bytes`);

  if (!blob || blob.size <= 0) {
    throw new Error('O encoder produziu um arquivo vazio (0 bytes). A exportação falhou.');
  }

  const MIN_VALID_SIZE = 1024; // 1 KB
  if (blob.size < MIN_VALID_SIZE) {
    throw new Error(
      `O arquivo exportado é muito pequeno (${blob.size} bytes) e provavelmente está corrompido.`
    );
  }

  log(`Valid blob: ${(blob.size / 1024 / 1024).toFixed(2)} MB — triggering download`);

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
