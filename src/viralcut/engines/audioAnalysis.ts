import { SilenceRange } from '../types';

export interface AudioAnalysisOptions {
  threshold?: number;
  minSilenceMs?: number;
  frameMs?: number;
  onProgress?: (pct: number) => void;
}

/**
 * Detects silence ranges from a File using the Web Audio API.
 * Runs synchronously over decoded PCM data — no server required.
 */
export async function detectSilences(
  file: File,
  opts?: AudioAnalysisOptions
): Promise<SilenceRange[]> {
  const threshold = opts?.threshold ?? 0.022;
  const minSilenceMs = opts?.minSilenceMs ?? 220;
  const frameMs = opts?.frameMs ?? 20;
  const onProgress = opts?.onProgress;

  const arrayBuffer = await file.arrayBuffer();
  const audioCtx = new AudioContext();
  const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer.slice(0));

  // Mix down to mono by averaging all channels
  const numChannels = audioBuffer.numberOfChannels;
  const length = audioBuffer.length;
  const mixed = new Float32Array(length);

  for (let c = 0; c < numChannels; c++) {
    const ch = audioBuffer.getChannelData(c);
    for (let i = 0; i < length; i++) {
      mixed[i] += ch[i] / numChannels;
    }
  }

  const sampleRate = audioBuffer.sampleRate;
  const frameSize = Math.max(1, Math.floor((sampleRate * frameMs) / 1000));
  const minSilentFrames = Math.ceil(minSilenceMs / frameMs);
  const totalFrames = Math.ceil(length / frameSize);

  const silentFrames: boolean[] = [];

  for (let i = 0; i < length; i += frameSize) {
    let sum = 0;
    const end = Math.min(i + frameSize, length);

    for (let j = i; j < end; j++) {
      const v = mixed[j];
      sum += v * v;
    }

    const rms = Math.sqrt(sum / (end - i || 1));
    silentFrames.push(rms < threshold);

    if (onProgress && i % (frameSize * 100) === 0) {
      onProgress(Math.round((i / length) * 100));
    }
  }

  onProgress?.(100);

  const ranges: SilenceRange[] = [];
  let startFrame = -1;
  let count = 0;

  for (let i = 0; i < silentFrames.length; i++) {
    if (silentFrames[i]) {
      if (startFrame === -1) startFrame = i;
      count++;
    } else {
      if (startFrame !== -1 && count >= minSilentFrames) {
        ranges.push({
          start: (startFrame * frameMs) / 1000,
          end: ((startFrame + count) * frameMs) / 1000,
        });
      }
      startFrame = -1;
      count = 0;
    }
  }

  if (startFrame !== -1 && count >= minSilentFrames) {
    ranges.push({
      start: (startFrame * frameMs) / 1000,
      end: ((startFrame + count) * frameMs) / 1000,
    });
  }

  await audioCtx.close();
  return ranges;
}

/**
 * Extracts raw RMS energy per frame — used for waveform rendering.
 */
export async function extractRmsEnergy(
  file: File,
  frameMs = 20
): Promise<Float32Array> {
  const arrayBuffer = await file.arrayBuffer();
  const audioCtx = new AudioContext();
  const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer.slice(0));

  const numChannels = audioBuffer.numberOfChannels;
  const length = audioBuffer.length;
  const sampleRate = audioBuffer.sampleRate;
  const frameSize = Math.max(1, Math.floor((sampleRate * frameMs) / 1000));
  const numFrames = Math.ceil(length / frameSize);

  const mixed = new Float32Array(length);
  for (let c = 0; c < numChannels; c++) {
    const ch = audioBuffer.getChannelData(c);
    for (let i = 0; i < length; i++) {
      mixed[i] += ch[i] / numChannels;
    }
  }

  const rms = new Float32Array(numFrames);
  for (let f = 0; f < numFrames; f++) {
    const start = f * frameSize;
    const end = Math.min(start + frameSize, length);
    let sum = 0;
    for (let i = start; i < end; i++) {
      sum += mixed[i] * mixed[i];
    }
    rms[f] = Math.sqrt(sum / (end - start || 1));
  }

  await audioCtx.close();
  return rms;
}
