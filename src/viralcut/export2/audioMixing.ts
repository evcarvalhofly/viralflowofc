// ============================================================
// ViralCut Export2 – Audio mixing for export
//
// Strategy: use createMediaElementSource to tap each video
// element's audio through the AudioContext graph.
// This is simpler than the pre-decode approach and avoids
// CORS fetch issues with blob: URLs.
// Each video element is connected once; we control volume/mute
// by manipulating GainNodes — no reconnection needed per frame.
// ============================================================
import { Project, MediaFile } from '../types';
import { PreparedExportAssets } from './prepareExportAssets';

export interface AudioMixResult {
  destination: MediaStreamAudioDestinationNode;
  /** Call before advancing each frame to sync video element currentTime */
  syncVideoToTime(mediaId: string, time: number): void;
  dispose(): void;
}

export async function buildExportAudioMix(
  project: Project,
  mediaMap: Map<string, MediaFile>,
  assets: PreparedExportAssets
): Promise<AudioMixResult> {
  const ctx = new AudioContext({ sampleRate: 44100 });
  await ctx.resume().catch(() => {});

  const destination = ctx.createMediaStreamDestination();
  const masterGain = ctx.createGain();
  masterGain.gain.value = 1;
  masterGain.connect(destination);

  // Connect each unique video element once
  const gainMap = new Map<string, GainNode>();
  const sourceMap = new Map<string, MediaElementAudioSourceNode>();

  for (const track of project.tracks) {
    if (track.muted) continue;
    if (track.type !== 'video' && track.type !== 'audio') continue;

    for (const item of track.items) {
      const { mediaId } = item;
      if (!mediaId || sourceMap.has(mediaId)) continue;
      const el = assets.videos.get(mediaId);
      if (!el) continue;

      try {
        const source = ctx.createMediaElementSource(el);
        const gain = ctx.createGain();
        gain.gain.value = track.muted ? 0 : (item.videoDetails?.volume ?? item.audioDetails?.volume ?? 1);
        source.connect(gain);
        gain.connect(masterGain);
        sourceMap.set(mediaId, source);
        gainMap.set(mediaId, gain);
        // Unmute the element so audio flows through the graph
        el.muted = false;
      } catch {
        // Already connected — createMediaElementSource can only be called once per element
      }
    }
  }

  const syncVideoToTime = (mediaId: string, time: number) => {
    const el = assets.videos.get(mediaId);
    if (!el) return;
    // Update gain for current item volume
    const gainNode = gainMap.get(mediaId);
    if (gainNode) {
      for (const track of project.tracks) {
        if (track.type !== 'video' && track.type !== 'audio') continue;
        for (const item of track.items) {
          if (item.mediaId === mediaId && time >= item.startTime && time < item.endTime) {
            const vol = track.muted ? 0 : (item.videoDetails?.volume ?? item.audioDetails?.volume ?? 1);
            gainNode.gain.value = vol;
          }
        }
      }
    }
  };

  const dispose = () => {
    for (const src of sourceMap.values()) {
      try { src.disconnect(); } catch { /* ignore */ }
    }
    masterGain.disconnect();
    ctx.close().catch(() => {});
  };

  return { destination, syncVideoToTime, dispose };
}
