// ============================================================
// AutoCut – Silence/pause detection via Web Audio API (RMS energy)
// ============================================================
import { useState, useCallback } from 'react';
import { Scissors, Zap, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Track, TrackItem, MediaFile } from '../types';
import { createId } from '../store';
import { cn } from '@/lib/utils';

export interface SilenceRegion {
  start: number;
  end: number;
}

interface AutoCutProps {
  tracks: Track[];
  media: MediaFile[];
  onApplyCuts: (regions: SilenceRegion[]) => void;
  onClose: () => void;
}

type Intensity = 'suave' | 'medio' | 'agressivo';

const INTENSITY_CONFIG: Record<Intensity, { threshold: number; minSilence: number; margin: number; label: string; desc: string }> = {
  suave: {
    threshold: 0.02,
    minSilence: 0.5,
    margin: 0.1,
    label: 'Suave',
    desc: 'Remove pausas longas (>0.5s)',
  },
  medio: {
    threshold: 0.03,
    minSilence: 0.3,
    margin: 0.07,
    label: 'Médio',
    desc: 'Remove pausas moderadas (>0.3s)',
  },
  agressivo: {
    threshold: 0.05,
    minSilence: 0.15,
    margin: 0.04,
    label: 'Agressivo',
    desc: 'Remove todas as pausas (>0.15s)',
  },
};

async function detectSilences(
  url: string,
  threshold: number,
  minSilenceDuration: number,
  margin: number
): Promise<SilenceRegion[]> {
  const audioCtx = new AudioContext();
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
  audioCtx.close();

  const channelData = audioBuffer.getChannelData(0);
  const sampleRate = audioBuffer.sampleRate;
  const frameSize = Math.floor(sampleRate * 0.02); // 20ms frames

  const silenceRegions: SilenceRegion[] = [];
  let inSilence = false;
  let silenceStart = 0;

  for (let i = 0; i < channelData.length; i += frameSize) {
    let sum = 0;
    const end = Math.min(i + frameSize, channelData.length);
    for (let j = i; j < end; j++) {
      sum += channelData[j] * channelData[j];
    }
    const rms = Math.sqrt(sum / (end - i));
    const time = i / sampleRate;

    if (rms < threshold) {
      if (!inSilence) {
        inSilence = true;
        silenceStart = time;
      }
    } else {
      if (inSilence) {
        inSilence = false;
        const duration = time - silenceStart;
        if (duration >= minSilenceDuration) {
          silenceRegions.push({
            start: Math.max(0, silenceStart + margin),
            end: Math.max(0, time - margin),
          });
        }
      }
    }
  }

  // Check if audio ends in silence
  if (inSilence) {
    const duration = audioBuffer.duration - silenceStart;
    if (duration >= minSilenceDuration) {
      silenceRegions.push({
        start: Math.max(0, silenceStart + margin),
        end: Math.max(0, audioBuffer.duration - margin),
      });
    }
  }

  return silenceRegions.filter((r) => r.end > r.start + 0.05);
}

export function AutoCut({ tracks, media, onApplyCuts, onClose }: AutoCutProps) {
  const [intensity, setIntensity] = useState<Intensity>('medio');
  const [analyzing, setAnalyzing] = useState(false);
  const [regions, setRegions] = useState<SilenceRegion[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const videoTrack = tracks.find((t) => t.type === 'video');
  const firstVideoItem = videoTrack?.items[0];
  const videoMedia = firstVideoItem ? media.find((m) => m.id === firstVideoItem.mediaId) : null;

  const handleAnalyze = useCallback(async () => {
    if (!videoMedia?.file) {
      setError('Nenhum vídeo encontrado na timeline. Adicione um vídeo primeiro.');
      return;
    }
    setAnalyzing(true);
    setError(null);
    setRegions(null);
    try {
      const cfg = INTENSITY_CONFIG[intensity];
      const found = await detectSilences(videoMedia.url, cfg.threshold, cfg.minSilence, cfg.margin);
      setRegions(found);
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao analisar áudio');
    } finally {
      setAnalyzing(false);
    }
  }, [videoMedia, intensity]);

  const handleApply = useCallback(() => {
    if (!regions) return;
    onApplyCuts(regions);
  }, [regions, onApplyCuts]);

  return (
    <div className="flex flex-col h-full bg-card/30 overflow-y-auto">
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border shrink-0">
        <Scissors className="h-3.5 w-3.5 text-primary" />
        <span className="text-xs font-semibold text-foreground uppercase tracking-wide">Corte Automático</span>
        <button className="ml-auto text-muted-foreground hover:text-foreground text-xs" onClick={onClose}>✕</button>
      </div>

      <div className="p-3 space-y-3">
        <p className="text-[10px] text-muted-foreground">
          Detecta silêncios e pausas no áudio do vídeo e remove automaticamente da timeline.
        </p>

        {/* Intensity selector */}
        <div className="space-y-1.5">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Intensidade</span>
          {(Object.entries(INTENSITY_CONFIG) as [Intensity, typeof INTENSITY_CONFIG[Intensity]][]).map(([key, cfg]) => (
            <button
              key={key}
              className={cn(
                'w-full text-left rounded-lg border px-3 py-2 transition-all',
                intensity === key
                  ? 'border-primary bg-primary/10 text-foreground'
                  : 'border-border text-muted-foreground hover:text-foreground hover:border-border/70'
              )}
              onClick={() => { setIntensity(key); setRegions(null); }}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium">{cfg.label}</span>
                {intensity === key && <div className="w-1.5 h-1.5 rounded-full bg-primary" />}
              </div>
              <p className="text-[9px] mt-0.5 opacity-70">{cfg.desc}</p>
            </button>
          ))}
        </div>

        {error && (
          <div className="rounded-lg bg-destructive/10 border border-destructive/30 px-3 py-2 text-xs text-destructive">
            {error}
          </div>
        )}

        {regions !== null && !analyzing && (
          <div className="rounded-lg bg-muted/50 border border-border px-3 py-2 text-center">
            <p className="text-xs font-semibold text-foreground">
              {regions.length === 0 ? 'Nenhum silêncio detectado' : `${regions.length} regiões encontradas`}
            </p>
            {regions.length > 0 && (
              <p className="text-[9px] text-muted-foreground mt-0.5">
                {regions.reduce((acc, r) => acc + (r.end - r.start), 0).toFixed(1)}s serão removidos
              </p>
            )}
          </div>
        )}

        <Button
          size="sm"
          onClick={handleAnalyze}
          disabled={analyzing || !videoMedia}
          className="w-full gap-1.5 gradient-viral text-white border-0"
        >
          {analyzing ? (
            <>
              <div className="h-3 w-3 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              Analisando…
            </>
          ) : (
            <>
              <Zap className="h-3.5 w-3.5" />
              Analisar Vídeo
            </>
          )}
        </Button>

        {regions && regions.length > 0 && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleApply}
            className="w-full gap-1.5"
          >
            <Scissors className="h-3.5 w-3.5" />
            Aplicar {regions.length} Cortes
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * Apply silence regions to video track items: splits and removes silent segments
 */
export function applySilenceCuts(
  tracks: Track[],
  regions: SilenceRegion[]
): Track[] {
  if (!regions.length) return tracks;

  return tracks.map((track) => {
    if (track.type !== 'video' && track.type !== 'audio') return track;

    let items = [...track.items];

    // For each silence region, split and remove the silent segment
    for (const region of regions) {
      const newItems: TrackItem[] = [];
      for (const item of items) {
        const regionStart = item.startTime + (region.start - item.mediaStart);
        const regionEnd = item.startTime + (region.end - item.mediaStart);

        // Region is outside this item
        if (regionEnd <= item.startTime || regionStart >= item.endTime) {
          newItems.push(item);
          continue;
        }

        // Region overlaps — split: keep left side, skip region, keep right side
        const leftEnd = Math.max(item.startTime, regionStart);
        const rightStart = Math.min(item.endTime, regionEnd);
        const cutDuration = rightStart - leftEnd;

        if (leftEnd > item.startTime + 0.05) {
          const leftMediaEnd = item.mediaStart + (leftEnd - item.startTime);
          newItems.push({ ...item, id: createId(), endTime: leftEnd, mediaEnd: leftMediaEnd });
        }

        if (item.endTime > rightStart + 0.05) {
          const rightMediaStart = item.mediaStart + (rightStart - item.startTime);
          // Shift start time back by cut duration
          newItems.push({
            ...item,
            id: createId(),
            startTime: leftEnd,
            endTime: item.endTime - cutDuration,
            mediaStart: rightMediaStart,
          });
        }
      }
      items = newItems;
    }

    return { ...track, items };
  });
}
