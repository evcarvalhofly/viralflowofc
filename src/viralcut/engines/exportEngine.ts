import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';
import { Segment, SubtitleItem } from '../types';
import { toSrt } from './subtitleEngine';

export interface ExportOptions {
  file: File;
  keepSegments: Segment[];
  subtitles?: SubtitleItem[];
  embedSubtitles?: boolean;
  onProgress?: (pct: number, label: string) => void;
}

let ffmpegInstance: FFmpeg | null = null;

async function getFFmpeg(): Promise<FFmpeg> {
  if (ffmpegInstance) return ffmpegInstance;
  const { FFmpeg } = await import('@ffmpeg/ffmpeg');
  ffmpegInstance = new FFmpeg();
  ffmpegInstance.on('log', ({ message }) => {
    if (import.meta.env.DEV) console.debug('[ffmpeg]', message);
  });
  ffmpegInstance.on('progress', ({ progress }) => {
    // propagate via callback if needed
  });
  await ffmpegInstance.load();
  return ffmpegInstance;
}

/**
 * Exports the edited video by:
 * 1. Trimming each keep segment with re-encode for precision
 * 2. Concatenating all parts
 * 3. Optionally burning in subtitles
 */
export async function exportVideo(opts: ExportOptions): Promise<Blob> {
  const { file, keepSegments, subtitles, embedSubtitles, onProgress } = opts;

  if (!keepSegments.length) {
    throw new Error('Nenhum segmento para exportar');
  }

  const ffmpeg = await getFFmpeg();

  onProgress?.(2, 'Carregando vídeo…');
  await ffmpeg.writeFile('input.mp4', await fetchFile(file));

  const partNames: string[] = [];
  const total = keepSegments.length;

  for (let i = 0; i < total; i++) {
    const seg = keepSegments[i];
    const dur = seg.end - seg.start;

    if (dur < 0.05) continue;

    const outName = `part_${i}.mp4`;
    partNames.push(outName);

    const pct = Math.round(5 + (i / total) * 60);
    onProgress?.(pct, `Recortando segmento ${i + 1} / ${total}…`);

    // Re-encode for frame-accurate cuts (avoids keyframe issues)
    await ffmpeg.exec([
      '-ss', seg.start.toFixed(6),
      '-i', 'input.mp4',
      '-t', dur.toFixed(6),
      '-c:v', 'libx264',
      '-preset', 'ultrafast',
      '-crf', '23',
      '-c:a', 'aac',
      '-b:a', '128k',
      '-avoid_negative_ts', 'make_zero',
      '-movflags', '+faststart',
      outName,
    ]);
  }

  if (!partNames.length) {
    throw new Error('Nenhuma parte válida para montar');
  }

  onProgress?.(68, 'Concatenando partes…');

  const concatContent = partNames.map((p) => `file '${p}'`).join('\n');
  await ffmpeg.writeFile(
    'concat.txt',
    new TextEncoder().encode(concatContent)
  );

  await ffmpeg.exec([
    '-f', 'concat',
    '-safe', '0',
    '-i', 'concat.txt',
    '-c', 'copy',
    '-movflags', '+faststart',
    'joined.mp4',
  ]);

  let outputFile = 'joined.mp4';

  if (embedSubtitles && subtitles?.length) {
    onProgress?.(82, 'Adicionando legendas…');

    const srtContent = toSrt(subtitles);
    await ffmpeg.writeFile('subs.srt', new TextEncoder().encode(srtContent));

    await ffmpeg.exec([
      '-i', 'joined.mp4',
      '-vf', "subtitles=subs.srt:force_style='FontSize=22,PrimaryColour=&Hffffff&,Outline=1,Shadow=1'",
      '-c:v', 'libx264',
      '-preset', 'ultrafast',
      '-crf', '23',
      '-c:a', 'copy',
      'final.mp4',
    ]);

    outputFile = 'final.mp4';
  }

  onProgress?.(95, 'Preparando download…');

  const data = await ffmpeg.readFile(outputFile);
  const buffer: ArrayBuffer =
    data instanceof Uint8Array
      ? data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
      : new TextEncoder().encode(String(data)).buffer;
  const blob = new Blob([buffer], { type: 'video/mp4' });

  // Cleanup
  try {
    for (const p of partNames) {
      await ffmpeg.deleteFile(p);
    }
    await ffmpeg.deleteFile('input.mp4');
    await ffmpeg.deleteFile('concat.txt');
    await ffmpeg.deleteFile('joined.mp4');
    if (outputFile === 'final.mp4') {
      await ffmpeg.deleteFile('subs.srt');
      await ffmpeg.deleteFile('final.mp4');
    }
  } catch {
    // ignore cleanup errors
  }

  onProgress?.(100, 'Concluído!');
  return blob;
}

export function downloadBlob(blob: Blob, filename = 'viralcut-export.mp4') {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
