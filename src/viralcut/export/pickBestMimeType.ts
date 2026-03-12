// ============================================================
// ViralCut – Mime-type picker for MediaRecorder
// ============================================================

const WEBM_MIME_PREFS = [
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm;codecs=vp9',
  'video/webm;codecs=vp8',
  'video/webm',
] as const;

/** Returns the best supported WebM mime type for MediaRecorder. */
export function pickBestMimeType(): string {
  for (const mime of WEBM_MIME_PREFS) {
    try {
      if (MediaRecorder.isTypeSupported(mime)) return mime;
    } catch { /* some browsers throw on unsupported types */ }
  }
  return 'video/webm';
}
