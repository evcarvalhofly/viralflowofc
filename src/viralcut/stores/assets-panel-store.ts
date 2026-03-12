import { create } from "zustand";
import { persist } from "zustand/middleware";

export type AssetTab =
  | "media"
  | "audio"
  | "text"
  | "effects"
  | "settings";

interface AssetsPanelStore {
  activeTab: AssetTab;
  setActiveTab: (tab: AssetTab) => void;
}

export const useAssetsPanelStore = create<AssetsPanelStore>()(
  persist(
    (set) => ({
      activeTab: "media",
      setActiveTab: (tab) => set({ activeTab: tab }),
    }),
    { name: "viralcut-assets-panel" }
  )
);
