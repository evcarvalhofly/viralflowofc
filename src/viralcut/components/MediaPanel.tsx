// ============================================================
// MediaPanel – Library of imported files
// ============================================================
import { useRef } from 'react';
import { Plus, Film, Music, Image, Trash2, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MediaFile } from '../types';
import { cn } from '@/lib/utils';

interface MediaPanelProps {
  media: MediaFile[];
  selectedMediaId: string | null;
  onImport: (files: FileList) => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onAddToTimeline: (id: string) => void;
}

function fmt(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
}

function MediaIcon({ type }: { type: MediaFile['type'] }) {
  if (type === 'video') return <Film className="h-3.5 w-3.5" />;
  if (type === 'audio') return <Music className="h-3.5 w-3.5" />;
  return <Image className="h-3.5 w-3.5" />;
}

export function MediaPanel({
  media,
  selectedMediaId,
  onImport,
  onSelect,
  onDelete,
  onAddToTimeline,
}: MediaPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border shrink-0">
        <span className="text-xs font-semibold text-foreground uppercase tracking-wide">Mídia</span>
        <Button
          size="sm"
          onClick={() => inputRef.current?.click()}
          className="h-7 px-2.5 text-xs gap-1.5 gradient-viral text-white border-0"
        >
          <Plus className="h-3.5 w-3.5" />
          Importar
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="video/*,audio/*,image/*"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && onImport(e.target.files)}
        />
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {media.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center h-32 border-2 border-dashed border-border rounded-xl text-center p-4 cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => inputRef.current?.click()}
          >
            <Plus className="h-6 w-6 text-muted-foreground mb-1.5" />
            <p className="text-xs text-muted-foreground">Clique ou arraste arquivos</p>
          </div>
        ) : (
          media.map((m) => (
            <div
              key={m.id}
              className={cn(
                'group flex items-center gap-2 rounded-lg p-2 cursor-pointer border transition-all',
                selectedMediaId === m.id
                  ? 'border-primary/60 bg-primary/10'
                  : 'border-transparent hover:bg-muted/60'
              )}
              onClick={() => onSelect(m.id)}
            >
              {/* Thumbnail / icon */}
              <div className="w-12 h-9 rounded-md bg-muted shrink-0 overflow-hidden flex items-center justify-center relative">
                {m.thumbnail ? (
                  <img src={m.thumbnail} className="w-full h-full object-cover" alt="" />
                ) : (
                  <MediaIcon type={m.type} />
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground truncate">{m.name}</p>
                {m.duration > 0 && (
                  <p className="text-[10px] text-muted-foreground flex items-center gap-0.5 mt-0.5">
                    <Clock className="h-2.5 w-2.5" />
                    {fmt(m.duration)}
                  </p>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  className="p-1 rounded hover:bg-primary/20 text-primary transition-colors"
                  title="Adicionar à timeline"
                  onClick={(e) => { e.stopPropagation(); onAddToTimeline(m.id); }}
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
                <button
                  className="p-1 rounded hover:bg-destructive/20 text-destructive transition-colors"
                  title="Remover"
                  onClick={(e) => { e.stopPropagation(); onDelete(m.id); }}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
