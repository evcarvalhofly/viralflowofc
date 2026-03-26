import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

const MONTHLY_LIMIT_SECONDS = 3600; // 60 min/mês por usuário

export interface SubtitleSegment {
  start: number; // segundos relativos ao início do arquivo de mídia
  end: number;
  text: string;
}

export type SubtitleStyle = 'classic' | 'minimal' | 'viral';

/** Encode Float32Array mono como WAV Blob (16-bit PCM) */
function encodeWAV(samples: Float32Array, sampleRate: number): Blob {
  const buf = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buf);
  const str = (off: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i)); };
  str(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);    // PCM
  view.setUint16(22, 1, true);    // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byteRate
  view.setUint16(32, 2, true);    // blockAlign
  view.setUint16(34, 16, true);   // bitsPerSample
  str(36, 'data');
  view.setUint32(40, samples.length * 2, true);
  let off = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    off += 2;
  }
  return new Blob([buf], { type: 'audio/wav' });
}

/**
 * Extrai áudio do arquivo de vídeo, reamostrado para 16kHz mono WAV.
 * Isso reduz o tamanho significativamente (ex: vídeo 100MB → ~10MB de áudio).
 */
async function extractAudioWAV(file: File): Promise<Blob> {
  const arrayBuffer = await file.arrayBuffer();
  const tempCtx = new AudioContext();
  const decoded = await tempCtx.decodeAudioData(arrayBuffer);
  await tempCtx.close();

  const targetRate = 16000;
  const offlineCtx = new OfflineAudioContext(1, Math.ceil(decoded.duration * targetRate), targetRate);
  const source = offlineCtx.createBufferSource();
  source.buffer = decoded;
  source.connect(offlineCtx.destination);
  source.start(0);

  const rendered = await offlineCtx.startRendering();
  return encodeWAV(rendered.getChannelData(0), targetRate);
}

export function useSubtitleGeneration() {
  const [generating, setGenerating] = useState(false);
  const [statusLabel, setStatusLabel] = useState('');

  const getMonthlyUsed = useCallback(async (userId: string): Promise<number> => {
    const { data } = await (supabase as any).rpc('get_subtitle_usage', { p_user_id: userId });
    return (data as number) ?? 0;
  }, []);

  const generate = useCallback(async (opts: {
    videoFile: File;
    clipDurationSec: number;
    language: string;
    userId: string;
    apiKey: string;
  }): Promise<{ segments: SubtitleSegment[]; error?: string }> => {
    const { videoFile, clipDurationSec, language, userId, apiKey } = opts;

    // Verifica limite mensal
    const used = await getMonthlyUsed(userId);
    const remaining = MONTHLY_LIMIT_SECONDS - used;
    if (clipDurationSec > remaining) {
      const remMin = Math.floor(remaining / 60);
      return { segments: [], error: `Limite mensal atingido. Você tem apenas ${remMin} minutos restantes este mês.` };
    }

    setGenerating(true);
    try {
      // Prefere enviar arquivo direto se pequeno o suficiente (< 24MB)
      let audioPayload: Blob;
      let fileName: string;
      if (videoFile.size < 24 * 1024 * 1024) {
        audioPayload = videoFile;
        fileName = videoFile.name;
        setStatusLabel('Enviando para transcrição...');
      } else {
        setStatusLabel('Extraindo áudio...');
        audioPayload = await extractAudioWAV(videoFile);
        fileName = 'audio.wav';
        setStatusLabel('Transcrevendo com Whisper...');
      }

      const formData = new FormData();
      formData.append('file', audioPayload, fileName);
      formData.append('model', 'whisper-1');
      formData.append('language', language);
      formData.append('response_format', 'verbose_json');
      formData.append('timestamp_granularities[]', 'segment');

      const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}` },
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error?.message ?? `Erro HTTP ${res.status}`);
      }

      const data = await res.json();
      const segments: SubtitleSegment[] = (data.segments ?? []).map((s: any) => ({
        start: s.start,
        end: s.end,
        text: s.text.trim(),
      }));

      // Registra uso no banco (não bloqueia em caso de falha)
      (supabase as any)
        .rpc('increment_subtitle_usage', { p_user_id: userId, p_seconds: Math.ceil(clipDurationSec) })
        .catch(() => {});

      return { segments };
    } catch (e: any) {
      return { segments: [], error: e.message ?? 'Erro desconhecido' };
    } finally {
      setGenerating(false);
      setStatusLabel('');
    }
  }, [getMonthlyUsed]);

  return { generating, statusLabel, generate, getMonthlyUsed, MONTHLY_LIMIT_SECONDS };
}
