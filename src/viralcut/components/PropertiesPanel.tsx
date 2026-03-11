// ============================================================
// PropertiesPanel – Right-side inspector
// ============================================================
import { TrackItem, MediaFile } from '../types';
import { Sliders } from 'lucide-react';

interface PropertiesPanelProps {
  selectedItem: TrackItem | null;
  media: MediaFile[];
}

function fmt(s: number) {
  const m = Math.floor(s / 60);
  const sec = (s % 60).toFixed(2);
  return `${m}:${String(Math.floor(+sec)).padStart(2, '0')}.${String(Math.round((+sec % 1) * 100)).padStart(2, '0')}`;
}

export function PropertiesPanel({ selectedItem, media }: PropertiesPanelProps) {
  const m = selectedItem ? media.find((x) => x.id === selectedItem.mediaId) : null;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border shrink-0">
        <Sliders className="h-3.5 w-3.5 text-primary" />
        <span className="text-xs font-semibold text-foreground uppercase tracking-wide">Propriedades</span>
      </div>

      {selectedItem && m ? (
        <div className="p-3 space-y-3 overflow-y-auto flex-1">
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Clipe</p>
            <p className="text-xs font-medium text-foreground truncate">{selectedItem.name}</p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Início', value: fmt(selectedItem.startTime) },
              { label: 'Fim', value: fmt(selectedItem.endTime) },
              { label: 'Duração', value: fmt(selectedItem.endTime - selectedItem.startTime) },
              { label: 'Tipo', value: m.type.toUpperCase() },
            ].map((p) => (
              <div key={p.label} className="rounded-lg bg-muted/60 p-2">
                <p className="text-[9px] text-muted-foreground uppercase tracking-wide">{p.label}</p>
                <p className="text-xs font-mono font-medium text-foreground mt-0.5">{p.value}</p>
              </div>
            ))}
          </div>

          {m.width && m.height && (
            <div className="rounded-lg bg-muted/60 p-2">
              <p className="text-[9px] text-muted-foreground uppercase tracking-wide">Resolução</p>
              <p className="text-xs font-mono font-medium text-foreground mt-0.5">{m.width}×{m.height}</p>
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-center p-4">
          <div className="text-muted-foreground/50">
            <Sliders className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p className="text-xs">Selecione um clipe na timeline</p>
          </div>
        </div>
      )}
    </div>
  );
}
