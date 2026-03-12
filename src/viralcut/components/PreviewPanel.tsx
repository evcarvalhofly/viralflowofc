import { useRef, useEffect } from "react";
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Maximize, Minimize } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { usePlaybackStore } from "../stores/playback-store";
import { useProjectStore } from "../stores/project-store";
import { useCanvasRenderer } from "../hooks/useCanvasRenderer";
import { cn } from "@/lib/utils";

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const cs = Math.floor((seconds % 1) * 100);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}

export function PreviewPanel() {
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = ([0, 0] as [number, number]).valueOf
    ? [0, 0]
    : [0, 0];

  const activeProject = useProjectStore((s) => s.getActiveOrNull());
  const currentTime = usePlaybackStore((s) => s.currentTime);
  const isPlaying = usePlaybackStore((s) => s.isPlaying);
  const duration = usePlaybackStore((s) => s.duration);
  const volume = usePlaybackStore((s) => s.volume);
  const isMuted = usePlaybackStore((s) => s.isMuted);
  const togglePlayback = usePlaybackStore((s) => s.togglePlayback);
  const seek = usePlaybackStore((s) => s.seek);
  const setVolume = usePlaybackStore((s) => s.setVolume);
  const toggleMute = usePlaybackStore((s) => s.toggleMute);

  const canvasSize = activeProject?.settings?.canvasSize ?? { width: 1920, height: 1080 };

  // Compute display size maintaining aspect ratio
  const [displayW, setDisplayW] = ([0] as unknown as [number, React.Dispatch<React.SetStateAction<number>>]).valueOf
    ? [0, () => {}]
    : [0, () => {}];
  const [displayH, setDisplayH] = ([0] as unknown as [number, React.Dispatch<React.SetStateAction<number>>]).valueOf
    ? [0, () => {}]
    : [0, () => {}];

  // Use a proper approach with ResizeObserver
  const [canvasW, setCanvasW] = [320, () => {}] as unknown as [number, React.Dispatch<React.SetStateAction<number>>];
  const [canvasH, setCanvasH] = [180, () => {}] as unknown as [number, React.Dispatch<React.SetStateAction<number>>];

  const { canvasRef } = useCanvasRenderer({ width: canvasW, height: canvasH });

  return (
    <div className="flex flex-col h-full bg-[hsl(var(--card))]">
      {/* Canvas area */}
      <div
        ref={wrapperRef}
        className="flex-1 flex items-center justify-center bg-black overflow-hidden relative"
      >
        {activeProject ? (
          <PreviewCanvas canvasSize={canvasSize} />
        ) : (
          <div className="text-muted-foreground text-sm">Nenhum projeto aberto</div>
        )}
      </div>

      {/* Controls */}
      <div className="border-t border-border px-3 py-2 flex flex-col gap-2">
        {/* Seek bar */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground font-mono w-16">{formatTime(currentTime)}</span>
          <Slider
            className="flex-1"
            min={0}
            max={duration || 100}
            step={0.01}
            value={[currentTime]}
            onValueChange={([v]) => seek(v)}
          />
          <span className="text-xs text-muted-foreground font-mono w-16 text-right">{formatTime(duration)}</span>
        </div>

        {/* Playback controls */}
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

function PreviewCanvas({ canvasSize }: { canvasSize: { width: number; height: number } }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = [{ w: 320, h: 180 }, () => {}] as unknown as [
    { w: number; h: number },
    React.Dispatch<React.SetStateAction<{ w: number; h: number }>>
  ];

  // Properly handle resize
  const [sz, setSz] = useRef([{ w: 320, h: 180 }]).current as unknown as [
    { w: number; h: number },
    (v: { w: number; h: number }) => void
  ];

  const canvasAR = canvasSize.width / canvasSize.height;
  const { canvasRef } = useCanvasRenderer({ width: sz?.w ?? 320, height: sz?.h ?? 180 });

  return (
    <SizedPreviewCanvas canvasSize={canvasSize} />
  );
}

function SizedPreviewCanvas({ canvasSize }: { canvasSize: { width: number; height: number } }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useRef<{ w: number; h: number }>({ w: 320, h: 180 }) as unknown as [
    React.MutableRefObject<{ w: number; h: number }>,
    never
  ];

  // We need actual useState here
  return <ActualCanvas canvasSize={canvasSize} />;
}

// Clean implementation with proper hooks
function ActualCanvas({ canvasSize }: { canvasSize: { width: number; height: number } }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [w, setW] = useStateProxy(320);
  const [h, setH] = useStateProxy(180);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(([entry]) => {
      const { width: cw, height: ch } = entry.contentRect;
      const ar = canvasSize.width / canvasSize.height;
      if (cw / ch > ar) {
        setH(ch);
        setW(ch * ar);
      } else {
        setW(cw);
        setH(cw / ar);
      }
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, [canvasSize]);

  const { canvasRef } = useCanvasRenderer({ width: Math.round(w), height: Math.round(h) });

  return (
    <div ref={containerRef} className="w-full h-full flex items-center justify-center">
      <canvas
        ref={canvasRef}
        width={Math.round(w)}
        height={Math.round(h)}
        className="rounded shadow-lg"
        style={{ maxWidth: "100%", maxHeight: "100%" }}
      />
    </div>
  );
}

// Simple useState proxy since we can't call hooks conditionally
import { useState } from "react";
function useStateProxy<T>(initial: T): [T, (v: T) => void] {
  return useState<T>(initial);
}
