// ============================================================
// PropertiesPanel – Right-side inspector with trim controls
// ============================================================
import { TrackItem, MediaFile } from '../types';
import { Sliders, Scissors, Trash2, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PropertiesPanelProps {
  selectedItem: TrackItem | null;
  selectedTrackId: string | null;
  media: MediaFile[];
  onDelete: (trackId: string, itemId: string) => void;
  onSplit: (trackId: string, itemId: string, atTime: number) => void;
  currentTime: number;
}

function fmt(s: number) {
  const m = Math.floor(s / 60);
  const sec = (s % 60).toFixed(2);
  return `${m}:${String(Math.floor(+sec)).padStart(2, '0')}.${String(Math.round((+sec % 1) * 100)).padStart(2, '0')}`;
}

export function PropertiesPanel({
  selectedItem,
  selectedTrackId,
  media,
  onDelete,
  onSplit,
  currentTime,
}: PropertiesPanelProps) {
  const m = selectedItem ? media.find((x) => x.id === selectedItem.mediaId) : null;
  const clipDur = selectedItem ? selectedItem.endTime - selectedItem.startTime : 0;
  const canSplit = selectedItem && selectedTrackId &&
    currentTime > selectedItem.startTime && currentTime < selectedItem.endTime;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border shrink-0">
        <Sliders className="h-3.5 w-3.5 text-primary" />
        <span className="text-xs font-semibold text-foreground uppercase tracking-wide">Propriedades</span>
      </div>

      {selectedItem && m ? (
        <div className="p-3 space-y-3 overflow-y-auto flex-1">
          {/* Clip name */}
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Clipe</p>
            <p className="text-xs font-medium text-foreground truncate">{selectedItem.name}</p>
          </div>

          {/* Time info */}
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Início', value: fmt(selectedItem.startTime) },
              { label: 'Fim', value: fmt(selectedItem.endTime) },
              { label: 'Duração', value: fmt(clipDur) },
              { label: 'Tipo', value: m.type.toUpperCase() },
            ].map((p) => (
              <div key={p.label} className="rounded-lg bg-muted/60 p-2">
                <p className="text-[9px] text-muted-foreground uppercase tracking-wide">{p.label}</p>
                <p className="text-xs font-mono font-medium text-foreground mt-0.5">{p.value}</p>
              </div>
            ))}
          </div>

          {/* Trim info */}
          <div className="rounded-lg bg-muted/60 p-2 space-y-1">
            <p className="text-[9px] text-muted-foreground uppercase tracking-wide">Recorte na mídia</p>
            <div className="flex justify-between text-xs font-mono text-foreground/80">
              <span>{fmt(selectedItem.mediaStart)}</span>
              <span className="text-muted-foreground">→</span>
              <span>{fmt(selectedItem.mediaEnd)}</span>
            </div>
          </div>

          {/* Resolution */}
          {m.width && m.height && (
            <div className="rounded-lg bg-muted/60 p-2">
              <p className="text-[9px] text-muted-foreground uppercase tracking-wide">Resolução</p>
              <p className="text-xs font-mono font-medium text-foreground mt-0.5">{m.width}×{m.height}</p>
            </div>
          )}

          {/* Actions */}
          <div className="space-y-2 pt-1">
            <Button
              size="sm"
              variant="outline"
              className="w-full h-7 text-xs gap-1.5"
              disabled={!canSplit}
              title={canSplit ? 'Dividir no playhead' : 'Mova o playhead sobre este clipe'}
              onClick={() => canSplit && onSplit(selectedTrackId!, selectedItem.id, currentTime)}
            >
              <Scissors className="h-3 w-3" />
              Dividir no Playhead
            </Button>
            <Button
              size="sm"
              variant="destructive"
              className="w-full h-7 text-xs gap-1.5"
              onClick={() => selectedTrackId && onDelete(selectedTrackId, selectedItem.id)}
            >
              <Trash2 className="h-3 w-3" />
              Remover Clipe
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-center p-4">
          <div className="text-muted-foreground/50">
            <Sliders className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p className="text-xs">Selecione um clipe na timeline</p>
            <p className="text-[10px] mt-1 opacity-60">Clique sobre um clipe para ver as propriedades e opções de edição</p>
          </div>
        </div>
      )}
    </div>
  );
}
