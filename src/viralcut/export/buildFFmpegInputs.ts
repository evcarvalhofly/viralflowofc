// ============================================================
// ViralCut – FFmpeg Input Builder
// Writes all unique source media files to the FFmpeg virtual FS
// and returns the -i argument list for the FFmpeg command.
// ============================================================
import { TrackItem, MediaFile } from '../types';

export interface FFmpegInputEntry {
  /** Virtual filename inside FFmpeg FS (e.g. "media_0.mp4") */
  fsName: string;
  /** Original MediaFile */
  mediaFile: MediaFile;
  /** 0-based index matching the -i position in the FFmpeg command */
  inputIndex: number;
}

/**
 * Given a list of track items (video + audio), deduplicate by mediaId,
 * fetch each Blob from the object URL, write it to FFmpeg's FS, and
 * return a map of mediaId → FFmpegInputEntry.
 */
export async function buildFFmpegInputs(
  items: TrackItem[],
  mediaMap: Map<string, MediaFile>,
  ffmpeg: { writeFile: (name: string, data: Uint8Array) => Promise<void> },
  onProgress?: (msg: string) => void
): Promise<Map<string, FFmpegInputEntry>> {
  const result = new Map<string, FFmpegInputEntry>();
  let inputIndex = 0;

  // Deduplicate by mediaId
  const seen = new Set<string>();
  for (const item of items) {
    if (!item.mediaId || seen.has(item.mediaId)) continue;
    seen.add(item.mediaId);

    const mf = mediaMap.get(item.mediaId);
    if (!mf) continue;

    const fsName = `media_${inputIndex}.${getExtension(mf.name)}`;
    onProgress?.(`Carregando "${mf.name}"…`);

    // Fetch the Blob from the object URL (could be File or Blob URL)
    const arrayBuf = await fileToArrayBuffer(mf.file ?? mf.url);
    await ffmpeg.writeFile(fsName, new Uint8Array(arrayBuf));

    result.set(item.mediaId, { fsName, mediaFile: mf, inputIndex });
    inputIndex++;
  }

  return result;
}

function getExtension(filename: string): string {
  const parts = filename.split('.');
  if (parts.length > 1) return parts[parts.length - 1].toLowerCase();
  return 'mp4';
}

async function fileToArrayBuffer(source: File | string): Promise<ArrayBuffer> {
  if (source instanceof File) {
    return source.arrayBuffer();
  }
  // It's a URL (object URL or regular URL)
  const resp = await fetch(source);
  if (!resp.ok) throw new Error(`Falha ao carregar arquivo: ${resp.status}`);
  return resp.arrayBuffer();
}
