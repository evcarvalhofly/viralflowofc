// ============================================================
// PreviewPanel – Double-buffer video for seamless clip transitions
// Two hidden <video> elements swap on each clip change so there
// is ZERO seek delay visible to the user (no black flash).
// ============================================================
import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
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
  projectWidth: number;
  projectHeight: number;
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


// ── Direct-manipulation overlay for a text or image item ──────────────────
interface OverlayHandleProps {
  item: TrackItem;
  trackId: string;
  containerRef: React.RefObject<HTMLDivElement | null>;
  isSelected: boolean;
  onSelect: () => void;
  onOpenProperties?: () => void;
  onUpdate: (updates: Partial<TrackItem>) => void;
  children: React.ReactNode;
}

function OverlayHandle({ item, containerRef, isSelected, onSelect, onOpenProperties, onUpdate, children }: OverlayHandleProps) {
  const td = item.textDetails;
  const imgd = item.imageDetails;
  const vd = item.videoDetails;

  const posX = td?.posX ?? imgd?.posX ?? vd?.posX ?? 50;
  const posY = td?.posY ?? imgd?.posY ?? vd?.posY ?? 50;
  const width = td?.width ?? imgd?.width ?? vd?.width ?? 50;

  const lastTapRef = useRef<number>(0);

  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    onSelect();
    const container = containerRef.current;
    if (!container) return;
    if ('touches' in e && e.touches.length >= 2) return;

    const startX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const startY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const origPosX = posX;
    const origPosY = posY;

    const onMove = (ev: MouseEvent | TouchEvent) => {
      if ('touches' in ev && (ev as TouchEvent).touches.length >= 2) return;
      ev.preventDefault();
      const cx = 'touches' in ev ? (ev as TouchEvent).touches[0].clientX : (ev as MouseEvent).clientX;
      const cy = 'touches' in ev ? (ev as TouchEvent).touches[0].clientY : (ev as MouseEvent).clientY;
      const rect = container.getBoundingClientRect();
      const dx = ((cx - startX) / rect.width) * 100;
      const dy = ((cy - startY) / rect.height) * 100;
      const newPosX = Math.max(0, Math.min(100, origPosX + dx));
      const newPosY = Math.max(0, Math.min(100, origPosY + dy));
      if (td) onUpdate({ textDetails: { ...td, posX: newPosX, posY: newPosY } });
      else if (imgd) onUpdate({ imageDetails: { ...imgd, posX: newPosX, posY: newPosY } });
      else if (vd) onUpdate({ videoDetails: { ...vd, posX: newPosX, posY: newPosY } });
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

  const handlePinchStart = (e: React.TouchEvent) => {
    if (e.touches.length < 2) return;
    onSelect();
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
        const newFontSize = Math.max(0.5, Math.min(30, origFontSize * ratio));
        onUpdate({ textDetails: { ...td, fontSize: newFontSize } });
      } else if (imgd) {
        const newW = Math.max(5, Math.min(100, origWidth * ratio));
        onUpdate({ imageDetails: { ...imgd, width: newW } });
      } else if (vd) {
        const newW = Math.max(5, Math.min(100, origWidth * ratio));
        onUpdate({ videoDetails: { ...vd, width: newW } });
      }
    };

    const onUp = () => {
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
    };

    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onUp);
  };

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
      const dx = ((cx - startX) / rect.width) * 100 * 2;
      const newW = Math.max(5, Math.min(100, origWidth + dx));
      if (td) onUpdate({ textDetails: { ...td, width: newW } });
      else if (imgd) onUpdate({ imageDetails: { ...imgd, width: newW } });
      else if (vd) onUpdate({ videoDetails: { ...vd, width: newW } });
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
        if (e.touches.length >= 2) {
          handlePinchStart(e);
        } else {
          const now = Date.now();
          if (isSelected && now - lastTapRef.current < 400) {
            lastTapRef.current = 0;
            onOpenProperties?.();
            return;
          }
          lastTapRef.current = now;
          handleDragStart(e);
        }
      }}
      onClick={(e) => {
        e.stopPropagation();
        const now = Date.now();
        if (isSelected && now - lastTapRef.current < 400) {
          lastTapRef.current = 0;
          onOpenProperties?.();
          return;
        }
        lastTapRef.current = now;
        onSelect();
      }}
    >
      {children}

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

      {isSelected && (
        <div
          style={{
            position: 'absolute',
            top: -20,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'hsl(var(--primary))',
            borderRadius: 4,
            padding: '1px 6px',
            fontSize: 9,
            color: 'white',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
          }}
        >
          <Move style={{ display: 'inline', width: 10, height: 10 }} /> mover · 2x clique = editar
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
  projectWidth,
  projectHeight,
  selectedItemId,
  onSelectItem,
  onUpdateItem,
  onOpenProperties,
}: PreviewPanelProps) {
  // ── Double-buffer: two video elements swap on each clip transition ─
  const videoRefA = useRef<HTMLVideoElement>(null);
  const videoRefB = useRef<HTMLVideoElement>(null);
  const activeSlotRef = useRef<'A' | 'B'>('A');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayContainerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);

  // Last valid frame fallback: if video is not ready, hold last drawn frame
  const lastValidFrameRef = useRef<boolean>(false);

  const audioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);

  // Track the actual CSS-rendered height of the overlay container so that
  // text font sizes (which must be in CSS pixels, not canvas internal pixels)
  // match what the export renders at the project's full resolution.
  const [overlayH, setOverlayH] = useState(270);

  // Preload tracking: what is ready in the inactive slot
  const preloadRef = useRef<{ itemId: string; url: string; mediaTime: number; ready: boolean } | null>(null);
  const activeItemIdRef = useRef<string | null>(null);

  const getActiveVideo = useCallback(() =>
    activeSlotRef.current === 'A' ? videoRefA.current : videoRefB.current, []);
  const getPreloadVideo = useCallback(() =>
    activeSlotRef.current === 'A' ? videoRefB.current : videoRefA.current, []);

  // ── Derived active items ───────────────────────────────────
  const activeVideoTracks = useMemo(
    () => tracks.filter((t) => t.type === 'video' && !t.muted),
    [tracks]
  );
  const baseVideoTrack = activeVideoTracks.length > 0 ? activeVideoTracks[0] : null;
  const overlayVideoTracks = activeVideoTracks.length > 1 ? activeVideoTracks.slice(1) : [];

  const activeVideoItem = useMemo(() => {
    if (!baseVideoTrack) return null;
    for (const item of baseVideoTrack.items) {
      if (currentTime >= item.startTime && currentTime < item.endTime) {
        return { item, mediaFile: media.find((m) => m.id === item.mediaId) };
      }
    }
    return null;
  }, [baseVideoTrack, currentTime, media]);

  const activeVideoOverlays = useMemo(() => {
    const overlays: { item: TrackItem; trackId: string; mediaFile?: MediaFile }[] = [];
    for (const track of overlayVideoTracks) {
      for (const item of track.items) {
        if (currentTime >= item.startTime && currentTime < item.endTime) {
          overlays.push({ item, trackId: track.id, mediaFile: media.find((m) => m.id === item.mediaId) });
        }
      }
    }
    return overlays;
  }, [overlayVideoTracks, currentTime, media]);

  // Next video item (for background preloading of base video ONLY)
  const nextVideoItem = useMemo(() => {
    if (!activeVideoItem || !baseVideoTrack) return null;
    const all = [...baseVideoTrack.items].sort((a, b) => a.startTime - b.startTime);
    const idx = all.findIndex((i) => i.id === activeVideoItem.item.id);
    if (idx < 0 || idx >= all.length - 1) return null;
    const next = all[idx + 1];
    return { item: next, mediaFile: media.find((m) => m.id === next.mediaId) };
  }, [activeVideoItem, baseVideoTrack, media]);

  const { w: canvasW, h: canvasH } = previewSize(
    activeVideoItem?.mediaFile?.width,
    activeVideoItem?.mediaFile?.height
  );

  const activeTextItems = useMemo(
    () =>
      tracks
        .filter((t) => t.type === 'text' && !t.muted)
        .flatMap((t) => t.items)
        .filter((i) => currentTime >= i.startTime && currentTime < i.endTime),
    [tracks, currentTime]
  );

  const activeImageItems = useMemo(
    () =>
      tracks
        .filter((t) => t.type === 'image' && !t.muted)
        .flatMap((t) => t.items.map((item) => ({ item, trackId: t.id })))
        .filter(({ item }) => currentTime >= item.startTime && currentTime < item.endTime)
        .map(({ item, trackId }) => ({ item, trackId, mediaFile: media.find((m) => m.id === item.mediaId) })),
    [tracks, currentTime, media]
  );

  const getTrackId = useCallback((itemId: string) => {
    return tracks.find((t) => t.items.some((i) => i.id === itemId))?.id ?? '';
  }, [tracks]);

  // Observe actual CSS height of overlay container for accurate font sizing
  useEffect(() => {
    const el = overlayContainerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const h = entries[0]?.contentRect.height;
      if (h && h > 0) setOverlayH(h);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const applyVideoProps = useCallback(() => {
    const v = getActiveVideo();
    if (!v) return;
    const rate = activeVideoItem?.item.videoDetails?.playbackRate ?? 1;
    const itemVol = activeVideoItem?.item.videoDetails?.volume ?? 1;
    if (v.playbackRate !== rate) v.playbackRate = rate;
    const targetVol = Math.min(1, itemVol) * (muted ? 0 : volume);
    if (Math.abs(v.volume - targetVol) > 0.01) v.volume = targetVol;
    if (v.muted !== muted) v.muted = muted;
  }, [activeVideoItem, muted, volume, getActiveVideo]);

  // ── Draw a frame from the ACTIVE video slot ────────────────
  // Uses "last valid frame" strategy: if video isn't ready yet,
  // keep the canvas as-is (hold last frame) instead of going black.
  const drawFrame = useCallback(() => {
    const canvas = canvasRef.current;
    const v = getActiveVideo();
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    if (v && v.readyState >= 2 && activeVideoItem?.mediaFile && v.videoWidth > 0) {
      // Valid frame available — draw it
      const vd = activeVideoItem.item.videoDetails;
      const mf = activeVideoItem.mediaFile;
      const vW = mf?.width || v.videoWidth;
      const vH = mf?.height || v.videoHeight;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.globalAlpha = vd?.opacity ?? 1;
      // Contain-fit: center video without stretching
      const scale = Math.min(canvas.width / vW, canvas.height / vH);
      const dw = vW * scale;
      const dh = vH * scale;
      const dx = (canvas.width - dw) / 2;
      const dy = (canvas.height - dh) / 2;
      if (vd?.flipH || vd?.flipV) {
        ctx.translate(vd.flipH ? canvas.width : 0, vd.flipV ? canvas.height : 0);
        ctx.scale(vd.flipH ? -1 : 1, vd.flipV ? -1 : 1);
      }
      ctx.drawImage(v, dx, dy, dw, dh);
      ctx.restore();
      lastValidFrameRef.current = true;
    } else if (!activeVideoItem) {
      // Genuine gap in timeline — show black
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      lastValidFrameRef.current = false;
    }
    // else: video not ready yet → do NOT clear canvas (hold last valid frame)
  }, [activeVideoItem, getActiveVideo]);

  // ── RAF render loop ────────────────────────────────────────
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

  // ── Core double-buffer sync ────────────────────────────────
  // On every currentTime change, check if we need to:
  //   a) Swap to the preloaded slot (instant, no black flash)
  //   b) Load + seek in the inactive slot while active plays
  useEffect(() => {
    const mf = activeVideoItem?.mediaFile;

    if (!mf) {
      // Gap: pause active, show black
      const v = getActiveVideo();
      v?.pause();
      activeItemIdRef.current = null;
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, canvas.width, canvas.height); }
      }
      return;
    }

    const item = activeVideoItem!.item;
    const mediaTime = item.mediaStart + (currentTime - item.startTime);

    // ── Case 1: same clip, just keep playing (no action needed) ──
    if (activeItemIdRef.current === item.id) {
      // Only sync position when scrubbing (not playing)
      if (!isPlaying) {
        const v = getActiveVideo();
        if (v && Math.abs(v.currentTime - mediaTime) > 0.15) {
          v.currentTime = mediaTime;
        }
      }
      applyVideoProps();
      return;
    }

    // ── Case 2: new clip — check if preloaded slot is ready ──
    const preload = preloadRef.current;
    const preloadReady = preload && preload.itemId === item.id && preload.ready;

    if (preloadReady) {
      // ✅ Instant swap — no seek delay, no black frame
      const preloadV = getPreloadVideo()!;
      activeSlotRef.current = activeSlotRef.current === 'A' ? 'B' : 'A';
      activeItemIdRef.current = item.id;
      preloadRef.current = null;

      // Sync to exact media time (it may have drifted slightly during preload)
      if (Math.abs(preloadV.currentTime - mediaTime) > 0.15) {
        preloadV.currentTime = mediaTime;
      }
      applyVideoProps();
      if (isPlaying) preloadV.play().catch(() => {});

      // Pause the old active video
      const oldV = getPreloadVideo(); // now the old active is the new "preload" slot
      oldV?.pause();
    } else {
      // ⚠️ Preload wasn't ready — load directly into active slot
      // (brief black is possible here, but this is the fallback)
      const v = getActiveVideo()!;
      activeItemIdRef.current = item.id;
      preloadRef.current = null;

      if (v.src !== mf.url) {
        v.pause();
        v.src = mf.url;
        v.preload = 'auto';
        v.load();
        v.oncanplay = () => {
          v.oncanplay = null;
          v.currentTime = mediaTime;
          applyVideoProps();
          if (isPlaying) v.play().catch(() => {});
        };
      } else {
        v.currentTime = mediaTime;
        applyVideoProps();
        if (isPlaying) v.play().catch(() => {});
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTime, activeVideoItem?.item.id, activeVideoItem?.mediaFile?.url, isPlaying]);

  useEffect(() => { applyVideoProps(); }, [applyVideoProps]);

  // ── Background preloading of NEXT clip ────────────────────
  // Start preloading the next clip as soon as we enter any clip.
  // Also refresh every tick when < 4s left (bigger window = fewer black flashes).
  useEffect(() => {
    if (!nextVideoItem) return;

    const nextMf = nextVideoItem.mediaFile;
    if (!nextMf) return;

    const nextItem = nextVideoItem.item;
    const targetMediaTime = nextItem.mediaStart;

    // Only start if not already preloaded/preloading for this clip
    if (preloadRef.current?.itemId === nextItem.id) return;

    // Throttle: only start when we're reasonably close (within 4s)
    if (activeVideoItem) {
      const timeLeft = activeVideoItem.item.endTime - currentTime;
      if (timeLeft > 4) return;
    }

    const pv = getPreloadVideo();
    if (!pv) return;

    preloadRef.current = { itemId: nextItem.id, url: nextMf.url, mediaTime: targetMediaTime, ready: false };

    const doPreload = () => {
      pv.currentTime = targetMediaTime;
      const onSeeked = () => {
        pv.removeEventListener('seeked', onSeeked);
        if (preloadRef.current?.itemId === nextItem.id) {
          preloadRef.current.ready = true;
        }
      };
      pv.addEventListener('seeked', onSeeked);
    };

    if (pv.src === nextMf.url) {
      doPreload();
    } else {
      pv.pause();
      pv.src = nextMf.url;
      pv.preload = 'auto';
      pv.load();
      pv.oncanplay = () => {
        pv.oncanplay = null;
        doPreload();
      };
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTime, activeVideoItem?.item.id, nextVideoItem?.item.id]);

  // ── Immediately preload next clip as soon as active clip changes ──────────
  // This ensures short clips (< 4s) always have preload started
  useEffect(() => {
    if (!nextVideoItem) return;
    const nextMf = nextVideoItem.mediaFile;
    if (!nextMf) return;
    const nextItem = nextVideoItem.item;
    if (preloadRef.current?.itemId === nextItem.id) return;

    const pv = getPreloadVideo();
    if (!pv) return;

    preloadRef.current = { itemId: nextItem.id, url: nextMf.url, mediaTime: nextItem.mediaStart, ready: false };

    const doPreload = () => {
      pv.currentTime = nextItem.mediaStart;
      const onSeeked = () => {
        pv.removeEventListener('seeked', onSeeked);
        if (preloadRef.current?.itemId === nextItem.id) preloadRef.current.ready = true;
      };
      pv.addEventListener('seeked', onSeeked);
    };

    if (pv.src === nextMf.url) {
      doPreload();
    } else {
      pv.pause();
      pv.src = nextMf.url;
      pv.preload = 'auto';
      pv.load();
      pv.oncanplay = () => { pv.oncanplay = null; doPreload(); };
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeVideoItem?.item.id]);

  // ── Play / Pause ──────────────────────────────────────────
  useEffect(() => {
    const v = getActiveVideo();
    if (!v) return;
    if (isPlaying) {
      applyVideoProps();
      v.play().catch(() => {});
    } else {
      v.pause();
    }
  }, [isPlaying, getActiveVideo, applyVideoProps]);

  // ── Audio track sync ──────────────────────────────────────
  useEffect(() => {
    const activeAudioItems = tracks
      .filter((t) => t.type === 'audio' && !t.muted)
      .flatMap((t) => t.items)
      .filter((i) => currentTime >= i.startTime && currentTime < i.endTime);

    const activeIds = new Set(activeAudioItems.map((i) => i.id));

    // Stop / remove no-longer-active audio
    for (const [id, audio] of audioRefs.current) {
      if (!activeIds.has(id)) {
        audio.pause();
        audio.src = '';
        audioRefs.current.delete(id);
      }
    }

    for (const item of activeAudioItems) {
      const mf = media.find((m) => m.id === item.mediaId);
      if (!mf) continue;
      const ad = item.audioDetails;
      const mediaTime = item.mediaStart + (currentTime - item.startTime);

      let audio = audioRefs.current.get(item.id);
      if (!audio) {
        audio = new Audio(mf.url);
        audio.preload = 'auto';
        audioRefs.current.set(item.id, audio);
      }

      const targetVol = Math.min(1, ad?.volume ?? 1) * (muted ? 0 : volume);
      if (Math.abs(audio.volume - targetVol) > 0.01) audio.volume = targetVol;
      const rate = ad?.playbackRate ?? 1;
      if (audio.playbackRate !== rate) audio.playbackRate = rate;

      if (Math.abs(audio.currentTime - mediaTime) > 0.3) audio.currentTime = mediaTime;

      if (isPlaying && audio.paused) audio.play().catch(() => {});
      else if (!isPlaying && !audio.paused) audio.pause();
    }
  }, [currentTime, isPlaying, tracks, media, muted, volume]);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      for (const audio of audioRefs.current.values()) { audio.pause(); audio.src = ''; }
      audioRefs.current.clear();
    };
  }, []);

  // ── Scrubber ──────────────────────────────────────────────
  const scrubberRef = useRef<HTMLDivElement>(null);

  const handleScrubMove = useCallback((clientX: number) => {
    const bar = scrubberRef.current;
    if (!bar || duration <= 0) return;
    const rect = bar.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    onTimeChange(pct * duration);
  }, [duration, onTimeChange]);

  const handleScrubStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    handleScrubMove(clientX);
    const onMove = (ev: MouseEvent | TouchEvent) => {
      handleScrubMove('touches' in ev ? (ev as TouchEvent).touches[0].clientX : (ev as MouseEvent).clientX);
    };
    const onUp = () => {
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
    <div className="flex flex-col h-full bg-card select-none">
      {/* ── Canvas preview ── */}
      <div
        className="flex-1 flex items-center justify-center bg-black overflow-hidden relative"
        onClick={() => onSelectItem?.(null)}
      >
        {/* Hidden video slots (double-buffer) */}
        <video
          ref={videoRefA}
          style={{ display: 'none' }}
          muted={false}
          playsInline
          crossOrigin="anonymous"
          preload="auto"
        />
        <video
          ref={videoRefB}
          style={{ display: 'none' }}
          muted={false}
          playsInline
          crossOrigin="anonymous"
          preload="auto"
        />

        <div
          ref={overlayContainerRef}
          style={{
            position: 'relative',
            aspectRatio: `${projectWidth} / ${projectHeight}`,
            maxWidth: '100%',
            maxHeight: '100%',
            overflow: 'hidden',
            margin: 'auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <canvas
            ref={canvasRef}
            width={canvasW}
            height={canvasH}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              display: 'block',
            }}
          />

        {/* Text overlays */}
        {activeTextItems.map((item) => {
          const td = item.textDetails;
          if (!td) return null;
          const trackId = getTrackId(item.id);
          const fontSizePx = (td.fontSize / 100) * overlayH;
          const fontSize = `${fontSizePx}px`;
          const shadowStyle = td.boxShadow?.blur > 0
            ? `${td.boxShadow.x}px ${td.boxShadow.y}px ${td.boxShadow.blur}px ${td.boxShadow.color}`
            : undefined;
          // Stroke: scale same as canvas export (strokeWidth * fontSize/16) and use
          // paint-order: stroke fill so fill renders on top — matches canvas strokeText→fillText
          const hasStroke = (td.strokeWidth ?? 0) > 0;
          const strokeWidthPx = hasStroke ? (td.strokeWidth! * (fontSizePx / 16)) : 0;
          return (
            <OverlayHandle
              key={item.id}
              item={item}
              trackId={trackId}
              containerRef={overlayContainerRef}
              isSelected={selectedItemId === item.id}
              onSelect={() => onSelectItem?.(item.id)}
              onOpenProperties={() => onOpenProperties?.(item.id)}
              onUpdate={(updates) => onUpdateItem?.(trackId, item.id, updates)}
            >
              <div
                style={{
                  fontSize,
                  fontFamily: td.fontFamily,
                  color: td.color,
                  textAlign: td.textAlign as React.CSSProperties['textAlign'],
                  textDecoration: td.textDecoration,
                  opacity: td.opacity,
                  backgroundColor: td.backgroundColor !== 'transparent' ? td.backgroundColor : undefined,
                  padding: '2px 6px',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  textShadow: shadowStyle,
                  WebkitTextStroke: hasStroke ? `${strokeWidthPx}px ${td.strokeColor ?? '#000000'}` : undefined,
                  paintOrder: hasStroke ? 'stroke fill' : undefined,
                  borderWidth: td.borderWidth,
                  borderStyle: td.borderWidth > 0 ? 'solid' : 'none',
                  borderColor: td.borderColor,
                  fontWeight: td.fontWeight ?? undefined,
                  pointerEvents: 'none',
                  lineHeight: 1.35,
                  animation: (() => {
                    const map: Partial<Record<string, string>> = {
                      fadeIn:     'vc-fadeIn 0.22s ease forwards',
                      slideUp:    'vc-slideUp 0.2s ease forwards',
                      slideDown:  'vc-slideDown 0.2s ease forwards',
                      slideLeft:  'vc-slideLeft 0.2s ease forwards',
                      slideRight: 'vc-slideRight 0.2s ease forwards',
                      zoomIn:     'vc-zoomIn 0.2s ease forwards',
                    };
                    return item.animationIn ? (map[item.animationIn] ?? undefined) : undefined;
                  })(),
                }}
              >
                {td.text}
              </div>
            </OverlayHandle>
          );
        })}

        {/* Image overlays */}
        {activeImageItems.map(({ item, trackId, mediaFile }) => {
          if (!mediaFile) return null;
          const imgd = item.imageDetails;
          if (!imgd) return null;
          return (
            <OverlayHandle
              key={item.id}
              item={item}
              trackId={trackId}
              containerRef={overlayContainerRef}
              isSelected={selectedItemId === item.id}
              onSelect={() => onSelectItem?.(item.id)}
              onOpenProperties={() => onOpenProperties?.(item.id)}
              onUpdate={(updates) => onUpdateItem?.(trackId, item.id, updates)}
            >
              <img
                src={mediaFile.url}
                alt=""
                draggable={false}
                style={{
                  width: '100%',
                  display: 'block',
                  opacity: imgd.opacity,
                  transform: buildTransform(imgd.flipH, imgd.flipV),
                  filter: buildFilter(imgd.brightness, imgd.contrast, imgd.saturation),
                  borderRadius: imgd.borderRadius,
                  borderWidth: imgd.borderWidth,
                  borderStyle: imgd.borderWidth > 0 ? 'solid' : 'none',
                  borderColor: imgd.borderColor,
                  pointerEvents: 'none',
                }}
              />
            </OverlayHandle>
          );
        })}

        {/* Video overlays */}
        {activeVideoOverlays.map(({ item, trackId, mediaFile }) => {
          if (!mediaFile) return null;
          const vd = item.videoDetails;
          if (!vd) return null;
          const playbackRate = vd.playbackRate ?? 1;
          const mediaTime = (item.mediaStart ?? 0) + (currentTime - item.startTime) * playbackRate;
          return (
            <OverlayHandle
              key={item.id}
              item={item}
              trackId={trackId}
              containerRef={overlayContainerRef}
              isSelected={selectedItemId === item.id}
              onSelect={() => onSelectItem?.(item.id)}
              onOpenProperties={() => onOpenProperties?.(item.id)}
              onUpdate={(updates) => onUpdateItem?.(trackId, item.id, updates)}
            >
              {/* Utilize dynamic video element that syncs with current time */}
              <video
                src={mediaFile.url}
                crossOrigin="anonymous"
                ref={(el) => {
                  if (el) {
                    el.playbackRate = playbackRate;
                    el.volume = Math.min(1, vd.volume ?? 1) * (muted ? 0 : volume);
                    el.muted = muted;
                    if (Math.abs(el.currentTime - mediaTime) > 0.15) {
                      el.currentTime = mediaTime;
                    }
                    if (isPlaying && el.paused) el.play().catch(() => {});
                    else if (!isPlaying && !el.paused) el.pause();
                  }
                }}
                style={{
                  width: '100%',
                  display: 'block',
                  opacity: vd.opacity,
                  transform: buildTransform(vd.flipH, vd.flipV),
                  filter: buildFilter(vd.brightness, vd.contrast, vd.saturation),
                  borderRadius: vd.borderRadius,
                  borderWidth: vd.borderWidth,
                  borderColor: vd.borderColor,
                  borderStyle: vd.borderWidth > 0 ? 'solid' : 'none',
                  boxShadow: vd.boxShadow?.blur > 0 ? `${vd.boxShadow.x}px ${vd.boxShadow.y}px ${vd.boxShadow.blur}px ${vd.boxShadow.color}` : 'none',
                  pointerEvents: 'none',
                }}
              />
            </OverlayHandle>
          );
        })}
        </div>
      </div>

      {/* ── Transport controls ── */}
      <div className="shrink-0 bg-card border-t border-border px-3 py-2 space-y-1.5">
        {/* Scrubber */}
        <div
          ref={scrubberRef}
          className="h-1.5 rounded-full bg-muted cursor-pointer relative group"
          onMouseDown={handleScrubStart}
          onTouchStart={handleScrubStart}
        >
          <div
            className="h-full rounded-full bg-primary transition-none"
            style={{ width: `${pct}%` }}
          />
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-primary border-2 border-background shadow opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ left: `calc(${pct}% - 7px)` }}
          />
        </div>

        {/* Time + buttons */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground font-mono tabular-nums">
            {fmt(currentTime)} / {fmt(duration)}
          </span>
          <div className="flex-1" />
          <button
            className="p-1 rounded hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => onTimeChange(0)}
          >
            <SkipBack className="h-3.5 w-3.5" />
          </button>
          <button
            className="p-1.5 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            onClick={onPlayPause}
          >
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </button>
          <button
            className="p-1 rounded hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => onTimeChange(duration)}
          >
            <SkipForward className="h-3.5 w-3.5" />
          </button>
          <div className="flex-1" />
          <button
            className="p-1 rounded hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setMuted((m) => !m)}
          >
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
