// ============================================================
// ViralCut – FFmpeg-Native Export Engine
//
// Architecture:
//   1. Sanitize + validate the timeline
//   2. Write ALL source media to FFmpeg virtual FS
//   3. Build a single filter_complex (trim + concat + mix)
//   4. Run ONE FFmpeg command → output.mp4
//   5. Return the MP4 Blob
//
// Why this is better than MediaRecorder + canvas capture:
//   ✅ Audio/video sync is guaranteed by FFmpeg — not by JS timing
//   ✅ No seek stalls or frame drop during offline render
//   ✅ Every frame at the correct PTS — no freezes
//   ✅ No "real-time recording of a slow render" mismatch
// ============================================================

import { Project, MediaFile } from '../types';
import { sanitizeProject } from '../utils/sanitize';
import { validateProjectForFFmpegExport, EXPORT_MIN_CLIP_DURATION } from './validateProjectForFFmpegExport';
import { buildFFmpegInputs } from './buildFFmpegInputs';
import { buildFFmpegFilterComplex } from './buildFFmpegFilterComplex';

const DEBUG_EXPORT = true;
function exportLog(...args: unknown[]) {
  if (DEBUG_EXPORT) console.log('[ViralCut FFmpeg Export]', ...args);
}

export interface ExportProgressCallback {
  (progress: number, label: string): void;
}

export interface ExportOptions {
  resolution: '1080p' | '720p';
  fps: 30 | 60;
  projectName: string;
}

export async function exportTimelineWithFFmpeg(
  rawProject: Project,
  media: MediaFile[],
  opts: ExportOptions,
  onProgress: ExportProgressCallback,
  signal?: AbortSignal
): Promise<Blob> {
  const t0 = performance.now();
  exportLog('Export started (FFmpeg-native engine)');

  // ── 1. Sanitize ────────────────────────────────────────────
  onProgress(2, 'Sanitizando timeline…');
  const project = sanitizeProject(rawProject);

  // Filter micro-clips that would confuse FFmpeg
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

  const mediaMap = new Map(media.map((m) => [m.id, m]));

  // ── 2. Validate ────────────────────────────────────────────
  onProgress(4, 'Validando timeline…');
  validateProjectForFFmpegExport(cleanedProject, mediaMap);

  const totalDuration = cleanedProject.duration;
  exportLog(`Duração total: ${totalDuration.toFixed(2)}s`);

  if (signal?.aborted) throw new Error('Exportação cancelada.');

  // ── 3. Compute output dimensions ───────────────────────────
  const videoTracks = cleanedProject.tracks.filter((t) => t.type === 'video' && !t.muted);
  const allVideoItems = videoTracks.flatMap((t) => t.items).sort((a, b) => a.startTime - b.startTime);
  const allMediaItems = cleanedProject.tracks
    .filter((t) => !t.muted && (t.type === 'video' || t.type === 'audio'))
    .flatMap((t) => t.items);

  const firstMf = mediaMap.get(allVideoItems[0]?.mediaId ?? '');
  const srcW = firstMf?.width ?? 1920;
  const srcH = firstMf?.height ?? 1080;
  const targetLongSide = opts.resolution === '1080p' ? 1920 : 1280;
  const exportScale = Math.min(targetLongSide / Math.max(srcW, srcH), 1);
  const outW = Math.max(2, Math.round((srcW * exportScale) / 2) * 2);
  const outH = Math.max(2, Math.round((srcH * exportScale) / 2) * 2);
  const FPS = opts.fps;

  exportLog(`Resolução: ${outW}×${outH} @ ${FPS}fps | ${allVideoItems.length} clips de vídeo`);

  // ── 4. Load FFmpeg ─────────────────────────────────────────
  onProgress(6, 'Carregando FFmpeg…');

  const [{ FFmpeg }, { fetchFile, toBlobURL }] = await Promise.all([
    import('@ffmpeg/ffmpeg'),
    import('@ffmpeg/util'),
  ]);

  if (signal?.aborted) throw new Error('Exportação cancelada.');

  const ffmpeg = new FFmpeg();

  // Progress from FFmpeg transcoding (maps 30%→95%)
  ffmpeg.on('progress', ({ progress }) => {
    const safe = Math.max(0, Math.min(1, isFinite(progress) ? progress : 0));
    onProgress(Math.min(30 + Math.round(safe * 65), 95), 'Exportando com FFmpeg…');
  });

  ffmpeg.on('log', ({ message }) => {
    exportLog('[ffmpeg]', message);
  });

  const baseURL = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm';
  try {
    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    });
  } catch {
    exportLog('CDN principal falhou, tentando fallback…');
    const fallbackURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
    await ffmpeg.load({
      coreURL: await toBlobURL(`${fallbackURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${fallbackURL}/ffmpeg-core.wasm`, 'application/wasm'),
    });
  }

  exportLog('FFmpeg loaded');
  if (signal?.aborted) throw new Error('Exportação cancelada.');

  // ── 5. Write source files to FFmpeg FS ─────────────────────
  onProgress(10, 'Carregando arquivos de mídia…');

  const inputMap = await buildFFmpegInputs(
    allMediaItems,
    mediaMap,
    { writeFile: (name, data) => ffmpeg.writeFile(name, data) },
    (msg) => onProgress(10, msg)
  );

  exportLog(`Arquivos escritos no FS: ${inputMap.size}`);
  if (signal?.aborted) throw new Error('Exportação cancelada.');

  // ── 6. Build filter_complex ────────────────────────────────
  onProgress(22, 'Construindo pipeline de edição…');

  let filterResult;
  try {
    filterResult = buildFFmpegFilterComplex(cleanedProject, inputMap, outW, outH);
  } catch (err: any) {
    throw new Error(`Falha ao construir pipeline: ${err?.message ?? err}`);
  }

  exportLog(`filter_complex: ${filterResult.segmentCount} segmentos`);
  exportLog('filter_complex string:', filterResult.filterComplex.substring(0, 500) + '…');

  if (signal?.aborted) throw new Error('Exportação cancelada.');

  // ── 7. Build FFmpeg input arguments ───────────────────────
  const inputArgs: string[] = [];
  // Collect unique inputs in inputIndex order
  const sortedInputs = [...inputMap.values()].sort((a, b) => a.inputIndex - b.inputIndex);
  for (const entry of sortedInputs) {
    inputArgs.push('-i', entry.fsName);
  }

  // ── 8. Run FFmpeg ──────────────────────────────────────────
  onProgress(28, 'Iniciando exportação com FFmpeg…');

  const crf = opts.resolution === '1080p' ? 23 : 26;
  const preset = 'ultrafast';

  const ffmpegArgs = [
    ...inputArgs,
    '-filter_complex', filterResult.filterComplex,
    '-map', filterResult.videoOutLabel,
    '-map', filterResult.audioOutLabel,
    '-c:v', 'libx264',
    '-preset', preset,
    '-crf', String(crf),
    '-c:a', 'aac',
    '-b:a', '128k',
    '-ar', '44100',
    '-movflags', '+faststart',
    '-r', String(FPS),
    '-t', totalDuration.toFixed(6),
    'output.mp4',
  ];

  exportLog('FFmpeg command:', 'ffmpeg', ffmpegArgs.join(' '));

  try {
    await ffmpeg.exec(ffmpegArgs);
  } catch (err: any) {
    exportLog('FFmpeg exec failed:', err);
    // Try fallback without audio if the audio stream causes issues
    exportLog('Tentando exportação somente com vídeo como fallback…');
    const fallbackArgs = [
      ...inputArgs,
      '-filter_complex', filterResult.filterComplex,
      '-map', filterResult.videoOutLabel,
      '-c:v', 'libx264',
      '-preset', preset,
      '-crf', String(crf),
      '-movflags', '+faststart',
      '-r', String(FPS),
      '-t', totalDuration.toFixed(6),
      '-an',
      'output.mp4',
    ];
    exportLog('Fallback command (no audio):', fallbackArgs.join(' '));
    await ffmpeg.exec(fallbackArgs);
  }

  if (signal?.aborted) throw new Error('Exportação cancelada.');

  // ── 9. Read output ─────────────────────────────────────────
  onProgress(96, 'Preparando download…');
  const outputData = await ffmpeg.readFile('output.mp4');

  // ── 10. Cleanup ────────────────────────────────────────────
  try {
    for (const entry of inputMap.values()) {
      await ffmpeg.deleteFile(entry.fsName).catch(() => {});
    }
    await ffmpeg.deleteFile('output.mp4').catch(() => {});
  } catch { /* ignore cleanup errors */ }

  // ── 11. Build result Blob ──────────────────────────────────
  let mp4Blob: Blob;
  if (typeof outputData === 'string') {
    mp4Blob = new Blob([outputData], { type: 'video/mp4' });
  } else {
    const buf = new ArrayBuffer(outputData.byteLength);
    new Uint8Array(buf).set(outputData);
    mp4Blob = new Blob([buf], { type: 'video/mp4' });
  }

  if (mp4Blob.size < 1000) {
    throw new Error('Arquivo exportado vazio. Verifique os clipes na timeline.');
  }

  const elapsed = ((performance.now() - t0) / 1000).toFixed(1);
  exportLog(
    `Export concluído em ${elapsed}s | Tamanho: ${(mp4Blob.size / 1024 / 1024).toFixed(2)}MB | ${allVideoItems.length} clips`
  );

  return mp4Blob;
}
