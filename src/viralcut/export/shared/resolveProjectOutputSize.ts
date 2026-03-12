// ============================================================
// ViralCut – Shared Output Size Resolver
//
// Single source of truth for export dimensions.
// Preserves the project's real aspect ratio (9:16, 1:1, 4:5, 16:9…)
// and scales to the chosen resolution long-side.
// ============================================================
import { Project } from '@/viralcut/types';

export type ExportResolution = '720p' | '1080p';

/** Round up to nearest even integer (required by H.264) */
function even(n: number): number {
  const v = Math.max(2, Math.round(n));
  return v % 2 === 0 ? v : v - 1;
}

/**
 * Resolves output width/height for a project + resolution combo.
 *
 * Rules:
 *  - The long side of the project maps to 1920 (1080p) or 1280 (720p).
 *  - The short side is calculated from the real aspect ratio.
 *  - Both dimensions are clamped to even integers (H.264 requirement).
 *  - 9:16 → stays 9:16  |  1:1 → stays 1:1  |  16:9 → stays 16:9
 */
export function resolveProjectOutputSize(
  project: Project,
  resolution: ExportResolution
): { width: number; height: number } {
  const srcW = project.width  || 1920;
  const srcH = project.height || 1080;

  const longSide = resolution === '1080p' ? 1920 : 1280;
  const scale    = longSide / Math.max(srcW, srcH);

  return {
    width:  even(srcW * scale),
    height: even(srcH * scale),
  };
}
