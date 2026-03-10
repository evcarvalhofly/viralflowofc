/// <reference lib="webworker" />

// This worker runs Whisper inference off the main thread so the UI stays responsive.

import { pipeline, env } from '@huggingface/transformers';

(env as any).allowRemoteModels = true;
(env as any).useBrowserCache = true;
(env as any).allowLocalModels = false;

let _pipeline: any = null;

async function getOrCreatePipeline(onProgress: (msg: string) => void) {
  if (_pipeline) return _pipeline;

  onProgress('Carregando modelo Whisper…');

  _pipeline = await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny', {
    progress_callback: (info: any) => {
      if (info?.status === 'downloading' || info?.status === 'progress') {
        const pct = info.progress != null ? Math.round(info.progress) : 0;
        onProgress(`Baixando modelo: ${pct}%`);
      } else if (info?.status === 'initiate') {
        onProgress('Inicializando modelo…');
      } else if (info?.status === 'done') {
        onProgress('Modelo pronto!');
      } else if (info?.status === 'ready') {
        onProgress('Modelo carregado. Transcrevendo…');
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

    self.postMessage({ type: 'progress', label: 'Transcrevendo com Whisper…' });

    let result: any;
    try {
      result = await transcriber(audioData, {
        return_timestamps: true,
        chunk_length_s: 15,
        stride_length_s: 3,
        language,
        task: 'transcribe',
      });
    } catch {
      self.postMessage({ type: 'progress', label: 'Retentando transcrição…' });
      result = await transcriber(audioData, {
        return_timestamps: true,
        chunk_length_s: 15,
        stride_length_s: 3,
      });
    }

    const raw = Array.isArray(result) ? result[0] : result;
    self.postMessage({ type: 'result', raw });
  } catch (err: any) {
    self.postMessage({ type: 'error', message: err?.message ?? 'Erro na transcrição' });
  }
};
