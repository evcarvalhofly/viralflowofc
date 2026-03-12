// ============================================================
// ViralCut – Text Clip Mapper
// Converts a ViralCut TrackItem (text) into a core.TextClip.
// fontSize in ViralCut is % of canvas height.
// posX/posY are % of canvas dimensions.
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

  const pxX = ((td.posX) / 100) * project.width;
  const pxY = ((td.posY) / 100) * project.height;

  const clip = new core.TextClip({
    text: td.text,
    delay: item.startTime,
    duration,
    x: pxX,
    y: pxY,
    fontSize: fontSizePx,
    fontFamily: td.fontFamily,
    color: td.color,
    opacity: td.opacity,
    align: td.textAlign as 'left' | 'center' | 'right',
    ...(td.backgroundColor && td.backgroundColor !== 'transparent'
      ? { background: { color: td.backgroundColor, padding: 4 } }
      : {}),
  });

  return clip;
}
