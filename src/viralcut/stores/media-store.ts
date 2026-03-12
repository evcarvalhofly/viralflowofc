import { create } from "zustand";
import type { MediaAsset, MediaType } from "../types/media";

function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

async function getVideoMetadata(file: File): Promise<{ duration: number; width: number; height: number }> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      resolve({
        duration: video.duration,
        width: video.videoWidth,
        height: video.videoHeight,
      });
      URL.revokeObjectURL(video.src);
    };
    video.onerror = () => resolve({ duration: 0, width: 0, height: 0 });
    video.src = URL.createObjectURL(file);
  });
}

async function getAudioDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const audio = document.createElement("audio");
    audio.preload = "metadata";
    audio.onloadedmetadata = () => {
      resolve(audio.duration);
      URL.revokeObjectURL(audio.src);
    };
    audio.onerror = () => resolve(0);
    audio.src = URL.createObjectURL(file);
  });
}

async function generateVideoThumbnail(file: File): Promise<string> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.onloadeddata = () => {
      video.currentTime = Math.min(1, video.duration * 0.1);
    };
    video.onseeked = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 160;
      canvas.height = 90;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0, 160, 90);
        resolve(canvas.toDataURL("image/jpeg", 0.7));
      } else {
        resolve("");
      }
      URL.revokeObjectURL(video.src);
    };
    video.onerror = () => resolve("");
    video.src = URL.createObjectURL(file);
  });
}

interface MediaStore {
  assets: MediaAsset[];
  isLoading: boolean;

  addFiles: (files: File[]) => Promise<MediaAsset[]>;
  removeAsset: (id: string) => void;
  getAsset: (id: string) => MediaAsset | undefined;
  getAssets: () => MediaAsset[];
  clearAll: () => void;
}

export const useMediaStore = create<MediaStore>()((set, get) => ({
  assets: [],
  isLoading: false,

  addFiles: async (files: File[]) => {
    set({ isLoading: true });
    const newAssets: MediaAsset[] = [];

    for (const file of files) {
      const type: MediaType = file.type.startsWith("video/")
        ? "video"
        : file.type.startsWith("audio/")
        ? "audio"
        : "image";

      const url = URL.createObjectURL(file);
      const asset: MediaAsset = {
        id: generateId(),
        name: file.name,
        type,
        url,
        file,
        size: file.size,
        createdAt: new Date().toISOString(),
      };

      if (type === "video") {
        const meta = await getVideoMetadata(file);
        asset.duration = meta.duration;
        asset.width = meta.width;
        asset.height = meta.height;
        asset.thumbnail = await generateVideoThumbnail(file);
      } else if (type === "audio") {
        asset.duration = await getAudioDuration(file);
      } else {
        // image
        await new Promise<void>((resolve) => {
          const img = new Image();
          img.onload = () => {
            asset.width = img.naturalWidth;
            asset.height = img.naturalHeight;
            asset.thumbnail = url;
            resolve();
          };
          img.onerror = () => resolve();
          img.src = url;
        });
      }

      newAssets.push(asset);
    }

    set((state) => ({ assets: [...state.assets, ...newAssets], isLoading: false }));
    return newAssets;
  },

  removeAsset: (id) => {
    set((state) => {
      const asset = state.assets.find((a) => a.id === id);
      if (asset) URL.revokeObjectURL(asset.url);
      return { assets: state.assets.filter((a) => a.id !== id) };
    });
  },

  getAsset: (id) => get().assets.find((a) => a.id === id),

  getAssets: () => get().assets,

  clearAll: () => {
    get().assets.forEach((a) => URL.revokeObjectURL(a.url));
    set({ assets: [] });
  },
}));
