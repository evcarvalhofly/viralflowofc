import { SubtitleItem } from '../types';

export interface TranscriberWord {
  text: string;
  timestamp: [number, number];
}

// ─── SRT helpers ────────────────────────────────────────────────────────────

function formatSrtTime(sec: number): string {
  const ms = Math.floor((sec % 1) * 1000);
  const total = Math.floor(sec);
  const s = total % 60;
  const m = Math.floor(total / 60) % 60;
  const h = Math.floor(total / 3600);
  const pad = (n: number, size = 2) => String(n).padStart(size, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(ms, 3)}`;
}

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

// ─── Block builder ───────────────────────────────────────────────────────────

/**
 * Groups timed words into subtitle blocks of N words each.
 * Each word must have a valid [start, end] pair.
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

    if (text && end > start) {
      blocks.push({ start, end, text });
    }
  }

  return blocks;
}

// ─── Audio decoder ───────────────────────────────────────────────────────────

/**
 * Decodes a video/audio File to mono Float32Array at 16 kHz for Whisper.
 */
async function fileToAudioData(file: File): Promise<Float32Array> {
  const arrayBuffer = await file.arrayBuffer();
  const audioCtx = new AudioContext({ sampleRate: 16000 });
  try {
    const decoded = await audioCtx.decodeAudioData(arrayBuffer);
    // Mix down to mono by taking channel 0
    return decoded.getChannelData(0);
  } finally {
    audioCtx.close();
  }
}

// ─── Pipeline singleton ──────────────────────────────────────────────────────

let _pipeline: any = null;

async function getOrCreatePipeline(onProgress?: (label: string) => void) {
  if (_pipeline) {
    console.log('[subtitleEngine] Reusing cached pipeline');
    return _pipeline;
  }

  const { pipeline, env } = await import('@huggingface/transformers');
  (env as any).allowRemoteModels = true;
  (env as any).useBrowserCache = true;
  (env as any).allowLocalModels = false;

  onProgress?.('Carregando modelo Whisper…');
  console.log('[subtitleEngine] Creating Whisper pipeline…');

  _pipeline = await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny', {
    progress_callback: (info: any) => {
      if (info?.status === 'downloading' || info?.status === 'progress') {
        const pct = info.progress != null ? Math.round(info.progress) : 0;
        onProgress?.(`Baixando modelo: ${pct}%`);
      } else if (info?.status === 'initiate') {
        onProgress?.('Inicializando modelo…');
      } else if (info?.status === 'done') {
        onProgress?.('Modelo pronto!');
      } else if (info?.status === 'ready') {
        onProgress?.('Modelo carregado. Transcrevendo…');
      }
    },
  });

  console.log('[subtitleEngine] Pipeline ready');
  return _pipeline;
}

// ─── Chunk normalizer ────────────────────────────────────────────────────────

/**
 * Given Whisper sentence-level chunks (each with a [start, end] timestamp and text),
 * distributes words evenly within that chunk's time range.
 *
 * This is the RELIABLE path: whisper-tiny in the browser almost always returns
 * sentence-level chunks even when return_timestamps:'word' is requested.
 */
function chunksToTimedWords(chunks: Array<{ text: string; timestamp: [number, number | null] }>): TranscriberWord[] {
  const words: TranscriberWord[] = [];

  for (const chunk of chunks) {
    if (!chunk?.text || !Array.isArray(chunk.timestamp)) continue;

    const rawStart = chunk.timestamp[0];
    const rawEnd = chunk.timestamp[1];

    const chunkStart = typeof rawStart === 'number' ? rawStart : 0;
    const chunkWords = chunk.text.trim().split(/\s+/).filter(Boolean);
    if (!chunkWords.length) continue;

    // Estimate end: use model's value if valid, else chunkStart + 0.4s per word
    const chunkEnd =
      typeof rawEnd === 'number' && rawEnd > chunkStart
        ? rawEnd
        : chunkStart + chunkWords.length * 0.4;

    const step = (chunkEnd - chunkStart) / chunkWords.length;

    chunkWords.forEach((w, i) => {
      words.push({
        text: w,
        timestamp: [
          parseFloat((chunkStart + i * step).toFixed(3)),
          parseFloat((chunkStart + (i + 1) * step).toFixed(3)),
        ],
      });
    });
  }

  return words;
}

/**
 * Fallback: no chunks at all. Spread all words evenly across the full audio duration.
 */
function textToTimedWords(text: string, audioDuration: number): TranscriberWord[] {
  const allWords = text.trim().split(/\s+/).filter(Boolean);
  if (!allWords.length) return [];

  return allWords.map((w, i) => ({
    text: w,
    timestamp: [
      parseFloat(((i / allWords.length) * audioDuration).toFixed(3)),
      parseFloat((((i + 1) / allWords.length) * audioDuration).toFixed(3)),
    ],
  }));
}

// ─── Main export ─────────────────────────────────────────────────────────────

/**
 * Transcribes a video/audio File using Whisper-tiny in-browser.
 * Returns subtitle blocks ready for the overlay.
 */
export async function transcribeFile(
  file: File,
  onProgress?: (label: string) => void
): Promise<SubtitleItem[]> {
  console.log('[subtitleEngine] Start:', file.name, file.size);

  const transcriber = await getOrCreatePipeline(onProgress);

  onProgress?.('Decodificando áudio…');

  let audioData: Float32Array;
  try {
    audioData = await fileToAudioData(file);
    console.log('[subtitleEngine] Audio samples:', audioData.length, '→', (audioData.length / 16000).toFixed(1), 's');
  } catch (err) {
    console.error('[subtitleEngine] Audio decode failed:', err);
    throw new Error('Não foi possível decodificar o áudio. Verifique se o arquivo tem áudio.');
  }

  onProgress?.('Transcrevendo com Whisper…');

  // Smaller chunks = more precise per-segment timestamps from whisper-tiny
  let result: any;
  try {
    result = await transcriber(audioData, {
      return_timestamps: true,
      chunk_length_s: 15,     // smaller window → tighter timestamps
      stride_length_s: 3,
      language: 'portuguese',
      task: 'transcribe',
    });
  } catch (err) {
    console.warn('[subtitleEngine] First attempt failed, retrying without language…', err);
    onProgress?.('Retentando transcrição…');
    try {
      result = await transcriber(audioData, {
        return_timestamps: true,
        chunk_length_s: 15,
        stride_length_s: 3,
      });
    } catch (err2) {
      console.error('[subtitleEngine] Retry failed:', err2);
      throw new Error('Erro na transcrição. Verifique se o vídeo tem áudio audível.');
    }
  }

  // Normalize result (pipeline may wrap in array)
  const raw = Array.isArray(result) ? result[0] : result;
  console.log('[subtitleEngine] Raw text:', String(raw?.text ?? '').slice(0, 300));
  console.log('[subtitleEngine] Chunks:', raw?.chunks?.length ?? 0, raw?.chunks?.[0]);

  const audioDuration = audioData.length / 16000;
  let words: TranscriberWord[] = [];

  if (raw?.chunks && Array.isArray(raw.chunks) && raw.chunks.length > 0) {
    // Primary path: sentence-level chunks with timestamps
    words = chunksToTimedWords(raw.chunks);
    console.log('[subtitleEngine] Words from chunks:', words.length);
  } else if (typeof raw?.text === 'string' && raw.text.trim()) {
    // Fallback: no chunks, evenly distribute across full audio
    console.warn('[subtitleEngine] No chunks — distributing words evenly');
    words = textToTimedWords(raw.text, audioDuration);
    console.log('[subtitleEngine] Words from text split:', words.length);
  }

  if (!words.length) {
    throw new Error('Nenhuma fala detectada. Verifique se o vídeo tem áudio claro.');
  }

  const blocks = buildSubtitleBlocks(words, 4);
  console.log('[subtitleEngine] Blocks:', blocks.length, blocks[0], blocks[blocks.length - 1]);

  if (!blocks.length) {
    throw new Error('Não foi possível criar blocos de legenda. Tente novamente.');
  }

  return blocks;
}

export function resetPipeline() {
  _pipeline = null;
}
