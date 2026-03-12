// ============================================================
// ViralCut – Timeline → Composition Adapter
//
// Converts the UI timeline model (Project + MediaFile[]) into
// the internal Composition model consumed by the export engine.
// ============================================================
import { Project, MediaFile, TrackItem } from '@/viralcut/types';
import {
  Composition, CompositionItem,
  VideoProps, AudioProps, ImageProps, TextStyle,
} from '../core/compositionTypes';

function getZIndex(type: TrackItem['type'], trackIndex: number): number {
  // video = base (0-9), audio = hidden (not rendered), image = 10-49, text = 50-99
  switch (type) {
    case 'video': return trackIndex;
    case 'audio': return 0; // audio not composited visually
    case 'image': return 10 + trackIndex;
    case 'text':  return 50 + trackIndex;
  }
}

export function timelineToComposition(
  project: Project,
  media: MediaFile[]
): Composition {
  const mediaMap = new Map(media.map((m) => [m.id, m]));
  const items: CompositionItem[] = [];

  project.tracks.forEach((track, trackIndex) => {
    if (track.muted) return;

    track.items.forEach((item) => {
      const dur = item.endTime - item.startTime;
      if (dur < 0.04) return; // skip micro-clips

      const mf = mediaMap.get(item.mediaId);
      // Text items have no mediaId
      if (item.type !== 'text' && !mf) return;

      let videoProps: VideoProps | undefined;
      let audioProps: AudioProps | undefined;
      let imageProps: ImageProps | undefined;
      let textStyle: TextStyle | undefined;

      if (item.type === 'video' && item.videoDetails) {
        const vd = item.videoDetails;
        videoProps = {
          volume: vd.volume ?? 1,
          opacity: vd.opacity ?? 1,
          flipH: vd.flipH ?? false,
          flipV: vd.flipV ?? false,
          playbackRate: vd.playbackRate ?? 1,
          brightness: vd.brightness ?? 1,
          contrast: vd.contrast ?? 1,
          saturation: vd.saturation ?? 1,
        };
      }

      if (item.type === 'audio' && item.audioDetails) {
        const ad = item.audioDetails;
        audioProps = {
          volume: ad.volume ?? 1,
          playbackRate: ad.playbackRate ?? 1,
          fadeIn: ad.fadeIn ?? 0,
          fadeOut: ad.fadeOut ?? 0,
        };
      }

      if (item.type === 'image' && item.imageDetails) {
        const id = item.imageDetails;
        imageProps = {
          opacity: id.opacity ?? 1,
          flipH: id.flipH ?? false,
          flipV: id.flipV ?? false,
          posX: id.posX ?? 50,
          posY: id.posY ?? 50,
          width: id.width ?? 50,
          height: id.height ?? 50,
          brightness: id.brightness ?? 1,
          contrast: id.contrast ?? 1,
          saturation: id.saturation ?? 1,
        };
      }

      if (item.type === 'text' && item.textDetails) {
        const td = item.textDetails;
        textStyle = {
          text: td.text ?? '',
          fontSize: td.fontSize ?? 3.5,
          fontFamily: td.fontFamily ?? 'sans-serif',
          color: td.color ?? '#ffffff',
          textAlign: td.textAlign ?? 'center',
          opacity: td.opacity ?? 1,
          backgroundColor: td.backgroundColor ?? 'transparent',
          boxShadow: td.boxShadow ?? { color: '#000000', x: 0, y: 0, blur: 0 },
          posX: td.posX ?? 50,
          posY: td.posY ?? 80,
          width: td.width ?? 80,
        };
      }

      const ci: CompositionItem = {
        id: item.id,
        type: item.type,
        sourceFile: mf?.file,
        sourceUrl: mf?.url ?? '',
        startTime: item.startTime,
        endTime: item.endTime,
        mediaStart: item.mediaStart,
        mediaEnd: item.mediaEnd,
        zIndex: getZIndex(item.type, trackIndex),
        name: item.name,
        videoProps,
        audioProps,
        imageProps,
        textStyle,
      };

      items.push(ci);
    });
  });

  // Sort by zIndex so compositing order is correct
  items.sort((a, b) => a.zIndex - b.zIndex);

  return {
    width: project.width || 1920,
    height: project.height || 1080,
    fps: project.fps === 60 ? 60 : 30,
    duration: project.duration,
    aspectRatio: project.aspectRatio,
    items,
  };
}
