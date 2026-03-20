// ============================================================
// MediaPanel – Library with Tabs: Uploads, Text, Shapes, Transitions
// ============================================================
import { useRef, useState } from 'react';
import { Plus, Film, Music, Image, Trash2, Clock, Type, Shapes, Layers, Upload, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MediaFile, TrackItem, DEFAULT_TEXT_DETAILS } from '../types';
import { cn } from '@/lib/utils';

type Tab = 'uploads' | 'text' | 'shapes' | 'transitions';

interface MediaPanelProps {
  media: MediaFile[];
  selectedMediaId: string | null;
  onImport: (files: FileList) => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onAddToTimeline: (id: string) => void;
  onAddOverlay?: (id: string) => void;
  onAddText: (preset: Partial<typeof DEFAULT_TEXT_DETAILS>) => void;
  onAddShape: (shape: 'rect' | 'circle' | 'triangle') => void;
  onAddTransition: (type: string) => void;
  defaultTab?: Tab;
  isOverlayMode?: boolean;
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

// fontSize is stored as % of canvas height (e.g. 3.5 = 3.5% of height)
const TEXT_PRESETS = [
  { label: 'Título', fontSize: 6, fontFamily: 'Inter, sans-serif', color: '#ffffff', textAlign: 'center' as const, posY: 50 },
  { label: 'Subtítulo', fontSize: 4, fontFamily: 'Inter, sans-serif', color: '#e2e8f0', textAlign: 'center' as const, posY: 70 },
  { label: 'Legenda', fontSize: 3.5, fontFamily: 'Inter, sans-serif', color: '#ffffff', textAlign: 'center' as const, posY: 88, backgroundColor: 'rgba(0,0,0,0.6)' },
  { label: 'Destaque', fontSize: 5, fontFamily: 'Inter, sans-serif', color: '#f472b6', textAlign: 'center' as const, posY: 50 },
];

const TRANSITIONS = [
  { id: 'fade', label: 'Fade', icon: '◉' },
  { id: 'wipe', label: 'Wipe', icon: '▶' },
  { id: 'slide', label: 'Slide', icon: '→' },
  { id: 'zoom', label: 'Zoom', icon: '⊕' },
];

export function MediaPanel({
  media,
  selectedMediaId,
  onImport,
  onSelect,
  onDelete,
  onAddToTimeline,
  onAddOverlay,
  onAddText,
  onAddShape,
  onAddTransition,
  defaultTab = 'uploads',
  isOverlayMode = false,
}: MediaPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<Tab>(defaultTab);

  const tabs: { id: Tab; icon: React.ReactNode; label: string }[] = [
    { id: 'uploads', icon: <Upload className="h-3.5 w-3.5" />, label: 'Mídia' },
    { id: 'text', icon: <Type className="h-3.5 w-3.5" />, label: 'Texto' },
    { id: 'shapes', icon: <Shapes className="h-3.5 w-3.5" />, label: 'Formas' },
    { id: 'transitions', icon: <Layers className="h-3.5 w-3.5" />, label: 'Trans.' },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex border-b border-border shrink-0 bg-card/80">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={cn(
              'flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors',
              activeTab === tab.id
                ? 'text-primary border-b-2 border-primary'
                : 'text-muted-foreground hover:text-foreground'
            )}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">

        {/* ── Uploads tab ── */}
        {activeTab === 'uploads' && (
          <div className="p-2 space-y-2">
            <Button
              size="sm"
              onClick={() => inputRef.current?.click()}
              className="w-full h-8 text-xs gap-1.5 gradient-viral text-white border-0"
            >
              <Plus className="h-3.5 w-3.5" />
              Importar Arquivo
            </Button>
            <input
              ref={inputRef}
              type="file"
              accept="video/*,audio/*,image/*"
              multiple
              className="hidden"
              onChange={(e) => e.target.files && onImport(e.target.files)}
            />

            {media.length === 0 ? (
              <div
                className="flex flex-col items-center justify-center h-32 border-2 border-dashed border-border rounded-xl text-center p-3 cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => inputRef.current?.click()}
              >
                <Upload className="h-6 w-6 text-muted-foreground mb-1.5" />
                <p className="text-[10px] text-muted-foreground">Clique ou arraste arquivos aqui</p>
                <p className="text-[9px] text-muted-foreground/60 mt-0.5">Vídeo, áudio ou imagem</p>
              </div>
            ) : (
              media.map((m) => (
                <div
                  key={m.id}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData('mediaId', m.id)}
                  className={cn(
                    'group flex items-center gap-2 rounded-lg p-2 cursor-grab border transition-all',
                    selectedMediaId === m.id
                      ? 'border-primary/60 bg-primary/10'
                      : 'border-transparent hover:bg-muted/60'
                  )}
                  onClick={() => onSelect(m.id)}
                >
                  {/* Thumbnail */}
                  <div className="w-12 h-9 rounded-md bg-muted shrink-0 overflow-hidden flex items-center justify-center">
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
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    {isOverlayMode ? (
                      <button
                        className="flex items-center gap-1 px-2 py-1 rounded bg-emerald-500/20 text-emerald-500 hover:bg-emerald-500/30 font-semibold"
                        title="Adicionar em Sobreposição"
                        onClick={(e) => { e.stopPropagation(); if (onAddOverlay) onAddOverlay(m.id); else onAddToTimeline(m.id); }}
                      >
                        <Layers className="h-3.5 w-3.5" />
                        <span className="text-[10px]">Camada</span>
                      </button>
                    ) : (
                      <>
                        {onAddOverlay && (m.type === 'video' || m.type === 'image') && (
                          <button
                            className="p-1 rounded hover:bg-emerald-500/20 text-emerald-500"
                            title="Adicionar como Camada (Overlay)"
                            onClick={(e) => { e.stopPropagation(); onAddOverlay(m.id); }}
                          >
                            <Layers className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button
                          className="p-1 rounded hover:bg-primary/20 text-primary"
                          title="Adicionar à timeline principal"
                          onClick={(e) => { e.stopPropagation(); onAddToTimeline(m.id); }}
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                    <button
                      className="p-1 rounded hover:bg-destructive/20 text-destructive"
                      title="Excluir do projeto"
                      onClick={(e) => { e.stopPropagation(); onDelete(m.id); }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ── Text tab ── */}
        {activeTab === 'text' && (
          <div className="p-2 space-y-2">
            <p className="text-[10px] text-muted-foreground px-1 py-1">Clique para adicionar à timeline</p>
            {TEXT_PRESETS.map((preset) => (
              <button
                key={preset.label}
                className="w-full text-left rounded-lg border border-border bg-muted/40 hover:bg-muted hover:border-primary/40 transition-all p-3 group"
                onClick={() => onAddText(preset)}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-foreground">{preset.label}</p>
                    <p className="text-[9px] text-muted-foreground mt-0.5">{preset.fontSize}px · {preset.textAlign}</p>
                  </div>
                  <Plus className="h-3.5 w-3.5 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <div
                  className="mt-2 rounded px-2 py-1 text-center truncate"
                  style={{
                    fontSize: preset.label === 'Título' ? 18 : preset.label === 'Destaque' ? 16 : preset.label === 'Subtítulo' ? 14 : 13,
                    color: preset.color,
                    backgroundColor: (preset as any).backgroundColor || 'transparent',
                    fontFamily: preset.fontFamily,
                    fontWeight: 'bold',
                  }}
                >
                  {preset.label}
                </div>
              </button>
            ))}
            <Button
              size="sm"
              variant="outline"
              className="w-full h-8 text-xs gap-1.5"
              onClick={() => onAddText({})}
            >
              <Type className="h-3.5 w-3.5" />
              Texto personalizado
            </Button>
          </div>
        )}

        {/* ── Shapes tab ── */}
        {activeTab === 'shapes' && (
          <div className="p-2 space-y-2">
            <p className="text-[10px] text-muted-foreground px-1 py-1">Formas geométricas</p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'rect' as const, icon: '▬', label: 'Retângulo' },
                { id: 'circle' as const, icon: '●', label: 'Círculo' },
                { id: 'triangle' as const, icon: '▲', label: 'Triângulo' },
              ].map((shape) => (
                <button
                  key={shape.id}
                  className="flex flex-col items-center gap-1.5 rounded-lg border border-border bg-muted/40 hover:bg-muted hover:border-primary/40 transition-all p-3"
                  onClick={() => onAddShape(shape.id)}
                >
                  <span className="text-2xl text-foreground/70">{shape.icon}</span>
                  <span className="text-[9px] text-muted-foreground">{shape.label}</span>
                </button>
              ))}
            </div>
            <p className="text-[9px] text-muted-foreground/60 px-1 text-center">Em breve: mais formas e ícones</p>
          </div>
        )}

        {/* ── Transitions tab ── */}
        {activeTab === 'transitions' && (
          <div className="p-2 space-y-2">
            <p className="text-[10px] text-muted-foreground px-1 py-1">Arraste entre dois clipes na timeline</p>
            <div className="grid grid-cols-2 gap-2">
              {TRANSITIONS.map((t) => (
                <button
                  key={t.id}
                  className="flex flex-col items-center gap-1.5 rounded-lg border border-border bg-muted/40 hover:bg-muted hover:border-primary/40 transition-all p-3"
                  onClick={() => onAddTransition(t.id)}
                >
                  <span className="text-xl text-primary">{t.icon}</span>
                  <span className="text-[10px] font-medium text-foreground">{t.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
