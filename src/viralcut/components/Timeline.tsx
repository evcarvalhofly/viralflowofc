// ============================================================
// Timeline – Multi-track drag & drop timeline (OpenCut style)
// ============================================================
import { useRef, useState, useCallback } from 'react';
import { Lock, Volume2, VolumeX, ChevronDown, Trash2, Film, Music } from 'lucide-react';
import { Track, TrackItem, MediaFile } from '../types';
import { cn } from '@/lib/utils';

const MIN_PX_PER_SEC = 40;
const TRACK_H = 52;

interface TimelineProps {
  tracks: Track[];
  media: MediaFile[];
  currentTime: number;
  duration: number;
  zoom: number; // px per second
  onSeek: (t: number) => void;
  onItemMove: (trackId: string, itemId: string, newStart: number) => void;
  onItemDelete: (trackId: string, itemId: string) => void;
  onTrackToggleMute: (trackId: string) => void;
  onTrackToggleLock: (trackId: string) => void;
  onDropMedia: (trackId: string, mediaId: string, startTime: number) => void;
}

function fmtRuler(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
}

export function Timeline({
  tracks,
  media,
  currentTime,
  duration,
  zoom,
  onSeek,
  onItemMove,
  onItemDelete,
  onTrackToggleMute,
  onTrackToggleLock,
  onDropMedia,
}: TimelineProps) {
  const rulerRef = useRef<HTMLDivElement>(null);
  const draggingItem = useRef<{ trackId: string; itemId: string; offsetX: number } | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);

  const totalWidth = Math.max(duration * zoom + 200, 600);

  // Time ruler ticks
  const tickInterval = zoom < 60 ? 5 : zoom < 100 ? 2 : 1;
  const ticks: number[] = [];
  const totalSeconds = Math.ceil(totalWidth / zoom);
  for (let i = 0; i <= totalSeconds; i += tickInterval) ticks.push(i);

  const handleRulerClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const t = Math.max(0, (e.clientX - rect.left) / zoom);
    onSeek(t);
  }, [zoom, onSeek]);

  // Drag item
  const handleItemMouseDown = (
    e: React.MouseEvent,
    trackId: string,
    itemId: string,
    itemStart: number
  ) => {
    e.stopPropagation();
    const offsetX = e.clientX - itemStart * zoom;
    draggingItem.current = { trackId, itemId, offsetX };

    const onMove = (ev: MouseEvent) => {
      if (!draggingItem.current) return;
      const newStart = Math.max(0, (ev.clientX - draggingItem.current.offsetX) / zoom);
      onItemMove(draggingItem.current.trackId, draggingItem.current.itemId, newStart);
    };
    const onUp = () => {
      draggingItem.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // Drop from media panel
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
      {/* Ruler */}
      <div
        className="flex shrink-0 bg-muted/40 border-b border-border cursor-pointer relative overflow-x-auto"
        style={{ height: 24 }}
        onClick={handleRulerClick}
        ref={rulerRef}
      >
        <div className="w-[160px] shrink-0" /> {/* Track label offset */}
        <div className="relative" style={{ width: totalWidth, minWidth: totalWidth }}>
          {ticks.map((t) => (
            <div
              key={t}
              className="absolute top-0 flex flex-col items-center"
              style={{ left: t * zoom }}
            >
              <div className="w-px h-2 bg-border" />
              <span className="text-[9px] text-muted-foreground/70 mt-0.5 whitespace-nowrap">
                {fmtRuler(t)}
              </span>
            </div>
          ))}
          {/* Playhead on ruler */}
          <div
            className="absolute top-0 w-0.5 h-full bg-primary z-10 pointer-events-none"
            style={{ left: playheadX }}
          />
        </div>
      </div>

      {/* Tracks */}
      <div className="flex-1 overflow-auto">
        {tracks.map((track) => (
          <div
            key={track.id}
            className={cn('flex border-b border-border', dragOver === track.id && 'bg-primary/5')}
            style={{ height: TRACK_H }}
          >
            {/* Track label */}
            <div className="w-[160px] shrink-0 flex items-center gap-1.5 px-2 bg-card/80 border-r border-border">
              <div className="p-1 rounded text-muted-foreground">
                {track.type === 'video'
                  ? <Film className="h-3.5 w-3.5" />
                  : <Music className="h-3.5 w-3.5" />}
              </div>
              <span className="text-[11px] font-medium text-foreground capitalize flex-1 truncate">
                {track.type === 'video' ? 'Vídeo' : 'Áudio'}
              </span>
              <button
                className={cn(
                  'p-0.5 rounded transition-colors',
                  track.muted ? 'text-destructive' : 'text-muted-foreground hover:text-foreground'
                )}
                onClick={() => onTrackToggleMute(track.id)}
              >
                {track.muted ? <VolumeX className="h-3 w-3" /> : <Volume2 className="h-3 w-3" />}
              </button>
              <button
                className={cn(
                  'p-0.5 rounded transition-colors',
                  track.locked ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                )}
                onClick={() => onTrackToggleLock(track.id)}
              >
                <Lock className="h-3 w-3" />
              </button>
            </div>

            {/* Track lane */}
            <div
              className="flex-1 relative overflow-x-auto cursor-default"
              style={{ minWidth: totalWidth }}
              onDragOver={(e) => { e.preventDefault(); setDragOver(track.id); }}
              onDragLeave={() => setDragOver(null)}
              onDrop={(e) => handleDrop(e, track.id)}
            >
              {/* Playhead */}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-primary/70 z-10 pointer-events-none"
                style={{ left: playheadX }}
              />

              {/* Items */}
              {track.items.map((item) => {
                const w = (item.endTime - item.startTime) * zoom;
                const left = item.startTime * zoom;
                const m = media.find((x) => x.id === item.mediaId);
                return (
                  <div
                    key={item.id}
                    className={cn(
                      'absolute top-1 bottom-1 rounded-md border overflow-hidden flex items-center cursor-grab active:cursor-grabbing group',
                      track.type === 'video'
                        ? 'bg-primary/20 border-primary/50 hover:border-primary'
                        : 'bg-accent/20 border-accent/50 hover:border-accent'
                    )}
                    style={{ left, width: Math.max(w, 24) }}
                    onMouseDown={(e) => handleItemMouseDown(e, track.id, item.id, item.startTime)}
                    title={item.name}
                  >
                    {m?.thumbnail && (
                      <img
                        src={m.thumbnail}
                        className="h-full w-8 object-cover shrink-0 opacity-50"
                        alt=""
                        draggable={false}
                      />
                    )}
                    <span className="text-[10px] font-medium px-1.5 truncate text-foreground/80">
                      {item.name}
                    </span>
                    <button
                      className="absolute right-0.5 top-0.5 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded bg-destructive/80 text-white"
                      onClick={(e) => { e.stopPropagation(); onItemDelete(track.id, item.id); }}
                    >
                      <Trash2 className="h-2.5 w-2.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
