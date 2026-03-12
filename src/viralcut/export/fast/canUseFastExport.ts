// ============================================================
// ViralCut – Real async probe for WebCodecs / fast export
//
// Does NOT just check API existence — it actually tries to
// configure a VideoEncoder, which surfaces hardware/driver
// limitations on mobile early, before any real work starts.
// ============================================================

export interface FastExportProbeResult {
  ok: boolean;
  reason?: string;
}

export async function canUseFastExport(): Promise<FastExportProbeResult> {
  if (typeof window === 'undefined') {
    return { ok: false, reason: 'Sem window' };
  }

  if (
    !('VideoEncoder' in window) ||
    !('AudioEncoder' in window) ||
    !('AudioData'    in window) ||
    !('OffscreenCanvas' in window)
  ) {
    return { ok: false, reason: 'APIs essenciais indisponíveis (VideoEncoder/AudioEncoder/OffscreenCanvas)' };
  }

  try {
    // Verify OffscreenCanvas 2D context is usable
    const canvas = new OffscreenCanvas(16, 16);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return { ok: false, reason: 'OffscreenCanvas 2D context indisponível' };
    }

    // Real hardware probe with a minimal config
    const support = await VideoEncoder.isConfigSupported({
      codec: 'avc1.42001E',
      width: 16,
      height: 16,
      bitrate: 200_000,
      framerate: 30,
      hardwareAcceleration: 'prefer-hardware',
    });

    if (!support.supported) {
      // Try software fallback config before giving up
      const sw = await VideoEncoder.isConfigSupported({
        codec: 'avc1.42001E',
        width: 16,
        height: 16,
        bitrate: 200_000,
        framerate: 30,
        hardwareAcceleration: 'no-preference',
      });
      if (!sw.supported) {
        return { ok: false, reason: 'VideoEncoder H.264 não suportado neste dispositivo' };
      }
    }

    return { ok: true };
  } catch (err: any) {
    return { ok: false, reason: err?.message || 'Probe falhou' };
  }
}
