import { useRef, useCallback, useEffect, useMemo } from "react";
import { usePlaybackStore } from "../stores/playback-store";
import { useProjectStore } from "../stores/project-store";
import { useMediaStore } from "../stores/media-store";
import type { VideoElement, ImageElement, TextElement } from "../types/timeline";

interface RenderProps {
  width: number;
  height: number;
}

function getContainSize(
  srcW: number, srcH: number,
  dstW: number, dstH: number
): { x: number; y: number; w: number; h: number } {
  const scale = Math.min(dstW / srcW, dstH / srcH);
  const w = srcW * scale;
  const h = srcH * scale;
  return { x: (dstW - w) / 2, y: (dstH - h) / 2, w, h };
}

export function useCanvasRenderer({ width, height }: RenderProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());
  const rafRef = useRef<number>(0);

  const currentTime = usePlaybackStore((s) => s.currentTime);
  const isPlaying = usePlaybackStore((s) => s.isPlaying);
  const setCurrentTime = usePlaybackStore((s) => s.setCurrentTime);
  const setIsPlaying = usePlaybackStore((s) => s.setIsPlaying);
  const setDuration = usePlaybackStore((s) => s.setDuration);

  // Select primitives only — derive with useMemo to avoid new refs each render
  const projects = useProjectStore((s) => s.projects);
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const activeProject = useMemo(
    () => projects.find((p) => p.id === activeProjectId) ?? null,
    [projects, activeProjectId]
  );
  const tracks = useMemo(() => activeProject?.tracks ?? [], [activeProject]);

  const getAsset = useMediaStore((s) => s.getAsset);

  // Compute project duration from tracks
  useEffect(() => {
    if (!activeProject) return;
    let maxEnd = 0;
    for (const track of tracks) {
      for (const el of track.elements) {
        const end = el.startTime + el.duration - el.trimStart - el.trimEnd;
        if (end > maxEnd) maxEnd = end;
      }
    }
    setDuration(maxEnd || 60);
  }, [tracks, activeProject, setDuration]);

  const getOrCreateVideo = useCallback((mediaId: string, url: string) => {
    if (!videoRefs.current.has(mediaId)) {
      const video = document.createElement("video");
      video.src = url;
      video.preload = "auto";
      video.muted = false;
      video.crossOrigin = "anonymous";
      videoRefs.current.set(mediaId, video);
    }
    return videoRefs.current.get(mediaId)!;
  }, []);

  const renderFrame = useCallback((time: number) => {
    const canvas = canvasRef.current;
    if (!canvas || !activeProject) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { canvasSize } = activeProject.settings;
    const scaleX = width / canvasSize.width;
    const scaleY = height / canvasSize.height;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, width, height);

    for (const track of [...tracks].reverse()) {
      if ((track as any).hidden) continue;

      for (const el of track.elements) {
        const elStart = el.startTime;
        const elEnd = el.startTime + el.duration - el.trimStart - el.trimEnd;
        if (time < elStart || time >= elEnd) continue;

        const elLocalTime = time - elStart + el.trimStart;

        if (el.type === "video") {
          const asset = getAsset(el.mediaId);
          if (!asset) continue;
          const video = getOrCreateVideo(el.mediaId, asset.url);
          if (Math.abs(video.currentTime - elLocalTime) > 0.1) {
            video.currentTime = elLocalTime;
          }
          ctx.save();
          ctx.globalAlpha = el.opacity ?? 1;
          const { x, y, w, h } = getContainSize(
            video.videoWidth || canvasSize.width,
            video.videoHeight || canvasSize.height,
            width, height
          );
          ctx.drawImage(video, x, y, w, h);
          ctx.restore();

        } else if (el.type === "image") {
          const asset = getAsset(el.mediaId);
          if (!asset) continue;
          const img = new Image();
          img.src = asset.url;
          ctx.save();
          ctx.globalAlpha = (el as ImageElement).opacity ?? 1;
          ctx.drawImage(img, 0, 0, width, height);
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
          const tx = (textEl.transform?.x ?? 0.5) * width;
          const ty = (textEl.transform?.y ?? 0.8) * height;
          if (textEl.background?.enabled) {
            const metrics = ctx.measureText(textEl.content);
            const padX = (textEl.background.paddingX ?? 16) * scaleX;
            const padY = (textEl.background.paddingY ?? 8) * scaleY;
            const bx = tx - metrics.width / 2 - padX;
            const by = ty - fontSize / 2 - padY;
            const bw = metrics.width + padX * 2;
            const bh = fontSize + padY * 2;
            ctx.fillStyle = textEl.background.color ?? "rgba(0,0,0,0.5)";
            const r = (textEl.background.cornerRadius ?? 8) * scaleX;
            ctx.beginPath();
            ctx.roundRect(bx, by, bw, bh, r);
            ctx.fill();
            ctx.fillStyle = textEl.color ?? "#ffffff";
          }
          ctx.fillText(textEl.content, tx, ty);
          ctx.restore();
        }
      }
    }
  }, [tracks, activeProject, width, height, getAsset, getOrCreateVideo]);

  useEffect(() => {
    if (!isPlaying) {
      renderFrame(currentTime);
    }
  }, [currentTime, isPlaying, renderFrame]);

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
      const newTime = Math.min(
        usePlaybackStore.getState().currentTime + delta,
        usePlaybackStore.getState().duration
      );
      if (newTime >= usePlaybackStore.getState().duration) {
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
  }, [isPlaying, renderFrame, setCurrentTime, setIsPlaying]);

  return { canvasRef };
}
