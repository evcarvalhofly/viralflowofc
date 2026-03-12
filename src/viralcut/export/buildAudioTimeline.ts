// ============================================================
// ViralCut – Audio Timeline Builder
//
// Pre-decodes all audio/video clips that contribute audio,
// then schedules every segment as an AudioBufferSourceNode
// at the exact AudioContext position on the timeline.
//
// This is far more reliable than piping MediaElementSource
// through the AudioContext because:
//  - No dependency on video element seek timing
//  - No gaps between clips due to seek delays
//  - Precise trim (offset/duration) via .start(when, offset, dur)
//  - Works even if the video element hasn't seeked yet
// ============================================================
import { Project, MediaFile } from '../types';

const DEBUG = true;
function log(...a: unknown[]) { if (DEBUG) console.log('[ViralCut Audio]', ...a); }

// ── Helpers ──────────────────────────────────────────────────

async function fetchAndDecode(
  ctx: AudioContext,
  url: string
): Promise<AudioBuffer | null> {
  try {
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const ab = await res.arrayBuffer();
    return await ctx.decodeAudioData(ab);
  } catch (err) {
    log('decode failed for', url, err);
    return null;
  }
}

// ── Main ─────────────────────────────────────────────────────

export interface ScheduledAudioResult {
  /** The destination node — connect its output to whatever stream you need */
  destination: MediaStreamAudioDestinationNode;
  /** Call this to stop all scheduled sources (on cancel / after export) */
  dispose: () => void;
}

/**
 * Builds and schedules the full audio timeline into a single
 * MediaStreamAudioDestinationNode.
 *
 * @param ctx       An AudioContext that is already running (or will be resumed)
 * @param project   Sanitized project
 * @param mediaMap  Map of mediaId → MediaFile
 * @param startAt   AudioContext.currentTime at which t=0 of the timeline starts
 */
export async function buildAudioTimeline(
  ctx: AudioContext,
  project: Project,
  mediaMap: Map<string, MediaFile>,
  startAt: number,
  onProgress?: (msg: string) => void
): Promise<ScheduledAudioResult> {

  const masterGain = ctx.createGain();
  masterGain.gain.value = 1;
  const destination = ctx.createMediaStreamDestination();
  masterGain.connect(destination);

  // Collect all audio-bearing items (video tracks with audio + dedicated audio tracks)
  type AudioItem = {
    url: string;
    timelineStart: number;  // seconds on the project timeline
    timelineEnd: number;
    mediaStart: number;     // trim start inside the source file
    volume: number;
    playbackRate: number;
  };

  const items: AudioItem[] = [];

  for (const track of project.tracks) {
    if (track.muted) continue;
    if (track.type !== 'video' && track.type !== 'audio') continue;

    for (const item of track.items) {
      const mf = mediaMap.get(item.mediaId);
      if (!mf) continue;
      const duration = item.endTime - item.startTime;
      if (duration <= 0) continue;

      const volume =
        track.type === 'video'
          ? (item.videoDetails?.volume ?? 1)
          : (item.audioDetails?.volume ?? 1);

      const playbackRate =
        track.type === 'video'
          ? (item.videoDetails?.playbackRate ?? 1)
          : (item.audioDetails?.playbackRate ?? 1);

      items.push({
        url: mf.url,
        timelineStart: item.startTime,
        timelineEnd: item.endTime,
        mediaStart: item.mediaStart,
        volume,
        playbackRate,
      });
    }
  }

  log(`Scheduling ${items.length} audio items`);

  // Deduplicate URLs for decoding
  const urlSet = new Set(items.map((i) => i.url));
  const bufferMap = new Map<string, AudioBuffer | null>();
  let decoded = 0;
  for (const url of urlSet) {
    onProgress?.(`Decodificando áudio ${++decoded}/${urlSet.size}…`);
    bufferMap.set(url, await fetchAndDecode(ctx, url));
  }

  // Schedule all items
  const allSources: AudioBufferSourceNode[] = [];

  for (const item of items) {
    const buffer = bufferMap.get(item.url);
    if (!buffer) continue;

    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.value = Math.min(Math.max(item.playbackRate, 0.1), 4);

    const gainNode = ctx.createGain();
    gainNode.gain.value = Math.min(1, Math.max(0, item.volume));

    src.connect(gainNode);
    gainNode.connect(masterGain);

    // AudioContext time when this clip should start playing
    const when = startAt + item.timelineStart;
    // Offset inside the source buffer (respects trim)
    const offset = item.mediaStart;
    // How long to play (in source-time, so divide by playbackRate for wall-clock)
    const clipDuration = item.timelineEnd - item.timelineStart;
    const sourceDuration = clipDuration * item.playbackRate;

    // Clamp to buffer length
    const safeOffset = Math.max(0, Math.min(offset, buffer.duration - 0.01));
    const safeDuration = Math.min(sourceDuration, buffer.duration - safeOffset);

    if (safeDuration <= 0) continue;

    src.start(Math.max(0, when), safeOffset, safeDuration);
    allSources.push(src);

    log(
      `Scheduled audio: timelineStart=${item.timelineStart.toFixed(3)}`,
      `when=${when.toFixed(3)} offset=${safeOffset.toFixed(3)} dur=${safeDuration.toFixed(3)}`
    );
  }

  log(`Total scheduled audio sources: ${allSources.length}`);

  const dispose = () => {
    for (const src of allSources) {
      try { src.stop(); } catch { /* already stopped */ }
      src.disconnect();
    }
    masterGain.disconnect();
  };

  return { destination, dispose };
}
