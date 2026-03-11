/// <reference lib="webworker" />

// This worker runs Whisper inference off the main thread so the UI stays responsive.
// Model: Xenova/whisper-small (~460MB) — best balance of quality/size for in-browser PT-BR.

import { pipeline, env } from '@huggingface/transformers';

(env as any).allowRemoteModels = true;
(env as any).useBrowserCache = true;
(env as any).allowLocalModels = false;

// Use WASM single-thread backend to avoid SharedArrayBuffer issues in some environments
(env as any).backends = { onnx: { wasm: { numThreads: 1 } } };

let _pipeline: any = null;

async function getOrCreatePipeline(onProgress: (msg: string) => void) {
  if (_pipeline) return _pipeline;

  onProgress('Carregando modelo Whisper (pequeno ~460MB)…');

  _pipeline = await pipeline('automatic-speech-recognition', 'Xenova/whisper-small', {
    dtype: 'q8', // quantized 8-bit — 2x smaller download, nearly same quality
    progress_callback: (info: any) => {
      if (info?.status === 'downloading' || info?.status === 'progress') {
        const pct = info.progress != null ? Math.round(info.progress) : 0;
        const file = info.file ? ` (${info.file.split('/').pop()})` : '';
        onProgress(`Baixando modelo${file}: ${pct}%`);
      } else if (info?.status === 'initiate') {
        onProgress('Inicializando modelo…');
      } else if (info?.status === 'done') {
        onProgress('Arquivo carregado!');
      } else if (info?.status === 'ready') {
        onProgress('Modelo pronto. Transcrevendo…');
      }
    },
  });

  return _pipeline;
}

self.onmessage = async (e: MessageEvent) => {
  const { audioData, language } = e.data as { audioData: Float32Array; language: string };

  try {
    const transcriber = await getOrCreatePipeline((label) => {
      self.postMessage({ type: 'progress', label });
    });

    self.postMessage({ type: 'progress', label: 'Transcrevendo áudio…' });

    let result: any;
    try {
      result = await transcriber(audioData, {
        return_timestamps: 'word', // word-level timestamps for precise SRT
        chunk_length_s: 20,        // longer chunks = better context
        stride_length_s: 4,
        language: language || 'portuguese',
        task: 'transcribe',
      });
    } catch {
      // Fallback: sentence-level timestamps (still generates valid SRT)
      self.postMessage({ type: 'progress', label: 'Retentando com timestamps por frase…' });
      result = await transcriber(audioData, {
        return_timestamps: true,
        chunk_length_s: 20,
        stride_length_s: 4,
        language: language || 'portuguese',
        task: 'transcribe',
      });
    }

    const raw = Array.isArray(result) ? result[0] : result;
    self.postMessage({ type: 'result', raw });
  } catch (err: any) {
    self.postMessage({ type: 'error', message: err?.message ?? 'Erro na transcrição' });
  }
};
