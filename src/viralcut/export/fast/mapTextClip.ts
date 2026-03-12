// ============================================================
// ViralCut – Text Clip Mapper
// Converts a ViralCut TrackItem (text) into a core.TextClip.
// fontSize in ViralCut is % of canvas height.
// posX/posY are % of canvas dimensions.
// Uses the REAL @diffusionstudio/core TextClipProps API:
//   - font: { size, family } (NOT fontFamily directly)
//   - color: `#${string}` hex
//   - background.color: `#${string}` hex
// ============================================================
import * as core from '@diffusionstudio/core';
import { TrackItem, Project } from '@/viralcut/types';

export async function mapTextClip(
  item: TrackItem,
  project: Project
): Promise<core.TextClip | null> {
  const td = item.textDetails;
  if (!td) return null;

  const duration = item.endTime - item.startTime;
  const fontSizePx = Math.round((td.fontSize / 100) * project.height);

  const pxX = (td.posX / 100) * project.width;
  const pxY = (td.posY / 100) * project.height;

  // Ensure color is valid hex
  const safeColor = (td.color?.startsWith('#') ? td.color : '#ffffff') as `#${string}`;

  const clip = new core.TextClip({
    text: td.text,
    delay: item.startTime,
    duration,
    x: pxX,
    y: pxY,
    // font is a Font object: { size, family }
    font: {
      size: fontSizePx,
      family: td.fontFamily || 'sans-serif',
    },
    color: safeColor,
    opacity: td.opacity,
    align: td.textAlign as 'left' | 'center' | 'right',
    ...(td.backgroundColor && td.backgroundColor !== 'transparent'
      ? {
          background: {
            fill: (td.backgroundColor.startsWith('#')
              ? td.backgroundColor
              : '#000000') as `#${string}`,
            padding: { x: 8, y: 4 },
          },
        }
      : {}),
  });

  return clip;
}
