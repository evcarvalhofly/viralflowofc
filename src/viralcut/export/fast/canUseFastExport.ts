// ============================================================
// ViralCut – Native WebCodecs support detector
// ============================================================

export function canUseFastExport(): boolean {
  return (
    typeof window !== 'undefined' &&
    'VideoEncoder' in window &&
    'VideoDecoder' in window &&
    'AudioEncoder' in window &&
    'OffscreenCanvas' in window &&
    'AudioData' in window
  );
}
