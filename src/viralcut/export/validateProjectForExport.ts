// ============================================================
// ViralCut – Pre-export validator (strict)
// ============================================================
import { Project } from '../types';
import { MediaFile } from '../types';

export const EXPORT_MIN_CLIP_DURATION = 0.10; // seconds

export function validateProjectForContinuousExport(
  project: Project,
  media: MediaFile[]
): void {
  const mediaMap = new Map(media.map((m) => [m.id, m]));

  const videoTracks = project.tracks.filter((t) => t.type === 'video' && !t.muted);
  const hasVideoContent = videoTracks.some((t) => t.items.length > 0);
  if (!hasVideoContent) {
    throw new Error('Nenhum vídeo na timeline para exportar.');
  }

  for (const track of project.tracks) {
    for (const item of track.items) {
      if (!Number.isFinite(item.startTime) || !Number.isFinite(item.endTime)) {
        throw new Error(`Item com tempo inválido: "${item.name}". Remova-o e tente novamente.`);
      }
      if (item.startTime < 0) {
        throw new Error(`Item com tempo negativo: "${item.name}".`);
      }
      const duration = item.endTime - item.startTime;
      if (duration < EXPORT_MIN_CLIP_DURATION) {
        throw new Error(
          `Clipe muito curto: "${item.name}" (${duration.toFixed(3)}s). Mínimo: ${EXPORT_MIN_CLIP_DURATION}s.`
        );
      }
      if (!Number.isFinite(item.mediaStart) || !Number.isFinite(item.mediaEnd)) {
        throw new Error(`Trim inválido no clipe: "${item.name}".`);
      }
      if (item.mediaEnd <= item.mediaStart) {
        throw new Error(`Trim inválido no clipe: "${item.name}". Ajuste os pontos de corte.`);
      }
      // Check media reference for non-text items
      if (item.type !== 'text' && item.mediaId) {
        if (!mediaMap.has(item.mediaId)) {
          throw new Error(`Mídia não encontrada para o clipe: "${item.name}". Reimporte o arquivo.`);
        }
      }
    }
  }
}
