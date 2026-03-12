// ============================================================
// ViralCut – Audio Mixer for Export
// Uses OfflineAudioContext to mix all tracks into stereo PCM.
// ============================================================
import type { Composition } from '../core/compositionTypes';

const log = (...a: unknown[]) => console.log('[AudioMix]', ...a);

export async function mixCompositionAudio(
  composition: Composition,
  sampleRate = 48_000
): Promise<Float32Array[]> {
  const numSamples = Math.ceil(composition.duration * sampleRate);
  const audioCtx   = new OfflineAudioContext(2, numSamples, sampleRate);

  const decodeFile = async (file: File): Promise<AudioBuffer | null> => {
    try {
      const ab   = await file.arrayBuffer();
      return await audioCtx.decodeAudioData(ab.slice(0));
    } catch (err) {
      log('decode error:', err);
      return null;
    }
  };

  let scheduled = 0;

  for (const item of composition.items) {
    if (item.type !== 'audio' && item.type !== 'video') continue;
    if (!item.sourceFile) continue;

    const props = item.type === 'audio' ? item.audioProps : item.videoProps;
    const volume = (props as any)?.volume ?? 1;
    if (volume === 0) continue;

    const buf = await decodeFile(item.sourceFile);
    if (!buf) continue;

    const src   = audioCtx.createBufferSource();
    src.buffer  = buf;

    const gain       = audioCtx.createGain();
    gain.gain.value  = volume;

    const rate = (props as any)?.playbackRate ?? 1;
    src.playbackRate.value = rate;

    // Fade in/out for audio tracks
    if (item.type === 'audio' && item.audioProps) {
      const { fadeIn = 0, fadeOut = 0 } = item.audioProps;
      if (fadeIn > 0) {
        gain.gain.setValueAtTime(0, item.startTime);
        gain.gain.linearRampToValueAtTime(volume, item.startTime + fadeIn);
      }
      if (fadeOut > 0) {
        gain.gain.setValueAtTime(volume, item.endTime - fadeOut);
        gain.gain.linearRampToValueAtTime(0, item.endTime);
      }
    }

    src.connect(gain).connect(audioCtx.destination);

    const requestedDur = Math.max(0, item.endTime - item.startTime);
    const maxAvailable = Math.max(0, buf.duration - item.mediaStart);
    const safeDur      = Math.min(requestedDur, maxAvailable);

    if (safeDur > 0.001) {
      src.start(item.startTime, item.mediaStart, safeDur);
      scheduled++;
    }
  }

  if (scheduled === 0) {
    const silence = new Float32Array(numSamples);
    return [silence, silence];
  }

  const rendered = await audioCtx.startRendering();
  const l = rendered.getChannelData(0);
  const r = rendered.numberOfChannels > 1 ? rendered.getChannelData(1) : rendered.getChannelData(0);
  return [l, r];
}
