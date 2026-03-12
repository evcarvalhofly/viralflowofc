import { create } from "zustand";
import { persist } from "zustand/middleware";

interface PanelSizes {
  tools: number;
  preview: number;
  properties: number;
  mainContent: number;
  timeline: number;
}

const DEFAULT_PANELS: PanelSizes = {
  tools: 18,
  preview: 45,
  properties: 37,
  mainContent: 65,
  timeline: 35,
};

interface PanelStore {
  panels: PanelSizes;
  setPanel: (panel: keyof PanelSizes, size: number) => void;
  resetPanels: () => void;
}

export const usePanelStore = create<PanelStore>()(
  persist(
    (set) => ({
      panels: { ...DEFAULT_PANELS },
      setPanel: (panel, size) =>
        set((state) => ({ panels: { ...state.panels, [panel]: size } })),
      resetPanels: () => set({ panels: { ...DEFAULT_PANELS } }),
    }),
    { name: "viralcut-panels" }
  )
);
