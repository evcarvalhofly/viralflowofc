// ViralCut Timeline Types — adapted from OpenCut

export type TrackType = "video" | "audio" | "text" | "image";

export interface BaseTimelineElement {
  id: string;
  name: string;
  duration: number;
  startTime: number;
  trimStart: number;
  trimEnd: number;
  sourceDuration?: number;
}

export interface VideoElement extends BaseTimelineElement {
  type: "video";
  mediaId: string;
  muted?: boolean;
  hidden?: boolean;
  opacity: number;
  transform: Transform;
}

export interface ImageElement extends BaseTimelineElement {
  type: "image";
  mediaId: string;
  hidden?: boolean;
  opacity: number;
  transform: Transform;
}

export interface AudioElement extends BaseTimelineElement {
  type: "audio";
  mediaId: string;
  volume: number;
  muted?: boolean;
}

export interface TextBackground {
  enabled: boolean;
  color: string;
  cornerRadius?: number;
  paddingX?: number;
  paddingY?: number;
}

export interface TextElement extends BaseTimelineElement {
  type: "text";
  content: string;
  fontSize: number;
  fontFamily: string;
  color: string;
  background: TextBackground;
  textAlign: "left" | "center" | "right";
  fontWeight: "normal" | "bold";
  fontStyle: "normal" | "italic";
  textDecoration: "none" | "underline" | "line-through";
  letterSpacing?: number;
  lineHeight?: number;
  hidden?: boolean;
  opacity: number;
  transform: Transform;
}

export interface Transform {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
}

export type TimelineElement = VideoElement | ImageElement | AudioElement | TextElement;
export type ElementType = TimelineElement["type"];

export interface VideoTrack {
  id: string;
  type: "video";
  name: string;
  elements: (VideoElement | ImageElement)[];
  isMain: boolean;
  muted: boolean;
  hidden: boolean;
}

export interface AudioTrack {
  id: string;
  type: "audio";
  name: string;
  elements: AudioElement[];
  muted: boolean;
}

export interface TextTrack {
  id: string;
  type: "text";
  name: string;
  elements: TextElement[];
  hidden: boolean;
}

export type TimelineTrack = VideoTrack | AudioTrack | TextTrack;

export interface ElementDragState {
  isDragging: boolean;
  elementId: string | null;
  trackId: string | null;
  startMouseX: number;
  startElementTime: number;
  clickOffsetTime: number;
  currentTime: number;
}
