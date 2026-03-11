// ============================================================
// PreviewPanel – Video preview with text/image overlays + effects
// LOW-QUALITY PREVIEW MODE: renders video via downscaled canvas
// at ~360p to ensure smooth playback even with speed changes,
// multiple layers, and CSS filters. Full quality only on export.
// ============================================================
import { useEffect, useRef, useState, useCallback } from 'react';
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX } from 'lucide-react';
import { Track, TrackItem, MediaFile } from '../types';

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

function buildFilter(brightness = 1, contrast = 1, saturation = 1) {
  if (brightness === 1 && contrast === 1 && saturation === 1) return 'none';
  return `brightness(${brightness}) contrast(${contrast}) saturate(${saturation})`;
}

function buildTransform(flipH = false, flipV = false) {
  const sx = flipH ? -1 : 1;
  const sy = flipV ? -1 : 1;
  if (sx === 1 && sy === 1) return undefined;
  return `scale(${sx}, ${sy})`;
}

// Max pixels on the longest side for preview canvas (low-res for performance)
// The ASPECT RATIO always matches the actual video dimensions.
const PREVIEW_MAX_PX = 480;

/** Scale video dimensions down to fit within PREVIEW_MAX_PX on the longest side */
function previewSize(w?: number, h?: number): { w: number; h: number } {
  if (!w || !h || w === 0 || h === 0) return { w: 480, h: 270 };
  const scale = PREVIEW_MAX_PX / Math.max(w, h);
  // Ensure even numbers (some codecs require it)
  return { w: Math.max(2, Math.round(w * scale / 2) * 2), h: Math.max(2, Math.round(h * scale / 2) * 2) };
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
  // Hidden video element used purely for decoding
  const videoRef = useRef<HTMLVideoElement>(null);
  // Canvas shown to the user at low resolution
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);

  const audioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const lastSrcRef = useRef<string>('');

  // ── Derived active items ───────────────────────────────────
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

  // ── Canvas size: matches actual video AR, scaled to preview size ──
  // ASPECT RATIO = same as original video. Only pixel count reduced for perf.
  const { w: canvasW, h: canvasH } = previewSize(
    activeVideoItem?.mediaFile?.width,
    activeVideoItem?.mediaFile?.height
  );

  const activeTextItems: TrackItem[] = tracks
    .filter((t) => t.type === 'text' && !t.muted)
    .flatMap((t) => t.items)
    .filter((i) => currentTime >= i.startTime && currentTime < i.endTime);

  const activeImageItems: { item: TrackItem; mediaFile?: MediaFile }[] = tracks
    .filter((t) => t.type === 'image' && !t.muted)
    .flatMap((t) => t.items)
    .filter((i) => currentTime >= i.startTime && currentTime < i.endTime)
    .map((item) => ({ item, mediaFile: media.find((m) => m.id === item.mediaId) }));

  // ── Apply video props imperatively ─────────────────────────
  const applyVideoProps = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    const rate = activeVideoItem?.item.videoDetails?.playbackRate ?? 1;
    const itemVol = activeVideoItem?.item.videoDetails?.volume ?? 1;
    if (v.playbackRate !== rate) v.playbackRate = rate;
    const targetVol = Math.min(1, itemVol) * (muted ? 0 : volume);
    if (Math.abs(v.volume - targetVol) > 0.01) v.volume = targetVol;
    if (v.muted !== muted) v.muted = muted;
  }, [activeVideoItem, muted, volume]);

  // ── Draw a frame: canvas matches video AR, so draw 1:1 (no letterbox needed) ──
  const drawFrame = useCallback(() => {
    const canvas = canvasRef.current;
    const v = videoRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (v && v.readyState >= 2 && activeVideoItem?.mediaFile && v.videoWidth > 0) {
      const vd = activeVideoItem.item.videoDetails;
      ctx.save();
      ctx.globalAlpha = vd?.opacity ?? 1;
      if (vd?.flipH || vd?.flipV) {
        ctx.translate(vd.flipH ? canvas.width : 0, vd.flipV ? canvas.height : 0);
        ctx.scale(vd.flipH ? -1 : 1, vd.flipV ? -1 : 1);
      }
      // Canvas dimensions already match video AR — fill the whole canvas
      ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
      ctx.restore();
    }
  }, [activeVideoItem]);

  // ── RAF render loop while playing ─────────────────────────
  useEffect(() => {
    const loop = () => {
      drawFrame();
      rafRef.current = requestAnimationFrame(loop);
    };

    if (isPlaying) {
      rafRef.current = requestAnimationFrame(loop);
    } else {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      // Draw one frame when paused
      drawFrame();
    }

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isPlaying, drawFrame]);

  // ── Also redraw on currentTime change (scrubbing) ─────────
  useEffect(() => {
    if (!isPlaying) drawFrame();
  }, [currentTime, isPlaying, drawFrame]);

  // ── Sync video src + seek ──────────────────────────────────
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const mf = activeVideoItem?.mediaFile;
    if (!mf) {
      // No video — clear canvas
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx?.clearRect(0, 0, canvas.width, canvas.height);
      }
      return;
    }

    if (v.src !== mf.url) {
      lastSrcRef.current = mf.url;
      v.src = mf.url;
      v.preload = 'auto';
      // Do NOT constrain width/height — let browser decode at native res
      // (preview quality reduction is handled by the small canvas display size)
      v.load();
      applyVideoProps();
      return;
    }

    const mediaTime = activeVideoItem!.item.mediaStart + (currentTime - activeVideoItem!.item.startTime);
    if (!isPlaying && Math.abs(v.currentTime - mediaTime) > 0.1) {
      v.currentTime = mediaTime;
    }
    applyVideoProps();
  }, [currentTime, activeVideoItem, isPlaying, applyVideoProps]);

  // ── Play / pause ──────────────────────────────────────────
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (isPlaying) {
      if (activeVideoItem) {
        const mediaTime = activeVideoItem.item.mediaStart + (currentTime - activeVideoItem.item.startTime);
        if (Math.abs(v.currentTime - mediaTime) > 0.3) v.currentTime = mediaTime;
      }
      applyVideoProps();
      v.play().catch(() => {});
    } else {
      v.pause();
      // Redraw after pause
      setTimeout(() => drawFrame(), 30);
    }
  }, [isPlaying]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Apply rate/volume immediately when they change ────────
  useEffect(() => {
    applyVideoProps();
  }, [applyVideoProps]);

  // ── Audio tracks ──────────────────────────────────────────
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
      if (Math.abs(audio.currentTime - mediaTime) > 0.2) audio.currentTime = mediaTime;
      audio.volume = Math.min(1, (ad?.volume ?? 1)) * (muted ? 0 : volume);
      audio.playbackRate = ad?.playbackRate ?? 1;
      if (isPlaying && audio.paused) audio.play().catch(() => {});
      else if (!isPlaying && !audio.paused) audio.pause();
    });

    audioRefs.current.forEach((audio, id) => {
      if (!activeAudioItems.some((i) => i.id === id) && !audio.paused) audio.pause();
    });
  }, [currentTime, isPlaying, tracks, media, muted, volume]);

  // ── Canvas CSS filter (reflects video effects) ────────────
  const vd = activeVideoItem?.item.videoDetails;
  const canvasFilter = buildFilter(vd?.brightness, vd?.contrast, vd?.saturation);
  const canvasTransform = (vd?.flipH || vd?.flipV) ? undefined : undefined; // handled in drawFrame

  // ── Scrubber ──────────────────────────────────────────────
  const scrubbing = useRef(false);

  const handleScrubMove = useCallback((clientX: number, rect: DOMRect) => {
    if (duration <= 0) return;
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    onTimeChange(pct * duration);
  }, [duration, onTimeChange]);

  const handleScrubStart = useCallback((e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    scrubbing.current = true;
    const rect = e.currentTarget.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    handleScrubMove(clientX, rect);

    const onMove = (ev: MouseEvent | TouchEvent) => {
      const x = 'touches' in ev ? (ev as TouchEvent).touches[0].clientX : (ev as MouseEvent).clientX;
      handleScrubMove(x, rect);
    };
    const onUp = () => {
      scrubbing.current = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('touchend', onUp);
  }, [handleScrubMove]);

  const pct = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Hidden video element — decodes at full speed, never shown */}
      <video
        ref={videoRef}
        style={{ display: 'none' }}
        preload="auto"
        playsInline
        muted={false}
        crossOrigin="anonymous"
      />

      {/* Preview canvas — low-res display */}
      <div className="flex-1 min-h-0 flex items-center justify-center bg-black/90 relative overflow-hidden">

        {activeVideoItem?.mediaFile ? (
          <canvas
            ref={canvasRef}
            width={canvasW}
            height={canvasH}
            style={{
              maxHeight: '100%',
              maxWidth: '100%',
              objectFit: 'contain',
              filter: canvasFilter !== 'none' ? canvasFilter : undefined,
              imageRendering: 'auto',
              willChange: 'filter',
            }}
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
        <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-sm rounded px-2 py-0.5 text-[10px] font-mono text-white/80 pointer-events-none select-none">
          {fmt(currentTime)}
          <span className="ml-1 text-white/40 text-[8px]">LQ</span>
        </div>
      </div>

      {/* Scrubber */}
      <div className="px-3 pt-2 pb-1 shrink-0">
        <div
          className="h-3 flex items-center cursor-pointer group"
          onMouseDown={handleScrubStart}
          onTouchStart={handleScrubStart}
        >
          <div className="relative w-full h-1.5 rounded-full bg-muted">
            <div
              className="absolute left-0 top-0 h-full rounded-full gradient-viral transition-none"
              style={{ width: `${pct}%` }}
            />
            <div
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-primary shadow-md border-2 border-white opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
              style={{ left: `${pct}%` }}
            />
          </div>
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
