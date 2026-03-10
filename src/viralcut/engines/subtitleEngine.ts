import { SubtitleItem } from '../types';

export interface TranscriberWord {
  text: string;
  timestamp: [number, number];
}

// ─── SRT helpers ─────────────────────────────────────────────────────────────

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

// ─── Block builder ────────────────────────────────────────────────────────────

export function buildSubtitleBlocks(
  words: TranscriberWord[],
  wordsPerBlock = 4
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

// ─── Audio decoder ────────────────────────────────────────────────────────────

export async function fileToAudioData(file: File): Promise<Float32Array> {
  const arrayBuffer = await file.arrayBuffer();
  const audioCtx = new AudioContext({ sampleRate: 16000 });
  try {
    const decoded = await audioCtx.decodeAudioData(arrayBuffer);
    return decoded.getChannelData(0);
  } finally {
    audioCtx.close();
  }
}

// ─── Chunk normalizer ─────────────────────────────────────────────────────────

export function chunksToTimedWords(
  chunks: Array<{ text: string; timestamp: [number, number | null] }>
): TranscriberWord[] {
  const words: TranscriberWord[] = [];

  for (const chunk of chunks) {
    if (!chunk?.text || !Array.isArray(chunk.timestamp)) continue;

    const rawStart = chunk.timestamp[0];
    const rawEnd = chunk.timestamp[1];

    const chunkStart = typeof rawStart === 'number' ? rawStart : 0;
    const chunkWords = chunk.text.trim().split(/\s+/).filter(Boolean);
    if (!chunkWords.length) continue;

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

export function textToTimedWords(text: string, audioDuration: number): TranscriberWord[] {
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

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Transcribes a video/audio File using Whisper-tiny in a Web Worker.
 * Returns subtitle blocks ready for the overlay.
 */
export async function transcribeFile(
  file: File,
  onProgress?: (label: string) => void
): Promise<SubtitleItem[]> {
  console.log('[subtitleEngine] Start:', file.name, file.size);

  onProgress?.('Decodificando áudio…');

  let audioData: Float32Array;
  try {
    audioData = await fileToAudioData(file);
    console.log('[subtitleEngine] Audio samples:', audioData.length, '→', (audioData.length / 16000).toFixed(1), 's');
  } catch (err) {
    console.error('[subtitleEngine] Audio decode failed:', err);
    throw new Error('Não foi possível decodificar o áudio. Verifique se o arquivo tem áudio.');
  }

  const audioDuration = audioData.length / 16000;

  // Run Whisper in a Web Worker to avoid blocking the UI
  const raw = await runWorker(audioData, 'portuguese', onProgress);

  console.log('[subtitleEngine] Raw text:', String(raw?.text ?? '').slice(0, 300));
  console.log('[subtitleEngine] Chunks:', raw?.chunks?.length ?? 0, raw?.chunks?.[0]);

  let words: TranscriberWord[] = [];

  if (raw?.chunks && Array.isArray(raw.chunks) && raw.chunks.length > 0) {
    words = chunksToTimedWords(raw.chunks);
    console.log('[subtitleEngine] Words from chunks:', words.length);
  } else if (typeof raw?.text === 'string' && raw.text.trim()) {
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

// ─── Worker runner ────────────────────────────────────────────────────────────

function runWorker(
  audioData: Float32Array,
  language: string,
  onProgress?: (label: string) => void
): Promise<any> {
  return new Promise((resolve, reject) => {
    // Vite handles ?worker with type module correctly
    const worker = new Worker(
      new URL('../workers/transcriber.worker.ts', import.meta.url),
      { type: 'module' }
    );

    worker.onmessage = (e: MessageEvent) => {
      const { type, label, raw, message } = e.data;
      if (type === 'progress') {
        onProgress?.(label);
      } else if (type === 'result') {
        worker.terminate();
        resolve(raw);
      } else if (type === 'error') {
        worker.terminate();
        reject(new Error(message));
      }
    };

    worker.onerror = (err) => {
      worker.terminate();
      reject(new Error(err.message));
    };

    // Transfer the buffer to avoid copying (faster)
    worker.postMessage({ audioData, language }, [audioData.buffer]);
  });
}

export function resetPipeline() {
  // No-op: pipeline lives in the worker which is created per-run
}
