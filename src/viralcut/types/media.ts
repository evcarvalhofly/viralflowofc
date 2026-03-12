export type MediaType = "video" | "audio" | "image";

export interface MediaAsset {
  id: string;
  name: string;
  type: MediaType;
  url: string;         // object URL
  file: File;
  duration?: number;   // for video/audio
  width?: number;
  height?: number;
  thumbnail?: string;
  size: number;
  createdAt: string;
}
