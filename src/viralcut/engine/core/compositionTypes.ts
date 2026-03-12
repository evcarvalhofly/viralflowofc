// ============================================================
// ViralCut – Internal Composition Types
// Internal representation used by the export/preview engines.
// Decoupled from the UI timeline model.
// ============================================================

export type CompositionItemType = 'video' | 'audio' | 'image' | 'text';

export interface TextStyle {
  text: string;
  fontSize: number;       // % of canvas height
  fontFamily: string;
  color: string;
  textAlign: 'left' | 'center' | 'right';
  opacity: number;
  backgroundColor: string;
  boxShadow: { color: string; x: number; y: number; blur: number };
  posX: number;           // % of canvas width
  posY: number;           // % of canvas height
  width: number;          // % of canvas width
}

export interface VideoProps {
  volume: number;
  opacity: number;
  flipH: boolean;
  flipV: boolean;
  playbackRate: number;
  brightness: number;
  contrast: number;
  saturation: number;
}

export interface AudioProps {
  volume: number;
  playbackRate: number;
  fadeIn: number;
  fadeOut: number;
}

export interface ImageProps {
  opacity: number;
  flipH: boolean;
  flipV: boolean;
  posX: number;   // % of canvas width (center)
  posY: number;   // % of canvas height (center)
  width: number;  // % of canvas width
  height: number; // % of canvas height
  brightness: number;
  contrast: number;
  saturation: number;
}

export interface CompositionItem {
  id: string;
  type: CompositionItemType;
  /** Reference to the source File object */
  sourceFile?: File;
  /** Blob URL for the source */
  sourceUrl: string;
  /** Timeline position: when this item starts playing (seconds) */
  startTime: number;
  /** Timeline position: when this item ends (seconds) */
  endTime: number;
  /** Where in the source media to start reading from (trim-start) */
  mediaStart: number;
  /** Where in the source media to stop reading (trim-end) */
  mediaEnd: number;
  /** Z-order for composition (higher = on top) */
  zIndex: number;
  /** Human-readable label */
  name: string;
  // Type-specific properties
  videoProps?: VideoProps;
  audioProps?: AudioProps;
  imageProps?: ImageProps;
  textStyle?: TextStyle;
}

export interface Composition {
  width: number;
  height: number;
  fps: 30 | 60;
  duration: number;
  aspectRatio: string;
  items: CompositionItem[];
}
