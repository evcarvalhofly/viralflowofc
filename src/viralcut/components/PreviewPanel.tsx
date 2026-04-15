// ============================================================
// PreviewPanel – Double-buffer video for seamless clip transitions
// Two hidden <video> elements swap on each clip change so there
// is ZERO seek delay visible to the user (no black flash).
// ============================================================
import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, RotateCw, ChevronDown, Check } from 'lucide-react';
import { Track, TrackItem, MediaFile, TextDetails, ImageDetails, DEFAULT_VIDEO_DETAILS, Project } from '../types';
import { ASPECT_RATIOS } from '../store';
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
  currentAspectRatio?: Project['aspectRatio'];
  onChangeAspectRatio?: (ratio: Project['aspectRatio'], w: number, h: number) => void;
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


// ── Transform handles overlay (CapCut-style: 4 corners + rotation) ────────
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

const HANDLE_SIZE = 14; // px diameter
const HANDLE_HALF = HANDLE_SIZE / 2;
const HANDLE_STYLE: React.CSSProperties = {
  position: 'absolute',
  width: HANDLE_SIZE,
  height: HANDLE_SIZE,
  borderRadius: '50%',
  background: 'white',
  border: '2px solid #2dd4bf',
  zIndex: 30,
  touchAction: 'none',
  cursor: 'pointer',
};

function OverlayHandle({ item, containerRef, isSelected, onSelect, onOpenProperties, onUpdate, children }: OverlayHandleProps) {
  const td   = item.textDetails;
  const imgd = item.imageDetails;
  const vd   = item.videoDetails;

  const posX     = td?.posX     ?? imgd?.posX     ?? vd?.posX     ?? 50;
  const posY     = td?.posY     ?? imgd?.posY     ?? vd?.posY     ?? 50;
  const width    = td?.width    ?? imgd?.width    ?? vd?.width    ?? 50;
  const rotation = td?.rotation ?? imgd?.rotation ?? vd?.rotation ?? 0;

  const lastTapRef = useRef<number>(0);

  // ── helpers ──────────────────────────────────────────────────────────────
  function clientPos(e: MouseEvent | TouchEvent | React.MouseEvent | React.TouchEvent) {
    if ('touches' in e) {
      const te = e as TouchEvent | React.TouchEvent;
      return { x: te.touches[0].clientX, y: te.touches[0].clientY };
    }
    return { x: (e as MouseEvent | React.MouseEvent).clientX, y: (e as MouseEvent | React.MouseEvent).clientY };
  }

  function addListeners(
    onMove: (e: MouseEvent | TouchEvent) => void,
    onUp:   (e: MouseEvent | TouchEvent) => void
  ) {
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onUp);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend',  onUp);
  }

  function removeListeners(
    onMove: (e: MouseEvent | TouchEvent) => void,
    onUp:   (e: MouseEvent | TouchEvent) => void
  ) {
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup',   onUp);
    window.removeEventListener('touchmove', onMove);
    window.removeEventListener('touchend',  onUp);
  }

  // ── Move (drag body) ──────────────────────────────────────────────────────
  const handleBodyDrag = (e: React.MouseEvent | React.TouchEvent) => {
    if ('touches' in e && (e as React.TouchEvent).touches.length >= 2) return;
    e.stopPropagation();
    onSelect();
    const container = containerRef.current;
    if (!container) return;

    const start   = clientPos(e);
    const origX   = posX;
    const origY   = posY;

    const onMove = (ev: MouseEvent | TouchEvent) => {
      ev.preventDefault();
      const cur  = clientPos(ev);
      const rect = container.getBoundingClientRect();
      const nx   = Math.max(0, Math.min(100, origX + ((cur.x - start.x) / rect.width)  * 100));
      const ny   = Math.max(0, Math.min(100, origY + ((cur.y - start.y) / rect.height) * 100));
      if (td)   onUpdate({ textDetails:  { ...td,   posX: nx, posY: ny } });
      else if (imgd) onUpdate({ imageDetails: { ...imgd, posX: nx, posY: ny } });
      else if (vd)   onUpdate({ videoDetails: { ...vd,   posX: nx, posY: ny } });
    };
    const onUp = () => removeListeners(onMove, onUp);
    addListeners(onMove, onUp);
  };

  // ── Pinch-to-scale (touch) ────────────────────────────────────────────────
  const handlePinchStart = (e: React.TouchEvent) => {
    if (e.touches.length < 2) return;
    onSelect();
    e.stopPropagation();
    e.preventDefault();
    const origWidth = width;
    const origFontSize = td?.fontSize ?? 3.5;
    const startDist = Math.hypot(
      e.touches[1].clientX - e.touches[0].clientX,
      e.touches[1].clientY - e.touches[0].clientY
    );
    const onMove = (ev: TouchEvent) => {
      if (ev.touches.length < 2) return;
      ev.preventDefault();
      const dist  = Math.hypot(ev.touches[1].clientX - ev.touches[0].clientX, ev.touches[1].clientY - ev.touches[0].clientY);
      const ratio = dist / startDist;
      if (td)        onUpdate({ textDetails:  { ...td,   fontSize: Math.max(0.5, Math.min(30, origFontSize * ratio)) } });
      else if (imgd) onUpdate({ imageDetails: { ...imgd, width: Math.max(5, Math.min(100, origWidth * ratio)) } });
      else if (vd)   onUpdate({ videoDetails: { ...vd,   width: Math.max(5, Math.min(100, origWidth * ratio)) } });
    };
    const onUp = () => removeListeners(onMove, onUp);
    addListeners(onMove, onUp);
  };

  // ── Corner resize ─────────────────────────────────────────────────────────
  // Math: element center at (posX, posY)% of container. Width = width%.
  // Dragging any corner by (dx%, dy%):
  //   newPosX = origPosX + dx/2   (center follows mid-point of edge movement)
  //   newWidth  = origWidth ± dx  (+ for right corners, – for left corners)
  //   newPosY = origPosY + dy/2
  //   newHeight = origHeight ± dy (+ for bottom corners, – for top corners)
  type Corner = 'tl' | 'tr' | 'bl' | 'br';

  const handleCorner = (corner: Corner) => (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    const container = containerRef.current;
    if (!container) return;

    const start     = clientPos(e);
    const origPosX  = posX;
    const origPosY  = posY;
    const origW     = width;
    const isLeft    = corner === 'tl' || corner === 'bl';
    const isTop     = corner === 'tl' || corner === 'tr';

    // For proportional resize of images/videos
    const aspectH   = imgd?.height ?? vd?.height;
    const aspectW   = imgd?.width  ?? vd?.width;
    const aspectRatio = (aspectH && aspectW) ? aspectH / aspectW : 1;

    const onMove = (ev: MouseEvent | TouchEvent) => {
      ev.preventDefault();
      const cur  = clientPos(ev);
      const rect = container.getBoundingClientRect();
      const dx   = ((cur.x - start.x) / rect.width)  * 100;
      const dy   = ((cur.y - start.y) / rect.height) * 100;

      const dw   = isLeft ? -dx : dx;
      const newW = Math.max(5, Math.min(200, origW + dw));
      const newX = Math.max(0, Math.min(100, origPosX + dx / 2));

      if (td) {
        // Text: resize width only (height is auto)
        onUpdate({ textDetails: { ...td, width: newW, posX: newX } });
      } else if (imgd) {
        const dh   = isTop ? -dy : dy;
        const newH = Math.max(5, Math.min(200, (imgd.height ?? origW * aspectRatio) + dh));
        const newY = Math.max(0, Math.min(100, origPosY + dy / 2));
        onUpdate({ imageDetails: { ...imgd, width: newW, height: newH, posX: newX, posY: newY } });
      } else if (vd) {
        const dh   = isTop ? -dy : dy;
        const newH = Math.max(5, Math.min(200, ((vd.height ?? origW * aspectRatio)) + dh));
        const newY = Math.max(0, Math.min(100, origPosY + dy / 2));
        onUpdate({ videoDetails: { ...vd, width: newW, height: newH, posX: newX, posY: newY } });
      }
    };
    const onUp = () => removeListeners(onMove, onUp);
    addListeners(onMove, onUp);
  };

  // ── Rotation ──────────────────────────────────────────────────────────────
  const handleRotation = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    const container = containerRef.current;
    if (!container) return;

    const rect     = container.getBoundingClientRect();
    // Center of the element in screen coords
    const cx = rect.left + (posX / 100) * rect.width;
    const cy = rect.top  + (posY / 100) * rect.height;

    const start      = clientPos(e);
    const startAngle = Math.atan2(start.y - cy, start.x - cx) * (180 / Math.PI);
    const origRot    = rotation;

    const onMove = (ev: MouseEvent | TouchEvent) => {
      ev.preventDefault();
      const cur      = clientPos(ev);
      const angle    = Math.atan2(cur.y - cy, cur.x - cx) * (180 / Math.PI);
      const newRot   = ((origRot + angle - startAngle) % 360 + 360) % 360;
      if (td)        onUpdate({ textDetails:  { ...td,   rotation: newRot } });
      else if (imgd) onUpdate({ imageDetails: { ...imgd, rotation: newRot } });
      else if (vd)   onUpdate({ videoDetails: { ...vd,   rotation: newRot } });
    };
    const onUp = () => removeListeners(onMove, onUp);
    addListeners(onMove, onUp);
  };

  // ── Corner positions ──────────────────────────────────────────────────────
  const cornerStyles: Record<Corner, React.CSSProperties> = {
    tl: { top: -HANDLE_HALF, left:  -HANDLE_HALF, cursor: 'nw-resize' },
    tr: { top: -HANDLE_HALF, right: -HANDLE_HALF, cursor: 'ne-resize' },
    bl: { bottom: -HANDLE_HALF, left:  -HANDLE_HALF, cursor: 'sw-resize' },
    br: { bottom: -HANDLE_HALF, right: -HANDLE_HALF, cursor: 'se-resize' },
  };

  return (
    <div
      style={{
        position: 'absolute',
        left: `${posX}%`,
        top: `${posY}%`,
        width: `${width}%`,
        transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
        cursor: 'move',
        userSelect: 'none',
        touchAction: 'none',
      }}
      onMouseDown={handleBodyDrag}
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
          handleBodyDrag(e);
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
      {/* Bounding box border */}
      {isSelected && (
        <div style={{
          position: 'absolute',
          inset: -1,
          border: '1.5px solid #2dd4bf',
          borderRadius: 2,
          pointerEvents: 'none',
          zIndex: 20,
        }} />
      )}

      {children}

      {/* 4 corner handles */}
      {isSelected && (['tl', 'tr', 'bl', 'br'] as Corner[]).map((corner) => (
        <div
          key={corner}
          style={{ ...HANDLE_STYLE, ...cornerStyles[corner] }}
          onMouseDown={(e) => { e.stopPropagation(); handleCorner(corner)(e); }}
          onTouchStart={(e) => { e.stopPropagation(); handleCorner(corner)(e); }}
        />
      ))}

      {/* Rotation handle — below bottom center */}
      {isSelected && (
        <>
          {/* Line connecting to rotation handle */}
          <div style={{
            position: 'absolute',
            bottom: -20,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 1,
            height: 12,
            background: '#2dd4bf',
            pointerEvents: 'none',
            zIndex: 20,
          }} />
          <div
            style={{
              position: 'absolute',
              bottom: -34,
              left: '50%',
              transform: 'translateX(-50%)',
              width: HANDLE_SIZE + 4,
              height: HANDLE_SIZE + 4,
              borderRadius: '50%',
              background: 'white',
              border: '2px solid #2dd4bf',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'grab',
              zIndex: 30,
              touchAction: 'none',
            }}
            onMouseDown={(e) => { e.stopPropagation(); handleRotation(e); }}
            onTouchStart={(e) => { e.stopPropagation(); handleRotation(e); }}
          >
            <RotateCw size={10} color="#2dd4bf" strokeWidth={2.5} />
          </div>
        </>
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
  currentAspectRatio,
  onChangeAspectRatio,
}: PreviewPanelProps) {
  const [showRatioMenu, setShowRatioMenu] = useState(false);
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
  // Web Audio graph for noise reduction in preview
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioGainRefs = useRef<Map<string, GainNode>>(new Map());
  const audioNrActiveRefs = useRef<Map<string, boolean>>(new Map());
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

  const { w: canvasW, h: canvasH } = previewSize(projectWidth, projectHeight);

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
      ctx.filter = buildFilter(vd?.brightness, vd?.contrast, vd?.saturation);

      if (vd?.useTransform) {
        // Custom position / size / rotation (CapCut-style transform applied)
        const ox  = (vd.posX ?? 50) / 100 * canvas.width;
        const oy  = (vd.posY ?? 50) / 100 * canvas.height;
        const dw  = (vd.width ?? 100) / 100 * canvas.width;
        const dh  = vW > 0 ? dw * (vH / vW) : dw;
        const rot = ((vd.rotation ?? 0) * Math.PI) / 180;
        // Apply crop clip before transform
        const hasCropUT = (vd.cropX ?? 0) !== 0 || (vd.cropY ?? 0) !== 0 || (vd.cropW ?? 1) !== 1 || (vd.cropH ?? 1) !== 1;
        if (hasCropUT) {
          ctx.beginPath();
          ctx.rect(ox - dw / 2 + (vd.cropX ?? 0) * dw, oy - dh / 2 + (vd.cropY ?? 0) * dh, (vd.cropW ?? 1) * dw, (vd.cropH ?? 1) * dh);
          ctx.clip();
        }
        ctx.translate(ox, oy);
        if (rot !== 0) ctx.rotate(rot);
        if (vd.flipH || vd.flipV) ctx.scale(vd.flipH ? -1 : 1, vd.flipV ? -1 : 1);
        ctx.drawImage(v, -dw / 2, -dh / 2, dw, dh);
      } else {
        // Contain-fit: center video without stretching
        const scale = Math.min(canvas.width / vW, canvas.height / vH);
        const dw = vW * scale;
        const dh = vH * scale;
        const dx = (canvas.width - dw) / 2;
        const dy = (canvas.height - dh) / 2;
        // Apply crop clip before drawing
        const hasCrop = (vd?.cropX ?? 0) !== 0 || (vd?.cropY ?? 0) !== 0 || (vd?.cropW ?? 1) !== 1 || (vd?.cropH ?? 1) !== 1;
        if (hasCrop) {
          ctx.beginPath();
          ctx.rect(dx + (vd!.cropX ?? 0) * dw, dy + (vd!.cropY ?? 0) * dh, (vd!.cropW ?? 1) * dw, (vd!.cropH ?? 1) * dh);
          ctx.clip();
        }
        if (vd?.flipH || vd?.flipV) {
          ctx.translate(vd!.flipH ? canvas.width : 0, vd!.flipV ? canvas.height : 0);
          ctx.scale(vd!.flipH ? -1 : 1, vd!.flipV ? -1 : 1);
        }
        ctx.drawImage(v, dx, dy, dw, dh);
      }

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
      const nrEnabled = ad?.noiseReduction ?? false;
      const prevNr = audioNrActiveRefs.current.get(item.id);

      // If noise reduction state changed, destroy existing element to recreate with correct routing
      if (prevNr !== undefined && prevNr !== nrEnabled) {
        const old = audioRefs.current.get(item.id);
        if (old) { old.pause(); old.src = ''; }
        audioRefs.current.delete(item.id);
        audioGainRefs.current.delete(item.id);
      }
      audioNrActiveRefs.current.set(item.id, nrEnabled);

      let audio = audioRefs.current.get(item.id);
      if (!audio) {
        audio = new Audio(mf.url);
        audio.preload = 'auto';
        audioRefs.current.set(item.id, audio);

        if (nrEnabled) {
          if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
          const ctx = audioCtxRef.current;
          const source = ctx.createMediaElementSource(audio);
          const highpass = ctx.createBiquadFilter();
          highpass.type = 'highpass';
          highpass.frequency.value = 80;
          const compressor = ctx.createDynamicsCompressor();
          compressor.threshold.value = -50;
          compressor.knee.value = 40;
          compressor.ratio.value = 12;
          compressor.attack.value = 0.003;
          compressor.release.value = 0.25;
          const gainNode = ctx.createGain();
          source.connect(highpass);
          highpass.connect(compressor);
          compressor.connect(gainNode);
          gainNode.connect(ctx.destination);
          audioGainRefs.current.set(item.id, gainNode);
        }
      }

      if (nrEnabled) {
        const gainNode = audioGainRefs.current.get(item.id);
        if (gainNode) gainNode.gain.value = Math.min(1, ad?.volume ?? 1) * (muted ? 0 : volume);
        audio.volume = 1;
      } else {
        const targetVol = Math.min(1, ad?.volume ?? 1) * (muted ? 0 : volume);
        if (Math.abs(audio.volume - targetVol) > 0.01) audio.volume = targetVol;
      }

      const rate = ad?.playbackRate ?? 1;
      if (audio.playbackRate !== rate) audio.playbackRate = rate;

      if (Math.abs(audio.currentTime - mediaTime) > 0.3) audio.currentTime = mediaTime;

      if (isPlaying && audio.paused) {
        if (audioCtxRef.current?.state === 'suspended') audioCtxRef.current.resume();
        audio.play().catch(() => {});
      } else if (!isPlaying && !audio.paused) audio.pause();
    }
  }, [currentTime, isPlaying, tracks, media, muted, volume]);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      for (const audio of audioRefs.current.values()) { audio.pause(); audio.src = ''; }
      audioRefs.current.clear();
      audioGainRefs.current.clear();
      audioNrActiveRefs.current.clear();
      audioCtxRef.current?.close();
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
        className="flex items-center justify-center relative"
        style={{ background: '#111', flex: '1 1 0', minHeight: 0, maxHeight: 'min(100%, 55vh)', padding: 10 }}
        onClick={() => { onSelectItem?.(null); setShowRatioMenu(false); }}
      >
        {/* Aspect ratio selector — top left */}
        {onChangeAspectRatio && (
          <div className="absolute top-2 left-2 z-50">
            <button
              className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold bg-black/60 border border-white/20 text-white hover:bg-black/80 transition-colors backdrop-blur-sm"
              onClick={(e) => { e.stopPropagation(); setShowRatioMenu((v) => !v); }}
            >
              {currentAspectRatio ?? '16:9'}
              <ChevronDown className="h-3 w-3 opacity-70" />
            </button>
            {showRatioMenu && (
              <div
                className="absolute top-full left-0 mt-1 w-52 rounded-lg border border-border bg-card shadow-xl overflow-y-auto"
                style={{ maxHeight: 'min(320px, 60vh)' }}
                onClick={(e) => e.stopPropagation()}
              >
                {(Object.entries(ASPECT_RATIOS) as [Project['aspectRatio'], typeof ASPECT_RATIOS[keyof typeof ASPECT_RATIOS]][]).map(([key, val]) => (
                  <button
                    key={key}
                    className="w-full flex items-center gap-3 px-3 py-2 hover:bg-muted/50 transition-colors text-left"
                    onClick={() => {
                      onChangeAspectRatio(key, val.w, val.h);
                      setShowRatioMenu(false);
                    }}
                  >
                    {/* Aspect ratio icon */}
                    <div
                      className="shrink-0 border border-muted-foreground/50 bg-muted/20"
                      style={{
                        width: val.w > val.h ? 24 : val.w === val.h ? 18 : 14,
                        height: val.w > val.h ? 14 : val.w === val.h ? 18 : 24,
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-[12px] font-semibold text-foreground">{val.label}</div>
                      <div className="text-[10px] text-muted-foreground truncate">{val.desc}</div>
                    </div>
                    {currentAspectRatio === key && (
                      <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
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
            outline: '1px solid rgba(255,255,255,0.18)',
            outlineOffset: 0,
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

        {/* Base video transform handle — rendered first so overlays appear on top */}
        {activeVideoItem && baseVideoTrack && (() => {
          const vd = activeVideoItem.item.videoDetails;
          const useTransform = vd?.useTransform ?? false;
          // When not using transform, compute the letterboxed bounds of the video
          // within the canvas so handles track the actual video content, not the full canvas.
          const mediaW = activeVideoItem.mediaFile?.width ?? projectWidth;
          const mediaH = activeVideoItem.mediaFile?.height ?? projectHeight;
          const scale = Math.min(projectWidth / mediaW, projectHeight / mediaH);
          const letterboxedWidthPct = (mediaW * scale / projectWidth) * 100;
          // OverlayHandle uses item.videoDetails.width (% of canvas width) for its CSS width.
          // Child aspect ratio determines the handle height automatically.
          const handleWidth = useTransform ? (vd?.width ?? 100) : letterboxedWidthPct;
          // For the child placeholder, use video's own aspect ratio so handles hug the content.
          const childAspectW = useTransform ? projectWidth : mediaW;
          const childAspectH = useTransform ? projectHeight : mediaH;
          return (
            <OverlayHandle
              key={activeVideoItem.item.id + '-base'}
              item={{
                ...activeVideoItem.item,
                videoDetails: {
                  ...(vd ?? DEFAULT_VIDEO_DETAILS),
                  posX: vd?.posX ?? 50,
                  posY: vd?.posY ?? 50,
                  width: handleWidth,
                },
              }}
              trackId={baseVideoTrack.id}
              containerRef={overlayContainerRef}
              isSelected={selectedItemId === activeVideoItem.item.id}
              onSelect={() => onSelectItem?.(activeVideoItem.item.id)}
              onOpenProperties={() => onOpenProperties?.(activeVideoItem.item.id)}
              onUpdate={(updates) => {
                const withTransform = updates.videoDetails
                  ? { ...updates, videoDetails: { ...updates.videoDetails, useTransform: true } }
                  : updates;
                onUpdateItem?.(baseVideoTrack.id, activeVideoItem.item.id, withTransform);
              }}
            >
              {/* Transparent placeholder — aspect ratio matches video content (not canvas) */}
              <div style={{ width: '100%', aspectRatio: `${childAspectW} / ${childAspectH}` }} />
            </OverlayHandle>
          );
        })()}

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
