// ============================================================
// ViralCut Export2 – Safe seek helper
// ============================================================

function waitVideoFrame(video: HTMLVideoElement): Promise<void> {
  return new Promise((resolve) => {
    const v = video as HTMLVideoElement & {
      requestVideoFrameCallback?: (cb: () => void) => number;
    };
    if (typeof v.requestVideoFrameCallback === 'function') {
      v.requestVideoFrameCallback(() => resolve());
    } else {
      requestAnimationFrame(() => resolve());
    }
  });
}

/**
 * Seeks a video element to `time` and waits until the decoded
 * frame is actually available for drawImage.
 */
export async function seekVideoPrecisely(
  video: HTMLVideoElement,
  time: number
): Promise<void> {
  const target = Math.max(
    0,
    Math.min(time, Math.max(0, (video.duration || 9999) - 0.01))
  );

  // Already close enough and frame ready
  if (Math.abs(video.currentTime - target) < 0.01 && video.readyState >= 2) {
    await waitVideoFrame(video);
    return;
  }

  await new Promise<void>((resolve) => {
    let done = false;
    const timeout = setTimeout(() => { if (!done) { done = true; resolve(); } }, 5000);

    const cleanup = () => {
      clearTimeout(timeout);
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('error', onError);
    };

    const onSeeked = () => {
      if (done) return;
      done = true;
      cleanup();
      resolve();
    };

    const onError = () => {
      if (done) return;
      done = true;
      cleanup();
      resolve(); // Don't reject — just continue with whatever frame is there
    };

    video.addEventListener('seeked', onSeeked, { once: true });
    video.addEventListener('error', onError, { once: true });
    video.currentTime = target;
  });

  await waitVideoFrame(video);
}
