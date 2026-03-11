/// <reference lib="webworker" />

// Whisper-tiny: ~75MB, runs stably in browser, good enough for PT-BR subtitles.
// whisper-small (~460MB) and above cause browser OOM / hangs at 30%.

import { pipeline, env } from '@huggingface/transformers';

(env as any).allowRemoteModels = true;
(env as any).useBrowserCache = true;
(env as any).allowLocalModels = false;

let _pipeline: any = null;

async function getOrCreatePipeline(onProgress: (msg: string) => void) {
  if (_pipeline) return _pipeline;

  onProgress('Carregando modelo Whisper (tiny ~75MB)…');

  _pipeline = await pipeline(
    'automatic-speech-recognition',
    'Xenova/whisper-tiny',  // ~75MB — única opção estável no browser sem OOM
    {
      progress_callback: (info: any) => {
        if (info?.status === 'downloading' || info?.status === 'progress') {
          const pct = info.progress != null ? Math.round(info.progress) : 0;
          const file = info.file ? ` (${info.file.split('/').pop()?.split('?')[0]})` : '';
          onProgress(`Baixando modelo${file}: ${pct}%`);
        } else if (info?.status === 'initiate') {
          onProgress('Inicializando modelo…');
        } else if (info?.status === 'done') {
          onProgress('Arquivo pronto!');
        } else if (info?.status === 'ready') {
          onProgress('Modelo pronto. Iniciando transcrição…');
        }
      },
    }
  );

  return _pipeline;
}

self.onmessage = async (e: MessageEvent) => {
  const { audioData, language } = e.data as { audioData: Float32Array; language: string };

  try {
    const transcriber = await getOrCreatePipeline((label) => {
      self.postMessage({ type: 'progress', label });
    });

    self.postMessage({ type: 'progress', label: 'Transcrevendo áudio…' });

    // Smaller chunks = less memory per step, prevents browser hang
    const result = await transcriber(audioData, {
      return_timestamps: true,  // sentence-level — stable, avoid word-level OOM
      chunk_length_s: 10,       // short chunks to reduce peak memory
      stride_length_s: 2,
      language: language || 'portuguese',
      task: 'transcribe',
    });

    const raw = Array.isArray(result) ? result[0] : result;
    self.postMessage({ type: 'result', raw });
  } catch (err: any) {
    self.postMessage({ type: 'error', message: err?.message ?? 'Erro na transcrição' });
  }
};
