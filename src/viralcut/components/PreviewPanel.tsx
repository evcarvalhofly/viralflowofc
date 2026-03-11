// ============================================================
// PreviewPanel – Video preview with DIRECT MANIPULATION overlays
// - Text/image overlays match export exactly (fontSize = % of height)
// - Click overlay to select; drag to reposition; corner handle to resize
// ============================================================
import { useEffect, useRef, useState, useCallback } from 'react';
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Move } from 'lucide-react';
import { Track, TrackItem, MediaFile, TextDetails, ImageDetails } from '../types';
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
  selectedItemId?: string | null;
  onSelectItem?: (id: string | null) => void;
  onUpdateItem?: (trackId: string, itemId: string, updates: Partial<TrackItem>) => void;
  onOpenProperties?: (id: string) => void;
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
  if (sx === 1 && sy === 1) return '';
  return `scale(${sx}, ${sy})`;
}

const PREVIEW_MAX_PX = 480;

function previewSize(w?: number, h?: number): { w: number; h: number } {
  if (!w || !h || w === 0 || h === 0) return { w: 480, h: 270 };
  const scale = PREVIEW_MAX_PX / Math.max(w, h);
  return { w: Math.max(2, Math.round(w * scale / 2) * 2), h: Math.max(2, Math.round(h * scale / 2) * 2) };
}

function seekTo(v: HTMLVideoElement, t: number): Promise<void> {
  return new Promise((resolve) => {
    if (Math.abs(v.currentTime - t) < 0.05) { resolve(); return; }
    const onSeeked = () => { v.removeEventListener('seeked', onSeeked); resolve(); };
    v.addEventListener('seeked', onSeeked);
    const timeout = setTimeout(() => { v.removeEventListener('seeked', onSeeked); resolve(); }, 800);
    v.addEventListener('seeked', () => clearTimeout(timeout), { once: true });
    v.currentTime = t;
  });
}

// ── Direct-manipulation overlay for a text or image item ──────────────────
interface OverlayHandleProps {
  item: TrackItem;
  trackId: string;
  containerRef: React.RefObject<HTMLDivElement | null>;
  isSelected: boolean;
  onSelect: () => void;
  onUpdate: (updates: Partial<TrackItem>) => void;
  children: React.ReactNode;
}

function OverlayHandle({ item, containerRef, isSelected, onSelect, onUpdate, children }: OverlayHandleProps) {
  const td = item.textDetails;
  const imgd = item.imageDetails;

  const posX = td?.posX ?? imgd?.posX ?? 50;
  const posY = td?.posY ?? imgd?.posY ?? 50;
  const width = td?.width ?? imgd?.width ?? 50;

  // ── Drag to move ──────────────────────────────────────────────
  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    onSelect();
    const container = containerRef.current;
    if (!container) return;

    // If touch with 2+ fingers, skip drag (pinch will handle it)
    if ('touches' in e && e.touches.length >= 2) return;

    const startX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const startY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const origPosX = posX;
    const origPosY = posY;
    let moved = false;

    const onMove = (ev: MouseEvent | TouchEvent) => {
      // If 2 fingers appear mid-drag, abort drag
      if ('touches' in ev && (ev as TouchEvent).touches.length >= 2) return;
      ev.preventDefault();
      moved = true;
      const cx = 'touches' in ev ? (ev as TouchEvent).touches[0].clientX : (ev as MouseEvent).clientX;
      const cy = 'touches' in ev ? (ev as TouchEvent).touches[0].clientY : (ev as MouseEvent).clientY;
      const rect = container.getBoundingClientRect();
      const dx = ((cx - startX) / rect.width) * 100;
      const dy = ((cy - startY) / rect.height) * 100;
      const newPosX = Math.max(0, Math.min(100, origPosX + dx));
      const newPosY = Math.max(0, Math.min(100, origPosY + dy));
      if (td) onUpdate({ textDetails: { ...td, posX: newPosX, posY: newPosY } });
      else if (imgd) onUpdate({ imageDetails: { ...imgd, posX: newPosX, posY: newPosY } });
    };

    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onUp);
  };

  // ── Pinch to resize (touch only, when selected) ───────────────
  const handlePinchStart = (e: React.TouchEvent) => {
    if (!isSelected || e.touches.length < 2) return;
    e.stopPropagation();
    e.preventDefault();

    const origWidth = width;
    const origFontSize = td?.fontSize ?? 3.5;
    const t0 = e.touches[0];
    const t1 = e.touches[1];
    const startDist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);

    const onMove = (ev: TouchEvent) => {
      if (ev.touches.length < 2) return;
      ev.preventDefault();
      const a = ev.touches[0];
      const b = ev.touches[1];
      const dist = Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
      const ratio = dist / startDist;
      if (td) {
        // For text: scale fontSize
        const newFontSize = Math.max(0.5, Math.min(30, origFontSize * ratio));
        onUpdate({ textDetails: { ...td, fontSize: newFontSize } });
      } else if (imgd) {
        // For images: scale width
        const newW = Math.max(5, Math.min(100, origWidth * ratio));
        onUpdate({ imageDetails: { ...imgd, width: newW } });
      }
    };

    const onUp = () => {
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
    };

    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onUp);
  };

  // ── Corner handle to resize width ─────────────────────────────
  const handleResizeStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    const container = containerRef.current;
    if (!container) return;

    const startX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const origWidth = width;

    const onMove = (ev: MouseEvent | TouchEvent) => {
      ev.preventDefault();
      const cx = 'touches' in ev ? (ev as TouchEvent).touches[0].clientX : (ev as MouseEvent).clientX;
      const rect = container.getBoundingClientRect();
      const dx = ((cx - startX) / rect.width) * 100 * 2; // *2 because centered
      const newW = Math.max(5, Math.min(100, origWidth + dx));
      if (td) onUpdate({ textDetails: { ...td, width: newW } });
      else if (imgd) onUpdate({ imageDetails: { ...imgd, width: newW } });
    };

    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onUp);
  };

  return (
    <div
      style={{
        position: 'absolute',
        left: `${posX}%`,
        top: `${posY}%`,
        width: `${width}%`,
        transform: 'translate(-50%, -50%)',
        cursor: 'move',
        outline: isSelected ? '2px solid hsl(var(--primary))' : '2px solid transparent',
        outlineOffset: 2,
        borderRadius: 4,
        userSelect: 'none',
        touchAction: 'none',
      }}
      onMouseDown={handleDragStart}
      onTouchStart={(e) => {
        if (e.touches.length >= 2 && isSelected) {
          handlePinchStart(e);
        } else {
          handleDragStart(e);
        }
      }}
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
    >
      {children}

      {/* Resize handle — bottom-right corner */}
      {isSelected && (
        <div
          style={{
            position: 'absolute',
            right: -8,
            bottom: -8,
            width: 16,
            height: 16,
            borderRadius: '50%',
            background: 'hsl(var(--primary))',
            border: '2px solid white',
            cursor: 'se-resize',
            zIndex: 30,
            touchAction: 'none',
          }}
          onMouseDown={(e) => { e.stopPropagation(); handleResizeStart(e); }}
          onTouchStart={(e) => { e.stopPropagation(); handleResizeStart(e); }}
        />
      )}

      {/* Move icon indicator when selected */}
      {isSelected && (
        <div
          style={{
            position: 'absolute',
            top: -20,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'hsl(var(--primary))',
            borderRadius: 4,
            padding: '1px 4px',
            fontSize: 9,
            color: 'white',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
          }}
        >
          <Move style={{ display: 'inline', width: 10, height: 10 }} /> mover
        </div>
      )}
    </div>
  );
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
  selectedItemId,
  onSelectItem,
  onUpdateItem,
}: PreviewPanelProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayContainerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);

  const audioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);

  const lastSegmentIdRef = useRef<string | null>(null);
  const lastSrcRef = useRef<string>('');
  const seekingRef = useRef(false);

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

  const { w: canvasW, h: canvasH } = previewSize(
    activeVideoItem?.mediaFile?.width,
    activeVideoItem?.mediaFile?.height
  );

  const activeTextItems: TrackItem[] = tracks
    .filter((t) => t.type === 'text' && !t.muted)
    .flatMap((t) => t.items)
    .filter((i) => currentTime >= i.startTime && currentTime < i.endTime);

  const activeImageItems: { item: TrackItem; trackId: string; mediaFile?: MediaFile }[] = tracks
    .filter((t) => t.type === 'image' && !t.muted)
    .flatMap((t) => t.items.map((item) => ({ item, trackId: t.id })))
    .filter(({ item }) => currentTime >= item.startTime && currentTime < item.endTime)
    .map(({ item, trackId }) => ({ item, trackId, mediaFile: media.find((m) => m.id === item.mediaId) }));

  // trackId lookup helper
  const getTrackId = useCallback((itemId: string) => {
    return tracks.find((t) => t.items.some((i) => i.id === itemId))?.id ?? '';
  }, [tracks]);

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

  // ── Draw a frame ───────────────────────────────────────────
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
      drawFrame();
    }
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [isPlaying, drawFrame]);

  useEffect(() => {
    if (!isPlaying) drawFrame();
  }, [currentTime, isPlaying, drawFrame]);

  // ── Core sync: src change + segment jump + seek ────────────
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const mf = activeVideoItem?.mediaFile;

    if (!mf) {
      lastSegmentIdRef.current = null;
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx?.clearRect(0, 0, canvas.width, canvas.height);
      }
      return;
    }

    const currentItemId = activeVideoItem!.item.id;
    const segmentChanged = lastSegmentIdRef.current !== currentItemId;
    const srcChanged = v.src !== mf.url && lastSrcRef.current !== mf.url;
    const mediaTime = activeVideoItem!.item.mediaStart + (currentTime - activeVideoItem!.item.startTime);

    if (srcChanged) {
      lastSrcRef.current = mf.url;
      lastSegmentIdRef.current = currentItemId;
      seekingRef.current = true;
      v.pause();
      v.src = mf.url;
      v.preload = 'auto';
      v.load();
      v.oncanplay = async () => {
        v.oncanplay = null;
        await seekTo(v, mediaTime);
        applyVideoProps();
        seekingRef.current = false;
        if (isPlaying) v.play().catch(() => {});
      };
      return;
    }

    if (segmentChanged) {
      lastSegmentIdRef.current = currentItemId;
      if (seekingRef.current) return;
      seekingRef.current = true;
      v.pause();
      seekTo(v, mediaTime).then(() => {
        applyVideoProps();
        seekingRef.current = false;
        if (isPlaying) v.play().catch(() => {});
        else drawFrame();
      });
      return;
    }

    if (!isPlaying && Math.abs(v.currentTime - mediaTime) > 0.1) {
      seekingRef.current = true;
      seekTo(v, mediaTime).then(() => {
        seekingRef.current = false;
        drawFrame();
      });
    }
    applyVideoProps();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTime, activeVideoItem?.item.id, activeVideoItem?.mediaFile?.url, isPlaying]);

  useEffect(() => { applyVideoProps(); }, [applyVideoProps]);

  // ── Play / Pause ──────────────────────────────────────────
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (isPlaying) {
      if (seekingRef.current) return;
      applyVideoProps();
      v.play().catch(() => {});
    } else {
      v.pause();
      setTimeout(() => drawFrame(), 30);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying]);

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

  const vd = activeVideoItem?.item.videoDetails;
  const canvasFilter = buildFilter(vd?.brightness, vd?.contrast, vd?.saturation);

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
      {/* Hidden video element */}
      <video
        ref={videoRef}
        style={{ display: 'none' }}
        preload="auto"
        playsInline
        muted={false}
        crossOrigin="anonymous"
      />

      {/* Preview area */}
      <div
        className="flex-1 min-h-0 flex items-center justify-center bg-black/90 relative overflow-hidden"
        onClick={() => onSelectItem?.(null)}
      >
      {activeVideoItem?.mediaFile ? (
          // Canvas + overlays wrapper — fit inside flex container maintaining AR
          // Strategy: fill height first, aspect-ratio determines width, max-width caps overflow
          <div
            ref={overlayContainerRef}
            style={{
              position: 'relative',
              aspectRatio: `${canvasW} / ${canvasH}`,
              height: '100%',
              width: 'auto',
              maxWidth: '100%',
              maxHeight: '100%',
              flexShrink: 1,
              flexGrow: 0,
            }}
          >
            <canvas
              ref={canvasRef}
              width={canvasW}
              height={canvasH}
              style={{
                display: 'block',
                width: '100%',
                height: '100%',
                filter: canvasFilter !== 'none' ? canvasFilter : undefined,
                imageRendering: 'auto',
              }}
            />

            {/* Image overlays */}
            {activeImageItems.map(({ item, trackId, mediaFile }) => {
              if (!mediaFile) return null;
              const imgd = item.imageDetails;
              return (
                <OverlayHandle
                  key={item.id}
                  item={item}
                  trackId={trackId}
                  containerRef={overlayContainerRef}
                  isSelected={selectedItemId === item.id}
                  onSelect={() => onSelectItem?.(item.id)}
                  onUpdate={(updates) => onUpdateItem?.(trackId, item.id, updates)}
                >
                  <img
                    src={mediaFile.url}
                    alt=""
                    draggable={false}
                    style={{
                      display: 'block',
                      width: '100%',
                      height: imgd?.height ? `${imgd.height}%` : 'auto',
                      objectFit: 'contain',
                      opacity: imgd?.opacity ?? 1,
                      filter: buildFilter(imgd?.brightness, imgd?.contrast, imgd?.saturation),
                      transform: buildTransform(imgd?.flipH, imgd?.flipV) || undefined,
                    }}
                  />
                </OverlayHandle>
              );
            })}

            {/* Text overlays — fontSize stored as % of canvas height → pixel = fontSize/100 * canvasH */}
            {activeTextItems.map((item) => {
              const td = item.textDetails;
              if (!td) return null;
              const trackId = getTrackId(item.id);
              const shadow = td.boxShadow;
              // Convert percentage fontSize to CSS pixels based on canvas display size
              const fontPx = (td.fontSize / 100) * canvasH;

              return (
                <OverlayHandle
                  key={item.id}
                  item={item}
                  trackId={trackId}
                  containerRef={overlayContainerRef}
                  isSelected={selectedItemId === item.id}
                  onSelect={() => onSelectItem?.(item.id)}
                  onUpdate={(updates) => onUpdateItem?.(trackId, item.id, updates)}
                >
                  <div
                    style={{
                      fontSize: fontPx,
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
                      lineHeight: 1.2,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      pointerEvents: 'none',
                      width: '100%',
                    }}
                  >
                    {td.text}
                  </div>
                </OverlayHandle>
              );
            })}

            {/* Timecode overlay */}
            <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-sm rounded px-2 py-0.5 text-[10px] font-mono text-white/80 pointer-events-none select-none">
              {fmt(currentTime)}
              <span className="ml-1 text-white/40 text-[8px]">LQ</span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-muted-foreground/40 select-none">
            <div className="w-16 h-16 rounded-2xl border-2 border-muted-foreground/20 flex items-center justify-center">
              <Play className="h-7 w-7 ml-1" />
            </div>
            <p className="text-xs">Sem conteúdo na timeline</p>
          </div>
        )}
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
            className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            onClick={() => onTimeChange(0)}
            title="Ir para o início"
          >
            <SkipBack className="h-4 w-4" />
          </button>
          <button
            className="p-2 rounded-xl bg-primary/10 hover:bg-primary/20 transition-colors text-primary"
            onClick={onPlayPause}
            title={isPlaying ? 'Pausar' : 'Reproduzir'}
          >
            {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
          </button>
          <button
            className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            onClick={() => onTimeChange(duration)}
            title="Ir para o fim"
          >
            <SkipForward className="h-4 w-4" />
          </button>
        </div>

        <button
          className={cn(
            'p-1.5 rounded-lg transition-colors ml-auto',
            muted ? 'text-destructive' : 'text-muted-foreground hover:text-foreground'
          )}
          onClick={() => setMuted((m) => !m)}
          title={muted ? 'Ativar som' : 'Silenciar'}
        >
          {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
