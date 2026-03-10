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
  await ffmpegInstance.load();
  return ffmpegInstance;
}

/**
 * Converts subtitle color hex (#rrggbb) to ASS BGR hex (&H00BBGGRR).
 * ASS uses BGR order, not RGB.
 */
function hexToAssBgr(hex: string): string {
  const h = hex.replace('#', '');
  const r = h.slice(0, 2);
  const g = h.slice(2, 4);
  const b = h.slice(4, 6);
  return `&H00${b}${g}${r}`.toUpperCase();
}

/**
 * Converts SubtitleItem[] to an ASS subtitle file.
 * ASS is far more reliably supported by FFmpeg.wasm than SRT + subtitles filter.
 */
function toAss(subs: SubtitleItem[], fontSize = 22, color = '#ffffff', withBackground = true): string {
  const assColor = hexToAssBgr(color);
  const backColor = withBackground ? '&H99000000' : '&H00000000';

  const header = `[Script Info]
ScriptType: v4.00+
PlayResX: 1280
PlayResY: 720
Collisions: Normal

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,${fontSize},${assColor},${assColor},&H00000000,${backColor},-1,0,0,0,100,100,0,0,3,2,0,2,20,20,40,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text`;

  function fmtAssTime(sec: number): string {
    const cs = Math.floor((sec % 1) * 100);
    const total = Math.floor(sec);
    const s = total % 60;
    const m = Math.floor(total / 60) % 60;
    const h = Math.floor(total / 3600);
    const pad2 = (n: number) => String(n).padStart(2, '0');
    return `${h}:${pad2(m)}:${pad2(s)}.${String(cs).padStart(2, '0')}`;
  }

  const events = subs
    .map((s) => `Dialogue: 0,${fmtAssTime(s.start)},${fmtAssTime(s.end)},Default,,0,0,0,,${s.text}`)
    .join('\n');

  return `${header}\n${events}`;
}

/**
 * Exports the edited video by:
 * 1. Trimming each keep segment with re-encode for precision
 * 2. Concatenating all parts
 * 3. Optionally burning in subtitles via ASS filter (most compatible with FFmpeg.wasm)
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
  await ffmpeg.writeFile('concat.txt', new TextEncoder().encode(concatContent));

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

    // Use ASS format — much more reliable in FFmpeg.wasm than SRT+subtitles filter
    const assContent = toAss(subtitles, 22, '#ffffff', true);
    await ffmpeg.writeFile('subs.ass', new TextEncoder().encode(assContent));

    await ffmpeg.exec([
      '-i', 'joined.mp4',
      '-vf', 'ass=subs.ass',
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
  let buffer: ArrayBuffer;
  if (data instanceof Uint8Array) {
    buffer = data.buffer.slice(0) as ArrayBuffer;
  } else {
    buffer = new TextEncoder().encode(String(data)).buffer as ArrayBuffer;
  }
  const blob = new Blob([buffer], { type: 'video/mp4' });

  // Cleanup
  try {
    for (const p of partNames) await ffmpeg.deleteFile(p);
    await ffmpeg.deleteFile('input.mp4');
    await ffmpeg.deleteFile('concat.txt');
    await ffmpeg.deleteFile('joined.mp4');
    if (outputFile === 'final.mp4') {
      await ffmpeg.deleteFile('subs.ass');
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
