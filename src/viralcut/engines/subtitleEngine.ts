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

// ─── Whisper segment → words ──────────────────────────────────────────────────

/**
 * Converts OpenAI Whisper verbose_json "segments" into timed word objects.
 * Each segment has start/end timestamps and full text — we distribute words evenly within.
 */
function segmentsToTimedWords(
  segments: Array<{ text: string; start: number; end: number }>
): TranscriberWord[] {
  const words: TranscriberWord[] = [];

  for (const seg of segments) {
    if (!seg?.text) continue;
    const segWords = seg.text.trim().split(/\s+/).filter(Boolean);
    if (!segWords.length) continue;

    const duration = seg.end - seg.start;
    const step = duration / segWords.length;

    segWords.forEach((w, i) => {
      words.push({
        text: w,
        timestamp: [
          parseFloat((seg.start + i * step).toFixed(3)),
          parseFloat((seg.start + (i + 1) * step).toFixed(3)),
        ],
      });
    });
  }

  return words;
}

// ─── Audio converter: File → WebM/OGG blob (browser AudioContext → WAV PCM) ──

/**
 * Converts the video/audio File to a 16 kHz mono WAV Blob
 * suitable for OpenAI Whisper API (max 25 MB).
 */
async function fileToWavBlob(
  file: File,
  onProgress?: (label: string) => void
): Promise<Blob> {
  onProgress?.('Decodificando áudio…');

  const arrayBuffer = await file.arrayBuffer();
  const audioCtx = new AudioContext({ sampleRate: 16000 });

  let decoded: AudioBuffer;
  try {
    decoded = await audioCtx.decodeAudioData(arrayBuffer);
  } finally {
    audioCtx.close();
  }

  onProgress?.('Preparando áudio para envio…');

  const pcm = decoded.getChannelData(0); // mono, 16 kHz Float32
  const wavBuffer = float32ToWav(pcm, 16000);
  return new Blob([wavBuffer], { type: 'audio/wav' });
}

/** Encodes Float32Array PCM samples into a WAV ArrayBuffer. */
function float32ToWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const numSamples = samples.length;
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + numSamples * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);          // chunk size
  view.setUint16(20, 1, true);           // PCM
  view.setUint16(22, 1, true);           // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true);           // block align
  view.setUint16(34, 16, true);          // bits per sample
  writeStr(36, 'data');
  view.setUint32(40, numSamples * 2, true);

  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }

  return buffer;
}

// ─── Main export ──────────────────────────────────────────────────────────────

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const TRANSCRIBE_URL = `${SUPABASE_URL}/functions/v1/transcribe-audio`;

/**
 * Transcribes a video/audio File using OpenAI Whisper API via Supabase Edge Function.
 * Returns subtitle blocks ready for the overlay.
 * No more browser OOM — processing happens on the server.
 */
export async function transcribeFile(
  file: File,
  onProgress?: (label: string) => void
): Promise<SubtitleItem[]> {
  console.log('[subtitleEngine] Start:', file.name, file.size);

  // Convert to WAV first (16 kHz mono — optimal for Whisper)
  let wavBlob: Blob;
  try {
    wavBlob = await fileToWavBlob(file, onProgress);
    console.log('[subtitleEngine] WAV blob:', wavBlob.size, 'bytes');
  } catch (err) {
    console.error('[subtitleEngine] Audio decode failed:', err);
    throw new Error('Não foi possível decodificar o áudio. Verifique se o arquivo tem áudio.');
  }

  // Whisper API accepts up to 25 MB
  const MAX_BYTES = 25 * 1024 * 1024;
  if (wavBlob.size > MAX_BYTES) {
    throw new Error(
      `Arquivo muito grande para transcrição (${(wavBlob.size / 1024 / 1024).toFixed(1)} MB). Máximo: 25 MB.`
    );
  }

  onProgress?.('Enviando áudio para transcrição na nuvem…');

  const form = new FormData();
  form.append('audio', wavBlob, 'audio.wav');
  form.append('language', 'pt');

  let res: Response;
  try {
    res = await fetch(TRANSCRIBE_URL, {
      method: 'POST',
      body: form,
    });
  } catch (networkErr) {
    console.error('[subtitleEngine] Network error:', networkErr);
    throw new Error('Erro de rede ao conectar com o servidor de transcrição.');
  }

  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    console.error('[subtitleEngine] Edge function error:', res.status, errBody);

    let msg = 'Erro ao transcrever o áudio.';
    try {
      const parsed = JSON.parse(errBody);
      if (parsed?.error) msg = parsed.error;
    } catch { /* ignore */ }

    throw new Error(msg);
  }

  onProgress?.('Processando resultado…');

  const data = await res.json();
  console.log('[subtitleEngine] Whisper response segments:', data.segments?.length ?? 0);
  console.log('[subtitleEngine] Whisper text (first 200):', String(data.text ?? '').slice(0, 200));

  if (!data.segments?.length && !data.text?.trim()) {
    throw new Error('Nenhuma fala detectada. Verifique se o vídeo tem áudio claro.');
  }

  let words: TranscriberWord[] = [];

  if (data.segments?.length) {
    words = segmentsToTimedWords(data.segments);
    console.log('[subtitleEngine] Words from segments:', words.length);
  } else if (data.text?.trim()) {
    // Fallback: distribute words evenly over full duration
    const duration = data.duration ?? 60;
    const allWords = data.text.trim().split(/\s+/).filter(Boolean);
    words = allWords.map((w: string, i: number) => ({
      text: w,
      timestamp: [
        parseFloat(((i / allWords.length) * duration).toFixed(3)),
        parseFloat((((i + 1) / allWords.length) * duration).toFixed(3)),
      ] as [number, number],
    }));
    console.log('[subtitleEngine] Words from text fallback:', words.length);
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
  // No-op: processing is now server-side
}
