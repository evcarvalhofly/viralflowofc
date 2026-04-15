// ============================================================
// ViralCut Export3 – Offline Audio Timeline Builder
//
// Builds a single AudioBuffer representing the entire timeline
// by decoding each audio/video clip offline and mixing them
// into a flat stereo buffer.
//
// This is completely independent of real-time playback.
// ============================================================

import { Project, MediaFile, TrackItem, NoiseReductionLevel } from '../types';

const SAMPLE_RATE = 44100;

/**
 * Decodes a media file (video or audio) offline via AudioContext.decodeAudioData.
 * Returns null on failure.
 */
async function decodeMedia(url: string): Promise<AudioBuffer | null> {
  try {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const ctx = new OfflineAudioContext(2, 1, SAMPLE_RATE);
    const decoded = await ctx.decodeAudioData(arrayBuffer);
    return decoded;
  } catch {
    return null;
  }
}

// NR parameters per level:
//   hpFreq  – high-pass cutoff (removes hum / rumble below this Hz)
//   lpFreq  – low-pass cutoff  (removes hiss / sibilance above this Hz)
//   gate    – RMS amplitude threshold for noise gate (linear, 0–1)
const NR_PARAMS: Record<Exclude<NoiseReductionLevel, 'off'>, { hpFreq: number; lpFreq: number; gate: number }> = {
  low:    { hpFreq: 100, lpFreq: 12000, gate: 0.008 },
  medium: { hpFreq: 200, lpFreq:  8000, gate: 0.018 },
  high:   { hpFreq: 400, lpFreq:  6000, gate: 0.035 },
};

/**
 * Noise gate applied directly on a decoded AudioBuffer.
 * Silences blocks whose RMS energy falls below `threshold`,
 * with a short lookahead and release-hold to avoid clipping speech.
 */
function noiseGate(buffer: AudioBuffer, threshold: number): void {
  const blockSize = 512;
  // 100 ms release hold keeps gate open briefly after speech ends
  const releaseBlocks = Math.round(0.1 * buffer.sampleRate / blockSize);

  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const data = buffer.getChannelData(ch);
    const nBlocks = Math.ceil(data.length / blockSize);

    // Pass 1 – per-block gate decision
    const open = new Uint8Array(nBlocks);
    for (let b = 0; b < nBlocks; b++) {
      let rms = 0;
      const s = b * blockSize;
      const e = Math.min(s + blockSize, data.length);
      for (let j = s; j < e; j++) rms += data[j] * data[j];
      open[b] = Math.sqrt(rms / (e - s)) > threshold ? 1 : 0;
    }

    // Pass 2 – 1-block lookahead so speech onset is never cut
    for (let b = nBlocks - 2; b >= 0; b--) {
      if (open[b + 1]) open[b] = 1;
    }

    // Pass 3 – release hold
    let hold = 0;
    for (let b = 0; b < nBlocks; b++) {
      if (open[b]) { hold = releaseBlocks; }
      else if (hold > 0) { open[b] = 1; hold--; }
    }

    // Pass 4 – apply gain with linear ramp at each block boundary to avoid clicks
    let prevGain = open[0] ? 1.0 : 0.0;
    for (let b = 0; b < nBlocks; b++) {
      const targetGain = open[b] ? 1.0 : 0.0;
      const s = b * blockSize;
      const e = Math.min(s + blockSize, data.length);
      for (let j = s; j < e; j++) {
        const t = (j - s) / (e - s);
        data[j] *= prevGain + (targetGain - prevGain) * t;
      }
      prevGain = targetGain;
    }
  }
}

/**
 * Applies noise reduction to an AudioBuffer:
 *   1. High-pass filter  – removes low-frequency hum / rumble
 *   2. Low-pass filter   – removes high-frequency hiss / sibilance
 *   3. Noise gate        – silences passages below the RMS threshold
 */
async function applyNoiseReduction(
  buffer: AudioBuffer,
  level: Exclude<NoiseReductionLevel, 'off'>
): Promise<AudioBuffer> {
  const p = NR_PARAMS[level];

  const ctx = new OfflineAudioContext(buffer.numberOfChannels, buffer.length, buffer.sampleRate);
  const source = ctx.createBufferSource();
  source.buffer = buffer;

  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = p.hpFreq;
  hp.Q.value = 0.7;

  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = p.lpFreq;
  lp.Q.value = 0.7;

  source.connect(hp);
  hp.connect(lp);
  lp.connect(ctx.destination);
  source.start(0);

  const filtered = await ctx.startRendering();
  noiseGate(filtered, p.gate);
  return filtered;
}

function getAudioItems(project: Project): Array<{ item: TrackItem; muted: boolean }> {
  const result: Array<{ item: TrackItem; muted: boolean }> = [];
  for (const track of project.tracks) {
    if (track.type !== 'video' && track.type !== 'audio') continue;
    for (const item of track.items) {
      result.push({ item, muted: track.muted });
    }
  }
  return result;
}

export async function createTimelineAudioBuffer(
  project: Project,
  mediaMap: Map<string, MediaFile>,
  onProgress: (msg: string) => void
): Promise<AudioBuffer | null> {
  const totalDuration = project.duration;
  if (totalDuration <= 0) return null;

  const totalSamples = Math.ceil(totalDuration * SAMPLE_RATE);
  const outputL = new Float32Array(totalSamples);
  const outputR = new Float32Array(totalSamples);

  // Decode all unique audio sources first
  const audioItems = getAudioItems(project);
  const decodedMap = new Map<string, AudioBuffer | null>();

  const uniqueMediaIds = [...new Set(audioItems.map((a) => a.item.mediaId))];
  let idx = 0;
  for (const mediaId of uniqueMediaIds) {
    const mf = mediaMap.get(mediaId);
    if (!mf?.url) { decodedMap.set(mediaId, null); continue; }
    onProgress(`Decodificando áudio ${++idx}/${uniqueMediaIds.length}…`);
    const decoded = await decodeMedia(mf.url);
    decodedMap.set(mediaId, decoded);
  }

  // Mix each clip into the output buffer
  for (const { item, muted } of audioItems) {
    if (muted) continue;

    let decoded = decodedMap.get(item.mediaId);
    if (!decoded) continue;

    const noiseReduction = item.videoDetails?.noiseReduction ?? item.audioDetails?.noiseReduction ?? 'off';
    if (noiseReduction && noiseReduction !== 'off') {
      decoded = await applyNoiseReduction(decoded, noiseReduction);
    }

    const volume = item.videoDetails?.volume ?? item.audioDetails?.volume ?? 1;
    if (volume <= 0) continue;

    const playbackRate = item.videoDetails?.playbackRate ?? item.audioDetails?.playbackRate ?? 1;

    // Timeline position in samples
    const outStart = Math.floor(item.startTime * SAMPLE_RATE);
    const outEnd = Math.min(Math.ceil(item.endTime * SAMPLE_RATE), totalSamples);

    // Source position in decoded buffer
    const srcStart = (item.mediaStart ?? 0) * SAMPLE_RATE;

    const srcChL = decoded.numberOfChannels >= 1 ? decoded.getChannelData(0) : null;
    const srcChR = decoded.numberOfChannels >= 2 ? decoded.getChannelData(1) : srcChL;

    for (let outSample = outStart; outSample < outEnd; outSample++) {
      const clipSample = outSample - outStart;
      const srcPos = srcStart + clipSample * playbackRate;
      const srcIdx = Math.floor(srcPos);
      const frac   = srcPos - srcIdx;

      if (srcIdx >= decoded.length) break;

      // Linear interpolation between adjacent samples for smooth playback rate changes
      const sL0 = srcChL ? (srcChL[srcIdx]     ?? 0) : 0;
      const sL1 = srcChL ? (srcChL[srcIdx + 1] ?? sL0) : 0;
      const sR0 = srcChR ? (srcChR[srcIdx]     ?? 0) : sL0;
      const sR1 = srcChR ? (srcChR[srcIdx + 1] ?? sR0) : sL1;

      const sL = sL0 + (sL1 - sL0) * frac;
      const sR = sR0 + (sR1 - sR0) * frac;

      outputL[outSample] = Math.max(-1, Math.min(1, outputL[outSample] + sL * volume));
      outputR[outSample] = Math.max(-1, Math.min(1, outputR[outSample] + sR * volume));
    }
  }

  // Build final AudioBuffer
  const hasAudio = outputL.some((v) => v !== 0) || outputR.some((v) => v !== 0);
  if (!hasAudio) return null;

  const ctx = new OfflineAudioContext(2, totalSamples, SAMPLE_RATE);
  const finalBuffer = ctx.createBuffer(2, totalSamples, SAMPLE_RATE);
  finalBuffer.copyToChannel(outputL, 0);
  finalBuffer.copyToChannel(outputR, 1);
  return finalBuffer;
}
