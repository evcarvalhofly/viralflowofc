import { SubtitleItem } from '../types';

export interface TranscriberWord {
  text: string;
  timestamp: [number, number];
}

/**
 * Groups transcribed words into subtitle blocks.
 */
export function buildSubtitleBlocks(
  words: TranscriberWord[],
  wordsPerBlock = 3
): SubtitleItem[] {
  const blocks: SubtitleItem[] = [];

  for (let i = 0; i < words.length; i += wordsPerBlock) {
    const group = words.slice(i, i + wordsPerBlock).filter(Boolean);
    if (!group.length) continue;

    const start = group[0].timestamp[0];
    const end = group[group.length - 1].timestamp[1];
    const text = group
      .map((w) => w.text.trim())
      .join(' ')
      .trim();

    if (text) {
      blocks.push({ start, end, text });
    }
  }

  return blocks;
}

/**
 * Formats seconds to SRT timestamp format: HH:MM:SS,mmm
 */
function formatSrtTime(sec: number): string {
  const ms = Math.floor((sec % 1) * 1000);
  const total = Math.floor(sec);
  const s = total % 60;
  const m = Math.floor(total / 60) % 60;
  const h = Math.floor(total / 3600);
  const pad = (n: number, size = 2) => String(n).padStart(size, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(ms, 3)}`;
}

/**
 * Converts subtitle items to SRT format string.
 */
export function toSrt(subs: SubtitleItem[]): string {
  return subs
    .map((sub, i) =>
      [
        String(i + 1),
        `${formatSrtTime(sub.start)} --> ${formatSrtTime(sub.end)}`,
        sub.text,
        '',
      ].join('\n')
    )
    .join('\n');
}

/**
 * Transcribes audio using Transformers.js Whisper model in-browser.
 * Returns word-level timestamps.
 */
export async function transcribeFile(
  file: File,
  onProgress?: (label: string) => void
): Promise<SubtitleItem[]> {
  // Dynamically import to avoid loading the heavy model on startup
  const { pipeline, env } = await import('@huggingface/transformers');

  // Allow remote models (CDN)
  env.allowRemoteModels = true;
  env.useBrowserCache = true;

  onProgress?.('Carregando modelo Whisper…');

  const transcriber = await pipeline(
    'automatic-speech-recognition',
    'Xenova/whisper-tiny',
    {
      progress_callback: (info: any) => {
        if (info?.status === 'downloading') {
          const pct = info.progress ? Math.round(info.progress) : 0;
          onProgress?.(`Baixando modelo: ${pct}%`);
        }
      },
    }
  );

  onProgress?.('Transcrevendo áudio…');

  // Convert file to object URL for the pipeline
  const audioUrl = URL.createObjectURL(file);

  const result: any = await transcriber(audioUrl, {
    return_timestamps: 'word',
    chunk_length_s: 30,
    stride_length_s: 5,
  });

  URL.revokeObjectURL(audioUrl);

  const words: TranscriberWord[] =
    result?.chunks?.map((c: any) => ({
      text: c.text,
      timestamp: c.timestamp as [number, number],
    })) ?? [];

  return buildSubtitleBlocks(words, 3);
}
