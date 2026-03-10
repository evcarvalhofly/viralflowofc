import { SubtitleItem } from '../types';

export interface TranscriberWord {
  text: string;
  timestamp: [number, number | null];
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

    const start = group[0].timestamp[0] ?? 0;
    // end: use last non-null timestamp, fallback to start + 1s
    let end: number = start + 1;
    for (let j = group.length - 1; j >= 0; j--) {
      const ts = group[j].timestamp[1];
      if (ts !== null && ts !== undefined && ts > 0) {
        end = ts;
        break;
      }
    }

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
 * Compatible with @huggingface/transformers v3.
 */
export async function transcribeFile(
  file: File,
  onProgress?: (label: string) => void
): Promise<SubtitleItem[]> {
  const { pipeline, env } = await import('@huggingface/transformers');

  // @ts-ignore — env.allowRemoteModels exists in v3
  env.allowRemoteModels = true;
  // @ts-ignore
  env.useBrowserCache = true;

  onProgress?.('Carregando modelo Whisper…');

  const transcriber = await pipeline(
    'automatic-speech-recognition',
    'Xenova/whisper-tiny',
    {
      // @ts-ignore
      progress_callback: (info: any) => {
        if (info?.status === 'downloading' || info?.status === 'progress') {
          const pct = info.progress ? Math.round(info.progress) : 0;
          onProgress?.(`Baixando modelo: ${pct}%`);
        }
        if (info?.status === 'ready') {
          onProgress?.('Modelo carregado. Transcrevendo…');
        }
      },
    }
  );

  onProgress?.('Transcrevendo áudio…');

  const audioUrl = URL.createObjectURL(file);

  let result: any;
  try {
    result = await (transcriber as any)(audioUrl, {
      return_timestamps: 'word',
      chunk_length_s: 30,
      stride_length_s: 5,
    });
  } finally {
    URL.revokeObjectURL(audioUrl);
  }

  console.debug('[subtitleEngine] raw result:', JSON.stringify(result)?.slice(0, 500));

  // Normalize: v3 pipeline may return { chunks } or { text, chunks } or array
  let words: TranscriberWord[] = [];

  const raw = Array.isArray(result) ? result[0] : result;

  if (raw?.chunks && Array.isArray(raw.chunks)) {
    // word-level chunks: { text, timestamp: [start, end] }
    words = raw.chunks
      .filter((c: any) => c?.timestamp && Array.isArray(c.timestamp))
      .map((c: any) => ({
        text: c.text as string,
        timestamp: [
          typeof c.timestamp[0] === 'number' ? c.timestamp[0] : 0,
          typeof c.timestamp[1] === 'number' ? c.timestamp[1] : null,
        ] as [number, number | null],
      }));
  } else if (typeof raw?.text === 'string' && raw.text.trim()) {
    // Fallback: no word timestamps — create a single subtitle block
    console.warn('[subtitleEngine] No word-level timestamps. Falling back to single block.');
    words = [{ text: raw.text.trim(), timestamp: [0, null] }];
  }

  console.debug('[subtitleEngine] words parsed:', words.length);

  if (!words.length) {
    throw new Error(
      'Nenhuma palavra foi transcrita. Verifique se o vídeo tem áudio claro e tente novamente.'
    );
  }

  const blocks = buildSubtitleBlocks(words, 3);
  console.debug('[subtitleEngine] subtitle blocks:', blocks.length, blocks.slice(0, 3));
  return blocks;
}
