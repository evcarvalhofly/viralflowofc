import { create } from "zustand";

interface PlaybackStore {
  currentTime: number;
  isPlaying: boolean;
  duration: number;
  volume: number;
  isMuted: boolean;

  setCurrentTime: (time: number) => void;
  setIsPlaying: (playing: boolean) => void;
  setDuration: (duration: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  play: () => void;
  pause: () => void;
  togglePlayback: () => void;
  seek: (time: number) => void;
}

export const usePlaybackStore = create<PlaybackStore>()((set, get) => ({
  currentTime: 0,
  isPlaying: false,
  duration: 0,
  volume: 1,
  isMuted: false,

  setCurrentTime: (time) => set({ currentTime: time }),
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  setDuration: (duration) => set({ duration }),
  setVolume: (volume) => set({ volume }),
  toggleMute: () => set((state) => ({ isMuted: !state.isMuted })),
  play: () => set({ isPlaying: true }),
  pause: () => set({ isPlaying: false }),
  togglePlayback: () => set((state) => ({ isPlaying: !state.isPlaying })),
  seek: (time) => {
    set({ currentTime: Math.max(0, Math.min(time, get().duration)) });
  },
}));
