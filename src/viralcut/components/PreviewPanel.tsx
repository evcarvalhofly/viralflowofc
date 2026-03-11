// ============================================================
// PreviewPanel – Video preview with text/image overlays + effects
// ============================================================
import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Play, Pause, SkipBack, SkipForward, Volume2, VolumeX,
} from 'lucide-react';
import { Track, TrackItem, MediaFile } from '../types';
import { cn } from '@/lib/utils';

interface PreviewPanelProps {
  tracks: Track[];
  media: MediaFile[];
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  onTimeChange: (t: number) => void;
  onPlayPause: () => void;
  projectName: string;
}

function fmt(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  const ms = Math.floor((s % 1) * 10);
  return `${m}:${String(sec).padStart(2, '0')}.${ms}`;
}

/** Build CSS filter string from video/image details */
function buildFilter(brightness = 1, contrast = 1, saturation = 1) {
  return `brightness(${brightness}) contrast(${contrast}) saturate(${saturation})`;
}

/** Build CSS transform for flips */
function buildTransform(flipH = false, flipV = false) {
  const sx = flipH ? -1 : 1;
  const sy = flipV ? -1 : 1;
  if (sx === 1 && sy === 1) return undefined;
  return `scale(${sx}, ${sy})`;
}

export function PreviewPanel({
  tracks,
  media,
  currentTime,
  duration,
  isPlaying,
  onTimeChange,
  onPlayPause,
  projectName,
}: PreviewPanelProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);

  // ── Find active items at currentTime ─────────────────────────
  const activeVideoItem = (() => {
    for (const track of tracks) {
      if (track.type !== 'video' || track.muted) continue;
      for (const item of track.items) {
        if (currentTime >= item.startTime && currentTime < item.endTime) {
          return { item, mediaFile: media.find((m) => m.id === item.mediaId) };
        }
      }
    }
    return null;
  })();

  const activeTextItems: TrackItem[] = tracks
    .filter((t) => t.type === 'text' && !t.muted)
    .flatMap((t) => t.items)
    .filter((i) => currentTime >= i.startTime && currentTime < i.endTime);

  const activeImageItems: { item: TrackItem; mediaFile?: MediaFile }[] = tracks
    .filter((t) => t.type === 'image' && !t.muted)
    .flatMap((t) => t.items)
    .filter((i) => currentTime >= i.startTime && currentTime < i.endTime)
    .map((item) => ({ item, mediaFile: media.find((m) => m.id === item.mediaId) }));

  // ── Sync video element ────────────────────────────────────────
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !activeVideoItem?.mediaFile) return;
    const mediaTime = activeVideoItem.item.mediaStart + (currentTime - activeVideoItem.item.startTime);
    if (Math.abs(v.currentTime - mediaTime) > 0.15) {
      v.currentTime = mediaTime;
    }
  }, [currentTime, activeVideoItem]);

  // Apply playback rate from videoDetails
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const rate = activeVideoItem?.item.videoDetails?.playbackRate ?? 1;
    v.playbackRate = rate;
  }, [activeVideoItem]);

  // Apply volume from videoDetails
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const itemVolume = activeVideoItem?.item.videoDetails?.volume ?? 1;
    v.volume = Math.min(1, itemVolume) * (muted ? 0 : volume);
    v.muted = muted;
  }, [activeVideoItem, muted, volume]);

  // Play/pause sync
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (isPlaying) v.play().catch(() => {});
    else v.pause();
  }, [isPlaying, activeVideoItem?.item.id]);

  // ── Audio tracks ──────────────────────────────────────────────
  useEffect(() => {
    const activeAudioItems = tracks
      .filter((t) => t.type === 'audio' && !t.muted)
      .flatMap((t) => t.items)
      .filter((i) => currentTime >= i.startTime && currentTime < i.endTime);

    activeAudioItems.forEach((item) => {
      const mf = media.find((m) => m.id === item.mediaId);
      if (!mf) return;
      if (!audioRefs.current.has(item.id)) {
        const audio = new Audio(mf.url);
        audio.preload = 'auto';
        audioRefs.current.set(item.id, audio);
      }
      const audio = audioRefs.current.get(item.id)!;
      const ad = item.audioDetails;
      const mediaTime = item.mediaStart + (currentTime - item.startTime);
      if (Math.abs(audio.currentTime - mediaTime) > 0.2) {
        audio.currentTime = mediaTime;
      }
      audio.volume = Math.min(1, (ad?.volume ?? 1)) * (muted ? 0 : volume);
      audio.playbackRate = ad?.playbackRate ?? 1;
      if (isPlaying && audio.paused) audio.play().catch(() => {});
      else if (!isPlaying && !audio.paused) audio.pause();
    });

    // Pause audio items not currently active
    audioRefs.current.forEach((audio, id) => {
      const isActive = activeAudioItems.some((i) => i.id === id);
      if (!isActive && !audio.paused) audio.pause();
    });
  }, [currentTime, isPlaying, tracks, media, muted, volume]);

  const handleScrub = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (duration <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    onTimeChange(pct * duration);
  }, [duration, onTimeChange]);

  const pct = duration > 0 ? (currentTime / duration) * 100 : 0;

  // Video CSS effects
  const vd = activeVideoItem?.item.videoDetails;
  const videoStyle: React.CSSProperties = {
    maxHeight: '100%',
    maxWidth: '100%',
    objectFit: 'contain',
    opacity: vd?.opacity ?? 1,
    filter: buildFilter(vd?.brightness, vd?.contrast, vd?.saturation),
    transform: buildTransform(vd?.flipH, vd?.flipV),
    borderWidth: vd?.borderWidth ? `${vd.borderWidth}px` : undefined,
    borderColor: vd?.borderWidth ? (vd.borderColor ?? '#000') : undefined,
    borderStyle: vd?.borderWidth ? 'solid' : undefined,
    borderRadius: vd?.borderRadius ? `${vd.borderRadius}%` : undefined,
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Preview canvas */}
      <div className="flex-1 min-h-0 flex items-center justify-center bg-black/90 relative overflow-hidden">

        {/* Video layer */}
        {activeVideoItem?.mediaFile ? (
          <video
            ref={videoRef}
            key={activeVideoItem.mediaFile.id}
            src={activeVideoItem.mediaFile.url}
            style={videoStyle}
            preload="auto"
            playsInline
          />
        ) : (
          <div className="flex flex-col items-center gap-2 text-muted-foreground/40 select-none">
            <div className="w-16 h-16 rounded-2xl border-2 border-muted-foreground/20 flex items-center justify-center">
              <Play className="h-7 w-7 ml-1" />
            </div>
            <p className="text-xs">Sem conteúdo na timeline</p>
          </div>
        )}

        {/* Image overlays */}
        {activeImageItems.map(({ item, mediaFile }) => {
          if (!mediaFile) return null;
          const imgd = item.imageDetails;
          return (
            <img
              key={item.id}
              src={mediaFile.url}
              alt=""
              style={{
                position: 'absolute',
                left: `${imgd?.posX ?? 50}%`,
                top: `${imgd?.posY ?? 50}%`,
                width: `${imgd?.width ?? 50}%`,
                height: `${imgd?.height ?? 50}%`,
                transform: `translate(-50%, -50%) ${buildTransform(imgd?.flipH, imgd?.flipV) ?? ''}`.trim(),
                objectFit: 'contain',
                opacity: imgd?.opacity ?? 1,
                filter: buildFilter(imgd?.brightness, imgd?.contrast, imgd?.saturation),
                pointerEvents: 'none',
              }}
            />
          );
        })}

        {/* Text overlays */}
        {activeTextItems.map((item) => {
          const td = item.textDetails;
          if (!td) return null;
          const shadow = td.boxShadow;
          return (
            <div
              key={item.id}
              style={{
                position: 'absolute',
                left: `${td.posX}%`,
                top: `${td.posY}%`,
                width: `${td.width}%`,
                transform: 'translate(-50%, -50%)',
                fontSize: td.fontSize,
                fontFamily: td.fontFamily,
                color: td.color,
                textAlign: td.textAlign,
                textDecoration: td.textDecoration !== 'none' ? td.textDecoration : undefined,
                opacity: td.opacity,
                backgroundColor: td.backgroundColor !== 'transparent' ? td.backgroundColor : undefined,
                padding: td.backgroundColor !== 'transparent' ? '0.25em 0.5em' : undefined,
                borderRadius: 4,
                textShadow: shadow && (shadow.x || shadow.y || shadow.blur)
                  ? `${shadow.x}px ${shadow.y}px ${shadow.blur}px ${shadow.color}`
                  : undefined,
                pointerEvents: 'none',
                lineHeight: 1.2,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {td.text}
            </div>
          );
        })}

        {/* Timecode overlay */}
        <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-sm rounded px-2 py-0.5 text-[10px] font-mono text-white/80 pointer-events-none">
          {fmt(currentTime)}
        </div>
      </div>

      {/* Scrubber */}
      <div className="px-3 pt-2 pb-1 shrink-0">
        <div
          className="h-1.5 rounded-full bg-muted cursor-pointer relative group"
          onClick={handleScrub}
        >
          <div
            className="absolute left-0 top-0 h-full rounded-full gradient-viral transition-none"
            style={{ width: `${pct}%` }}
          />
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-primary shadow-md border-2 border-white opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
            style={{ left: `${pct}%` }}
          />
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2 px-3 pb-2.5 shrink-0">
        <span className="text-[10px] font-mono text-muted-foreground tabular-nums w-[72px]">
          {fmt(currentTime)} / {fmt(duration)}
        </span>

        <div className="flex items-center gap-0.5 mx-auto">
          <button
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => onTimeChange(0)}
            title="Ir ao início"
          >
            <SkipBack className="h-4 w-4" />
          </button>
          <button
            className="p-2 rounded-xl hover:bg-primary/20 text-primary transition-colors"
            onClick={onPlayPause}
          >
            {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
          </button>
          <button
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => onTimeChange(duration)}
            title="Ir ao fim"
          >
            <SkipForward className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center gap-1.5 w-[72px] justify-end">
          <button
            className="p-1 text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setMuted((v) => !v)}
          >
            {muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={muted ? 0 : volume}
            onChange={(e) => { setVolume(+e.target.value); setMuted(false); }}
            className="w-14 h-1 accent-primary"
          />
        </div>
      </div>
    </div>
  );
}
