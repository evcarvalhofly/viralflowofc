import { useRef, useState, useEffect, useCallback } from 'react';
import { Play, Pause, Volume2, VolumeX, Scissors } from 'lucide-react';
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
  // Whether to play only kept segments (preview mode)
  const [previewMode, setPreviewMode] = useState(false);
  // Guard to prevent recursive timeupdate calls when we manually seek
  const isSeekingRef = useRef(false);
  // Stable refs for values used inside timeupdate (avoids stale closure)
  const previewModeRef = useRef(previewMode);
  const keepSegmentsRef = useRef(keepSegments);
  previewModeRef.current = previewMode;
  keepSegmentsRef.current = keepSegments;

  const hasSegments = keepSegments.length > 0;

  // Keep video muted state in sync
  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = muted;
  }, [muted]);

  // Auto-enable preview mode when segments are first set
  useEffect(() => {
    if (hasSegments) setPreviewMode(true);
    else setPreviewMode(false);
  }, [hasSegments]);

  // Skip over removed regions during playback
  const handleTimeUpdate = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;

    // If we triggered this timeupdate by seeking programmatically, skip logic
    if (isSeekingRef.current) return;

    const t = v.currentTime;
    setCurrentTime(t);
    onTimeUpdate?.(t);

    if (!previewModeRef.current || keepSegmentsRef.current.length === 0) return;

    // Check if we're inside a "removed" gap between kept segments
    const inKeep = keepSegmentsRef.current.some((seg) => t >= seg.start && t < seg.end);
    if (!inKeep) {
      isSeekingRef.current = true;
      // Find the next kept segment start
      const next = keepSegmentsRef.current.find((seg) => seg.start > t);
      if (next) {
        v.currentTime = next.start;
      } else {
        // Past all kept segments — stop
        v.pause();
        setPlaying(false);
        // Rewind to first kept segment
        const first = keepSegmentsRef.current[0];
        if (first) v.currentTime = first.start;
      }
      // Release guard after browser processes the seek
      requestAnimationFrame(() => { isSeekingRef.current = false; });
    }
  }, [onTimeUpdate]);

  const handleLoadedMetadata = useCallback(() => {
    const d = videoRef.current?.duration ?? 0;
    setDuration(d);
    onDurationChange?.(d);
  }, [onDurationChange]);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;

    // If in preview mode and time is outside any segment, jump to first segment
    if (previewMode && hasSegments) {
      const inKeep = keepSegments.some(
        (seg) => v.currentTime >= seg.start && v.currentTime < seg.end
      );
      if (!inKeep) {
        v.currentTime = keepSegments[0].start;
      }
    }

    if (v.paused) {
      v.play();
      setPlaying(true);
    } else {
      v.pause();
      setPlaying(false);
    }
  }, [previewMode, hasSegments, keepSegments]);

  const handleEnded = () => {
    setPlaying(false);
    // Rewind to first kept segment if in preview mode
    if (previewMode && keepSegments.length > 0 && videoRef.current) {
      videoRef.current.currentTime = keepSegments[0].start;
    }
  };

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
  const cutRegions =
    hasSegments && duration > 0
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

        {/* Preview mode badge */}
        {previewMode && hasSegments && (
          <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-black/70 backdrop-blur-sm rounded-full px-2.5 py-1 text-[10px] font-medium text-primary border border-primary/30">
            <Scissors className="h-3 w-3" />
            Preview do corte
          </div>
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
          className="relative h-2 bg-muted rounded-full cursor-pointer"
          onClick={seek}
        >
          {/* Removed regions (dark overlay) */}
          {hasSegments && duration > 0 && (
            <div className="absolute inset-0 rounded-full overflow-hidden">
              {/* full bar dimmed */}
              <div className="absolute inset-0 bg-destructive/20" />
              {/* kept segments on top */}
              {cutRegions.map((r, i) => (
                <div
                  key={i}
                  className="absolute top-0 h-full bg-primary/35"
                  style={{ left: `${r.left}%`, width: `${r.width}%` }}
                />
              ))}
            </div>
          )}
          {/* Progress */}
          <div
            className="absolute top-0 left-0 h-full bg-primary rounded-full pointer-events-none z-10"
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

          <div className="flex items-center gap-3">
            {hasSegments && (
              <button
                onClick={() => setPreviewMode((p) => !p)}
                className={cn(
                  'flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border transition-colors',
                  previewMode
                    ? 'border-primary/50 text-primary bg-primary/10'
                    : 'border-border text-muted-foreground hover:text-foreground'
                )}
              >
                <Scissors className="h-2.5 w-2.5" />
                {previewMode ? 'Preview ON' : 'Preview OFF'}
              </button>
            )}
            <span>{fmt(duration)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
