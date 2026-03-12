// ============================================================
// ViralCut – Media pre-loader for export
// Pre-loads all video elements and seeks to their start positions
// before the main render loop begins — eliminates seek stalls.
// ============================================================
import { TrackItem, MediaFile } from '../types';

export interface PreparedVideoElement {
  itemId: string;
  mediaId: string;
  el: HTMLVideoElement;
  safeMediaEnd: number;
}

const LOAD_TIMEOUT_MS = 15_000;

function loadAndSeek(
  el: HTMLVideoElement,
  url: string,
  seekTo: number
): Promise<void> {
  return new Promise((resolve) => {
    let settled = false;
    const settle = () => {
      if (!settled) { settled = true; resolve(); }
    };
    const timer = setTimeout(settle, LOAD_TIMEOUT_MS);

    const onMeta = () => {
      el.removeEventListener('loadedmetadata', onMeta);
      const safe = Math.max(0, Math.min(seekTo, (el.duration || 9999) - 0.01));
      el.currentTime = safe;
      const onSeeked = () => {
        el.removeEventListener('seeked', onSeeked);
        clearTimeout(timer);
        settle();
      };
      el.addEventListener('seeked', onSeeked);
      setTimeout(settle, 5000); // fallback if seeked never fires
    };

    el.addEventListener('loadedmetadata', onMeta);
    el.addEventListener('error', () => { clearTimeout(timer); settle(); });
    el.src = url;
    el.load();
  });
}

/**
 * Pre-loads and seeks all unique video/audio elements needed for export.
 * Returns a map of mediaId → prepared HTMLVideoElement.
 */
export async function prepareMediaForExport(
  videoItems: TrackItem[],
  mediaMap: Map<string, MediaFile>,
  onProgress?: (msg: string) => void
): Promise<Map<string, HTMLVideoElement>> {
  const result = new Map<string, HTMLVideoElement>();

  // Deduplicate by mediaId — one element per unique file
  const seen = new Set<string>();
  const toLoad: { mediaId: string; url: string; seekTo: number }[] = [];

  for (const item of videoItems) {
    if (seen.has(item.mediaId)) continue;
    seen.add(item.mediaId);
    const mf = mediaMap.get(item.mediaId);
    if (!mf) continue;
    toLoad.push({ mediaId: item.mediaId, url: mf.url, seekTo: item.mediaStart });
  }

  for (let i = 0; i < toLoad.length; i++) {
    const { mediaId, url, seekTo } = toLoad[i];
    onProgress?.(`Pré-carregando mídia ${i + 1}/${toLoad.length}…`);
    const el = document.createElement('video');
    el.muted = false;
    el.playsInline = true;
    el.crossOrigin = 'anonymous';
    el.preload = 'auto';
    await loadAndSeek(el, url, seekTo);
    result.set(mediaId, el);
  }

  return result;
}
