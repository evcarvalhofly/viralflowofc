// ============================================================
// ViralCut Export2 – Asset pre-loader
// Pre-loads every video/audio element and every image bitmap
// before the render loop starts, eliminating mid-export stalls.
// ============================================================
import { Project, MediaFile } from '../types';

const LOAD_TIMEOUT_MS = 20_000;

export interface PreparedExportAssets {
  /** mediaId → HTMLVideoElement (for video + audio tracks) */
  videos: Map<string, HTMLVideoElement>;
  /** mediaId → ImageBitmap (for image tracks) */
  images: Map<string, ImageBitmap>;
}

// ── Load one video element ────────────────────────────────────
function loadVideo(url: string): Promise<HTMLVideoElement> {
  return new Promise((resolve) => {
    const el = document.createElement('video');
    el.muted = true; // will be un-muted via AudioContext
    el.playsInline = true;
    el.crossOrigin = 'anonymous';
    el.preload = 'auto';

    let settled = false;
    const settle = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(el);
    };

    const timer = setTimeout(settle, LOAD_TIMEOUT_MS);
    el.addEventListener('canplay', settle, { once: true });
    el.addEventListener('error', settle, { once: true });
    el.src = url;
    el.load();
  });
}

// ── Load one image as ImageBitmap ─────────────────────────────
function loadImage(url: string): Promise<ImageBitmap | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      createImageBitmap(img).then(resolve).catch(() => resolve(null));
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

// ── Main ─────────────────────────────────────────────────────
export async function prepareExportAssets(
  project: Project,
  mediaMap: Map<string, MediaFile>,
  onProgress?: (msg: string) => void
): Promise<PreparedExportAssets> {
  const videos = new Map<string, HTMLVideoElement>();
  const images = new Map<string, ImageBitmap>();

  // Collect unique media IDs by track type
  const videoIds = new Set<string>();
  const imageIds = new Set<string>();

  for (const track of project.tracks) {
    for (const item of track.items) {
      if (!item.mediaId) continue;
      if (track.type === 'video' || track.type === 'audio') videoIds.add(item.mediaId);
      else if (track.type === 'image') imageIds.add(item.mediaId);
    }
  }

  const videoArr = [...videoIds];
  const imageArr = [...imageIds];
  const total = videoArr.length + imageArr.length;
  let loaded = 0;

  for (const id of videoArr) {
    const mf = mediaMap.get(id);
    if (mf?.url) {
      onProgress?.(`Carregando vídeo ${++loaded}/${total}…`);
      const el = await loadVideo(mf.url);
      videos.set(id, el);
    }
  }

  for (const id of imageArr) {
    const mf = mediaMap.get(id);
    if (mf?.url) {
      onProgress?.(`Carregando imagem ${++loaded}/${total}…`);
      const bmp = await loadImage(mf.url);
      if (bmp) images.set(id, bmp);
    }
  }

  return { videos, images };
}

/** Release all loaded resources */
export function disposeExportAssets(assets: PreparedExportAssets) {
  assets.videos.forEach((el) => {
    try { el.pause(); el.src = ''; } catch { /* ignore */ }
  });
  assets.images.forEach((bmp) => {
    try { bmp.close(); } catch { /* ignore */ }
  });
}
