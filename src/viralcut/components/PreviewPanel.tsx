// ============================================================
// PreviewPanel – Video preview with playback controls
// ============================================================
import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Maximize2,
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
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const isDraggingRef = useRef(false);

  // Find active video item at currentTime
  const activeItem = (() => {
    for (const track of tracks) {
      if (track.type !== 'video') continue;
      for (const item of track.items) {
        if (currentTime >= item.startTime && currentTime < item.endTime) {
          return { item, media: media.find((m) => m.id === item.mediaId) };
        }
      }
    }
    return null;
  })();

  // Sync video element
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !activeItem?.media) return;
    const mediaTime = activeItem.item.mediaStart + (currentTime - activeItem.item.startTime);
    if (Math.abs(v.currentTime - mediaTime) > 0.15) {
      v.currentTime = mediaTime;
    }
  }, [currentTime, activeItem]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (isPlaying) v.play().catch(() => {});
    else v.pause();
  }, [isPlaying]);

  const handleScrub = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (duration <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    onTimeChange(pct * duration);
  }, [duration, onTimeChange]);

  const pct = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Preview canvas */}
      <div className="flex-1 min-h-0 flex items-center justify-center bg-black/90 relative overflow-hidden">
        {activeItem?.media ? (
          <video
            ref={videoRef}
            key={activeItem.media.id}
            src={activeItem.media.url}
            muted={muted}
            className="max-h-full max-w-full object-contain"
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

        {/* Timecode overlay */}
        <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-sm rounded px-2 py-0.5 text-[10px] font-mono text-white/80">
          {fmt(currentTime)}
        </div>
      </div>

      {/* Scrubber */}
      <div className="px-3 pt-2 pb-1 shrink-0">
        <div
          className="h-1.5 rounded-full bg-muted cursor-pointer relative group"
          onClick={handleScrub}
        >
          {/* Played */}
          <div
            className="absolute left-0 top-0 h-full rounded-full gradient-viral transition-none"
            style={{ width: `${pct}%` }}
          />
          {/* Thumb */}
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-primary shadow-md border-2 border-white opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
            style={{ left: `${pct}%` }}
          />
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2 px-3 pb-2.5 shrink-0">
        {/* Time */}
        <span className="text-[10px] font-mono text-muted-foreground tabular-nums w-[72px]">
          {fmt(currentTime)} / {fmt(duration)}
        </span>

        {/* Playback */}
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

        {/* Volume */}
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
