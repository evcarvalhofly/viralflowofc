// ============================================================
// ViralCut – FFmpeg Export Validator
// Strict pre-flight checks before launching the FFmpeg pipeline.
// ============================================================
import { Project, MediaFile } from '../types';

export const EXPORT_MIN_CLIP_DURATION = 0.08; // seconds

export function validateProjectForFFmpegExport(
  project: Project,
  mediaMap: Map<string, MediaFile>
): void {
  const videoTracks = project.tracks.filter((t) => t.type === 'video' && !t.muted);
  const hasVideoItems = videoTracks.some((t) => t.items.length > 0);
  if (!hasVideoItems) {
    throw new Error('Nenhum vídeo na timeline para exportar.');
  }

  for (const track of project.tracks) {
    if (track.muted) continue;
    for (const item of track.items) {
      if (!Number.isFinite(item.startTime) || !Number.isFinite(item.endTime)) {
        throw new Error(`Tempo inválido no clipe "${item.name}". Remova e tente novamente.`);
      }
      if (!Number.isFinite(item.mediaStart) || !Number.isFinite(item.mediaEnd)) {
        throw new Error(`Trim inválido no clipe "${item.name}". Ajuste os pontos de corte.`);
      }
      const dur = item.endTime - item.startTime;
      if (dur < EXPORT_MIN_CLIP_DURATION) {
        throw new Error(`Clipe muito curto: "${item.name}" (${dur.toFixed(3)}s). Mínimo: ${EXPORT_MIN_CLIP_DURATION}s.`);
      }
      if (item.mediaEnd <= item.mediaStart) {
        throw new Error(`Trim inválido: "${item.name}" — fim do trim antes do início.`);
      }
      if (item.type !== 'text' && item.mediaId) {
        const mf = mediaMap.get(item.mediaId);
        if (!mf) {
          throw new Error(`Mídia não encontrada para o clipe "${item.name}". Reimporte o arquivo.`);
        }
      }
    }
  }
}
