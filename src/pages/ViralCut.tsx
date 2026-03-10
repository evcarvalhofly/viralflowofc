import { useState, useRef, useCallback, useEffect } from "react";
import {
  Upload, Scissors, Type, Layers, Wand2, Download, Play, Pause,
  SkipBack, SkipForward, Volume2, VolumeX, ZoomIn, ZoomOut,
  Film, Music, Sparkles, Trash2, Eye, EyeOff,
  ChevronRight, ChevronLeft, Loader2, X,
  RotateCcw, ChevronUp, ChevronDown, Mic, MicOff, Undo2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

// ─── Types ────────────────────────────────────────────────────────────────────

/** A real editable clip on the timeline */
interface TimelineClip {
  id: string;
  sourceId: string;
  kind: "video" | "audio" | "text" | "overlay";
  trackId: string;
  sourceStart: number;
  sourceEnd: number;
  timelineStart: number;
  timelineEnd: number;
  visible: boolean;
  locked: boolean;
  color: string;
  text?: string;
}

/** Source media file */
interface SourceMedia {
  id: string;
  type: "video" | "audio" | "image";
  name: string;
  src: string;
  duration: number;
}

// Keep legacy ClipSegment for history & export compatibility
type ClipSegment = { id: string; start: number; end: number };
type LayerType = "video" | "overlay" | "text" | "audio";

interface Layer {
  id: string;
  type: LayerType;
  label: string;
  start: number;
  end: number;
  visible: boolean;
  locked: boolean;
  color: string;
  content?: string;
}

interface CaptionBlock {
  id: string;
  text: string;
  start: number;
  end: number;
}

type AutoCutLevel = "suave" | "medio" | "agressivo";
type CaptionWordMode = 1 | 2 | 3;

interface HistoryEntry {
  timelineClips: TimelineClip[];
  layers: Layer[];
  captions: CaptionBlock[];
  virtualDuration: number;
}

const SILENCE_THRESHOLDS: Record<AutoCutLevel, number> = {
  suave: 0.7,
  medio: 0.5,
  agressivo: 0.3,
};

const LAYER_COLORS: Record<LayerType, string> = {
  video: "hsl(262,83%,58%)",
  overlay: "hsl(25,90%,55%)",
  text: "hsl(160,70%,40%)",
  audio: "hsl(210,80%,50%)",
};

const CLIP_HUE_STEP = 37;
function clipColor(index: number) {
  return `hsl(${(262 + index * CLIP_HUE_STEP) % 360},70%,52%)`;
}

// ─── Time conversion utilities ───────────────────────────────────────────────

/**
 * Convert timeline time → source (real) time.
 * Returns null if the timeline position falls in a gap between clips.
 */
function timelineToSourceTime(timelineTime: number, clips: TimelineClip[]): number | null {
  const sorted = [...clips]
    .filter(c => c.kind === "video" && c.visible)
    .sort((a, b) => a.timelineStart - b.timelineStart);

  for (const clip of sorted) {
    if (timelineTime >= clip.timelineStart && timelineTime <= clip.timelineEnd) {
      return clip.sourceStart + (timelineTime - clip.timelineStart);
    }
  }
  return null;
}

/**
 * Convert source (real) time → timeline time.
 * If the source time is between clips, snaps to the nearest clip boundary.
 */
function sourceToTimelineTime(sourceTime: number, clips: TimelineClip[]): number {
  const sorted = [...clips]
    .filter(c => c.kind === "video" && c.visible)
    .sort((a, b) => a.timelineStart - b.timelineStart);

  for (const clip of sorted) {
    if (sourceTime >= clip.sourceStart && sourceTime <= clip.sourceEnd) {
      return clip.timelineStart + (sourceTime - clip.sourceStart);
    }
  }
  // Outside all clips — return end of last clip
  const last = sorted[sorted.length - 1];
  return last ? last.timelineEnd : sourceTime;
}

// ─── Utility: build TimelineClips from silence-detection segments ─────────────

function buildTimelineClipsFromSegments(
  segments: { id: string; start: number; end: number }[],
  sourceId: string
): TimelineClip[] {
  let cursor = 0;
  return segments.map((seg, index) => {
    const duration = seg.end - seg.start;
    const clip: TimelineClip = {
      id: `clip-${index}-${Date.now()}`,
      sourceId,
      kind: "video",
      trackId: "track-video-main",
      sourceStart: seg.start,
      sourceEnd: seg.end,
      timelineStart: cursor,
      timelineEnd: cursor + duration,
      visible: true,
      locked: false,
      color: clipColor(index),
    };
    cursor += duration;
    return clip;
  });
}

// ─── Clip mutation helpers ────────────────────────────────────────────────────

function moveClip(clips: TimelineClip[], clipId: string, newTimelineStart: number): TimelineClip[] {
  return clips.map(clip => {
    if (clip.id !== clipId) return clip;
    const dur = clip.timelineEnd - clip.timelineStart;
    const ts = Math.max(0, newTimelineStart);
    return { ...clip, timelineStart: ts, timelineEnd: ts + dur };
  });
}

function resizeClip(
  clips: TimelineClip[],
  clipId: string,
  side: "left" | "right",
  newTime: number
): TimelineClip[] {
  return clips.map(clip => {
    if (clip.id !== clipId) return clip;
    if (side === "left") {
      const newStart = Math.min(clip.timelineEnd - 0.1, Math.max(0, newTime));
      const delta = newStart - clip.timelineStart;
      return { ...clip, timelineStart: newStart, sourceStart: clip.sourceStart + delta };
    }
    const newEnd = Math.max(clip.timelineStart + 0.1, newTime);
    const delta = newEnd - clip.timelineEnd;
    return { ...clip, timelineEnd: newEnd, sourceEnd: clip.sourceEnd + delta };
  });
}

function deleteClip(clips: TimelineClip[], clipId: string): TimelineClip[] {
  return clips.filter(c => c.id !== clipId);
}

/** Convert TimelineClips (video track) to legacy ClipSegments for export */
function clipsToSegments(clips: TimelineClip[]): ClipSegment[] {
  return clips
    .filter(c => c.kind === "video" && c.trackId === "track-video-main" && c.visible)
    .sort((a, b) => a.timelineStart - b.timelineStart)
    .map(c => ({ id: c.id, start: c.sourceStart, end: c.sourceEnd }));
}

// ─── Silence Detection ────────────────────────────────────────────────────────

async function detectSilenceSegments(
  videoEl: HTMLVideoElement,
  minDuration: number,
  onProgress: (p: number) => void
): Promise<ClipSegment[]> {
  const audioCtx = new AudioContext();
  const response = await fetch(videoEl.src);
  const arrayBuf = await response.arrayBuffer();
  onProgress(30);
  const audioBuf = await audioCtx.decodeAudioData(arrayBuf);
  onProgress(60);

  const data = audioBuf.getChannelData(0);
  const sampleRate = audioBuf.sampleRate;
  const dur = audioBuf.duration;

  const windowSamples = Math.floor(sampleRate * 0.05);
  const rms: number[] = [];
  for (let i = 0; i < data.length; i += windowSamples) {
    let sum = 0;
    for (let j = i; j < Math.min(i + windowSamples, data.length); j++) {
      sum += data[j] * data[j];
    }
    rms.push(Math.sqrt(sum / windowSamples));
  }

  const dbThreshold = Math.pow(10, -30 / 20);
  let inSilence = false;
  let silenceStart = 0;
  const margin_before = 0.1;
  const margin_after = 0.12;
  const keepRanges: Array<{ start: number; end: number }> = [];
  let lastKeepEnd = 0;

  rms.forEach((v, i) => {
    const t = (i * windowSamples) / sampleRate;
    const isSilent = v < dbThreshold;
    if (isSilent && !inSilence) { inSilence = true; silenceStart = t; }
    if (!isSilent && inSilence) {
      inSilence = false;
      const silenceDur = t - silenceStart;
      if (silenceDur >= minDuration) {
        const keepEnd = Math.max(0, silenceStart - margin_before);
        const keepStart = Math.min(dur, t + margin_after);
        if (keepEnd > lastKeepEnd) keepRanges.push({ start: lastKeepEnd, end: keepEnd });
        lastKeepEnd = keepStart;
      }
    }
  });
  keepRanges.push({ start: lastKeepEnd, end: dur });

  const segments = keepRanges
    .filter(r => r.end - r.start > 0.1)
    .map((r, i) => ({ id: `clip-${i}`, start: r.start, end: r.end }));

  onProgress(100);
  audioCtx.close();
  return segments.length > 0 ? segments : [{ id: "clip-0", start: 0, end: dur }];
}

// ─── Caption splitter ─────────────────────────────────────────────────────────

function splitCaptionsFromTranscript(
  words: Array<{ text: string; start: number; end: number }>,
  mode: CaptionWordMode
): CaptionBlock[] {
  const blocks: CaptionBlock[] = [];
  let i = 0;
  while (i < words.length) {
    const chunk = words.slice(i, i + mode);
    blocks.push({
      id: `cap-${i}`,
      text: chunk.map(w => w.text).join(" "),
      start: chunk[0].start,
      end: chunk[chunk.length - 1].end,
    });
    i += mode;
  }
  return blocks;
}

// ─── Chroma Key ───────────────────────────────────────────────────────────────

function applyChromaKey(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  color: [number, number, number],
  tolerance: number,
  smoothing: number
) {
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = imageData.data;
  for (let i = 0; i < d.length; i += 4) {
    const dist = Math.sqrt(
      Math.pow(d[i] - color[0], 2) +
      Math.pow(d[i + 1] - color[1], 2) +
      Math.pow(d[i + 2] - color[2], 2)
    );
    if (dist < tolerance) d[i + 3] = 0;
    else if (dist < tolerance + smoothing)
      d[i + 3] = Math.round(((dist - tolerance) / smoothing) * 255);
  }
  ctx.putImageData(imageData, 0, 0);
}

// ─── TimelineClipBlock (draggable, resizable) ─────────────────────────────────

function TimelineClipBlock({
  clip, index, pxPerSec, trackHeight,
  onDragEnd, onResizeEnd, onSeek, onDelete,
}: {
  clip: TimelineClip;
  index: number;
  pxPerSec: number;
  trackHeight: number;
  onDragEnd: (id: string, newTimelineStart: number) => void;
  onResizeEnd: (id: string, side: "left" | "right", newTime: number) => void;
  onSeek: (t: number) => void;
  onDelete: (id: string) => void;
}) {
  const left = clip.timelineStart * pxPerSec;
  const width = Math.max(16, (clip.timelineEnd - clip.timelineStart) * pxPerSec);

  const dragRef = useRef<{ startX: number; origStart: number } | null>(null);
  const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [dragging, setDragging] = useState(false);
  const [tempLeft, setTempLeft] = useState<number | null>(null);

  const startDrag = useCallback((clientX: number) => {
    dragRef.current = { startX: clientX, origStart: clip.timelineStart };
    setDragging(true);

    const onMove = (e: MouseEvent | TouchEvent) => {
      const cx = "touches" in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
      const dx = (cx - dragRef.current!.startX) / pxPerSec;
      const newStart = Math.max(0, dragRef.current!.origStart + dx);
      setTempLeft(newStart * pxPerSec);
    };
    const onUp = (e: MouseEvent | TouchEvent) => {
      if (dragRef.current) {
        const cx = "changedTouches" in e
          ? (e as TouchEvent).changedTouches[0].clientX
          : (e as MouseEvent).clientX;
        const dx = (cx - dragRef.current.startX) / pxPerSec;
        const newStart = Math.max(0, dragRef.current.origStart + dx);
        onDragEnd(clip.id, newStart);
      }
      setDragging(false);
      setTempLeft(null);
      dragRef.current = null;
      window.removeEventListener("mousemove", onMove as EventListener);
      window.removeEventListener("mouseup", onUp as EventListener);
      window.removeEventListener("touchmove", onMove as EventListener);
      window.removeEventListener("touchend", onUp as EventListener);
    };
    window.addEventListener("mousemove", onMove as EventListener);
    window.addEventListener("mouseup", onUp as EventListener);
    window.addEventListener("touchmove", onMove as EventListener, { passive: true });
    window.addEventListener("touchend", onUp as EventListener);
  }, [clip, pxPerSec, onDragEnd]);

  const startResize = useCallback((side: "left" | "right", clientX: number, e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    const origVal = side === "left" ? clip.timelineStart : clip.timelineEnd;

    const onMove = (ev: MouseEvent | TouchEvent) => {
      const cx = "touches" in ev ? ev.touches[0].clientX : (ev as MouseEvent).clientX;
      const dt = (cx - clientX) / pxPerSec;
      onResizeEnd(clip.id, side, origVal + dt);
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove as EventListener);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onMove as EventListener);
      window.removeEventListener("touchend", onUp);
    };
    window.addEventListener("mousemove", onMove as EventListener);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onMove as EventListener, { passive: true });
    window.addEventListener("touchend", onUp);
  }, [clip, pxPerSec, onResizeEnd]);

  const currentLeft = tempLeft !== null ? tempLeft : left;

  return (
    <div
      className={cn(
        "absolute top-1 select-none group",
        dragging ? "z-30 opacity-80 shadow-xl" : "z-10"
      )}
      style={{ left: currentLeft, width, height: trackHeight - 8, cursor: dragging ? "grabbing" : "grab" }}
      onMouseDown={e => {
        if ((e.target as HTMLElement).dataset.handle) return;
        e.preventDefault();
        startDrag(e.clientX);
      }}
      onTouchStart={e => {
        if ((e.target as HTMLElement).dataset.handle) return;
        longPressRef.current = setTimeout(() => startDrag(e.touches[0].clientX), 350);
      }}
      onTouchEnd={() => { if (longPressRef.current) clearTimeout(longPressRef.current); }}
      onClick={e => { e.stopPropagation(); if (!dragging) onSeek(clip.timelineStart); }}
    >
      <div
        className="w-full h-full rounded flex items-center overflow-hidden border border-white/10 shadow"
        style={{ backgroundColor: clip.color }}
      >
        {/* Left resize handle */}
        <div
          data-handle="left"
          className="absolute left-0 top-0 h-full w-2.5 cursor-w-resize flex items-center justify-center z-20 hover:bg-black/20"
          onMouseDown={e => startResize("left", e.clientX, e)}
          onTouchStart={e => startResize("left", e.touches[0].clientX, e)}
        >
          <div className="w-0.5 h-4 bg-white/50 rounded pointer-events-none" />
        </div>

        {/* Label */}
        <span className="text-[9px] text-white font-semibold truncate px-3 pointer-events-none select-none flex-1 text-center">
          {index + 1}
        </span>

        {/* Delete btn */}
        <button
          data-handle="del"
          className="absolute top-0.5 right-6 h-4 w-4 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 z-20 transition-opacity"
          style={{ pointerEvents: width > 40 ? undefined : "none", opacity: width > 40 ? undefined : 0 }}
          onMouseDown={e => { e.stopPropagation(); onDelete(clip.id); }}
          onTouchEnd={e => { e.stopPropagation(); onDelete(clip.id); }}
        >
          <X className="h-2.5 w-2.5 text-white" />
        </button>

        {/* Right resize handle */}
        <div
          data-handle="right"
          className="absolute right-0 top-0 h-full w-2.5 cursor-e-resize flex items-center justify-center z-20 hover:bg-black/20"
          onMouseDown={e => startResize("right", e.clientX, e)}
          onTouchStart={e => startResize("right", e.touches[0].clientX, e)}
        >
          <div className="w-0.5 h-4 bg-white/50 rounded pointer-events-none" />
        </div>
      </div>
    </div>
  );
}

// ─── Video Track Lane ─────────────────────────────────────────────────────────

function VideoTrackLane({
  clips, duration, scale, cutMode,
  onSeek, onClipDragEnd, onClipResizeEnd, onClipDelete, onManualCut,
}: {
  clips: TimelineClip[];
  duration: number;
  scale: number;
  cutMode: boolean;
  onSeek: (t: number) => void;
  onClipDragEnd: (id: string, newStart: number) => void;
  onClipResizeEnd: (id: string, side: "left" | "right", newTime: number) => void;
  onClipDelete: (id: string) => void;
  onManualCut: (at: number) => void;
}) {
  const pxPerSec = scale * 80;
  const trackHeight = 40;
  const totalWidth = Math.max(duration * pxPerSec, 200);

  const sorted = [...clips].sort((a, b) => a.timelineStart - b.timelineStart);

  return (
    <div className="flex items-center border-b border-border/30 group" style={{ height: trackHeight }}>
      {/* Label column */}
      <div className="w-32 shrink-0 flex items-center gap-1 px-2 border-r border-border/30 h-full bg-card/50">
        <Eye className="h-3 w-3 text-muted-foreground" />
        <span className="text-[10px] truncate text-muted-foreground flex-1">
          Vídeo • {clips.length} clip{clips.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Track body */}
      <div
        className={cn("relative h-full overflow-hidden", cutMode ? "cursor-crosshair" : "cursor-pointer")}
        style={{ width: totalWidth }}
        onClick={e => {
          const rect = e.currentTarget.getBoundingClientRect();
          const t = (e.clientX - rect.left) / pxPerSec;
          if (cutMode) onManualCut(t);
          else onSeek(t);
        }}
      >
        {/* Dark background */}
        <div className="absolute inset-0 bg-border/10" />

        {/* Gap indicators between clips */}
        {sorted.map((clip, i) => {
          const prev = sorted[i - 1];
          const gapStart = prev ? prev.timelineEnd : 0;
          const gapEnd = clip.timelineStart;
          if (gapEnd <= gapStart + 0.01) return null;
          return (
            <div
              key={`gap-${clip.id}`}
              className="absolute top-0 bottom-0 bg-black/40 border-x border-destructive/20"
              style={{ left: gapStart * pxPerSec, width: Math.max(2, (gapEnd - gapStart) * pxPerSec) }}
            />
          );
        })}

        {/* Clip blocks */}
        {sorted.map((clip, i) => (
          <TimelineClipBlock
            key={clip.id}
            clip={clip}
            index={i}
            pxPerSec={pxPerSec}
            trackHeight={trackHeight}
            onDragEnd={onClipDragEnd}
            onResizeEnd={onClipResizeEnd}
            onSeek={onSeek}
            onDelete={onClipDelete}
          />
        ))}

        {/* Cut mode overlay */}
        {cutMode && (
          <div className="absolute inset-0 border-2 border-dashed border-destructive/60 rounded opacity-60 pointer-events-none" />
        )}
      </div>
    </div>
  );
}

// ─── Generic Layer Lane (text, audio, overlay) ────────────────────────────────

function LayerLane({
  layer, scale, displayDuration,
  onToggleVisible, onDelete, onSeek,
}: {
  layer: Layer;
  scale: number;
  displayDuration: number;
  onToggleVisible: (id: string) => void;
  onDelete: (id: string) => void;
  onSeek: (t: number) => void;
}) {
  const pxPerSec = scale * 80;
  const left = layer.start * pxPerSec;
  const width = Math.max(20, (layer.end - layer.start) * pxPerSec);
  const trackHeight = 40;

  return (
    <div className="flex items-center border-b border-border/30 group" style={{ height: trackHeight }}>
      <div className="w-32 shrink-0 flex items-center gap-1 px-2 border-r border-border/30 h-full bg-card/50">
        <button onClick={() => onToggleVisible(layer.id)} className="text-muted-foreground hover:text-foreground">
          {layer.visible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
        </button>
        <span className="text-[10px] truncate text-muted-foreground flex-1">{layer.label}</span>
        <button onClick={() => onDelete(layer.id)} className="opacity-0 group-hover:opacity-100 text-destructive">
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
      <div
        className="relative flex-1 h-full overflow-hidden cursor-pointer"
        onClick={e => {
          const rect = e.currentTarget.getBoundingClientRect();
          onSeek((e.clientX - rect.left) / pxPerSec);
        }}
      >
        <div
          className="absolute top-1 bottom-1 rounded flex items-center px-2"
          style={{ left, width, backgroundColor: layer.color, opacity: layer.visible ? 0.9 : 0.3 }}
        >
          <span className="text-[9px] text-white font-medium truncate">{layer.label}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

const ViralCut = () => {
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const rafRef = useRef<number>(0);
  const timelineScrollRef = useRef<HTMLDivElement>(null);

  // ─ State ──────────────────────────────────────────────────────────────────
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [videoName, setVideoName] = useState("Sem vídeo");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [duration, setDuration] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState([80]);

  // ─ Clip architecture ──────────────────────────────────────────────────────
  const [sourceMedia, setSourceMedia] = useState<SourceMedia | null>(null);
  const [timelineClips, setTimelineClips] = useState<TimelineClip[]>([]);
  // Keep ref for stable access inside RAF without stale closures
  const timelineClipsRef = useRef<TimelineClip[]>([]);

  // Derived: for export only
  const cutSegments: ClipSegment[] = timelineClips.length > 0
    ? clipsToSegments(timelineClips)
    : [];

  const virtualDurationRef = useRef(0);
  const [virtualDuration, setVirtualDuration] = useState(0);

  // ── CLEAR TIME SEMANTICS ──────────────────────────────────────────────────
  // timelineTime = position in the edited sequence (no silences)
  // sourceTime   = real position in the source video file
  const [timelineTime, setTimelineTime] = useState(0);
  const [sourceTime, setSourceTime] = useState(0);

  // Non-video layers (text, audio, overlay)
  const [layers, setLayers] = useState<Layer[]>([]);
  const [captions, setCaptions] = useState<CaptionBlock[]>([]);
  const [activeCaptions, setActiveCaptions] = useState<CaptionBlock[]>([]);
  const [activeTab, setActiveTab] = useState("upload");
  const [timelineScale, setTimelineScale] = useState(1);

  const [autoCutLevel, setAutoCutLevel] = useState<AutoCutLevel>("medio");
  const [autoCutLoading, setAutoCutLoading] = useState(false);
  const [autoCutProgress, setAutoCutProgress] = useState(0);

  const [chromaEnabled, setChromaEnabled] = useState(false);
  const [chromaColor, setChromaColor] = useState("#00ff00");
  const [chromaTolerance, setChromaTolerance] = useState([80]);
  const [chromaSmoothing, setChromaSmoothing] = useState([20]);

  const [captionMode, setCaptionMode] = useState<CaptionWordMode>(2);
  const [captionStyle, setCaptionStyle] = useState({
    color: "#ffffff", size: 32, shadow: true, bg: true, posY: 80
  });
  const [captionLoading, setCaptionLoading] = useState(false);
  const [transcriptWords, setTranscriptWords] = useState<Array<{ text: string; start: number; end: number }>>([]);

  const [addTextValue, setAddTextValue] = useState("Seu texto aqui");
  const [filterBrightness, setFilterBrightness] = useState([100]);
  const [filterContrast, setFilterContrast] = useState([100]);
  const [filterSaturation, setFilterSaturation] = useState([100]);

  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [bottomCollapsed, setBottomCollapsed] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [processingMsg, setProcessingMsg] = useState("");
  const [cutMode, setCutMode] = useState(false);

  // ─ History (Undo) ─────────────────────────────────────────────────────────
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  const pushHistory = useCallback((
    clips: TimelineClip[], lays: Layer[], caps: CaptionBlock[], virtDur: number
  ) => {
    setHistory(prev => [...prev.slice(-19), { timelineClips: clips, layers: lays, captions: caps, virtualDuration: virtDur }]);
  }, []);

  const handleUndo = () => {
    if (history.length === 0) {
      toast({ title: "Nada para desfazer", variant: "destructive" });
      return;
    }
    const last = history[history.length - 1];
    setTimelineClips(last.timelineClips);
    setLayers(last.layers);
    setCaptions(last.captions);
    setVirtualDuration(last.virtualDuration);
    virtualDurationRef.current = last.virtualDuration;
    setHistory(prev => prev.slice(0, -1));
    toast({ title: "↩ Ação desfeita" });
  };

  // ─ Playhead drag ──────────────────────────────────────────────────────────
  const playheadDragging = useRef(false);
  const timelineRulerRef = useRef<HTMLDivElement>(null);

  // ─── Keep clips ref in sync for stable RAF access ─────────────────────────
  useEffect(() => { timelineClipsRef.current = timelineClips; }, [timelineClips]);

  // ─── seekTimeline: always writes sourceTime to video.currentTime ──────────
  const seekTimeline = useCallback((tl: number) => {
    const v = videoRef.current;
    if (!v) return;
    const clips = timelineClipsRef.current;
    const src = clips.length > 0
      ? (timelineToSourceTime(tl, clips) ?? clips[0].sourceStart)
      : tl;
    v.currentTime = src;                // ← always source time
    setTimelineTime(tl);
    setSourceTime(src);
  }, []);

  // ─── seekSource: seeks by raw source time ─────────────────────────────────
  const seekSource = useCallback((src: number) => {
    const v = videoRef.current;
    if (!v) return;
    const clips = timelineClipsRef.current;
    v.currentTime = src;                // ← source time
    setSourceTime(src);
    setTimelineTime(clips.length > 0 ? sourceToTimelineTime(src, clips) : src);
  }, []);

  // ─── RAF update loop ──────────────────────────────────────────────────────
  const captionsRef = useRef(captions);
  useEffect(() => { captionsRef.current = captions; }, [captions]);

  const updateLoop = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;

    const src = v.currentTime;            // ← read source time from video
    const clips = timelineClipsRef.current;

    const tl = clips.length > 0
      ? sourceToTimelineTime(src, clips)
      : src;

    setSourceTime(src);
    setTimelineTime(tl);

    // Captions keyed on timelineTime
    setActiveCaptions(prev => {
      const next = captionsRef.current.filter(c => tl >= c.start && tl < c.end);
      if (next.length !== prev.length || next.some((c, i) => c.id !== prev[i]?.id)) return next;
      return prev;
    });

    // Chroma key
    if (chromaEnabled && canvasRef.current && !v.paused) {
      const ctx = canvasRef.current.getContext("2d");
      if (ctx) {
        canvasRef.current.width = v.videoWidth || 640;
        canvasRef.current.height = v.videoHeight || 360;
        ctx.drawImage(v, 0, 0);
        const r = parseInt(chromaColor.slice(1, 3), 16);
        const g = parseInt(chromaColor.slice(3, 5), 16);
        const b = parseInt(chromaColor.slice(5, 7), 16);
        applyChromaKey(ctx, canvasRef.current, [r, g, b], chromaTolerance[0], chromaSmoothing[0]);
      }
    }

    // Skip over silences: if source position is not inside any clip, jump to next clip
    if (clips.length > 1 && !v.paused) {
      const videoClips = clips
        .filter(c => c.kind === "video" && c.visible)
        .sort((a, b) => a.sourceStart - b.sourceStart);

      const inClip = videoClips.some(c => src >= c.sourceStart && src < c.sourceEnd);
      if (!inClip) {
        const nextClip = videoClips.find(c => c.sourceStart > src);
        if (nextClip) {
          v.currentTime = nextClip.sourceStart; // ← source time
        } else {
          v.pause();
          setPlaying(false);
        }
      }

      // Stop at timeline end
      const timelineEnd = Math.max(...videoClips.map(c => c.timelineEnd));
      if (tl >= timelineEnd - 0.05) {
        v.pause();
        setPlaying(false);
      }
    }

    rafRef.current = requestAnimationFrame(updateLoop);
  }, [chromaEnabled, chromaColor, chromaTolerance, chromaSmoothing]);

  useEffect(() => {
    if (playing) {
      rafRef.current = requestAnimationFrame(updateLoop);
    } else {
      cancelAnimationFrame(rafRef.current);
    }
    return () => cancelAnimationFrame(rafRef.current);
  }, [playing, updateLoop]);

  useEffect(() => {
    const v = videoRef.current;
    if (v) v.volume = volume[0] / 100;
  }, [volume]);

  useEffect(() => {
    virtualDurationRef.current = virtualDuration > 0 ? virtualDuration : duration;
  }, [virtualDuration, duration]);

  // ─ Playhead drag (timeline time) ─────────────────────────────────────────
  const handleTimelineMouseMove = useCallback((e: MouseEvent) => {
    if (!playheadDragging.current || !timelineRulerRef.current) return;
    const rect = timelineRulerRef.current.getBoundingClientRect();
    const relX = e.clientX - rect.left - 128;
    const pxPerSec = timelineScale * 80;
    const displayDur = virtualDurationRef.current > 0 ? virtualDurationRef.current : 0;
    if (displayDur <= 0 || pxPerSec <= 0) return;
    const tl = Math.max(0, Math.min(displayDur, relX / pxPerSec));
    seekTimeline(tl);                    // ← always timeline seek
  }, [timelineScale, seekTimeline]);

  const handleTimelineMouseUp = useCallback(() => {
    playheadDragging.current = false;
  }, []);

  useEffect(() => {
    window.addEventListener("mousemove", handleTimelineMouseMove);
    window.addEventListener("mouseup", handleTimelineMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleTimelineMouseMove);
      window.removeEventListener("mouseup", handleTimelineMouseUp);
    };
  }, [handleTimelineMouseMove, handleTimelineMouseUp]);

  // ─ Timeline zoom ──────────────────────────────────────────────────────────
  const lastPinchDist = useRef<number | null>(null);

  const handleTimelineWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.25 : 0.25;
      setTimelineScale(s => Math.min(8, Math.max(0.25, Math.round((s + delta) * 4) / 4)));
    }
  }, []);

  const handleTimelineTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      lastPinchDist.current = Math.sqrt(dx * dx + dy * dy);
    }
  }, []);

  const handleTimelineTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2 && lastPinchDist.current !== null) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const ratio = dist / lastPinchDist.current;
      lastPinchDist.current = dist;
      setTimelineScale(s => Math.min(8, Math.max(0.25, Math.round(s * ratio * 4) / 4)));
    }
  }, []);

  const handleTimelineTouchEnd = useCallback(() => {
    lastPinchDist.current = null;
  }, []);

  const videoStyle = {
    filter: `brightness(${filterBrightness[0]}%) contrast(${filterContrast[0]}%) saturate(${filterSaturation[0]}%)`,
  };

  // ─── Video load ───────────────────────────────────────────────────────────
  const handleVideoLoad = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setVideoFile(file);
    setVideoSrc(url);
    setVideoName(file.name);
    setSourceMedia({ id: "source-main", type: "video", name: file.name, src: url, duration: 0 });
    setTimelineClips([]);
    timelineClipsRef.current = [];
    setCaptions([]);
    setTranscriptWords([]);
    setLayers([]);
    setHistory([]);
    setPlaying(false);
    setTimelineTime(0);
    setSourceTime(0);
    toast({ title: "Vídeo carregado!", description: file.name });
  };

  const handleMetadata = () => {
    const v = videoRef.current;
    if (!v) return;
    const dur = v.duration || 0;
    setDuration(dur);
    virtualDurationRef.current = dur;
    setVirtualDuration(dur);
    setSourceMedia(prev => prev ? { ...prev, duration: dur } : null);

    const initialClip: TimelineClip = {
      id: "clip-main-0",
      sourceId: "source-main",
      kind: "video",
      trackId: "track-video-main",
      sourceStart: 0,
      sourceEnd: dur,
      timelineStart: 0,
      timelineEnd: dur,
      visible: true,
      locked: false,
      color: "hsl(262,83%,58%)",
    };
    setTimelineClips([initialClip]);
    timelineClipsRef.current = [initialClip];
  };

  // ─── Playback controls ────────────────────────────────────────────────────
  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (playing) { v.pause(); setPlaying(false); }
    else { v.play(); setPlaying(true); }
  };

  // Alias: all seek calls from UI go through seekTimeline
  const seekVirtual = seekTimeline;

  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !muted;
    setMuted(!muted);
  };

  // ─── Auto-cut ─────────────────────────────────────────────────────────────
  const handleAutoCut = async () => {
    const v = videoRef.current;
    if (!v || !videoSrc || !sourceMedia) {
      toast({ title: "Sem vídeo", description: "Carregue um vídeo primeiro.", variant: "destructive" });
      return;
    }
    pushHistory(timelineClips, layers, captions, virtualDuration > 0 ? virtualDuration : duration);
    setAutoCutLoading(true);
    setAutoCutProgress(0);
    try {
      const minDur = SILENCE_THRESHOLDS[autoCutLevel];
      const segs = await detectSilenceSegments(v, minDur, setAutoCutProgress);

      const clips = buildTimelineClipsFromSegments(segs, sourceMedia.id);
      setTimelineClips(clips);
      timelineClipsRef.current = clips;

      const total = clips.reduce((acc, c) => acc + (c.timelineEnd - c.timelineStart), 0);
      virtualDurationRef.current = total;
      setVirtualDuration(total);

      // Seek to the start of the first clip (source time)
      if (clips.length > 0) {
        v.currentTime = clips[0].sourceStart;  // ← source time
        setSourceTime(clips[0].sourceStart);
        setTimelineTime(0);
      }

      toast({ title: `✂️ ${clips.length} clipes detectados`, description: `Silêncios removidos • Nível: ${autoCutLevel}` });
    } catch (err) {
      console.error(err);
      toast({ title: "Erro no corte automático", variant: "destructive" });
    } finally {
      setAutoCutLoading(false);
      setAutoCutProgress(0);
    }
  };

  // ─── Manual cut ───────────────────────────────────────────────────────────
  const handleManualCut = useCallback((atTimelineTime: number) => {
    if (!duration || !sourceMedia) return;
    pushHistory(timelineClips, layers, captions, virtualDuration > 0 ? virtualDuration : duration);

    const idx = timelineClips.findIndex(
      c => c.kind === "video" && atTimelineTime > c.timelineStart && atTimelineTime < c.timelineEnd
    );
    if (idx === -1) return;

    const clip = timelineClips[idx];
    const ratio = (atTimelineTime - clip.timelineStart) / (clip.timelineEnd - clip.timelineStart);
    const sourceAtCut = clip.sourceStart + ratio * (clip.sourceEnd - clip.sourceStart);

    const leftClip: TimelineClip = { ...clip, id: `clip-${Date.now()}-a`, sourceEnd: sourceAtCut, timelineEnd: atTimelineTime };
    const rightClip: TimelineClip = { ...clip, id: `clip-${Date.now()}-b`, sourceStart: sourceAtCut, timelineStart: atTimelineTime, color: clipColor(idx + 1) };

    const newClips = [...timelineClips.slice(0, idx), leftClip, rightClip, ...timelineClips.slice(idx + 1)];
    setTimelineClips(newClips);
    timelineClipsRef.current = newClips;

    const total = newClips.filter(c => c.kind === "video").reduce((acc, c) => acc + (c.timelineEnd - c.timelineStart), 0);
    setVirtualDuration(total);
    virtualDurationRef.current = total;

    setCutMode(false);
    toast({ title: `✂️ Corte manual em ${atTimelineTime.toFixed(2)}s` });
  }, [timelineClips, layers, captions, duration, virtualDuration, sourceMedia, pushHistory]);

  // ─── Clip drag / resize / delete ─────────────────────────────────────────
  const handleClipDragEnd = useCallback((id: string, newTimelineStart: number) => {
    setTimelineClips(prev => {
      const next = moveClip(prev, id, newTimelineStart);
      timelineClipsRef.current = next;
      return next;
    });
  }, []);

  const handleClipResizeEnd = useCallback((id: string, side: "left" | "right", newTime: number) => {
    setTimelineClips(prev => {
      const next = resizeClip(prev, id, side, newTime);
      timelineClipsRef.current = next;
      return next;
    });
  }, []);

  const handleClipDelete = useCallback((id: string) => {
    pushHistory(timelineClips, layers, captions, virtualDuration > 0 ? virtualDuration : duration);
    setTimelineClips(prev => {
      const next = deleteClip(prev, id);
      timelineClipsRef.current = next;
      const videoOnly = next.filter(c => c.kind === "video");
      if (videoOnly.length === 0) {
        setVirtualDuration(0);
        virtualDurationRef.current = duration;
        return next;
      }
      const total = videoOnly.reduce((acc, c) => acc + (c.timelineEnd - c.timelineStart), 0);
      setVirtualDuration(total);
      virtualDurationRef.current = total;
      return next;
    });
    toast({ title: "Clipe removido" });
  }, [timelineClips, layers, captions, duration, virtualDuration, pushHistory]);

  // ─── Captions via Web Speech API ─────────────────────────────────────────
  const speechRecognitionRef = useRef<any>(null);
  const audioCtxCaptionRef = useRef<AudioContext | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcriptRaw, setTranscriptRaw] = useState("");

  const handleGenerateCaptions = async () => {
    const v = videoRef.current;
    if (!v || !videoSrc) {
      toast({ title: "Carregue um vídeo primeiro.", variant: "destructive" });
      return;
    }

    if (transcriptWords.length > 0) {
      const blocks = splitCaptionsFromTranscript(transcriptWords, captionMode);
      applyCaptures(blocks);
      toast({ title: `${blocks.length} legendas geradas` });
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast({ title: "Reconhecimento de voz não suportado neste navegador", variant: "destructive" });
      return;
    }

    setCaptionLoading(true);
    setIsTranscribing(true);

    try {
      const audioCtx = new AudioContext();
      audioCtxCaptionRef.current = audioCtx;
      const source = audioCtx.createMediaElementSource(v);
      const dest = audioCtx.createMediaStreamDestination();
      source.connect(dest);
      source.connect(audioCtx.destination);

      const recognition = new SpeechRecognition();
      speechRecognitionRef.current = recognition;
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "pt-BR";

      const wordTimings: Array<{ text: string; start: number; end: number }> = [];

      recognition.onresult = (event: any) => {
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            const transcript = event.results[i][0].transcript.trim();
            const words = transcript.split(/\s+/).filter(Boolean);
            const t = v.currentTime;
            const estDur = words.length * 0.4;
            words.forEach((word: string, wi: number) => {
              wordTimings.push({
                text: word,
                start: Math.max(0, t - estDur + wi * 0.4),
                end: Math.max(0, t - estDur + (wi + 1) * 0.4),
              });
            });
            setTranscriptRaw(prev => prev + " " + transcript);
          }
        }
      };

      recognition.onend = () => {
        if (wordTimings.length > 0) {
          setTranscriptWords(wordTimings);
          const blocks = splitCaptionsFromTranscript(wordTimings, captionMode);
          applyCaptures(blocks);
          toast({ title: `${blocks.length} legendas geradas de ${wordTimings.length} palavras` });
        } else {
          toast({ title: "Nenhuma fala detectada", variant: "destructive" });
        }
        setIsTranscribing(false);
        setCaptionLoading(false);
      };

      recognition.onerror = (event: any) => {
        console.error("Speech recognition error:", event.error);
        setIsTranscribing(false);
        setCaptionLoading(false);
      };

      recognition.start(dest.stream);
      v.currentTime = 0;
      await v.play();
      setPlaying(true);
    } catch (err) {
      console.error(err);
      setCaptionLoading(false);
      setIsTranscribing(false);
      toast({ title: "Erro ao iniciar transcrição", variant: "destructive" });
    }
  };

  const stopTranscription = () => {
    speechRecognitionRef.current?.stop();
    audioCtxCaptionRef.current?.close();
    videoRef.current?.pause();
    setPlaying(false);
    setIsTranscribing(false);
    setCaptionLoading(false);
  };

  const applyCaptures = (blocks: CaptionBlock[]) => {
    setCaptions(blocks);
    setLayers(prev => {
      const without = prev.filter(l => !(l.type === "text" && l.id.startsWith("caption-")));
      return [
        ...without,
        ...blocks.map(b => ({
          id: `caption-${b.id}`,
          type: "text" as LayerType,
          label: b.text,
          start: b.start, end: b.end,
          visible: true, locked: false,
          color: LAYER_COLORS.text,
          content: b.text,
        }))
      ];
    });
  };

  // ─── Texto ────────────────────────────────────────────────────────────────
  const handleAddText = () => {
    if (!addTextValue.trim() || !duration) {
      toast({ title: "Carregue um vídeo primeiro", variant: "destructive" });
      return;
    }
    pushHistory(timelineClips, layers, captions, virtualDuration > 0 ? virtualDuration : duration);
    setLayers(prev => [...prev, {
      id: `text-${Date.now()}`,
      type: "text",
      label: addTextValue,
      start: timelineTime,
      end: Math.min(timelineTime + 5, duration),
      visible: true, locked: false,
      color: LAYER_COLORS.text,
      content: addTextValue,
    }]);
    toast({ title: "Texto adicionado à timeline" });
  };

  // ─── Áudio extra ─────────────────────────────────────────────────────────
  const handleAudioLoad = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !duration) return;
    pushHistory(timelineClips, layers, captions, virtualDuration > 0 ? virtualDuration : duration);
    setLayers(prev => [...prev, {
      id: `audio-${Date.now()}`,
      type: "audio",
      label: file.name.replace(/\.[^.]+$/, ""),
      start: 0, end: duration,
      visible: true, locked: false,
      color: LAYER_COLORS.audio,
      content: URL.createObjectURL(file),
    }]);
    toast({ title: "🎵 Áudio adicionado" });
  };

  // ─── Layer actions ────────────────────────────────────────────────────────
  const toggleLayerVisible = (id: string) => {
    pushHistory(timelineClips, layers, captions, virtualDuration > 0 ? virtualDuration : duration);
    setLayers(prev => prev.map(l => l.id === id ? { ...l, visible: !l.visible } : l));
  };

  const deleteLayer = (id: string) => {
    pushHistory(timelineClips, layers, captions, virtualDuration > 0 ? virtualDuration : duration);
    setLayers(prev => prev.filter(l => l.id !== id));
  };

  // ─── Export ───────────────────────────────────────────────────────────────
  const handleExport = async () => {
    if (!videoSrc) {
      toast({ title: "Sem vídeo", variant: "destructive" });
      return;
    }
    setProcessing(true);
    setProcessingMsg("Preparando exportação via canvas...");
    videoRef.current?.pause();
    setPlaying(false);

    if (cutSegments.length === 0) {
      const a = document.createElement("a");
      a.href = videoSrc;
      a.download = `viralcut-export.mp4`;
      a.click();
      setProcessing(false);
      toast({ title: "✅ Vídeo exportado (sem cortes aplicados)" });
      return;
    }

    const v = document.createElement("video");
    v.src = videoSrc;
    v.muted = true;
    v.load();
    await new Promise(res => v.addEventListener("loadedmetadata", res, { once: true }));

    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth || 1280;
    canvas.height = v.videoHeight || 720;
    const ctx = canvas.getContext("2d")!;

    const stream = canvas.captureStream(30);
    const recorder = new MediaRecorder(stream, { mimeType: "video/webm;codecs=vp9" });
    const chunks: Blob[] = [];
    recorder.ondataavailable = e => chunks.push(e.data);

    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: "video/webm" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "viralcut-export.webm";
      a.click();
      URL.revokeObjectURL(url);
      setProcessing(false);
      toast({ title: "✅ Vídeo exportado com cortes aplicados!" });
    };

    recorder.start();
    setProcessingMsg("Renderizando segmentos...");

    for (let si = 0; si < cutSegments.length; si++) {
      const seg = cutSegments[si];
      setProcessingMsg(`Renderizando clipe ${si + 1}/${cutSegments.length}...`);
      v.currentTime = seg.start;
      await new Promise(res => v.addEventListener("seeked", res, { once: true }));
      while (v.currentTime < seg.end) {
        ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
        await new Promise(res => setTimeout(res, 1000 / 30));
        v.currentTime = Math.min(v.currentTime + 1 / 30, seg.end);
        await new Promise(res => v.addEventListener("seeked", res, { once: true }));
      }
    }
    recorder.stop();
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    const ms = Math.floor((s % 1) * 10);
    return `${m}:${sec.toString().padStart(2, "0")}.${ms}`;
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  const displayDuration = virtualDuration > 0 ? virtualDuration : duration;
  const displayTime = timelineTime;
  const pxPerSec = timelineScale * 80;

  // Video clips for the main track
  const videoClips = timelineClips
    .filter(c => c.kind === "video" && c.trackId === "track-video-main")
    .sort((a, b) => a.timelineStart - b.timelineStart);

  // Non-video layers
  const nonVideoLayers = layers.filter(l => l.type !== "video");

  const hasTimeline = videoSrc !== null;

  return (
    <div className="flex flex-col h-full bg-[hsl(220,25%,8%)] text-foreground overflow-hidden select-none">

      {/* ── Top Bar ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-border/40 bg-[hsl(220,25%,10%)] shrink-0">
        <div className="flex items-center gap-1.5 mr-2 shrink-0">
          <Scissors className="h-4 w-4 text-primary" />
          <span className="text-sm font-bold text-primary">ViralCut</span>
          {videoName !== "Sem vídeo" && (
            <span className="hidden sm:inline text-[10px] text-muted-foreground truncate max-w-[100px]">{videoName}</span>
          )}
        </div>

        <div className="flex items-center gap-1 flex-1 flex-wrap min-w-0">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground px-2 shrink-0"
            onClick={handleUndo}
            disabled={history.length === 0}
            title="Desfazer última ação"
          >
            <Undo2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Desfazer</span>
          </Button>

          <div className="h-4 w-px bg-border/50 mx-0.5 shrink-0" />

          <Button size="sm" variant="outline" className="h-7 text-xs gap-1 shrink-0" onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-3 w-3" />
            <span className="hidden sm:inline">Vídeo</span>
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1 shrink-0"
            onClick={handleAutoCut} disabled={!videoSrc || autoCutLoading}>
            {autoCutLoading
              ? <><Loader2 className="h-3 w-3 animate-spin" />{autoCutProgress}%</>
              : <><Scissors className="h-3 w-3" /><span className="hidden sm:inline">Corte Auto</span></>}
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1 shrink-0"
            onClick={() => setActiveTab("captions")}>
            <Sparkles className="h-3 w-3" />
            <span className="hidden sm:inline">Legenda</span>
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1 shrink-0" onClick={() => setActiveTab("text")}>
            <Type className="h-3 w-3" />
            <span className="hidden sm:inline">Texto</span>
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1 shrink-0" onClick={() => setActiveTab("chroma")}>
            <Layers className="h-3 w-3" />
            <span className="hidden sm:inline">Chroma</span>
          </Button>
          <Button size="sm" className="h-7 text-xs gap-1 shrink-0 ml-auto" onClick={handleExport} disabled={!videoSrc || processing}>
            {processing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
            <span>Exportar</span>
          </Button>
        </div>
      </div>

      <input ref={fileInputRef} type="file" accept="video/*" className="hidden" onChange={handleVideoLoad} />
      <input ref={audioInputRef} type="file" accept="audio/*" className="hidden" onChange={handleAudioLoad} />

      {/* ── Main Body ───────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* ── Left Sidebar ─────────────────────────────────────────── */}
        <div className={cn(
          "shrink-0 border-r border-border/40 bg-[hsl(220,25%,10%)] flex flex-col overflow-hidden transition-all duration-200",
          leftCollapsed ? "w-8" : "w-52"
        )}>
          <div className="flex items-center justify-between px-2 py-1.5 border-b border-border/40">
            {!leftCollapsed && <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Ferramentas</span>}
            <button onClick={() => setLeftCollapsed(!leftCollapsed)} className="text-muted-foreground hover:text-foreground ml-auto">
              {leftCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
            </button>
          </div>

          {!leftCollapsed && (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1 min-h-0">
              <TabsList className="grid grid-cols-3 h-auto mx-2 mt-2 shrink-0 gap-0.5 bg-muted/50">
                <TabsTrigger value="upload" className="text-[9px] py-1 px-1">Mídia</TabsTrigger>
                <TabsTrigger value="captions" className="text-[9px] py-1 px-1">Legenda</TabsTrigger>
                <TabsTrigger value="text" className="text-[9px] py-1 px-1">Texto</TabsTrigger>
              </TabsList>
              <TabsList className="grid grid-cols-3 h-auto mx-2 mt-1 shrink-0 gap-0.5 bg-muted/50">
                <TabsTrigger value="chroma" className="text-[9px] py-1 px-1">Chroma</TabsTrigger>
                <TabsTrigger value="filters" className="text-[9px] py-1 px-1">Filtros</TabsTrigger>
                <TabsTrigger value="audio" className="text-[9px] py-1 px-1">Áudio</TabsTrigger>
              </TabsList>

              <div className="flex-1 overflow-y-auto p-2 space-y-3 min-h-0">

                {/* ─ Upload / AutoCut ─ */}
                <TabsContent value="upload" className="mt-0 space-y-2">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full border-2 border-dashed border-border hover:border-primary rounded-lg p-4 flex flex-col items-center gap-2 transition-colors group"
                  >
                    <Upload className="h-5 w-5 text-muted-foreground group-hover:text-primary" />
                    <span className="text-[10px] text-muted-foreground text-center">Clique ou arraste um vídeo</span>
                  </button>
                  {videoSrc && (
                    <div className="bg-card rounded p-2">
                      <p className="text-[10px] text-muted-foreground truncate">{videoName}</p>
                      <p className="text-[10px] text-primary">{formatTime(duration)}</p>
                    </div>
                  )}
                  <div className="pt-1 space-y-1.5">
                    <p className="text-[9px] uppercase tracking-widest text-muted-foreground">Nível de corte</p>
                    <div className="grid grid-cols-3 gap-1">
                      {(["suave", "medio", "agressivo"] as AutoCutLevel[]).map(lvl => (
                        <button
                          key={lvl}
                          onClick={() => setAutoCutLevel(lvl)}
                          className={cn(
                            "text-[9px] py-1 rounded border transition-colors capitalize",
                            autoCutLevel === lvl
                              ? "bg-primary border-primary text-primary-foreground"
                              : "border-border text-muted-foreground hover:border-primary"
                          )}
                        >{lvl}</button>
                      ))}
                    </div>
                    <Button size="sm" className="w-full h-7 text-xs" onClick={handleAutoCut} disabled={!videoSrc || autoCutLoading}>
                      {autoCutLoading
                        ? <><Loader2 className="h-3 w-3 animate-spin mr-1" />{autoCutProgress}%</>
                        : <><Scissors className="h-3 w-3 mr-1" />Cortar silêncio</>
                      }
                    </Button>
                    {videoClips.length > 1 && (
                      <div className="bg-primary/10 border border-primary/30 rounded p-2 space-y-0.5">
                        <p className="text-[10px] text-primary font-medium">{videoClips.length} clipes ativos</p>
                        <p className="text-[9px] text-muted-foreground">Preview reproduz apenas as partes com fala</p>
                        <button
                          onClick={() => {
                            pushHistory(timelineClips, layers, captions, virtualDuration > 0 ? virtualDuration : duration);
                            const resetClip: TimelineClip = {
                              id: "clip-main-reset",
                              sourceId: "source-main",
                              kind: "video",
                              trackId: "track-video-main",
                              sourceStart: 0,
                              sourceEnd: duration,
                              timelineStart: 0,
                              timelineEnd: duration,
                              visible: true,
                              locked: false,
                              color: "hsl(262,83%,58%)",
                            };
                            setTimelineClips([resetClip]);
                            timelineClipsRef.current = [resetClip];
                            setVirtualDuration(duration);
                            virtualDurationRef.current = duration;
                            setTimelineTime(0);
                            setSourceTime(0);
                            if (videoRef.current) videoRef.current.currentTime = 0;
                          }}
                          className="text-[9px] text-destructive hover:underline"
                        >Desfazer cortes</button>
                      </div>
                    )}
                  </div>
                </TabsContent>

                {/* ─ Captions ─ */}
                <TabsContent value="captions" className="mt-0 space-y-2">
                  <div className="bg-card/60 border border-border/60 rounded p-2 space-y-1">
                    <div className="flex items-center gap-1.5">
                      <Mic className="h-3 w-3 text-primary" />
                      <p className="text-[10px] font-medium text-foreground">Transcrição pelo áudio</p>
                    </div>
                    <p className="text-[9px] text-muted-foreground leading-relaxed">
                      O vídeo será reproduzido e o áudio transcrito em tempo real via reconhecimento de voz do navegador.
                    </p>
                  </div>

                  {transcriptWords.length > 0 && (
                    <div className="bg-primary/10 border border-primary/30 rounded p-2">
                      <p className="text-[9px] text-primary">{transcriptWords.length} palavras transcritas</p>
                      <button
                        onClick={() => { setTranscriptWords([]); setTranscriptRaw(""); }}
                        className="text-[9px] text-muted-foreground hover:underline mt-0.5"
                      >Limpar e retranscrever</button>
                    </div>
                  )}

                  <div className="space-y-1">
                    <p className="text-[9px] uppercase tracking-widest text-muted-foreground">Palavras por bloco</p>
                    <div className="grid grid-cols-3 gap-1">
                      {([1, 2, 3] as CaptionWordMode[]).map(m => (
                        <button
                          key={m}
                          onClick={() => setCaptionMode(m)}
                          className={cn(
                            "text-[9px] py-1 rounded border transition-colors",
                            captionMode === m
                              ? "bg-primary border-primary text-primary-foreground"
                              : "border-border text-muted-foreground hover:border-primary"
                          )}
                        >{m} {m === 1 ? "palavra" : "palavras"}</button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <p className="text-[9px] uppercase tracking-widest text-muted-foreground">Estilo</p>
                    <div className="flex items-center gap-2">
                      <label className="text-[10px] text-muted-foreground w-10">Cor</label>
                      <input type="color" value={captionStyle.color}
                        onChange={e => setCaptionStyle(s => ({ ...s, color: e.target.value }))}
                        className="h-5 w-8 cursor-pointer rounded border-0 bg-transparent" />
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-[10px] text-muted-foreground w-12">Tam</label>
                      <Slider value={[captionStyle.size]} onValueChange={v => setCaptionStyle(s => ({ ...s, size: v[0] }))}
                        min={16} max={72} step={2} className="flex-1" />
                      <span className="text-[10px] w-6 text-right">{captionStyle.size}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-[10px] text-muted-foreground w-12">Posição</label>
                      <Slider value={[captionStyle.posY]} onValueChange={v => setCaptionStyle(s => ({ ...s, posY: v[0] }))}
                        min={10} max={95} step={5} className="flex-1" />
                      <span className="text-[10px] w-6 text-right">{captionStyle.posY}%</span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setCaptionStyle(s => ({ ...s, shadow: !s.shadow }))}
                        className={cn("text-[9px] flex-1 py-1 rounded border transition-colors",
                          captionStyle.shadow ? "bg-primary/20 border-primary text-primary" : "border-border text-muted-foreground")}
                      >Sombra</button>
                      <button
                        onClick={() => setCaptionStyle(s => ({ ...s, bg: !s.bg }))}
                        className={cn("text-[9px] flex-1 py-1 rounded border transition-colors",
                          captionStyle.bg ? "bg-primary/20 border-primary text-primary" : "border-border text-muted-foreground")}
                      >BG</button>
                    </div>
                  </div>

                  {isTranscribing ? (
                    <Button size="sm" variant="destructive" className="w-full h-7 text-xs" onClick={stopTranscription}>
                      <MicOff className="h-3 w-3 mr-1" />Parar transcrição
                    </Button>
                  ) : (
                    <Button size="sm" className="w-full h-7 text-xs" onClick={handleGenerateCaptions} disabled={!videoSrc || captionLoading}>
                      {captionLoading
                        ? <><Loader2 className="h-3 w-3 animate-spin mr-1" />Transcrevendo...</>
                        : <><Mic className="h-3 w-3 mr-1" />{transcriptWords.length > 0 ? "Regen. legendas" : "Gerar legendas"}</>
                      }
                    </Button>
                  )}

                  {isTranscribing && (
                    <div className="bg-destructive/10 border border-destructive/30 rounded p-2 flex items-center gap-2">
                      <div className="h-2 w-2 bg-destructive rounded-full animate-pulse" />
                      <p className="text-[9px] text-destructive">Reproduzindo e transcrevendo...</p>
                    </div>
                  )}

                  {captions.length > 0 && (
                    <p className="text-[10px] text-primary text-center">{captions.length} legendas ativas</p>
                  )}
                </TabsContent>

                {/* ─ Text ─ */}
                <TabsContent value="text" className="mt-0 space-y-2">
                  <p className="text-[9px] uppercase tracking-widest text-muted-foreground">Adicionar texto</p>
                  <input
                    value={addTextValue}
                    onChange={e => setAddTextValue(e.target.value)}
                    className="w-full text-xs bg-background border border-border rounded p-2 focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <Button size="sm" className="w-full h-7 text-xs" onClick={handleAddText} disabled={!videoSrc}>
                    <Type className="h-3 w-3 mr-1" />Adicionar à timeline
                  </Button>
                </TabsContent>

                {/* ─ Chroma ─ */}
                <TabsContent value="chroma" className="mt-0 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[9px] uppercase tracking-widest text-muted-foreground">Chroma Key</p>
                    <button
                      onClick={() => setChromaEnabled(!chromaEnabled)}
                      className={cn("text-[9px] px-2 py-0.5 rounded-full border transition-colors",
                        chromaEnabled ? "bg-primary border-primary text-primary-foreground" : "border-border text-muted-foreground")}
                    >{chromaEnabled ? "ON" : "OFF"}</button>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-[10px] text-muted-foreground w-10">Cor</label>
                    <input type="color" value={chromaColor} onChange={e => setChromaColor(e.target.value)}
                      className="h-5 w-10 cursor-pointer rounded border-0 bg-transparent" />
                    <span className="text-[10px] text-muted-foreground">{chromaColor}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-[10px] text-muted-foreground w-16">Tolerância</label>
                    <Slider value={chromaTolerance} onValueChange={setChromaTolerance} min={10} max={200} step={5} className="flex-1" />
                    <span className="text-[10px] w-6 text-right">{chromaTolerance[0]}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-[10px] text-muted-foreground w-16">Suavização</label>
                    <Slider value={chromaSmoothing} onValueChange={setChromaSmoothing} min={0} max={100} step={5} className="flex-1" />
                    <span className="text-[10px] w-6 text-right">{chromaSmoothing[0]}</span>
                  </div>
                </TabsContent>

                {/* ─ Filters ─ */}
                <TabsContent value="filters" className="mt-0 space-y-2">
                  <p className="text-[9px] uppercase tracking-widest text-muted-foreground mb-2">Filtros de Vídeo</p>
                  {[
                    { label: "Brilho", value: filterBrightness, set: setFilterBrightness },
                    { label: "Contraste", value: filterContrast, set: setFilterContrast },
                    { label: "Saturação", value: filterSaturation, set: setFilterSaturation },
                  ].map(f => (
                    <div key={f.label} className="flex items-center gap-2">
                      <label className="text-[10px] text-muted-foreground w-16">{f.label}</label>
                      <Slider value={f.value} onValueChange={f.set} min={0} max={200} step={5} className="flex-1" />
                      <span className="text-[10px] w-8 text-right">{f.value[0]}%</span>
                    </div>
                  ))}
                  <Button size="sm" variant="outline" className="w-full h-7 text-xs" onClick={() => {
                    setFilterBrightness([100]); setFilterContrast([100]); setFilterSaturation([100]);
                  }}>
                    <RotateCcw className="h-3 w-3 mr-1" />Resetar
                  </Button>
                </TabsContent>

                {/* ─ Audio ─ */}
                <TabsContent value="audio" className="mt-0 space-y-2">
                  <p className="text-[9px] uppercase tracking-widest text-muted-foreground">Adicionar Áudio</p>
                  <button
                    onClick={() => audioInputRef.current?.click()}
                    className="w-full border-2 border-dashed border-border hover:border-primary rounded-lg p-3 flex flex-col items-center gap-1 transition-colors group"
                  >
                    <Music className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                    <span className="text-[10px] text-muted-foreground">Upload de áudio</span>
                  </button>
                  <p className="text-[9px] text-muted-foreground text-center">MP3, WAV, M4A</p>
                </TabsContent>

              </div>
            </Tabs>
          )}
        </div>

        {/* ── Center: Preview ───────────────────────────────────────── */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
          <div className="flex-1 flex items-center justify-center bg-black relative min-h-0 overflow-hidden">
            {!videoSrc ? (
              <div
                className="flex flex-col items-center gap-3 cursor-pointer group"
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center border-2 border-dashed border-primary/40 group-hover:border-primary transition-colors">
                  <Film className="h-7 w-7 text-primary/50 group-hover:text-primary transition-colors" />
                </div>
                <p className="text-sm text-muted-foreground text-center">Clique para carregar um vídeo</p>
              </div>
            ) : (
              <div className="relative max-h-full max-w-full flex items-center justify-center w-full h-full">
                <video
                  ref={videoRef}
                  src={videoSrc}
                  onLoadedMetadata={handleMetadata}
                  onEnded={() => setPlaying(false)}
                  className={cn("max-h-full max-w-full object-contain", chromaEnabled && "hidden")}
                  style={videoStyle}
                  playsInline
                />
                {chromaEnabled && (
                  <canvas ref={canvasRef} className="max-h-full max-w-full object-contain" style={videoStyle} />
                )}

                {videoClips.length > 1 && (
                  <div className="absolute top-2 right-2 bg-primary/80 text-primary-foreground text-[9px] px-2 py-0.5 rounded-full">
                    ✂️ {videoClips.length} clips ativos
                  </div>
                )}

                {activeCaptions.map(cap => (
                  <div
                    key={cap.id}
                    className="absolute left-1/2 -translate-x-1/2 text-center px-3 py-1 rounded pointer-events-none"
                    style={{
                      bottom: `${100 - captionStyle.posY}%`,
                      color: captionStyle.color,
                      fontSize: captionStyle.size,
                      fontWeight: 900,
                      textShadow: captionStyle.shadow ? "0 2px 8px rgba(0,0,0,0.9)" : undefined,
                      backgroundColor: captionStyle.bg ? "rgba(0,0,0,0.55)" : undefined,
                      letterSpacing: "0.05em",
                      textTransform: "uppercase",
                    }}
                  >
                    {cap.text}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ══ Bottom panel ════════════════════════════════════════════════════ */}
      <div className="flex flex-col overflow-hidden" style={{ maxHeight: "min(46vh, 330px)" }}>

        {/* ── Player controls ─────────────────────────────────────────────── */}
        <div className="shrink-0 bg-[hsl(220,25%,10%)] border-t border-border/40 px-4 py-2.5 flex items-center gap-3 w-full">
          <button onClick={() => seekVirtual(0)} className="text-muted-foreground hover:text-foreground shrink-0">
            <SkipBack className="h-5 w-5" />
          </button>
          <button
            onClick={togglePlay}
            className="h-9 w-9 rounded-full bg-primary flex items-center justify-center hover:bg-primary/80 transition-colors shrink-0 shadow-md"
          >
            {playing
              ? <Pause className="h-4 w-4 text-primary-foreground" />
              : <Play className="h-4 w-4 text-primary-foreground ml-0.5" />}
          </button>
          <button onClick={() => seekVirtual(displayDuration)} className="text-muted-foreground hover:text-foreground shrink-0">
            <SkipForward className="h-5 w-5" />
          </button>

          {/* Seek bar */}
          <div
            className="flex-1 relative h-2.5 bg-border/60 rounded-full cursor-pointer"
            onClick={e => {
              const rect = e.currentTarget.getBoundingClientRect();
              const vt = ((e.clientX - rect.left) / rect.width) * displayDuration;
              seekVirtual(vt);
            }}
          >
            <div
              className="absolute h-full bg-primary rounded-full transition-none"
              style={{ width: displayDuration > 0 ? `${(displayTime / displayDuration) * 100}%` : "0%" }}
            />
            {/* Clip markers on seek bar */}
            {videoClips.length > 1 && (() => {
              const total = videoClips.reduce((a, c) => a + (c.timelineEnd - c.timelineStart), 0);
              let acc = 0;
              return videoClips.map(c => {
                const lft = (acc / total) * 100;
                const w = ((c.timelineEnd - c.timelineStart) / total) * 100;
                acc += c.timelineEnd - c.timelineStart;
                return (
                  <div key={c.id} className="absolute top-0 h-full bg-yellow-400/30 border-l border-yellow-400/60"
                    style={{ left: `${lft}%`, width: `${w}%` }} />
                );
              });
            })()}
            {/* Draggable thumb */}
            <div
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-5 w-5 rounded-full bg-primary border-2 border-primary-foreground shadow-lg cursor-grab active:cursor-grabbing hover:scale-110 transition-transform"
              style={{ left: displayDuration > 0 ? `${(displayTime / displayDuration) * 100}%` : "0%", touchAction: "none" }}
              onMouseDown={e => {
                e.preventDefault();
                const bar = e.currentTarget.parentElement!;
                const onMove = (ev: MouseEvent) => {
                  const rect = bar.getBoundingClientRect();
                  const vt = Math.max(0, Math.min(displayDuration, ((ev.clientX - rect.left) / rect.width) * displayDuration));
                  seekVirtual(vt);
                };
                const onUp = () => {
                  window.removeEventListener("mousemove", onMove);
                  window.removeEventListener("mouseup", onUp);
                };
                window.addEventListener("mousemove", onMove);
                window.addEventListener("mouseup", onUp);
              }}
              onTouchStart={e => {
                const bar = e.currentTarget.parentElement!;
                const onMove = (ev: TouchEvent) => {
                  const rect = bar.getBoundingClientRect();
                  const vt = Math.max(0, Math.min(displayDuration, ((ev.touches[0].clientX - rect.left) / rect.width) * displayDuration));
                  seekVirtual(vt);
                };
                const onEnd = () => {
                  window.removeEventListener("touchmove", onMove);
                  window.removeEventListener("touchend", onEnd);
                };
                window.addEventListener("touchmove", onMove, { passive: true });
                window.addEventListener("touchend", onEnd);
              }}
            />
          </div>

          <span className="text-[11px] text-muted-foreground tabular-nums whitespace-nowrap shrink-0">
            {formatTime(displayTime)} / {formatTime(displayDuration)}
          </span>

          <button onClick={toggleMute} className="text-muted-foreground hover:text-foreground shrink-0">
            {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
          </button>
          <div className="w-20 shrink-0 hidden sm:block">
            <Slider value={volume} onValueChange={setVolume} min={0} max={100} step={1} />
          </div>
        </div>

        {/* ── Action toolbar ───────────────────────────────────────────────── */}
        <div className="shrink-0 bg-[hsl(220,25%,9%)] border-t border-border/40 px-2 py-1.5 flex items-center gap-1 flex-wrap w-full">
          <Button
            size="sm"
            variant="ghost"
            className="h-8 text-xs gap-1.5 text-muted-foreground hover:text-foreground px-2.5"
            onClick={handleUndo}
            disabled={history.length === 0}
          >
            <Undo2 className="h-3.5 w-3.5" />
            Desfazer
          </Button>

          <div className="h-4 w-px bg-border/40 mx-0.5" />

          <Button size="sm" variant="ghost" className="h-8 text-xs gap-1.5 px-2.5" onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-3.5 w-3.5" /> Upload
          </Button>
          <Button size="sm" variant="ghost" className="h-8 text-xs gap-1.5 px-2.5"
            onClick={handleAutoCut} disabled={!videoSrc || autoCutLoading}>
            {autoCutLoading
              ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />{autoCutProgress}%</>
              : <><Scissors className="h-3.5 w-3.5" />Corte Auto</>}
          </Button>
          <Button
            size="sm"
            variant={cutMode ? "default" : "ghost"}
            className={cn(
              "h-8 text-xs gap-1.5 px-2.5",
              cutMode && "bg-destructive text-destructive-foreground hover:bg-destructive/80"
            )}
            onClick={() => setCutMode(m => !m)}
            disabled={!videoSrc}
            title="Modo corte manual: clique em um clipe na timeline para cortá-lo"
          >
            <Scissors className="h-3.5 w-3.5" />
            {cutMode ? "Cortando..." : "Cortar"}
          </Button>
          <Button size="sm" variant="ghost" className="h-8 text-xs gap-1.5 px-2.5" onClick={() => setActiveTab("captions")}>
            <Sparkles className="h-3.5 w-3.5" /> Legenda
          </Button>
          <Button size="sm" variant="ghost" className="h-8 text-xs gap-1.5 px-2.5" onClick={() => setActiveTab("text")}>
            <Type className="h-3.5 w-3.5" /> Texto
          </Button>
          <Button size="sm" variant="ghost" className="h-8 text-xs gap-1.5 px-2.5" onClick={() => setActiveTab("chroma")}>
            <Layers className="h-3.5 w-3.5" /> Chroma
          </Button>

          <div className="flex items-center gap-1 ml-auto">
            <span className="text-[9px] text-muted-foreground uppercase tracking-widest mr-1 hidden sm:inline">Zoom</span>
            <button onClick={() => setTimelineScale(s => Math.max(0.25, Math.round((s - 0.25) * 4) / 4))} className="text-muted-foreground hover:text-foreground">
              <ZoomOut className="h-3.5 w-3.5" />
            </button>
            <span className="text-[9px] text-muted-foreground w-7 text-center">{timelineScale}x</span>
            <button onClick={() => setTimelineScale(s => Math.min(8, Math.round((s + 0.25) * 4) / 4))} className="text-muted-foreground hover:text-foreground">
              <ZoomIn className="h-3.5 w-3.5" />
            </button>
          </div>

          <Button size="sm" className="h-8 text-xs gap-1.5 ml-2" onClick={handleExport} disabled={!videoSrc || processing}>
            {processing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            Exportar
          </Button>

          <button onClick={() => setBottomCollapsed(!bottomCollapsed)} className="text-muted-foreground hover:text-foreground ml-1">
            {bottomCollapsed ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        </div>

        {/* ── Timeline ─────────────────────────────────────────────────── */}
        {!bottomCollapsed && (
          <div
            className="flex-1 min-h-0 bg-[hsl(220,25%,9%)] border-t border-border/30 flex flex-col overflow-hidden"
            onWheel={handleTimelineWheel}
            onTouchStart={handleTimelineTouchStart}
            onTouchMove={handleTimelineTouchMove}
            onTouchEnd={handleTimelineTouchEnd}
          >
            {!hasTimeline ? (
              <div className="flex items-center justify-center h-full text-[11px] text-muted-foreground">
                Carregue um vídeo para ver a timeline
              </div>
            ) : (
              <div className="flex-1 overflow-auto min-h-0" ref={timelineScrollRef}>
                <div className="min-w-max" ref={timelineRulerRef}>

                  {/* Time ruler */}
                  <div className="relative flex h-6 border-b border-border/30 bg-[hsl(220,25%,8%)]">
                    <div className="w-32 shrink-0 border-r border-border/30" />
                    <div className="relative flex-1">
                      {Array.from({ length: Math.ceil((duration || displayDuration)) + 1 }).map((_, i) => (
                        <div
                          key={i}
                          className="absolute top-0 bottom-0 border-l border-border/20 flex items-end pb-0.5"
                          style={{ left: i * pxPerSec }}
                        >
                          <span className="text-[8px] text-muted-foreground pl-1">{i}s</span>
                        </div>
                      ))}
                      {/* Playhead on ruler */}
                      {displayDuration > 0 && (
                        <div
                          className="absolute top-0 bottom-0 w-3 -translate-x-1/2 flex flex-col items-center cursor-col-resize z-20 group"
                          style={{ left: displayTime * pxPerSec }}
                          onMouseDown={e => {
                            e.preventDefault();
                            const ruler = e.currentTarget.parentElement!;
                            const onMove = (ev: MouseEvent) => {
                              const rect = ruler.getBoundingClientRect();
                              const vt = Math.max(0, Math.min(displayDuration, (ev.clientX - rect.left) / pxPerSec));
                              seekVirtual(vt);
                            };
                            const onUp = () => {
                              window.removeEventListener("mousemove", onMove);
                              window.removeEventListener("mouseup", onUp);
                            };
                            window.addEventListener("mousemove", onMove);
                            window.addEventListener("mouseup", onUp);
                          }}
                          onTouchStart={e => {
                            const ruler = e.currentTarget.parentElement!;
                            const onMove = (ev: TouchEvent) => {
                              const rect = ruler.getBoundingClientRect();
                              const vt = Math.max(0, Math.min(displayDuration, (ev.touches[0].clientX - rect.left) / pxPerSec));
                              seekVirtual(vt);
                            };
                            const onEnd = () => {
                              window.removeEventListener("touchmove", onMove);
                              window.removeEventListener("touchend", onEnd);
                            };
                            window.addEventListener("touchmove", onMove, { passive: true });
                            window.addEventListener("touchend", onEnd);
                          }}
                        >
                          <div className="w-0 h-0 border-l-[5px] border-r-[5px] border-t-[7px] border-l-transparent border-r-transparent border-t-primary group-hover:border-t-primary/70 transition-colors" />
                        </div>
                      )}
                    </div>
                    {displayDuration > 0 && (
                      <div
                        className="absolute top-0 bottom-0 w-px bg-primary/70 pointer-events-none z-10"
                        style={{ left: 128 + displayTime * pxPerSec }}
                      />
                    )}
                  </div>

                  {/* Tracks */}
                  <div className="relative">
                    {/* Playhead line across tracks */}
                    {displayDuration > 0 && (
                      <div
                        className="absolute top-0 bottom-0 w-px bg-primary z-10 pointer-events-none"
                        style={{ left: 128 + displayTime * pxPerSec }}
                      />
                    )}

                    {/* ── Video track (real clips) ── */}
                    <VideoTrackLane
                      clips={videoClips}
                      duration={duration || displayDuration}
                      scale={timelineScale}
                      cutMode={cutMode}
                      onSeek={seekVirtual}
                      onClipDragEnd={handleClipDragEnd}
                      onClipResizeEnd={handleClipResizeEnd}
                      onClipDelete={handleClipDelete}
                      onManualCut={handleManualCut}
                    />

                    {/* ── Non-video layers (text, audio, overlay) ── */}
                    {nonVideoLayers.map(layer => (
                      <LayerLane
                        key={layer.id}
                        layer={layer}
                        scale={timelineScale}
                        displayDuration={displayDuration}
                        onToggleVisible={toggleLayerVisible}
                        onDelete={deleteLayer}
                        onSeek={seekVirtual}
                      />
                    ))}
                  </div>

                </div>
              </div>
            )}

            {/* Status bar */}
            <div className="px-3 py-1 border-t border-border/20 shrink-0 flex items-center gap-3">
              {cutMode ? (
                <span className="text-[9px] text-destructive font-semibold flex items-center gap-1">
                  <Scissors className="h-3 w-3" />
                  Modo corte ativo — clique sobre um clipe para cortá-lo
                </span>
              ) : (
                <span className="text-[8px] text-muted-foreground/50">Ctrl+scroll ou pinça para zoom • Arraste ▲ para navegar • Long-press para mover clipe</span>
              )}
              {videoClips.length > 1 && (
                <span className="text-[9px] text-primary bg-primary/10 border border-primary/30 rounded px-1.5 ml-auto">
                  {videoClips.length} clips • {formatTime(displayDuration)}
                </span>
              )}
            </div>
          </div>
        )}

      </div>

      {/* ── Processing overlay ──────────────────────────────────────── */}
      {processing && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center">
          <div className="bg-card border border-border rounded-xl p-6 flex flex-col items-center gap-4 min-w-56">
            <Loader2 className="h-8 w-8 text-primary animate-spin" />
            <p className="text-sm font-medium">{processingMsg}</p>
            <p className="text-xs text-muted-foreground text-center">
              Os segmentos estão sendo renderizados via canvas
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ViralCut;
