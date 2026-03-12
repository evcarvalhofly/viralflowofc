// ============================================================
// PropertiesPanel – Full inspector with all controls
// ============================================================
import { useState } from 'react';
import {
  Sliders, Scissors, Trash2, Volume2, Eye, FlipHorizontal2, FlipVertical2,
  Gauge, Type, AlignLeft, AlignCenter, AlignRight, Strikethrough, Underline,
  Sun, Contrast, Droplets, ChevronDown, ChevronUp
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import {
  TrackItem, MediaFile,
  DEFAULT_VIDEO_DETAILS, DEFAULT_AUDIO_DETAILS, DEFAULT_TEXT_DETAILS, DEFAULT_IMAGE_DETAILS
} from '../types';
import { cn } from '@/lib/utils';

interface PropertiesPanelProps {
  selectedItem: TrackItem | null;
  selectedTrackId: string | null;
  media: MediaFile[];
  onDelete: (trackId: string, itemId: string) => void;
  onSplit: (trackId: string, itemId: string, atTime: number) => void;
  onUpdateItem: (trackId: string, itemId: string, updates: Partial<TrackItem>) => void;
  currentTime: number;
}

function fmt(s: number) {
  const m = Math.floor(s / 60);
  const sec = (s % 60).toFixed(2);
  return `${m}:${String(Math.floor(+sec)).padStart(2, '0')}.${String(Math.round((+sec % 1) * 100)).padStart(2, '0')}`;
}

function Section({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-border/50">
      <button
        className="w-full flex items-center justify-between px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide hover:text-foreground transition-colors"
        onClick={() => setOpen((o) => !o)}
      >
        {title}
        {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>
      {open && <div className="px-3 pb-3 space-y-2">{children}</div>}
    </div>
  );
}

function SliderRow({ label, value, min, max, step = 0.01, onChange, format }: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center">
        <span className="text-[10px] text-muted-foreground">{label}</span>
        <span className="text-[10px] font-mono text-foreground">{format ? format(value) : value.toFixed(2)}</span>
      </div>
      <Slider
        min={min} max={max} step={step} value={[value]}
        onValueChange={([v]) => onChange(v)}
        className="h-4"
      />
    </div>
  );
}

export function PropertiesPanel({
  selectedItem,
  selectedTrackId,
  media,
  onDelete,
  onSplit,
  onUpdateItem,
  currentTime,
}: PropertiesPanelProps) {
  const m = selectedItem ? media.find((x) => x.id === selectedItem.mediaId) : null;
  const canSplit = selectedItem && selectedTrackId &&
    currentTime > selectedItem.startTime && currentTime < selectedItem.endTime;

  // Get details with defaults
  const vd = selectedItem?.videoDetails ?? DEFAULT_VIDEO_DETAILS;
  const ad = selectedItem?.audioDetails ?? DEFAULT_AUDIO_DETAILS;
  const td = selectedItem?.textDetails ?? DEFAULT_TEXT_DETAILS;
  const imgd = selectedItem?.imageDetails ?? DEFAULT_IMAGE_DETAILS;

  const updateVideo = (patch: Partial<typeof vd>) => {
    if (!selectedItem || !selectedTrackId) return;
    onUpdateItem(selectedTrackId, selectedItem.id, { videoDetails: { ...vd, ...patch } });
  };

  const updateAudio = (patch: Partial<typeof ad>) => {
    if (!selectedItem || !selectedTrackId) return;
    onUpdateItem(selectedTrackId, selectedItem.id, { audioDetails: { ...ad, ...patch } });
  };

  const updateText = (patch: Partial<typeof td>) => {
    if (!selectedItem || !selectedTrackId) return;
    onUpdateItem(selectedTrackId, selectedItem.id, { textDetails: { ...td, ...patch } });
  };

  const updateImage = (patch: Partial<typeof imgd>) => {
    if (!selectedItem || !selectedTrackId) return;
    onUpdateItem(selectedTrackId, selectedItem.id, { imageDetails: { ...imgd, ...patch } });
  };

  return (
    <div className="flex flex-col h-full bg-card/30">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border shrink-0">
        <Sliders className="h-3.5 w-3.5 text-primary" />
        <span className="text-xs font-semibold text-foreground uppercase tracking-wide">Propriedades</span>
      </div>

      {selectedItem ? (
        <div className="flex-1 overflow-y-auto">

          {/* ── Clip info ── */}
          <Section title="Clipe">
            <p className="text-xs font-medium text-foreground truncate">{selectedItem.name}</p>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { label: 'Início', value: fmt(selectedItem.startTime) },
                { label: 'Fim', value: fmt(selectedItem.endTime) },
                { label: 'Duração', value: fmt(selectedItem.endTime - selectedItem.startTime) },
                { label: 'Tipo', value: selectedItem.type.toUpperCase() },
              ].map((p) => (
                <div key={p.label} className="rounded-lg bg-muted/50 p-1.5">
                  <p className="text-[9px] text-muted-foreground uppercase">{p.label}</p>
                  <p className="text-[10px] font-mono font-medium text-foreground mt-0.5">{p.value}</p>
                </div>
              ))}
            </div>
          </Section>

          {/* ── VIDEO controls ── */}
          {selectedItem.type === 'video' && (
            <>
              <Section title="Áudio">
                <SliderRow label="Volume" value={vd.volume} min={0} max={2} onChange={(v) => updateVideo({ volume: v })} format={(v) => `${Math.round(v * 100)}%`} />
              </Section>
              <Section title="Velocidade">
                <SliderRow label="Velocidade" value={vd.playbackRate} min={0.25} max={4} step={0.05} onChange={(v) => updateVideo({ playbackRate: v })} format={(v) => `${v.toFixed(2)}x`} />
              </Section>
              <Section title="Aparência">
                <SliderRow label="Opacidade" value={vd.opacity} min={0} max={1} onChange={(v) => updateVideo({ opacity: v })} format={(v) => `${Math.round(v * 100)}%`} />
                <SliderRow label="Brilho" value={vd.brightness} min={0} max={3} onChange={(v) => updateVideo({ brightness: v })} />
                <SliderRow label="Contraste" value={vd.contrast} min={0} max={3} onChange={(v) => updateVideo({ contrast: v })} />
                <SliderRow label="Saturação" value={vd.saturation} min={0} max={3} onChange={(v) => updateVideo({ saturation: v })} />
                <SliderRow label="Borda (px)" value={vd.borderWidth} min={0} max={20} step={1} onChange={(v) => updateVideo({ borderWidth: v })} format={(v) => `${Math.round(v)}px`} />
                <SliderRow label="Arredondado" value={vd.borderRadius} min={0} max={50} step={1} onChange={(v) => updateVideo({ borderRadius: v })} format={(v) => `${Math.round(v)}%`} />
              </Section>
              <Section title="Espelhar" defaultOpen={false}>
                <div className="flex gap-2">
                  <button
                    className={cn('flex-1 flex items-center justify-center gap-1.5 rounded-lg border py-2 text-xs transition-colors', vd.flipH ? 'border-primary text-primary bg-primary/10' : 'border-border text-muted-foreground hover:text-foreground')}
                    onClick={() => updateVideo({ flipH: !vd.flipH })}
                  >
                    <FlipHorizontal2 className="h-3.5 w-3.5" /> Horiz.
                  </button>
                  <button
                    className={cn('flex-1 flex items-center justify-center gap-1.5 rounded-lg border py-2 text-xs transition-colors', vd.flipV ? 'border-primary text-primary bg-primary/10' : 'border-border text-muted-foreground hover:text-foreground')}
                    onClick={() => updateVideo({ flipV: !vd.flipV })}
                  >
                    <FlipVertical2 className="h-3.5 w-3.5" /> Vert.
                  </button>
                </div>
              </Section>
            </>
          )}

          {/* ── AUDIO controls ── */}
          {selectedItem.type === 'audio' && (
            <>
              <Section title="Áudio">
                <SliderRow label="Volume" value={ad.volume} min={0} max={2} onChange={(v) => updateAudio({ volume: v })} format={(v) => `${Math.round(v * 100)}%`} />
                <SliderRow label="Velocidade" value={ad.playbackRate} min={0.25} max={4} step={0.05} onChange={(v) => updateAudio({ playbackRate: v })} format={(v) => `${v.toFixed(2)}x`} />
              </Section>
              <Section title="Fades" defaultOpen={false}>
                <SliderRow label="Fade In (s)" value={ad.fadeIn} min={0} max={5} step={0.1} onChange={(v) => updateAudio({ fadeIn: v })} format={(v) => `${v.toFixed(1)}s`} />
                <SliderRow label="Fade Out (s)" value={ad.fadeOut} min={0} max={5} step={0.1} onChange={(v) => updateAudio({ fadeOut: v })} format={(v) => `${v.toFixed(1)}s`} />
              </Section>
            </>
          )}

          {/* ── TEXT controls ── */}
          {selectedItem.type === 'text' && (
            <>
              <Section title="Texto">
                <textarea
                  className="w-full rounded-lg bg-muted/60 border border-border text-xs text-foreground p-2 resize-none focus:outline-none focus:border-primary/60 transition-colors"
                  rows={3}
                  value={td.text}
                  onChange={(e) => updateText({ text: e.target.value })}
                />
              </Section>
              <Section title="Estilo">
                <div className="space-y-1">
                  <span className="text-[10px] text-muted-foreground">Tamanho da fonte (%)</span>
                  <div className="flex items-center gap-2">
                    <Slider min={1} max={30} step={0.5} value={[td.fontSize]} onValueChange={([v]) => updateText({ fontSize: v })} className="flex-1 h-4" />
                    <span className="text-[10px] font-mono w-8 text-right">{td.fontSize.toFixed(1)}%</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-muted-foreground">Cor do texto</span>
                  <div className="flex items-center gap-2">
                    <input type="color" value={td.color} onChange={(e) => updateText({ color: e.target.value })} className="w-8 h-8 rounded cursor-pointer bg-transparent border-0" />
                    <span className="text-[10px] font-mono text-foreground">{td.color}</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-muted-foreground">Alinhamento</span>
                  <div className="flex gap-1">
                    {(['left', 'center', 'right'] as const).map((a) => (
                      <button key={a} className={cn('flex-1 py-1.5 rounded border text-xs flex items-center justify-center transition-colors', td.textAlign === a ? 'border-primary text-primary bg-primary/10' : 'border-border text-muted-foreground')} onClick={() => updateText({ textAlign: a })}>
                        {a === 'left' ? <AlignLeft className="h-3 w-3" /> : a === 'center' ? <AlignCenter className="h-3 w-3" /> : <AlignRight className="h-3 w-3" />}
                      </button>
                    ))}
                  </div>
                </div>
                <SliderRow label="Opacidade" value={td.opacity} min={0} max={1} onChange={(v) => updateText({ opacity: v })} format={(v) => `${Math.round(v * 100)}%`} />
              </Section>
              <Section title="Posição" defaultOpen={false}>
                <SliderRow label="X (%)" value={td.posX} min={0} max={100} step={1} onChange={(v) => updateText({ posX: v })} format={(v) => `${Math.round(v)}%`} />
                <SliderRow label="Y (%)" value={td.posY} min={0} max={100} step={1} onChange={(v) => updateText({ posY: v })} format={(v) => `${Math.round(v)}%`} />
                <SliderRow label="Largura (%)" value={td.width} min={10} max={100} step={1} onChange={(v) => updateText({ width: v })} format={(v) => `${Math.round(v)}%`} />
              </Section>
              <Section title="Sombra" defaultOpen={false}>
                <div className="space-y-1">
                  <span className="text-[10px] text-muted-foreground">Cor da sombra</span>
                  <input type="color" value={td.boxShadow.color} onChange={(e) => updateText({ boxShadow: { ...td.boxShadow, color: e.target.value } })} className="w-8 h-8 rounded cursor-pointer" />
                </div>
                <SliderRow label="X" value={td.boxShadow.x} min={-20} max={20} step={1} onChange={(v) => updateText({ boxShadow: { ...td.boxShadow, x: v } })} format={(v) => `${Math.round(v)}px`} />
                <SliderRow label="Y" value={td.boxShadow.y} min={-20} max={20} step={1} onChange={(v) => updateText({ boxShadow: { ...td.boxShadow, y: v } })} format={(v) => `${Math.round(v)}px`} />
                <SliderRow label="Blur" value={td.boxShadow.blur} min={0} max={40} step={1} onChange={(v) => updateText({ boxShadow: { ...td.boxShadow, blur: v } })} format={(v) => `${Math.round(v)}px`} />
              </Section>
            </>
          )}

          {/* ── IMAGE controls ── */}
          {selectedItem.type === 'image' && (
            <>
              <Section title="Aparência">
                <SliderRow label="Opacidade" value={imgd.opacity} min={0} max={1} onChange={(v) => updateImage({ opacity: v })} format={(v) => `${Math.round(v * 100)}%`} />
                <SliderRow label="Brilho" value={imgd.brightness} min={0} max={3} onChange={(v) => updateImage({ brightness: v })} />
                <SliderRow label="Contraste" value={imgd.contrast} min={0} max={3} onChange={(v) => updateImage({ contrast: v })} />
                <SliderRow label="Saturação" value={imgd.saturation} min={0} max={3} onChange={(v) => updateImage({ saturation: v })} />
              </Section>
              <Section title="Posição" defaultOpen={false}>
                <SliderRow label="X (%)" value={imgd.posX} min={0} max={100} step={1} onChange={(v) => updateImage({ posX: v })} format={(v) => `${Math.round(v)}%`} />
                <SliderRow label="Y (%)" value={imgd.posY} min={0} max={100} step={1} onChange={(v) => updateImage({ posY: v })} format={(v) => `${Math.round(v)}%`} />
                <SliderRow label="Largura (%)" value={imgd.width} min={10} max={100} step={1} onChange={(v) => updateImage({ width: v })} format={(v) => `${Math.round(v)}%`} />
                <SliderRow label="Altura (%)" value={imgd.height} min={10} max={100} step={1} onChange={(v) => updateImage({ height: v })} format={(v) => `${Math.round(v)}%`} />
              </Section>
              <Section title="Espelhar" defaultOpen={false}>
                <div className="flex gap-2">
                  <button className={cn('flex-1 flex items-center justify-center gap-1.5 rounded-lg border py-2 text-xs transition-colors', imgd.flipH ? 'border-primary text-primary bg-primary/10' : 'border-border text-muted-foreground hover:text-foreground')} onClick={() => updateImage({ flipH: !imgd.flipH })}>
                    <FlipHorizontal2 className="h-3.5 w-3.5" /> Horiz.
                  </button>
                  <button className={cn('flex-1 flex items-center justify-center gap-1.5 rounded-lg border py-2 text-xs transition-colors', imgd.flipV ? 'border-primary text-primary bg-primary/10' : 'border-border text-muted-foreground hover:text-foreground')} onClick={() => updateImage({ flipV: !imgd.flipV })}>
                    <FlipVertical2 className="h-3.5 w-3.5" /> Vert.
                  </button>
                </div>
              </Section>
            </>
          )}

          {/* ── Resize info if available ── */}
          {m?.width && m?.height && (
            <Section title="Mídia Original" defaultOpen={false}>
              <p className="text-[10px] font-mono text-foreground">{m.width}×{m.height}</p>
            </Section>
          )}

          {/* ── Actions ── */}
          <div className="p-3 space-y-2">
            {(selectedItem.type === 'video' || selectedItem.type === 'audio') && (
              <Button
                size="sm" variant="outline" className="w-full h-7 text-xs gap-1.5"
                disabled={!canSplit}
                title={canSplit ? 'Dividir no playhead' : 'Mova o playhead sobre este clipe'}
                onClick={() => canSplit && onSplit(selectedTrackId!, selectedItem.id, currentTime)}
              >
                <Scissors className="h-3 w-3" /> Dividir no Playhead
              </Button>
            )}
            <Button
              size="sm" variant="destructive" className="w-full h-7 text-xs gap-1.5"
              onClick={() => selectedTrackId && onDelete(selectedTrackId, selectedItem.id)}
            >
              <Trash2 className="h-3 w-3" /> Remover Clipe
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-center p-4">
          <div className="text-muted-foreground/50">
            <Sliders className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p className="text-xs">Selecione um clipe</p>
            <p className="text-[10px] mt-1 opacity-60">Clique sobre um clipe na timeline para ver suas propriedades</p>
          </div>
        </div>
      )}
    </div>
  );
}
