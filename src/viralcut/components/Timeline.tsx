// ============================================================
// Timeline – Multi-track with drag, trim, split, select
// Supports video, audio, text, image tracks
// Playhead: draggable by handle; click empty lane area to seek
// Quick-split button: cuts ALL items across tracks at playhead
// ============================================================
import { useRef, useState, useCallback, useMemo, useEffect, useLayoutEffect } from 'react';
import { Lock, Volume2, VolumeX, Eye, EyeOff, Trash2, Film, Music, Type, Image, Scissors, Plus } from 'lucide-react';
import { Track, TrackItem, MediaFile } from '../types';
import { cn } from '@/lib/utils';

const TRACK_H: Record<string, number> = {
  video: 56,
  image: 56,
  audio: 34,
  text: 34,
};

interface TimelineProps {
  tracks: Track[];
  media: MediaFile[];
  currentTime: number;
  duration: number;
  zoom: number;
  selectedItemId: string | null;
  onSeek: (t: number) => void;
  onItemMove: (trackId: string, itemId: string, newStart: number) => void;
  onItemTrim: (trackId: string, itemId: string, newStart: number, newEnd: number, newMediaStart: number, newMediaEnd: number) => void;
  onItemDelete: (trackId: string, itemId: string) => void;
  onItemSelect: (itemId: string | null) => void;
  onItemDoubleClick?: (itemId: string) => void;
  onItemSplit: (trackId: string, itemId: string, atTime: number) => void;
  onTrackToggleMute: (trackId: string) => void;
  onTrackToggleLock: (trackId: string) => void;
  onDropMedia: (trackId: string, mediaId: string, startTime: number) => void;
  onOpenMediaPanel?: () => void;
  onSplitAllAtPlayhead?: () => void;
  onDeleteSelected?: () => void;
  onZoomChange?: (newZoom: number) => void;
  onItemReorder?: (trackId: string, itemId: string, insertIndex: number) => void;
  onItemMoveToTrack?: (fromTrackId: string, itemId: string, direction: 'toOverlay' | 'toMain', newStartTime: number) => void;
  isMobile?: boolean;
}

function fmtRuler(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
}

function TrackIcon({ type }: { type: Track['type'] }) {
  if (type === 'video') return <Film className="h-3.5 w-3.5" />;
  if (type === 'audio') return <Music className="h-3.5 w-3.5" />;
  if (type === 'text') return <Type className="h-3.5 w-3.5" />;
  return <Image className="h-3.5 w-3.5" />;
}

function trackLabel(type: Track['type']) {
  switch (type) {
    case 'video': return 'Vídeo';
    case 'audio': return 'Áudio';
    case 'text': return 'Texto';
    case 'image': return 'Imagem';
  }
}

function itemColors(type: Track['type'], isSelected: boolean) {
  switch (type) {
    case 'video':
      return isSelected
        ? 'bg-primary/30 border-primary shadow-lg shadow-primary/20'
        : 'bg-primary/15 border-primary/40 hover:border-primary/70';
    case 'audio':
      return isSelected
        ? 'bg-violet-500/30 border-violet-400 shadow-lg shadow-violet-500/20'
        : 'bg-violet-500/15 border-violet-500/40 hover:border-violet-400/70';
    case 'text':
      return isSelected
        ? 'bg-amber-500/30 border-amber-400 shadow-lg shadow-amber-500/20'
        : 'bg-amber-500/15 border-amber-500/40 hover:border-amber-400/70';
    case 'image':
      return isSelected
        ? 'bg-emerald-500/30 border-emerald-400 shadow-lg shadow-emerald-500/20'
        : 'bg-emerald-500/15 border-emerald-500/40 hover:border-emerald-400/70';
  }
}

export function Timeline({
  tracks,
  media,
  currentTime,
  duration,
  zoom,
  selectedItemId,
  onSeek,
  onItemMove,
  onItemTrim,
  onItemDelete,
  onItemSelect,
  onItemDoubleClick,
  onItemSplit,
  onTrackToggleMute,
  onTrackToggleLock,
  onDropMedia,
  onOpenMediaPanel,
  onSplitAllAtPlayhead,
  onDeleteSelected,
  onZoomChange,
  onItemReorder,
  onItemMoveToTrack,
  isMobile = false,
}: TimelineProps) {
  const rulerScrollRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const labelsRef = useRef<HTMLDivElement>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [isDraggingPlayhead, setIsDraggingPlayhead] = useState(false);
  // Mobile-only magnetic drag state
  const [mobileDragState, setMobileDragState] = useState<{
    itemId: string;
    trackId: string;
    insertIndex: number;
  } | null>(null);
  // Cross-track drag hint (desktop mouse only)
  const [crossTrackHint, setCrossTrackHint] = useState<{
    itemId: string;
    direction: 'toOverlay' | 'toMain';
  } | null>(null);
  // Long-press floating drag state (touch only — CapCut-style cross-track + reorder)
  const [floatingDrag, setFloatingDrag] = useState<{
    itemId: string;
    trackId: string;
    label: string;
    itemWPx: number;
    screenX: number;
    screenY: number;
    floatDir: 'undecided' | 'horizontal' | 'vertical';
    insertIndex: number;
    targetTrackId: string | null;
  } | null>(null);
  const floatingElRef = useRef<HTMLDivElement>(null);

  // ── Pinch-to-zoom ─────────────────────────────────────────────
  const pinchRef        = useRef<{ dist: number; anchorX: number } | null>(null);
  const zoomRef         = useRef(zoom);
  const pendingScrollRef = useRef<number | null>(null);
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);

  // Apply scroll correction after React commits the new zoom (no visual flash)
  useLayoutEffect(() => {
    if (pendingScrollRef.current !== null && scrollRef.current) {
      scrollRef.current.scrollLeft = Math.max(0, pendingScrollRef.current);
      pendingScrollRef.current = null;
    }
  }, [zoom]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        const dx = e.touches[1].clientX - e.touches[0].clientX;
        const dy = e.touches[1].clientY - e.touches[0].clientY;
        // anchorX: midpoint of fingers relative to the scrollable content area (label col = 160px)
        const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const rect = el.getBoundingClientRect();
        const anchorX = midX - rect.left - 160;
        pinchRef.current = { dist: Math.hypot(dx, dy), anchorX };
      } else {
        pinchRef.current = null;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 2 || !pinchRef.current) return;
      e.preventDefault(); // block browser pinch-zoom / scroll during our gesture

      const dx = e.touches[1].clientX - e.touches[0].clientX;
      const dy = e.touches[1].clientY - e.touches[0].clientY;
      const newDist = Math.hypot(dx, dy);
      const ratio = newDist / pinchRef.current.dist;
      pinchRef.current.dist = newDist;

      const oldZoom = zoomRef.current;
      const newZoom = Math.min(300, Math.max(20, Math.round(oldZoom * ratio)));
      if (newZoom !== oldZoom) {
        const { anchorX } = pinchRef.current;
        // Keep the anchor time fixed: newScrollLeft = (anchorX + scrollLeft) * ratio - anchorX
        pendingScrollRef.current = (anchorX + el.scrollLeft) * (newZoom / oldZoom) - anchorX;
        zoomRef.current = newZoom;
        onZoomChange?.(newZoom);
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) pinchRef.current = null;
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove',  onTouchMove,  { passive: false });
    el.addEventListener('touchend',   onTouchEnd,   { passive: true });

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove',  onTouchMove);
      el.removeEventListener('touchend',   onTouchEnd);
    };
  }, [onZoomChange]);

  // Double-click detection: track last click per item
  const lastClickRef = useRef<{ id: string; time: number } | null>(null);

  // Sync horizontal scroll: tracks → ruler
  const handleTrackScroll = useCallback(() => {
    if (scrollRef.current && rulerScrollRef.current) {
      rulerScrollRef.current.scrollLeft = scrollRef.current.scrollLeft;
    }
  }, []);

  const totalWidth = Math.max(duration * zoom + 300, 800);

  const { majorTicks, minorTicks } = useMemo(() => {
    const totalSeconds = Math.ceil(totalWidth / zoom);
    const majorInterval = zoom < 60 ? 5 : zoom < 100 ? 2 : 1;

    // Sub-second minor tick interval based on zoom level
    let minorInterval: number | null = null;
    if      (zoom >= 400) minorInterval = 0.1;
    else if (zoom >= 150) minorInterval = 0.25;
    else if (zoom >= 80)  minorInterval = 0.5;

    const major: number[] = [];
    const minor: number[] = [];

    for (let i = 0; i <= totalSeconds; i += majorInterval) major.push(i);

    if (minorInterval) {
      const step = minorInterval;
      for (let t = step; t <= totalSeconds; t = Math.round((t + step) * 1000) / 1000) {
        if (!major.some((mt) => Math.abs(mt - t) < 0.001)) minor.push(t);
      }
    }

    return { majorTicks: major, minorTicks: minor };
  }, [zoom, totalWidth]);

  // ── Shared: convert clientX inside the scroll area to timeline time ──
  const clientXToTime = useCallback((clientX: number): number => {
    const scroll = scrollRef.current;
    if (!scroll) return 0;
    const rect = scroll.getBoundingClientRect();
    // 160px label column scrolls with content, offset needed
    const x = clientX - rect.left - 160 + scroll.scrollLeft;
    return Math.max(0, x / zoom);
  }, [zoom]);

  // ── Ruler click → seek ───────────────────────────────────────
  const handleRulerClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const t = clientXToTime(e.clientX);
    onSeek(t);
  }, [clientXToTime, onSeek]);

  // ── Playhead drag (handle on ruler) ─────────────────────────
  const handlePlayheadMouseDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsDraggingPlayhead(true);

    const onMove = (ev: MouseEvent) => {
      const t = clientXToTime(ev.clientX);
      onSeek(t);
    };
    const onUp = () => {
      setIsDraggingPlayhead(false);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [clientXToTime, onSeek]);

  // Touch drag for playhead
  const handlePlayheadTouchStart = useCallback((e: React.TouchEvent) => {
    e.stopPropagation();
    setIsDraggingPlayhead(true);

    const onMove = (ev: TouchEvent) => {
      const t = clientXToTime(ev.touches[0].clientX);
      onSeek(t);
    };
    const onUp = () => {
      setIsDraggingPlayhead(false);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
    };
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('touchend', onUp);
  }, [clientXToTime, onSeek]);

  // ── Click on empty lane area → seek ─────────────────────────
  const handleLaneClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    // Only seek if the click target is the lane itself (not a clip item)
    if ((e.target as HTMLElement) !== e.currentTarget) return;
    const t = clientXToTime(e.clientX);
    onSeek(t);
    onItemSelect(null);
  }, [clientXToTime, onSeek, onItemSelect]);

  // Touch seek on empty lane
  const handleLaneTouchStart = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement) !== e.currentTarget) return;
    const t = clientXToTime(e.touches[0].clientX);
    onSeek(t);
  }, [clientXToTime, onSeek]);

  // ── Drag item (move) — mouse ─────────────────────────────────
  const handleItemMouseDown = (e: React.MouseEvent, track: Track, item: TrackItem) => {
    if (track.locked) return;
    e.stopPropagation();
    e.preventDefault();
    onItemSelect(item.id);

    const startX = e.clientX;
    const startY = e.clientY;
    const origStart = item.startTime;
    let dragging = false;
    let currentNewStart = origStart;
    let crossTrackDir: 'toOverlay' | 'toMain' | null = null;

    // Cross-track only for video items
    const mainVideoTrackId = tracks.find((t) => t.type === 'video')?.id;
    const isMainTrack = item.type === 'video' && track.id === mainVideoTrackId;
    const isOverlayTrack = item.type === 'video' && track.type === 'video' && !isMainTrack;

    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (!dragging && Math.abs(dx) < 4 && Math.abs(dy) < 4) return;
      dragging = true;
      currentNewStart = Math.max(0, origStart + dx / zoom);
      onItemMove(track.id, item.id, currentNewStart);

      // Cross-track: main is at top, overlays below → drag down from main = toOverlay; drag up from overlay = toMain
      if (isMainTrack && dy > 28) {
        crossTrackDir = 'toOverlay';
        setCrossTrackHint({ itemId: item.id, direction: 'toOverlay' });
      } else if (isOverlayTrack && dy < -28) {
        crossTrackDir = 'toMain';
        setCrossTrackHint({ itemId: item.id, direction: 'toMain' });
      } else {
        crossTrackDir = null;
        setCrossTrackHint(null);
      }
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);

      if (dragging && crossTrackDir) {
        onItemMoveToTrack?.(track.id, item.id, crossTrackDir, currentNewStart);
      }
      setCrossTrackHint(null);

      // Don't fire double-click if we actually dragged
      if (!dragging) {
        const now = Date.now();
        const last = lastClickRef.current;
        if (last && last.id === item.id && now - last.time < 350) {
          // Double click detected → open properties
          lastClickRef.current = null;
          onItemDoubleClick?.(item.id);
        } else {
          lastClickRef.current = { id: item.id, time: now };
        }
      }
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // ── Drag item (move) — touch ─────────────────────────────────
  const handleItemTouchStart = (e: React.TouchEvent, track: Track, item: TrackItem) => {
    if (track.locked) return;
    e.stopPropagation();
    onItemSelect(item.id);

    const startX = e.touches[0].clientX;
    const startY = e.touches[0].clientY;
    const origStart = item.startTime;
    let isDragging = false;
    let currentInsertIndex = 0;
    let currentNewStart = origStart;
    // 'undecided' → 'horizontal' (normal drag) or 'floating' (long-press detach)
    let dragMode: 'undecided' | 'horizontal' | 'floating' = 'undecided';

    const mainVideoTrackId = tracks.find((t) => t.type === 'video')?.id;
    const isMagneticTrack = isMobile && track.id === mainVideoTrackId;

    // ── Long-press timer: detach clip after 420ms (video items on mobile only) ──
    let longPressTimer: ReturnType<typeof setTimeout> | null = null;
    let lastTargetTrackId: string | null = track.id;

    if (item.type === 'video' && isMobile) {
      const itemWPx = (item.endTime - item.startTime) * zoom;
      longPressTimer = setTimeout(() => {
        dragMode = 'floating';
        navigator.vibrate?.(28);
        setFloatingDrag({
          itemId: item.id,
          trackId: track.id,
          label: item.name,
          itemWPx,
          screenX: startX,
          screenY: startY,
          floatDir: 'undecided',
          insertIndex: 0,
          targetTrackId: track.id,
        });
      }, 420);
    }

    // Direction determined after long-press activates (locked once set)
    let floatDir: 'undecided' | 'horizontal' | 'vertical' = 'undecided';

    const onMove = (ev: TouchEvent) => {
      const cx = ev.touches[0].clientX;
      const cy = ev.touches[0].clientY;
      const dx = cx - startX;
      const dy = cy - startY;

      // ── Floating mode: unified horizontal (reorder) + vertical (cross-track) ──
      if (dragMode === 'floating') {
        ev.preventDefault();

        // Move ghost element imperatively (no React re-render per frame)
        if (floatingElRef.current) {
          const elW = Math.min((item.endTime - item.startTime) * zoom, 180);
          floatingElRef.current.style.left = `${cx - elW / 2}px`;
          floatingElRef.current.style.top  = `${cy - 56}px`;
        }

        // Lock direction on first significant movement
        if (floatDir === 'undecided' && (Math.abs(dx) > 12 || Math.abs(dy) > 12)) {
          floatDir = Math.abs(dx) >= Math.abs(dy) ? 'horizontal' : 'vertical';
          setFloatingDrag((prev) => prev ? { ...prev, floatDir } : null);
        }

        if (floatDir === 'horizontal') {
          currentNewStart = Math.max(0, origStart + dx / zoom);
          const otherItems = track.items
            .filter((i) => i.id !== item.id)
            .sort((a, b) => a.startTime - b.startTime);
          let idx = otherItems.findIndex((i) => (i.startTime + i.endTime) / 2 > currentNewStart);
          if (idx === -1) idx = otherItems.length;
          if (idx !== currentInsertIndex) {
            currentInsertIndex = idx;
            setFloatingDrag((prev) => prev ? { ...prev, insertIndex: idx } : null);
          }
        } else if (floatDir === 'vertical') {
          currentNewStart = Math.max(0, origStart + dx / zoom);
          const hitEl = document.elementFromPoint(cx, cy);
          const hitTrackEl = hitEl?.closest('[data-track-id]') as HTMLElement | null;
          const hitTrackId = hitTrackEl?.dataset.trackId ?? null;
          if (hitTrackId !== lastTargetTrackId) {
            lastTargetTrackId = hitTrackId;
            setFloatingDrag((prev) => prev ? { ...prev, targetTrackId: hitTrackId } : null);
          }
        }
        return;
      }

      // Cancel long press if finger moves significantly before timer fires
      if (longPressTimer && (Math.abs(dx) > 14 || Math.abs(dy) > 14)) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }

      if (dragMode === 'undecided') {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        isDragging = true;
        ev.preventDefault();
        dragMode = 'horizontal';
        if (isMagneticTrack) {
          setMobileDragState({ itemId: item.id, trackId: track.id, insertIndex: 0 });
        }
      } else {
        isDragging = true;
        ev.preventDefault();
      }

      if (dragMode === 'horizontal') {
        currentNewStart = Math.max(0, origStart + dx / zoom);
        onItemMove(track.id, item.id, currentNewStart);
        if (isMagneticTrack) {
          const touchTimeSec = clientXToTime(cx);
          const otherItems = track.items
            .filter((i) => i.id !== item.id)
            .sort((a, b) => a.startTime - b.startTime);
          let idx = otherItems.findIndex((i) => (i.startTime + i.endTime) / 2 > touchTimeSec);
          if (idx === -1) idx = otherItems.length;
          currentInsertIndex = idx;
          setMobileDragState({ itemId: item.id, trackId: track.id, insertIndex: idx });
        }
      }
    };

    const onUp = () => {
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
      if (longPressTimer) clearTimeout(longPressTimer);

      // ── Floating drag ended: execute action based on direction ──
      if (dragMode === 'floating') {
        if (floatDir === 'horizontal') {
          onItemReorder?.(track.id, item.id, currentInsertIndex);
        } else if (floatDir === 'vertical' && lastTargetTrackId && lastTargetTrackId !== track.id) {
          const targetType = tracks.find((t) => t.id === lastTargetTrackId)?.type;
          if (targetType === 'video') {
            const isFromMain = track.id === mainVideoTrackId;
            const direction: 'toOverlay' | 'toMain' = isFromMain ? 'toOverlay' : 'toMain';
            onItemMoveToTrack?.(track.id, item.id, direction, currentNewStart);
          }
        }
        // floatDir === 'undecided' → barely moved → no action
        setFloatingDrag(null);
        return;
      }

      if (isMagneticTrack && isDragging && dragMode === 'horizontal') {
        onItemReorder?.(track.id, item.id, currentInsertIndex);
      }
      setMobileDragState(null);

      // Don't fire double-tap if we actually dragged
      if (!isDragging) {
        const now = Date.now();
        const last = lastClickRef.current;
        if (last && last.id === item.id && now - last.time < 400) {
          lastClickRef.current = null;
          onItemDoubleClick?.(item.id);
        } else {
          lastClickRef.current = { id: item.id, time: now };
        }
      }
    };

    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onUp);
  };

  // ── Trim left handle (mouse + touch) ────────────────────────
  const handleTrimLeft = (e: React.MouseEvent | React.TouchEvent, track: Track, item: TrackItem) => {
    if (track.locked) return;
    e.stopPropagation();
    if ('preventDefault' in e) e.preventDefault();

    const isTouch = 'touches' in e;
    const startX = isTouch ? (e as React.TouchEvent).touches[0].clientX : (e as React.MouseEvent).clientX;
    const origStart = item.startTime;
    const origMediaStart = item.mediaStart;
    const maxTrim = item.endTime - origStart - 0.1;

    const onMove = (ev: MouseEvent | TouchEvent) => {
      const cx = 'touches' in ev ? (ev as TouchEvent).touches[0].clientX : (ev as MouseEvent).clientX;
      const dx = cx - startX;
      const delta = dx / zoom;
      const clampedDelta = Math.max(-origMediaStart, Math.min(maxTrim, delta));
      onItemTrim(track.id, item.id, origStart + clampedDelta, item.endTime, origMediaStart + clampedDelta, item.mediaEnd);
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

  // ── Trim right handle (mouse + touch) ────────────────────────
  const handleTrimRight = (e: React.MouseEvent | React.TouchEvent, track: Track, item: TrackItem) => {
    if (track.locked) return;
    e.stopPropagation();
    if ('preventDefault' in e) e.preventDefault();

    const isTouch = 'touches' in e;
    const startX = isTouch ? (e as React.TouchEvent).touches[0].clientX : (e as React.MouseEvent).clientX;
    const origEnd = item.endTime;
    const origMediaEnd = item.mediaEnd;
    const mediaDur = media.find((m) => m.id === item.mediaId)?.duration ?? origMediaEnd;
    const minEnd = item.startTime + 0.1;
    const maxMediaDur = mediaDur > 0 ? mediaDur : 3600;

    const onMove = (ev: MouseEvent | TouchEvent) => {
      const cx = 'touches' in ev ? (ev as TouchEvent).touches[0].clientX : (ev as MouseEvent).clientX;
      const dx = cx - startX;
      const delta = dx / zoom;
      const newEnd = Math.max(minEnd, Math.min(item.startTime + maxMediaDur - item.mediaStart, origEnd + delta));
      const newMediaEnd = item.mediaStart + (newEnd - item.startTime);
      onItemTrim(track.id, item.id, item.startTime, newEnd, item.mediaStart, newMediaEnd);
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

  // ── Drop from media panel ────────────────────────────────────
  const handleDrop = (e: React.DragEvent, trackId: string) => {
    e.preventDefault();
    setDragOver(null);
    const mediaId = e.dataTransfer.getData('mediaId');
    if (!mediaId) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const startTime = Math.max(0, (e.clientX - rect.left) / zoom);
    onDropMedia(trackId, mediaId, startTime);
  };

  const playheadX = currentTime * zoom;

  // ── Count how many items would be split at currentTime ──────
  const splitableCount = tracks.reduce((acc, t) => {
    if (t.locked) return acc;
    return acc + t.items.filter(
      (i) => currentTime > i.startTime + 0.05 && currentTime < i.endTime - 0.05
    ).length;
  }, 0);

  return (
    <div className="flex flex-col h-full bg-card select-none overflow-hidden">

      {/* ── Ruler ── */}
      <div
        className="flex shrink-0 bg-muted/30 border-b border-border cursor-pointer relative"
        style={{ height: 28 }}
        onClick={handleRulerClick}
      >
        {/* Label column spacer — fixed width, never scrolls */}
        <div className="w-[160px] shrink-0 bg-card/80 border-r border-border flex items-center justify-center gap-1.5 px-2 z-20">
          {/* Add Media strictly to timeline */}
          <button
            title="Adicionar mídia na Timeline Principal"
            onClick={(e) => { e.stopPropagation(); onOpenMediaPanel?.(); }}
            className="flex items-center justify-center h-6 w-6 rounded-md bg-emerald-500/20 border border-emerald-500/50 text-emerald-500 hover:bg-emerald-500/30 transition-all shadow-sm"
          >
            <Plus className="h-4 w-4" />
          </button>
          {/* Quick-split-all button */}
          <button
            title={`Cortar todas as camadas no playhead${splitableCount > 0 ? ` (${splitableCount} itens)` : ''}`}
            disabled={splitableCount === 0}
            onClick={(e) => { e.stopPropagation(); onSplitAllAtPlayhead?.(); }}
            className={cn(
              'flex items-center gap-1 px-2 py-0.5 h-6 rounded-md text-[11px] font-bold transition-all border shadow-sm',
              splitableCount > 0
                ? 'bg-primary border-primary text-white hover:bg-primary/90 cursor-pointer'
                : 'bg-muted/40 border-border/30 text-muted-foreground/40 cursor-not-allowed'
            )}
          >
            <Scissors className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Cortar</span>
          </button>
          {/* Quick-delete selected item */}
          <button
            title="Deletar item selecionado"
            disabled={!selectedItemId}
            onClick={(e) => { e.stopPropagation(); onDeleteSelected?.(); }}
            className={cn(
              'flex items-center justify-center h-6 w-8 rounded-md text-[10px] font-bold transition-all border shadow-sm',
              selectedItemId
                ? 'bg-destructive border-destructive text-white hover:bg-destructive/90 cursor-pointer'
                : 'bg-muted/40 border-border/30 text-muted-foreground/40 cursor-not-allowed'
            )}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Ruler ticks — scrolls in sync with tracks via rulerScrollRef */}
        <div className="relative overflow-hidden flex-1" ref={rulerScrollRef}>
          <div style={{ width: totalWidth, position: 'relative', height: 28 }}>
            {/* Sub-second minor ticks */}
            {minorTicks.map((t) => (
              <div
                key={`minor-${t}`}
                className="absolute top-0"
                style={{ left: t * zoom }}
              >
                <div className="w-px h-1.5 bg-border/50" />
              </div>
            ))}

            {/* Major ticks with labels */}
            {majorTicks.map((t) => (
              <div
                key={t}
                className="absolute top-0 flex flex-col items-center"
                style={{ left: t * zoom }}
              >
                <div className="w-px h-2.5 bg-border" />
                <span className="text-[9px] text-muted-foreground/70 mt-0.5 whitespace-nowrap select-none">
                  {fmtRuler(t)}
                </span>
              </div>
            ))}

            {/* Playhead on ruler — draggable handle */}
            <div
              className="absolute top-0 h-full z-20 flex flex-col items-center"
              style={{ left: playheadX, transform: 'translateX(-50%)' }}
            >
              {/* Triangle handle — grab here to drag */}
              <div
                className={cn(
                  'w-5 h-3.5 flex items-center justify-center cursor-grab active:cursor-grabbing',
                  isDraggingPlayhead && 'cursor-grabbing'
                )}
                onMouseDown={handlePlayheadMouseDown}
                onTouchStart={handlePlayheadTouchStart}
                title="Arraste para mover o playhead"
              >
                <svg width="14" height="10" viewBox="0 0 14 10" className="text-primary drop-shadow">
                  <polygon points="7,10 0,0 14,0" fill="currentColor" />
                </svg>
              </div>
              {/* Vertical line (pointer-events-none so it doesn't block drag) */}
              <div className="w-0.5 flex-1 bg-primary pointer-events-none" />
            </div>
          </div>
        </div>
      </div>

      {/* ── Tracks ── */}
      <div
        className="flex-1 overflow-x-auto overflow-y-auto min-h-0"
        ref={scrollRef}
        onScroll={handleTrackScroll}
      >
        {/* Inner wrapper: labels (160px) + timeline content scroll together */}
        <div style={{ width: totalWidth + 160, minWidth: '100%' }}>
        {tracks.map((track) => (
          <div
            key={track.id}
            className={cn(
              'flex border-b border-border relative',
              dragOver === track.id && 'ring-1 ring-inset ring-primary/40 bg-primary/5'
            )}
            style={{ height: TRACK_H[track.type] ?? 56 }}
          >
            {/* Track label — scrolls with content (slides left when seeking forward) */}
            <div className="w-[160px] shrink-0 flex items-center gap-1.5 px-2 bg-card border-r border-border z-10">
              <div className="p-1 rounded text-muted-foreground shrink-0">
                <TrackIcon type={track.type} />
              </div>
              <span className="text-[11px] font-medium text-foreground capitalize flex-1 truncate">
                {trackLabel(track.type)}
              </span>
              <button
                className={cn(
                  'p-0.5 rounded transition-colors shrink-0',
                  track.muted ? 'text-destructive' : 'text-muted-foreground hover:text-foreground'
                )}
                onClick={() => onTrackToggleMute(track.id)}
                title={
                  track.type === 'audio'
                    ? (track.muted ? 'Ativar som' : 'Silenciar')
                    : (track.muted ? 'Mostrar' : 'Ocultar')
                }
              >
                {track.type === 'audio'
                  ? (track.muted ? <VolumeX className="h-3 w-3" /> : <Volume2 className="h-3 w-3" />)
                  : (track.muted ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />)
                }
              </button>
              <button
                className={cn(
                  'p-0.5 rounded transition-colors shrink-0',
                  track.locked ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                )}
                onClick={() => onTrackToggleLock(track.id)}
                title={track.locked ? 'Desbloquear' : 'Bloquear'}
              >
                <Lock className="h-3 w-3" />
              </button>
            </div>

            {/* Track lane — click empty area to seek */}
            <div
              className={cn(
                'relative flex-1',
                floatingDrag?.floatDir === 'vertical'
                  && floatingDrag.targetTrackId === track.id
                  && floatingDrag.trackId !== track.id
                  ? 'bg-primary/15 ring-1 ring-inset ring-primary/50'
                  : undefined
              )}
              data-track-id={track.id}
              style={{ width: totalWidth, cursor: 'crosshair' }}
              onDragOver={(e) => { e.preventDefault(); setDragOver(track.id); }}
              onDragLeave={() => setDragOver(null)}
              onDrop={(e) => handleDrop(e, track.id)}
              onClick={handleLaneClick}
              onTouchStart={handleLaneTouchStart}
            >
              {/* Playhead line across lane */}
              <div
                className="absolute top-0 bottom-0 bg-primary z-20 pointer-events-none"
                style={{ left: playheadX, width: 1 }}
              />

              {/* Insertion indicator — regular drag OR floating horizontal */}
              {isMobile && (() => {
                const isRegular  = mobileDragState?.trackId === track.id;
                const isFloating = floatingDrag?.floatDir === 'horizontal' && floatingDrag.trackId === track.id;
                if (!isRegular && !isFloating) return null;

                const dragItemId  = isRegular ? mobileDragState!.itemId    : floatingDrag!.itemId;
                const insertIndex = isRegular ? mobileDragState!.insertIndex : floatingDrag!.insertIndex;

                const otherItems = track.items
                  .filter((i) => i.id !== dragItemId)
                  .sort((a, b) => a.startTime - b.startTime);
                let insertX: number;
                if (insertIndex <= 0 || otherItems.length === 0) {
                  insertX = otherItems.length > 0 ? otherItems[0].startTime * zoom : 0;
                } else if (insertIndex >= otherItems.length) {
                  insertX = otherItems[otherItems.length - 1].endTime * zoom;
                } else {
                  insertX = otherItems[insertIndex].startTime * zoom;
                }
                return (
                  <div
                    style={{
                      position: 'absolute',
                      left: insertX - 1,
                      top: 2,
                      bottom: 2,
                      width: 3,
                      background: '#3b82f6',
                      borderRadius: 2,
                      zIndex: 25,
                      pointerEvents: 'none',
                      boxShadow: '0 0 6px 1px rgba(59,130,246,0.7)',
                    }}
                  />
                );
              })()}

              {/* Items */}
              {track.items.map((item) => {
                const w = Math.max((item.endTime - item.startTime) * zoom, 8);
                const left = item.startTime * zoom;
                const m = media.find((x) => x.id === item.mediaId);
                const isSelected = selectedItemId === item.id;
                const isTextOrImage = item.type === 'text' || item.type === 'image';

                return (
                  <div
                    key={item.id}
                    className={cn(
                      'absolute top-1.5 bottom-1.5 rounded-lg border overflow-visible flex items-center group transition-shadow',
                      track.locked ? 'cursor-not-allowed' : 'cursor-grab active:cursor-grabbing',
                      itemColors(track.type, isSelected)
                    )}
                    style={{ left, width: w, opacity: floatingDrag?.itemId === item.id ? 0.3 : crossTrackHint?.itemId === item.id ? 0.55 : mobileDragState?.itemId === item.id ? 0.45 : undefined }}
                    onMouseDown={(e) => handleItemMouseDown(e, track, item)}
                    onTouchStart={(e) => handleItemTouchStart(e, track, item)}
                    title={item.name}
                  >
                    {/* Tiled thumbnail strip for video/image clips */}
                    {m?.thumbnail && (track.type === 'video' || track.type === 'image') && (
                      <div
                        style={{
                          position: 'absolute',
                          inset: 0,
                          backgroundImage: `url(${m.thumbnail})`,
                          backgroundSize: 'auto 100%',
                          backgroundRepeat: 'repeat-x',
                          backgroundPosition: 'left center',
                          opacity: 0.45,
                          pointerEvents: 'none',
                          borderRadius: 'inherit',
                        }}
                      />
                    )}

                    {/* Text preview */}
                    {item.type === 'text' && item.textDetails && (
                      <span
                        className="text-[9px] px-1.5 truncate flex-1 pointer-events-none font-medium"
                        style={{ color: item.textDetails.color }}
                      >
                        {item.textDetails.text || item.name}
                      </span>
                    )}

                    {/* Name for non-text */}
                    {item.type !== 'text' && (
                      <span className="text-[10px] font-medium px-1.5 truncate text-foreground/90 flex-1 pointer-events-none">
                        {item.name}
                      </span>
                    )}


                    {/* ── Trim handles (CapCut-style bracket) ── */}
                    {!track.locked && (
                      <>
                        {/* Left trim bracket */}
                        <div
                          className="absolute left-0 top-0 bottom-0 w-4 cursor-col-resize z-30 touch-none group/trim"
                          onMouseDown={(e) => handleTrimLeft(e, track, item)}
                          onTouchStart={(e) => handleTrimLeft(e, track, item)}
                        >
                          {/* Vertical bar */}
                          <div className={cn(
                            'absolute left-0 inset-y-0 w-[5px] rounded-l transition-colors',
                            isSelected ? 'bg-white' : 'bg-white/50 group-hover/trim:bg-white/90'
                          )} />
                          {/* Top horizontal tick */}
                          <div className={cn(
                            'absolute top-0 left-0 h-[3px] w-3 transition-colors',
                            isSelected ? 'bg-white' : 'bg-white/50 group-hover/trim:bg-white/90'
                          )} />
                          {/* Bottom horizontal tick */}
                          <div className={cn(
                            'absolute bottom-0 left-0 h-[3px] w-3 transition-colors',
                            isSelected ? 'bg-white' : 'bg-white/50 group-hover/trim:bg-white/90'
                          )} />
                        </div>
                        {/* Right trim bracket */}
                        <div
                          className="absolute right-0 top-0 bottom-0 w-4 cursor-col-resize z-30 touch-none group/trim"
                          onMouseDown={(e) => handleTrimRight(e, track, item)}
                          onTouchStart={(e) => handleTrimRight(e, track, item)}
                        >
                          {/* Vertical bar */}
                          <div className={cn(
                            'absolute right-0 inset-y-0 w-[5px] rounded-r transition-colors',
                            isSelected ? 'bg-white' : 'bg-white/50 group-hover/trim:bg-white/90'
                          )} />
                          {/* Top horizontal tick */}
                          <div className={cn(
                            'absolute top-0 right-0 h-[3px] w-3 transition-colors',
                            isSelected ? 'bg-white' : 'bg-white/50 group-hover/trim:bg-white/90'
                          )} />
                          {/* Bottom horizontal tick */}
                          <div className={cn(
                            'absolute bottom-0 right-0 h-[3px] w-3 transition-colors',
                            isSelected ? 'bg-white' : 'bg-white/50 group-hover/trim:bg-white/90'
                          )} />
                        </div>
                      </>
                    )}

                    {/* Cross-track drag hint label */}
                    {crossTrackHint?.itemId === item.id && (
                      <div
                        className="absolute inset-0 flex items-center justify-center pointer-events-none z-40 rounded-lg"
                        style={{ background: 'rgba(59,130,246,0.18)' }}
                      >
                        <span className="bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded-full shadow">
                          {crossTrackHint.direction === 'toOverlay' ? '↑ Camada' : '↓ Principal'}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {/* Empty state */}
        {tracks.every((t) => t.items.length === 0) && (
          <div className="flex items-center justify-center h-16 text-muted-foreground/40 text-xs">
            Arraste mídia aqui ou clique em "+ Adicionar" no painel esquerdo
          </div>
        )}
        </div>{/* end inner width wrapper */}
      </div>{/* end scroll container */}

      {/* ── Floating ghost (long-press cross-track drag) ── */}
      {floatingDrag && (
        <div
          ref={floatingElRef}
          className="fixed pointer-events-none z-[200]"
          style={{
            left: floatingDrag.screenX - Math.min(floatingDrag.itemWPx, 180) / 2,
            top:  floatingDrag.screenY - 56,
            width:  Math.min(floatingDrag.itemWPx, 180),
            height: 48,
            transform: 'scale(1.07)',
            transformOrigin: 'bottom center',
            transition: 'none',
          }}
        >
          <div className="w-full h-full rounded-xl border-2 border-primary bg-primary/40 backdrop-blur-sm flex items-center px-2.5 gap-1.5 shadow-2xl shadow-primary/50">
            <Film className="h-3.5 w-3.5 text-primary-foreground shrink-0" />
            <span className="text-[11px] font-bold text-primary-foreground truncate flex-1">
              {floatingDrag.label}
            </span>
          </div>
          {/* Label: cross-track (vertical) */}
          {floatingDrag.floatDir === 'vertical'
            && floatingDrag.targetTrackId
            && floatingDrag.targetTrackId !== floatingDrag.trackId
            && (() => {
              const mainVidId = tracks.find((t) => t.type === 'video')?.id;
              const targetType = tracks.find((t) => t.id === floatingDrag.targetTrackId)?.type;
              if (targetType !== 'video') return null;
              const label = floatingDrag.trackId === mainVidId ? '↓ Mover para Camada' : '↑ Mover para Principal';
              return (
                <div className="absolute -bottom-5 left-0 right-0 flex justify-center">
                  <span className="bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded-full shadow-lg whitespace-nowrap">
                    {label}
                  </span>
                </div>
              );
            })()
          }
          {/* Label: reorder (horizontal) */}
          {floatingDrag.floatDir === 'horizontal' && (
            <div className="absolute -bottom-5 left-0 right-0 flex justify-center">
              <span className="bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-lg whitespace-nowrap">
                ↔ Reorganizar
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
