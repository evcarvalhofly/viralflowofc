import { useRef, useState, useCallback } from "react";
import { useProjectStore } from "../stores/project-store";
import { useMediaStore } from "../stores/media-store";
import type { TimelineElement, VideoTrack, AudioTrack, TextTrack } from "../types/timeline";

function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

export function useTimelineActions() {
  const getTracks = useProjectStore((s) => s.getTracks);
  const addTrack = useProjectStore((s) => s.addTrack);
  const updateTrack = useProjectStore((s) => s.updateTrack);
  const removeTrack = useProjectStore((s) => s.removeTrack);
  const getActiveOrNull = useProjectStore((s) => s.getActiveOrNull);
  const getAsset = useMediaStore((s) => s.getAsset);

  const addMediaToTimeline = useCallback(
    (mediaId: string) => {
      const asset = getAsset(mediaId);
      if (!asset) return;

      const tracks = getTracks();

      if (asset.type === "video" || asset.type === "image") {
        // Find the main video track or create one
        let mainTrack = tracks.find(
          (t): t is VideoTrack => t.type === "video" && (t as VideoTrack).isMain
        );

        // Calculate start time (after last element)
        let startTime = 0;
        if (mainTrack) {
          for (const el of mainTrack.elements) {
            const end = el.startTime + el.duration - el.trimStart - el.trimEnd;
            if (end > startTime) startTime = end;
          }
        }

        const duration = asset.duration ?? 5;
        const element: TimelineElement =
          asset.type === "video"
            ? {
                id: generateId(),
                type: "video",
                name: asset.name,
                mediaId,
                duration,
                startTime,
                trimStart: 0,
                trimEnd: 0,
                sourceDuration: duration,
                opacity: 1,
                transform: { x: 0.5, y: 0.5, width: 1, height: 1, rotation: 0, scaleX: 1, scaleY: 1 },
              }
            : {
                id: generateId(),
                type: "image",
                name: asset.name,
                mediaId,
                duration: 5,
                startTime,
                trimStart: 0,
                trimEnd: 0,
                opacity: 1,
                transform: { x: 0.5, y: 0.5, width: 1, height: 1, rotation: 0, scaleX: 1, scaleY: 1 },
              };

        if (mainTrack) {
          updateTrack(mainTrack.id, {
            elements: [...mainTrack.elements, element as any],
          } as any);
        } else {
          const newTrack: VideoTrack = {
            id: generateId(),
            type: "video",
            name: "Faixa Principal",
            elements: [element as any],
            isMain: true,
            muted: false,
            hidden: false,
          };
          addTrack(newTrack);
        }
      } else if (asset.type === "audio") {
        const audioTracks = tracks.filter((t): t is AudioTrack => t.type === "audio");
        let startTime = 0;
        if (audioTracks.length > 0) {
          const lastTrack = audioTracks[audioTracks.length - 1];
          for (const el of lastTrack.elements) {
            const end = el.startTime + el.duration - el.trimStart - el.trimEnd;
            if (end > startTime) startTime = end;
          }
        }

        const duration = asset.duration ?? 30;
        const element = {
          id: generateId(),
          type: "audio" as const,
          name: asset.name,
          mediaId,
          duration,
          startTime,
          trimStart: 0,
          trimEnd: 0,
          volume: 1,
        };

        const newTrack: AudioTrack = {
          id: generateId(),
          type: "audio",
          name: asset.name,
          elements: [element],
          muted: false,
        };
        addTrack(newTrack);
      }
    },
    [getTracks, addTrack, updateTrack, getAsset]
  );

  const addTextToTimeline = useCallback(
    (content = "Texto") => {
      const tracks = getTracks();
      const textTracks = tracks.filter((t): t is TextTrack => t.type === "text");

      let startTime = 0;
      if (textTracks.length > 0) {
        const last = textTracks[textTracks.length - 1];
        for (const el of last.elements) {
          const end = el.startTime + el.duration;
          if (end > startTime) startTime = end;
        }
      }

      const element = {
        id: generateId(),
        type: "text" as const,
        name: content,
        content,
        duration: 5,
        startTime,
        trimStart: 0,
        trimEnd: 0,
        fontSize: 48,
        fontFamily: "Inter, sans-serif",
        color: "#ffffff",
        background: { enabled: false, color: "rgba(0,0,0,0.5)" },
        textAlign: "center" as const,
        fontWeight: "bold" as const,
        fontStyle: "normal" as const,
        textDecoration: "none" as const,
        opacity: 1,
        transform: { x: 0.5, y: 0.8, width: 1, height: 0.1, rotation: 0, scaleX: 1, scaleY: 1 },
      };

      const newTrack: TextTrack = {
        id: generateId(),
        type: "text",
        name: "Texto",
        elements: [element],
        hidden: false,
      };
      addTrack(newTrack);
    },
    [getTracks, addTrack]
  );

  const removeElement = useCallback(
    (trackId: string, elementId: string) => {
      const tracks = getTracks();
      const track = tracks.find((t) => t.id === trackId);
      if (!track) return;

      const newElements = (track.elements as TimelineElement[]).filter(
        (e) => e.id !== elementId
      );

      if (newElements.length === 0 && !(track as VideoTrack).isMain) {
        removeTrack(trackId);
      } else {
        updateTrack(trackId, { elements: newElements } as any);
      }
    },
    [getTracks, updateTrack, removeTrack]
  );

  const splitElement = useCallback(
    (trackId: string, elementId: string, splitTime: number) => {
      const tracks = getTracks();
      const track = tracks.find((t) => t.id === trackId);
      if (!track) return;

      const elementIndex = (track.elements as TimelineElement[]).findIndex(
        (e) => e.id === elementId
      );
      if (elementIndex === -1) return;

      const el = (track.elements as TimelineElement[])[elementIndex];
      const localTime = splitTime - el.startTime;

      if (localTime <= 0 || localTime >= el.duration - el.trimStart - el.trimEnd) return;

      const firstHalf = {
        ...el,
        id: generateId(),
        duration: localTime + el.trimStart,
        trimEnd: el.trimEnd + (el.duration - el.trimStart - el.trimEnd - localTime),
      };

      const secondHalf = {
        ...el,
        id: generateId(),
        startTime: splitTime,
        trimStart: el.trimStart + localTime,
      };

      const newElements = [...(track.elements as TimelineElement[])];
      newElements.splice(elementIndex, 1, firstHalf as any, secondHalf as any);
      updateTrack(trackId, { elements: newElements } as any);
    },
    [getTracks, updateTrack]
  );

  return { addMediaToTimeline, addTextToTimeline, removeElement, splitElement };
}
