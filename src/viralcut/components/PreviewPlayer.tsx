import { useRef, useState, useEffect, useCallback } from 'react';
import { Play, Pause, Volume2, VolumeX } from 'lucide-react';
import { SubtitleItem, SubtitleOptions, Segment } from '../types';
import { SubtitleOverlay } from './SubtitleOverlay';
import { cn } from '@/lib/utils';

interface PreviewPlayerProps {
  videoUrl: string;
  subtitles: SubtitleItem[];
  subtitleOptions: SubtitleOptions;
  keepSegments: Segment[];
  onTimeUpdate?: (t: number) => void;
  onDurationChange?: (d: number) => void;
}

export function PreviewPlayer({
  videoUrl,
  subtitles,
  subtitleOptions,
  keepSegments,
  onTimeUpdate,
  onDurationChange,
}: PreviewPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);

  // Keep video muted state in sync
  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = muted;
  }, [muted]);

  const handleTimeUpdate = useCallback(() => {
    const t = videoRef.current?.currentTime ?? 0;
    setCurrentTime(t);
    onTimeUpdate?.(t);
  }, [onTimeUpdate]);

  const handleLoadedMetadata = useCallback(() => {
    const d = videoRef.current?.duration ?? 0;
    setDuration(d);
    onDurationChange?.(d);
  }, [onDurationChange]);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play();
      setPlaying(true);
    } else {
      v.pause();
      setPlaying(false);
    }
  };

  const handleEnded = () => setPlaying(false);

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    const t = pct * duration;
    if (videoRef.current) {
      videoRef.current.currentTime = t;
      setCurrentTime(t);
    }
  };

  const fmt = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${String(sec).padStart(2, '0')}`;
  };

  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;

  // Mark cut regions on the scrubber
  const cutRegions = keepSegments.length > 0
    ? keepSegments.map((seg) => ({
        left: (seg.start / duration) * 100,
        width: ((seg.end - seg.start) / duration) * 100,
      }))
    : [];

  return (
    <div className="rounded-xl overflow-hidden bg-black relative group shadow-2xl">
      {/* Video */}
      <div className="relative" style={{ aspectRatio: '16/9' }}>
        <video
          ref={videoRef}
          src={videoUrl}
          className="w-full h-full object-contain bg-black"
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={handleEnded}
          onClick={togglePlay}
          playsInline
          preload="metadata"
        />

        {/* Subtitle overlay */}
        {subtitles.length > 0 && (
          <SubtitleOverlay
            currentTime={currentTime}
            subtitles={subtitles}
            options={subtitleOptions}
          />
        )}

        {/* Play/Pause large button on hover */}
        <div
          className={cn(
            'absolute inset-0 flex items-center justify-center transition-opacity',
            playing ? 'opacity-0 group-hover:opacity-100' : 'opacity-100'
          )}
          onClick={togglePlay}
          style={{ cursor: 'pointer' }}
        >
          <div className="h-14 w-14 rounded-full bg-black/60 flex items-center justify-center backdrop-blur-sm">
            {playing ? (
              <Pause className="h-6 w-6 text-white" />
            ) : (
              <Play className="h-6 w-6 text-white ml-1" />
            )}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-[hsl(220,25%,7%)] px-4 py-3 space-y-2">
        {/* Scrubber */}
        <div
          className="relative h-2 bg-muted rounded-full cursor-pointer overflow-hidden"
          onClick={seek}
        >
          {/* Keep regions highlight */}
          {cutRegions.map((r, i) => (
            <div
              key={i}
              className="absolute top-0 h-full bg-primary/30 rounded-full"
              style={{ left: `${r.left}%`, width: `${r.width}%` }}
            />
          ))}
          {/* Progress */}
          <div
            className="absolute top-0 left-0 h-full bg-primary rounded-full pointer-events-none"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {/* Bottom row */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-3">
            <button
              onClick={togglePlay}
              className="text-foreground hover:text-primary transition-colors"
            >
              {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </button>
            <button
              onClick={() => setMuted((m) => !m)}
              className="text-foreground hover:text-primary transition-colors"
            >
              {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
            <span>{fmt(currentTime)}</span>
          </div>
          <span>{fmt(duration)}</span>
        </div>
      </div>
    </div>
  );
}
