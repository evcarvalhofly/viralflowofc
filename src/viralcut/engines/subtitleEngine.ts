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
    // end: use last non-null timestamp, fallback to start + 1.5s
    let end: number = start + 1.5;
    for (let j = group.length - 1; j >= 0; j--) {
      const ts = group[j].timestamp[1];
      if (ts !== null && ts !== undefined && ts > 0) {
        end = ts;
        break;
      }
    }

    const text = group
      .map((w) => w.text.replace(/^\s+/, '').replace(/\s+$/, ''))
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

// Singleton pipeline — avoid reloading model on every call
let _pipelineInstance: any = null;

async function getOrCreatePipeline(onProgress?: (label: string) => void) {
  if (_pipelineInstance) {
    console.log('[subtitleEngine] Reusing cached pipeline');
    return _pipelineInstance;
  }

  // Use AutoProcessor + AutoModelForSpeechSeq2Seq approach via pipeline helper
  const { pipeline, env } = await import('@huggingface/transformers');

  // Allow remote model downloads and browser cache
  (env as any).allowRemoteModels = true;
  (env as any).useBrowserCache = true;
  // Disable local models to avoid CORS issues
  (env as any).allowLocalModels = false;

  console.log('[subtitleEngine] Creating pipeline…');
  onProgress?.('Carregando modelo Whisper (primeira vez pode demorar)…');

  _pipelineInstance = await pipeline(
    'automatic-speech-recognition',
    'Xenova/whisper-tiny',
    {
      progress_callback: (info: any) => {
        console.log('[subtitleEngine] progress:', JSON.stringify(info));
        if (info?.status === 'downloading' || info?.status === 'progress') {
          const pct = info.progress ? Math.round(info.progress) : 0;
          const name = info.name ?? '';
          onProgress?.(`Baixando modelo${name ? ' (' + name + ')' : ''}: ${pct}%`);
        } else if (info?.status === 'initiate') {
          onProgress?.(`Inicializando modelo…`);
        } else if (info?.status === 'done') {
          onProgress?.('Modelo pronto!');
        } else if (info?.status === 'ready') {
          onProgress?.('Modelo carregado. Transcrevendo…');
        }
      },
    }
  );

  console.log('[subtitleEngine] Pipeline ready:', typeof _pipelineInstance);
  return _pipelineInstance;
}

/**
 * Decodes audio file to a Float32Array (mono, 16kHz) for Whisper.
 * This is more reliable than passing a blob URL directly.
 */
async function fileToAudioData(file: File): Promise<Float32Array> {
  const arrayBuffer = await file.arrayBuffer();
  const audioCtx = new AudioContext({ sampleRate: 16000 });
  try {
    const decoded = await audioCtx.decodeAudioData(arrayBuffer);
    // Mix down to mono
    const channel = decoded.getChannelData(0);
    return channel;
  } finally {
    await audioCtx.close();
  }
}

/**
 * Transcribes audio using Transformers.js Whisper model in-browser.
 * Compatible with @huggingface/transformers v3.
 */
export async function transcribeFile(
  file: File,
  onProgress?: (label: string) => void
): Promise<SubtitleItem[]> {
  console.log('[subtitleEngine] Starting transcription for:', file.name, file.type, file.size);

  const transcriber = await getOrCreatePipeline(onProgress);

  onProgress?.('Decodificando áudio…');

  // Decode audio to Float32Array for reliable Whisper input
  let audioData: Float32Array;
  try {
    audioData = await fileToAudioData(file);
    console.log('[subtitleEngine] Audio decoded, samples:', audioData.length);
  } catch (err) {
    console.error('[subtitleEngine] Audio decode failed:', err);
    throw new Error('Não foi possível decodificar o áudio do vídeo. Verifique se o arquivo tem faixa de áudio.');
  }

  onProgress?.('Transcrevendo com Whisper…');

  let result: any;
  try {
    result = await transcriber(audioData, {
      return_timestamps: 'word',
      chunk_length_s: 30,
      stride_length_s: 5,
      language: 'portuguese',
      task: 'transcribe',
    });
  } catch (err) {
    console.error('[subtitleEngine] Transcription error:', err);
    // Retry without language hint in case of language detection issue
    try {
      console.warn('[subtitleEngine] Retrying without language constraint…');
      onProgress?.('Retentando transcrição…');
      result = await transcriber(audioData, {
        return_timestamps: 'word',
        chunk_length_s: 30,
        stride_length_s: 5,
      });
    } catch (err2) {
      console.error('[subtitleEngine] Retry failed:', err2);
      throw new Error('Erro na transcrição. Verifique se o vídeo tem áudio audível.');
    }
  }

  console.log('[subtitleEngine] Raw result type:', typeof result, Array.isArray(result));
  console.log('[subtitleEngine] Raw result keys:', result ? Object.keys(result) : 'null');

  // Normalize: handle array wrapper, nested results, etc.
  const raw = Array.isArray(result) ? result[0] : result;

  console.log('[subtitleEngine] Raw text preview:', String(raw?.text ?? '').slice(0, 200));
  console.log('[subtitleEngine] Chunks count:', raw?.chunks?.length ?? 0);

  if (raw?.chunks && Array.isArray(raw.chunks) && raw.chunks.length > 0) {
    console.log('[subtitleEngine] First chunk sample:', JSON.stringify(raw.chunks[0]));
  }

  let words: TranscriberWord[] = [];

  if (raw?.chunks && Array.isArray(raw.chunks) && raw.chunks.length > 0) {
    // Filter to word-level chunks (shorter text, no sentence punctuation at ends)
    words = raw.chunks
      .filter((c: any) => c?.timestamp && Array.isArray(c.timestamp) && c.text)
      .map((c: any) => ({
        text: c.text as string,
        timestamp: [
          typeof c.timestamp[0] === 'number' ? c.timestamp[0] : 0,
          typeof c.timestamp[1] === 'number' && c.timestamp[1] > 0 ? c.timestamp[1] : null,
        ] as [number, number | null],
      }));

    console.log('[subtitleEngine] Words extracted from chunks:', words.length);

    // If we only got a few chunks that look like sentences (long text), split them
    if (words.length <= 3 && raw.text?.trim()) {
      console.warn('[subtitleEngine] Got only sentence chunks, falling back to text split');
      words = splitTextIntoTimedWords(raw.text, raw.chunks);
    }
  } else if (typeof raw?.text === 'string' && raw.text.trim()) {
    // No word timestamps at all — create evenly spaced words from full text
    console.warn('[subtitleEngine] No chunks found. Using full text with estimated timestamps.');
    const totalWords = raw.text.trim().split(/\s+/);
    const audioDuration = audioData.length / 16000; // samples / sampleRate
    words = totalWords.map((w: string, i: number) => ({
      text: w,
      timestamp: [
        (i / totalWords.length) * audioDuration,
        ((i + 1) / totalWords.length) * audioDuration,
      ] as [number, number | null],
    }));
    console.log('[subtitleEngine] Estimated words created:', words.length);
  }

  console.log('[subtitleEngine] Final words count:', words.length);

  if (!words.length) {
    throw new Error(
      'Nenhuma fala detectada. Verifique se o vídeo tem áudio claro e tente novamente.'
    );
  }

  const blocks = buildSubtitleBlocks(words, 3);
  console.log('[subtitleEngine] Subtitle blocks created:', blocks.length);
  if (blocks.length > 0) {
    console.log('[subtitleEngine] First block:', JSON.stringify(blocks[0]));
    console.log('[subtitleEngine] Last block:', JSON.stringify(blocks[blocks.length - 1]));
  }

  return blocks;
}

/**
 * When Whisper returns sentence-level chunks instead of word-level,
 * distribute words evenly across the sentence time range.
 */
function splitTextIntoTimedWords(
  fullText: string,
  chunks: any[]
): TranscriberWord[] {
  const words: TranscriberWord[] = [];

  for (const chunk of chunks) {
    if (!chunk?.text || !chunk?.timestamp) continue;
    const chunkWords = chunk.text.trim().split(/\s+/).filter(Boolean);
    if (!chunkWords.length) continue;

    const start = typeof chunk.timestamp[0] === 'number' ? chunk.timestamp[0] : 0;
    const end = typeof chunk.timestamp[1] === 'number' && chunk.timestamp[1] > 0
      ? chunk.timestamp[1]
      : start + chunkWords.length * 0.4;

    const step = (end - start) / chunkWords.length;
    chunkWords.forEach((w: string, i: number) => {
      words.push({
        text: w,
        timestamp: [start + i * step, start + (i + 1) * step],
      });
    });
  }

  return words;
}

/**
 * Resets the singleton pipeline (useful for testing or memory management).
 */
export function resetPipeline() {
  _pipelineInstance = null;
}
