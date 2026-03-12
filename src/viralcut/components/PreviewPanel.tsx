import { useState, useRef, useEffect, useMemo } from "react";
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { usePlaybackStore } from "../stores/playback-store";
import { useProjectStore } from "../stores/project-store";
import { useMediaStore } from "../stores/media-store";
import type { TextElement } from "../types/timeline";

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const cs = Math.floor((seconds % 1) * 100);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}

function containFit(srcW: number, srcH: number, dstW: number, dstH: number) {
  if (!srcW || !srcH) return { x: 0, y: 0, w: dstW, h: dstH };
  const scale = Math.min(dstW / srcW, dstH / srcH);
  const w = srcW * scale;
  const h = srcH * scale;
  return { x: (dstW - w) / 2, y: (dstH - h) / 2, w, h };
}

export function PreviewPanel() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const videoCache = useRef<Map<string, HTMLVideoElement>>(new Map());
  const [canvasSize, setCanvasSize] = useState({ w: 320, h: 180 });

  // Select primitives only — no derived objects
  const projects = useProjectStore((s) => s.projects);
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const activeProject = useMemo(
    () => projects.find((p) => p.id === activeProjectId) ?? null,
    [projects, activeProjectId]
  );
  const tracks = useMemo(() => activeProject?.tracks ?? [], [activeProject]);

  const currentTime = usePlaybackStore((s) => s.currentTime);
  const isPlaying = usePlaybackStore((s) => s.isPlaying);
  const duration = usePlaybackStore((s) => s.duration);
  const volume = usePlaybackStore((s) => s.volume);
  const isMuted = usePlaybackStore((s) => s.isMuted);
  const togglePlayback = usePlaybackStore((s) => s.togglePlayback);
  const seek = usePlaybackStore((s) => s.seek);
  const setVolume = usePlaybackStore((s) => s.setVolume);
  const toggleMute = usePlaybackStore((s) => s.toggleMute);
  const setCurrentTime = usePlaybackStore((s) => s.setCurrentTime);
  const setIsPlaying = usePlaybackStore((s) => s.setIsPlaying);
  const setDuration = usePlaybackStore((s) => s.setDuration);
  const getAsset = useMediaStore((s) => s.getAsset);

  const projectCanvas = activeProject?.settings?.canvasSize ?? { width: 1920, height: 1080 };

  // Compute project duration
  useEffect(() => {
    if (!activeProject) return;
    let maxEnd = 0;
    for (const track of tracks) {
      for (const el of track.elements as any[]) {
        const end = el.startTime + el.duration - el.trimStart - el.trimEnd;
        if (end > maxEnd) maxEnd = end;
      }
    }
    setDuration(maxEnd || 60);
  }, [tracks, activeProject, setDuration]);

  // Responsive canvas size
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(([entry]) => {
      const { width: cw, height: ch } = entry.contentRect;
      const ar = projectCanvas.width / projectCanvas.height;
      let w: number, h: number;
      if (cw / ch > ar) {
        h = ch;
        w = ch * ar;
      } else {
        w = cw;
        h = cw / ar;
      }
      setCanvasSize({ w: Math.round(w), h: Math.round(h) });
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, [projectCanvas.width, projectCanvas.height]);

  const getOrCreateVideo = (mediaId: string, url: string) => {
    if (!videoCache.current.has(mediaId)) {
      const video = document.createElement("video");
      video.src = url;
      video.preload = "auto";
      video.crossOrigin = "anonymous";
      videoCache.current.set(mediaId, video);
    }
    return videoCache.current.get(mediaId)!;
  };

  const renderFrame = (time: number) => {
    const canvas = canvasRef.current;
    if (!canvas || !activeProject) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { w, h } = canvasSize;

    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, w, h);

    const scaleX = w / projectCanvas.width;
    const scaleY = h / projectCanvas.height;

    for (const track of [...tracks].reverse()) {
      if ((track as any).hidden) continue;
      for (const el of track.elements as any[]) {
        const elStart = el.startTime;
        const elEnd = el.startTime + el.duration - el.trimStart - el.trimEnd;
        if (time < elStart || time >= elEnd) continue;
        const localTime = time - elStart + el.trimStart;

        if (el.type === "video") {
          const asset = getAsset(el.mediaId);
          if (!asset) continue;
          const video = getOrCreateVideo(el.mediaId, asset.url);
          if (Math.abs(video.currentTime - localTime) > 0.15) {
            video.currentTime = localTime;
          }
          const { x, y, w: vw, h: vh } = containFit(video.videoWidth || projectCanvas.width, video.videoHeight || projectCanvas.height, w, h);
          ctx.save();
          ctx.globalAlpha = el.opacity ?? 1;
          ctx.drawImage(video, x, y, vw, vh);
          ctx.restore();
        } else if (el.type === "image") {
          const asset = getAsset(el.mediaId);
          if (!asset) continue;
          const img = new Image();
          img.src = asset.url;
          ctx.save();
          ctx.globalAlpha = el.opacity ?? 1;
          ctx.drawImage(img, 0, 0, w, h);
          ctx.restore();
        } else if (el.type === "text") {
          const textEl = el as TextElement;
          ctx.save();
          ctx.globalAlpha = textEl.opacity ?? 1;
          const fontSize = (textEl.fontSize ?? 48) * scaleX;
          ctx.font = `${textEl.fontStyle ?? "normal"} ${textEl.fontWeight ?? "normal"} ${fontSize}px ${textEl.fontFamily ?? "Inter, sans-serif"}`;
          ctx.fillStyle = textEl.color ?? "#ffffff";
          ctx.textAlign = textEl.textAlign ?? "center";
          ctx.textBaseline = "middle";
          const tx = (textEl.transform?.x ?? 0.5) * w;
          const ty = (textEl.transform?.y ?? 0.8) * h;
          if (textEl.background?.enabled) {
            const metrics = ctx.measureText(textEl.content);
            const px = 16 * scaleX, py = 8 * scaleY;
            ctx.fillStyle = textEl.background.color ?? "rgba(0,0,0,0.5)";
            ctx.fillRect(tx - metrics.width / 2 - px, ty - fontSize / 2 - py, metrics.width + px * 2, fontSize + py * 2);
            ctx.fillStyle = textEl.color ?? "#ffffff";
          }
          ctx.fillText(textEl.content, tx, ty);
          ctx.restore();
        }
      }
    }
  };

  // Static render when not playing
  useEffect(() => {
    if (!isPlaying) renderFrame(currentTime);
  }, [currentTime, isPlaying, canvasSize, tracks]);

  // RAF loop when playing
  useEffect(() => {
    if (!isPlaying) {
      cancelAnimationFrame(rafRef.current);
      return;
    }
    let lastTs = 0;
    const loop = (ts: number) => {
      if (lastTs === 0) lastTs = ts;
      const delta = (ts - lastTs) / 1000;
      lastTs = ts;
      const state = usePlaybackStore.getState();
      const newTime = Math.min(state.currentTime + delta, state.duration);
      if (newTime >= state.duration) {
        setIsPlaying(false);
        setCurrentTime(0);
        return;
      }
      setCurrentTime(newTime);
      renderFrame(newTime);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [isPlaying]);

  return (
    <div className="flex flex-col h-full bg-card">
      {/* Canvas area */}
      <div
        ref={containerRef}
        className="flex-1 flex items-center justify-center bg-black overflow-hidden"
      >
        {activeProject ? (
          <canvas
            ref={canvasRef}
            width={canvasSize.w}
            height={canvasSize.h}
            className="rounded shadow-lg"
            style={{ maxWidth: "100%", maxHeight: "100%" }}
          />
        ) : (
          <div className="text-muted-foreground text-sm">Nenhum projeto aberto</div>
        )}
      </div>

      {/* Controls */}
      <div className="border-t border-border px-3 py-2 flex flex-col gap-2 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground font-mono w-14 shrink-0">{formatTime(currentTime)}</span>
          <Slider
            className="flex-1"
            min={0}
            max={Math.max(duration, 0.01)}
            step={0.01}
            value={[currentTime]}
            onValueChange={([v]) => seek(v)}
          />
          <span className="text-xs text-muted-foreground font-mono w-14 text-right shrink-0">{formatTime(duration)}</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => seek(0)}>
              <SkipBack className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={togglePlayback}
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => seek(duration)}>
              <SkipForward className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={toggleMute}>
              {isMuted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
            </Button>
            <Slider
              className="w-20"
              min={0}
              max={1}
              step={0.01}
              value={[isMuted ? 0 : volume]}
              onValueChange={([v]) => setVolume(v)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
