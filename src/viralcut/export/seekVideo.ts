// ============================================================
// ViralCut – Safe video seek helper
//
// Never draw a video frame immediately after setting currentTime.
// The seek is asynchronous — we must wait for 'seeked' to fire,
// and optionally for requestVideoFrameCallback if available.
// ============================================================

const SEEK_TIMEOUT_MS = 8_000;

/**
 * Seeks a video element to `time` and waits until the frame
 * is actually ready to be painted.
 */
export function seekVideoPrecisely(
  video: HTMLVideoElement,
  time: number
): Promise<void> {
  // If already close enough, skip
  if (Math.abs(video.currentTime - time) < 0.005) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve) => {
    let settled = false;

    const settle = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve();
    };

    // Hard fallback — never block the export indefinitely
    const timer = setTimeout(() => {
      console.warn('[ViralCut Seek] Timeout waiting for seeked event', time);
      settle();
    }, SEEK_TIMEOUT_MS);

    const onSeeked = () => {
      video.removeEventListener('seeked', onSeeked);
      // If the browser supports requestVideoFrameCallback, wait one more frame
      // so the decoded frame is fully available for drawImage
      if ('requestVideoFrameCallback' in video) {
        (video as any).requestVideoFrameCallback(settle);
        // Extra safety: if rVFC never fires (rare), resolve after 200ms
        setTimeout(settle, 200);
      } else {
        settle();
      }
    };

    video.addEventListener('seeked', onSeeked);
    video.currentTime = time;
  });
}

/**
 * Returns the media-file time for a given project timeline time,
 * factoring in trim start (mediaStart) and playback rate.
 */
export function getMediaTimeForTimelineTime(
  itemStart: number,
  itemMediaStart: number,
  playbackRate: number,
  timelineTime: number
): number {
  const offsetInClip = timelineTime - itemStart;
  return itemMediaStart + offsetInClip * playbackRate;
}
