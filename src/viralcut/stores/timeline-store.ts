import { create } from "zustand";
import { persist } from "zustand/middleware";

interface TimelineStore {
  snappingEnabled: boolean;
  toggleSnapping: () => void;
  selectedElementId: string | null;
  selectedTrackId: string | null;
  setSelectedElement: (elementId: string | null, trackId: string | null) => void;
  pixelsPerSecond: number;
  setPixelsPerSecond: (pps: number) => void;
  zoomLevel: number;
  setZoomLevel: (level: number) => void;
}

export const useTimelineStore = create<TimelineStore>()(
  persist(
    (set) => ({
      snappingEnabled: true,
      toggleSnapping: () => set((state) => ({ snappingEnabled: !state.snappingEnabled })),
      selectedElementId: null,
      selectedTrackId: null,
      setSelectedElement: (elementId, trackId) =>
        set({ selectedElementId: elementId, selectedTrackId: trackId }),
      pixelsPerSecond: 100,
      setPixelsPerSecond: (pps) => set({ pixelsPerSecond: pps }),
      zoomLevel: 1,
      setZoomLevel: (level) => set({ zoomLevel: level }),
    }),
    {
      name: "viralcut-timeline",
      partialize: (state) => ({
        snappingEnabled: state.snappingEnabled,
        pixelsPerSecond: state.pixelsPerSecond,
        zoomLevel: state.zoomLevel,
      }),
    }
  )
);
