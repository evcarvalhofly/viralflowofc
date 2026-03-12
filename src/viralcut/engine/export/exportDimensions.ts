// ============================================================
// ViralCut – Export Dimensions Utility
// Single source of truth for output size calculations.
// ============================================================
import type { Composition } from '../core/compositionTypes';

/** Round to nearest even integer (H.264 requirement) */
export function even(n: number): number {
  const v = Math.max(2, Math.round(n));
  return v % 2 === 0 ? v : v - 1;
}

export type ExportResolution = '720p' | '1080p';

/**
 * Computes output dimensions preserving the project's aspect ratio.
 * The long side is mapped to 1920 (1080p) or 1280 (720p).
 */
export function resolveExportDimensions(
  composition: Composition,
  resolution: ExportResolution
): { width: number; height: number } {
  const srcW = composition.width  || 1920;
  const srcH = composition.height || 1080;
  const longSide = resolution === '1080p' ? 1920 : 1280;
  const scale    = longSide / Math.max(srcW, srcH);
  return {
    width:  even(srcW * scale),
    height: even(srcH * scale),
  };
}
