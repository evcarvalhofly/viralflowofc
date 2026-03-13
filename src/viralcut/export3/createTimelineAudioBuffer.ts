// ============================================================
// ViralCut Export3 – Offline Audio Timeline Builder
//
// Builds a single AudioBuffer representing the entire timeline
// by decoding each audio/video clip offline and mixing them
// into a flat stereo buffer.
//
// This is completely independent of real-time playback.
// ============================================================

import { Project, MediaFile, TrackItem } from '../types';

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

    const decoded = decodedMap.get(item.mediaId);
    if (!decoded) continue;

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
      const clipSample = outSample - outStart; // position within clip in output samples
      const srcSample = Math.floor(srcStart + clipSample * playbackRate);

      if (srcSample >= decoded.length) break;

      const sL = srcChL ? (srcChL[srcSample] ?? 0) : 0;
      const sR = srcChR ? (srcChR[srcSample] ?? 0) : sL;

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
