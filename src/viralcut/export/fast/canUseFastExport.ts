// ============================================================
// ViralCut – Fast Export Detector
// Checks whether the browser supports WebCodecs-based export
// via @diffusionstudio/core.
// ============================================================

export function canUseFastExport(): boolean {
  return (
    typeof window !== 'undefined' &&
    'VideoEncoder' in window &&
    'VideoDecoder' in window &&
    'AudioEncoder' in window &&
    'AudioDecoder' in window
  );
}
