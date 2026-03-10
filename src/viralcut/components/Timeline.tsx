import { useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.esm.js';
import { SilenceRange, Segment } from '../types';
import { cn } from '@/lib/utils';

interface TimelineProps {
  audioUrl: string;
  silences: SilenceRange[];
  keepSegments: Segment[];
  currentTime: number;
  duration: number;
  onSeek?: (t: number) => void;
}

export function Timeline({
  audioUrl,
  silences,
  keepSegments,
  currentTime,
  duration,
  onSeek,
}: TimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WaveSurfer | null>(null);
  const regionsRef = useRef<ReturnType<typeof RegionsPlugin.create> | null>(null);
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);

  // Init WaveSurfer
  useEffect(() => {
    if (!containerRef.current || !audioUrl) return;

    setLoading(true);
    setReady(false);

    const regions = RegionsPlugin.create();
    regionsRef.current = regions;

    const ws = WaveSurfer.create({
      container: containerRef.current,
      url: audioUrl,
      height: 80,
      normalize: true,
      waveColor: 'hsl(262, 83%, 45%)',
      progressColor: 'hsl(262, 83%, 65%)',
      cursorColor: 'hsl(330, 81%, 65%)',
      cursorWidth: 2,
      minPxPerSec: 40,
      interact: true,
      plugins: [regions],
    });

    wsRef.current = ws;

    ws.on('ready', () => {
      setLoading(false);
      setReady(true);
    });

    ws.on('interaction', (t) => {
      onSeek?.(t);
    });

    return () => {
      ws.destroy();
      wsRef.current = null;
      regionsRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioUrl]);

  // Paint silence regions when silences/ws changes
  useEffect(() => {
    const regions = regionsRef.current;
    if (!regions || !ready) return;

    // Clear old regions
    regions.clearRegions();

    // Paint removed (silence) regions in red
    silences.forEach((s) => {
      regions.addRegion({
        start: s.start,
        end: s.end,
        drag: false,
        resize: false,
        color: 'rgba(239, 68, 68, 0.22)',
      });
    });

    // Paint keep regions in green
    keepSegments.forEach((seg) => {
      regions.addRegion({
        start: seg.start,
        end: seg.end,
        drag: false,
        resize: false,
        color: 'rgba(34, 197, 94, 0.08)',
      });
    });
  }, [silences, keepSegments, ready]);

  // Sync playhead
  useEffect(() => {
    if (!wsRef.current || !ready || duration <= 0) return;
    const pct = currentTime / duration;
    wsRef.current.seekTo(Math.min(1, Math.max(0, pct)));
  }, [currentTime, duration, ready]);

  return (
    <div className="rounded-xl bg-card border border-border p-3 space-y-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="font-medium text-foreground">Timeline</span>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-3 rounded-sm bg-red-500/60" />
            Removido
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-3 rounded-sm bg-green-500/60" />
            Mantido
          </span>
        </div>
      </div>

      <div className="relative">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground z-10 bg-card/80 rounded-lg">
            Carregando waveform…
          </div>
        )}
        <div
          ref={containerRef}
          className={cn(
            'rounded-lg overflow-hidden transition-opacity',
            loading && 'opacity-0'
          )}
        />
      </div>

      {!loading && silences.length > 0 && (
        <p className="text-xs text-muted-foreground">
          <span className="text-red-400 font-medium">{silences.length}</span> silêncio
          {silences.length !== 1 ? 's' : ''} detectado
          {silences.length !== 1 ? 's' : ''}
        </p>
      )}
    </div>
  );
}
