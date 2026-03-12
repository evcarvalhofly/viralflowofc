import { useRef, useState, useCallback, useEffect } from "react";
import { Scissors, Trash2, ZoomIn, ZoomOut, AlignCenter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useProjectStore } from "../stores/project-store";
import { usePlaybackStore } from "../stores/playback-store";
import { useTimelineStore } from "../stores/timeline-store";
import { useTimelineActions } from "../hooks/useTimelineActions";
import type { TimelineTrack, TimelineElement } from "../types/timeline";

const TRACK_HEIGHT = 52;
const RULER_HEIGHT = 24;

function formatTimeShort(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return m > 0 ? `${m}:${String(sec).padStart(2, "0")}` : `${sec}s`;
}

function getTrackColor(type: string): string {
  switch (type) {
    case "video": return "bg-primary/20 border-primary/60";
    case "audio": return "bg-green-500/20 border-green-500/60";
    case "text": return "bg-accent/20 border-accent/60";
    case "image": return "bg-yellow-500/20 border-yellow-500/60";
    default: return "bg-muted border-border";
  }
}

function getTrackLabel(type: string): string {
  switch (type) {
    case "video": return "V";
    case "audio": return "A";
    case "text": return "T";
    default: return "?";
  }
}

export function Timeline() {
  const tracks = useProjectStore((s) => s.getTracks());
  const currentTime = usePlaybackStore((s) => s.currentTime);
  const duration = usePlaybackStore((s) => s.duration);
  const seek = usePlaybackStore((s) => s.seek);
  const { pixelsPerSecond, setPixelsPerSecond, snappingEnabled, toggleSnapping, selectedElementId, selectedTrackId, setSelectedElement } = useTimelineStore();
  const { removeElement, splitElement } = useTimelineActions();

  const scrollRef = useRef<HTMLDivElement>(null);
  const timelineWidth = Math.max(duration * pixelsPerSecond + 200, 800);

  const handleRulerClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left + (scrollRef.current?.scrollLeft ?? 0);
      const t = x / pixelsPerSecond;
      seek(Math.max(0, t));
    },
    [pixelsPerSecond, seek]
  );

  const zoomIn = () => setPixelsPerSecond(Math.min(pixelsPerSecond * 1.5, 600));
  const zoomOut = () => setPixelsPerSecond(Math.max(pixelsPerSecond / 1.5, 20));

  // Scroll playhead into view
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const playheadX = currentTime * pixelsPerSecond;
    const { scrollLeft, clientWidth } = el;
    if (playheadX < scrollLeft || playheadX > scrollLeft + clientWidth - 60) {
      el.scrollLeft = Math.max(0, playheadX - clientWidth / 3);
    }
  }, [currentTime, pixelsPerSecond]);

  return (
    <div className="flex flex-col h-full bg-card select-none">
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-border shrink-0">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={zoomOut} title="Reduzir zoom">
          <ZoomOut className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={zoomIn} title="Aumentar zoom">
          <ZoomIn className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className={cn("h-7 w-7", snappingEnabled && "bg-primary/20 text-primary")}
          onClick={toggleSnapping}
          title="Snap"
        >
          <AlignCenter className="h-3.5 w-3.5" />
        </Button>

        {selectedElementId && selectedTrackId && (
          <>
            <div className="w-px h-5 bg-border mx-1" />
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={() => splitElement(selectedTrackId, selectedElementId, currentTime)}
              title="Cortar"
            >
              <Scissors className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
              onClick={() => { removeElement(selectedTrackId, selectedElementId); setSelectedElement(null, null); }}
              title="Deletar"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </>
        )}

        <div className="ml-auto text-xs text-muted-foreground font-mono">
          {formatTimeShort(currentTime)}
        </div>
      </div>

      {/* Timeline scroll area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Track labels */}
        <div className="w-16 shrink-0 flex flex-col border-r border-border bg-card/80">
          <div style={{ height: RULER_HEIGHT }} className="border-b border-border" />
          {tracks.map((track) => (
            <div
              key={track.id}
              style={{ height: TRACK_HEIGHT }}
              className="flex items-center justify-center border-b border-border"
            >
              <span
                className={cn(
                  "text-xs font-bold px-1.5 py-0.5 rounded",
                  track.type === "video" && "bg-primary/20 text-primary",
                  track.type === "audio" && "bg-green-500/20 text-green-600",
                  track.type === "text" && "bg-accent/20 text-accent"
                )}
              >
                {getTrackLabel(track.type)}
              </span>
            </div>
          ))}
        </div>

        {/* Scrollable content */}
        <div ref={scrollRef} className="flex-1 overflow-x-auto overflow-y-hidden relative">
          <div style={{ width: timelineWidth, minWidth: "100%" }} className="relative">
            {/* Ruler */}
            <div
              style={{ height: RULER_HEIGHT }}
              className="sticky top-0 z-10 bg-muted border-b border-border cursor-pointer relative"
              onClick={handleRulerClick}
            >
              <RulerTicks duration={duration} pixelsPerSecond={pixelsPerSecond} />
            </div>

            {/* Tracks */}
            {tracks.map((track) => (
              <div
                key={track.id}
                style={{ height: TRACK_HEIGHT }}
                className="relative border-b border-border/50"
              >
                {(track.elements as TimelineElement[]).map((element) => (
                  <TimelineElementBlock
                    key={element.id}
                    element={element}
                    track={track}
                    pixelsPerSecond={pixelsPerSecond}
                    isSelected={selectedElementId === element.id}
                    onSelect={() => setSelectedElement(element.id, track.id)}
                    onRemove={() => removeElement(track.id, element.id)}
                    onSplit={() => splitElement(track.id, element.id, currentTime)}
                  />
                ))}
              </div>
            ))}

            {/* Playhead */}
            <div
              className="absolute top-0 bottom-0 z-20 pointer-events-none"
              style={{ left: currentTime * pixelsPerSecond }}
            >
              <div className="w-0.5 h-full bg-red-500 relative">
                <div className="absolute -top-0 left-1/2 -translate-x-1/2 w-3 h-3 bg-red-500 rotate-45" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function RulerTicks({ duration, pixelsPerSecond }: { duration: number; pixelsPerSecond: number }) {
  const interval = pixelsPerSecond < 50 ? 5 : pixelsPerSecond < 100 ? 2 : 1;
  const ticks: number[] = [];
  for (let t = 0; t <= Math.ceil(duration) + 5; t += interval) {
    ticks.push(t);
  }

  return (
    <>
      {ticks.map((t) => (
        <div
          key={t}
          className="absolute top-0 bottom-0 flex flex-col justify-end"
          style={{ left: t * pixelsPerSecond }}
        >
          <div className="w-px bg-border h-2" />
          <span className="text-[9px] text-muted-foreground pl-0.5 leading-none">{formatTimeShort(t)}</span>
        </div>
      ))}
    </>
  );
}

function TimelineElementBlock({
  element,
  track,
  pixelsPerSecond,
  isSelected,
  onSelect,
  onRemove,
  onSplit,
}: {
  element: TimelineElement;
  track: TimelineTrack;
  pixelsPerSecond: number;
  isSelected: boolean;
  onSelect: () => void;
  onRemove: () => void;
  onSplit: () => void;
}) {
  const effectiveDuration = element.duration - element.trimStart - element.trimEnd;
  const left = element.startTime * pixelsPerSecond;
  const width = Math.max(effectiveDuration * pixelsPerSecond, 16);

  return (
    <div
      className={cn(
        "absolute top-1 bottom-1 rounded border cursor-pointer flex items-center px-2 overflow-hidden group transition-all",
        getTrackColor(element.type),
        isSelected && "ring-2 ring-primary ring-offset-0 border-primary"
      )}
      style={{ left, width }}
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
    >
      <span className="text-xs font-medium truncate leading-tight">
        {element.type === "text"
          ? (element as any).content
          : element.name}
      </span>
      {isSelected && (
        <div className="absolute right-1 top-1/2 -translate-y-1/2 flex gap-0.5">
          <button
            onClick={(e) => { e.stopPropagation(); onSplit(); }}
            className="p-0.5 rounded bg-primary/20 hover:bg-primary/40 text-primary"
          >
            <Scissors className="h-2.5 w-2.5" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            className="p-0.5 rounded bg-destructive/20 hover:bg-destructive/40 text-destructive"
          >
            <Trash2 className="h-2.5 w-2.5" />
          </button>
        </div>
      )}
    </div>
  );
}
