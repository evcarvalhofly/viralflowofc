// ============================================================
// Timeline – Multi-track with drag, trim, split, select
// Supports video, audio, text, image tracks
// ============================================================
import { useRef, useState, useCallback } from 'react';
import { Lock, Volume2, VolumeX, Trash2, Film, Music, Type, Image, Scissors } from 'lucide-react';
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
  onItemSplit: (trackId: string, itemId: string, atTime: number) => void;
  onTrackToggleMute: (trackId: string) => void;
  onTrackToggleLock: (trackId: string) => void;
  onDropMedia: (trackId: string, mediaId: string, startTime: number) => void;
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

/** Color classes for each track/item type */
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
  onItemSplit,
  onTrackToggleMute,
  onTrackToggleLock,
  onDropMedia,
}: TimelineProps) {
  const rulerRef = useRef<HTMLDivElement>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);

  const totalWidth = Math.max(duration * zoom + 300, 800);
  const tickInterval = zoom < 60 ? 5 : zoom < 100 ? 2 : 1;
  const ticks: number[] = [];
  const totalSeconds = Math.ceil(totalWidth / zoom);
  for (let i = 0; i <= totalSeconds; i += tickInterval) ticks.push(i);

  // ── Ruler seek ──────────────────────────────────────────────
  const handleRulerClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left - 160;
    const t = Math.max(0, x / zoom);
    onSeek(t);
  }, [zoom, onSeek]);

  // ── Drag item (move) — mouse ─────────────────────────────────
  const handleItemMouseDown = (e: React.MouseEvent, track: Track, item: TrackItem) => {
    if (track.locked) return;
    e.stopPropagation();
    e.preventDefault();
    onItemSelect(item.id);

    const startX = e.clientX;
    const origStart = item.startTime;

    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX;
      const newStart = Math.max(0, origStart + dx / zoom);
      onItemMove(track.id, item.id, newStart);
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // ── Drag item (move) — touch ─────────────────────────────────
  const handleItemTouchStart = (e: React.TouchEvent, track: Track, item: TrackItem) => {
    if (track.locked) return;
    e.stopPropagation();
    // Always select on touch
    onItemSelect(item.id);

    const startX = e.touches[0].clientX;
    const origStart = item.startTime;
    let moved = false;

    const onMove = (ev: TouchEvent) => {
      const dx = ev.touches[0].clientX - startX;
      if (Math.abs(dx) > 4) {
        moved = true;
        const newStart = Math.max(0, origStart + dx / zoom);
        onItemMove(track.id, item.id, newStart);
      }
    };
    const onUp = () => {
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
    };
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('touchend', onUp);
  };

  // ── Trim left handle ────────────────────────────────────────
  const handleTrimLeft = (e: React.MouseEvent, track: Track, item: TrackItem) => {
    if (track.locked) return;
    e.stopPropagation();
    e.preventDefault();

    const startX = e.clientX;
    const origStart = item.startTime;
    const origMediaStart = item.mediaStart;
    const maxTrim = item.endTime - origStart - 0.1;

    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX;
      const delta = dx / zoom;
      const clampedDelta = Math.max(-origMediaStart, Math.min(maxTrim, delta));
      onItemTrim(track.id, item.id, origStart + clampedDelta, item.endTime, origMediaStart + clampedDelta, item.mediaEnd);
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // ── Trim right handle ────────────────────────────────────────
  const handleTrimRight = (e: React.MouseEvent, track: Track, item: TrackItem) => {
    if (track.locked) return;
    e.stopPropagation();
    e.preventDefault();

    const startX = e.clientX;
    const origEnd = item.endTime;
    const origMediaEnd = item.mediaEnd;
    const mediaDur = media.find((m) => m.id === item.mediaId)?.duration ?? origMediaEnd;
    const minEnd = item.startTime + 0.1;
    // For text/image items that have no media duration, allow free stretch
    const maxMediaDur = mediaDur > 0 ? mediaDur : 3600;

    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX;
      const delta = dx / zoom;
      const newEnd = Math.max(minEnd, Math.min(item.startTime + maxMediaDur - item.mediaStart, origEnd + delta));
      const newMediaEnd = item.mediaStart + (newEnd - item.startTime);
      onItemTrim(track.id, item.id, item.startTime, newEnd, item.mediaStart, newMediaEnd);
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
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

  return (
    <div className="flex flex-col h-full bg-card select-none overflow-hidden">
      {/* ── Ruler ── */}
      <div
        className="flex shrink-0 bg-muted/30 border-b border-border cursor-pointer relative"
        style={{ height: 28 }}
        onClick={handleRulerClick}
        ref={rulerRef}
      >
        <div className="w-[160px] shrink-0 bg-card/80 border-r border-border" />
        <div className="relative overflow-hidden flex-1">
          <div style={{ width: totalWidth, position: 'relative', height: 28 }}>
            {ticks.map((t) => (
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
            {/* Playhead on ruler */}
            <div
              className="absolute top-0 w-0.5 h-full bg-primary z-10 pointer-events-none"
              style={{ left: playheadX }}
            >
              <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-primary" />
            </div>
          </div>
        </div>
      </div>

      {/* ── Tracks ── */}
      <div className="flex-1 overflow-x-auto overflow-y-auto min-h-0">
        {tracks.map((track) => (
          <div
            key={track.id}
            className={cn(
              'flex border-b border-border relative',
              dragOver === track.id && 'ring-1 ring-inset ring-primary/40 bg-primary/5'
            )}
            style={{ height: TRACK_H[track.type] ?? 56 }}
          >
            {/* Track label */}
            <div className="w-[160px] shrink-0 flex items-center gap-1.5 px-2 bg-card/90 border-r border-border z-10">
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
                title={track.muted ? 'Ativar som' : 'Silenciar'}
              >
                {track.muted ? <VolumeX className="h-3 w-3" /> : <Volume2 className="h-3 w-3" />}
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

            {/* Track lane */}
            <div
              className="relative overflow-x-hidden cursor-default flex-1"
              style={{ minWidth: totalWidth }}
              onDragOver={(e) => { e.preventDefault(); setDragOver(track.id); }}
              onDragLeave={() => setDragOver(null)}
              onDrop={(e) => handleDrop(e, track.id)}
              onClick={() => onItemSelect(null)}
            >
              {/* Playhead line */}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-primary/60 z-20 pointer-events-none"
                style={{ left: playheadX }}
              />

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
                    style={{ left, width: w }}
                    onMouseDown={(e) => handleItemMouseDown(e, track, item)}
                    title={item.name}
                  >
                    {/* Thumbnail for video */}
                    {m?.thumbnail && (
                      <img
                        src={m.thumbnail}
                        className="h-full w-8 object-cover shrink-0 opacity-60 rounded-l-lg"
                        alt=""
                        draggable={false}
                      />
                    )}

                    {/* Text preview for text items */}
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

                    {/* Split button (visible on selected) */}
                    {isSelected && w > 40 && !isTextOrImage && (
                      <button
                        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 p-1 rounded-full bg-background/80 border border-border text-foreground/70 hover:text-primary hover:border-primary transition-colors opacity-0 group-hover:opacity-100"
                        title="Dividir no playhead"
                        onClick={(e) => {
                          e.stopPropagation();
                          onItemSplit(track.id, item.id, currentTime);
                        }}
                      >
                        <Scissors className="h-2.5 w-2.5" />
                      </button>
                    )}

                    {/* Delete button */}
                    <button
                      className="absolute right-1 top-1/2 -translate-y-1/2 z-30 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded bg-destructive/80 hover:bg-destructive text-white"
                      onClick={(e) => { e.stopPropagation(); onItemDelete(track.id, item.id); }}
                      title="Deletar"
                    >
                      <Trash2 className="h-2.5 w-2.5" />
                    </button>

                    {/* ── Trim handles ── */}
                    {!track.locked && (
                      <>
                        <div
                          className="absolute left-0 top-0 bottom-0 w-2.5 cursor-col-resize z-30 flex items-center justify-center group/trim"
                          onMouseDown={(e) => handleTrimLeft(e, track, item)}
                        >
                          <div className="w-1 h-5 rounded-full bg-white/60 group-hover/trim:bg-white transition-colors" />
                        </div>
                        <div
                          className="absolute right-0 top-0 bottom-0 w-2.5 cursor-col-resize z-30 flex items-center justify-center group/trim"
                          onMouseDown={(e) => handleTrimRight(e, track, item)}
                        >
                          <div className="w-1 h-5 rounded-full bg-white/60 group-hover/trim:bg-white transition-colors" />
                        </div>
                      </>
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
      </div>
    </div>
  );
}
