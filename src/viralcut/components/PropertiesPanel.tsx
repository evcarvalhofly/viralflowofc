// ============================================================
// PropertiesPanel – Full inspector with all controls
// ============================================================
import { useState } from 'react';
import {
  Sliders, Scissors, Trash2, Volume2, Eye, FlipHorizontal2, FlipVertical2,
  Gauge, Type, AlignLeft, AlignCenter, AlignRight, Strikethrough, Underline,
  Sun, Contrast, Droplets, ChevronDown, ChevronUp, Bold, MicOff
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import {
  TrackItem, MediaFile,
  DEFAULT_VIDEO_DETAILS, DEFAULT_AUDIO_DETAILS, DEFAULT_TEXT_DETAILS, DEFAULT_IMAGE_DETAILS
} from '../types';
import { cn } from '@/lib/utils';

// ── Shared style options (same as SubtitleStylePanel) ──────────
const FONT_OPTIONS = [
  { label: 'Inter',            family: 'Inter, sans-serif' },
  { label: 'Roboto',           family: '"Roboto", sans-serif' },
  { label: 'Poppins',          family: '"Poppins", sans-serif' },
  { label: 'Montserrat',       family: '"Montserrat", sans-serif' },
  { label: 'Lato',             family: '"Lato", sans-serif' },
  { label: 'Nunito',           family: '"Nunito", sans-serif' },
  { label: 'Raleway',          family: '"Raleway", sans-serif' },
  { label: 'Oswald',           family: '"Oswald", sans-serif' },
  { label: 'Anton',            family: '"Anton", sans-serif' },
  { label: 'Bebas Neue',       family: '"Bebas Neue", sans-serif' },
  { label: 'Abril Fatface',    family: '"Abril Fatface", serif' },
  { label: 'Black Han Sans',   family: '"Black Han Sans", sans-serif' },
  { label: 'Playfair',         family: '"Playfair Display", Georgia, serif' },
  { label: 'Bangers',          family: '"Bangers", cursive' },
  { label: 'Pacifico',         family: '"Pacifico", cursive' },
  { label: 'Lobster',          family: '"Lobster", cursive' },
  { label: 'Permanent Marker', family: '"Permanent Marker", cursive' },
];

const QUICK_COLORS = ['#ffffff', '#facc15', '#00f5ff', '#ff4444', '#44ff88', '#ff88ff', '#000000', '#f97316'];

type BgType = 'filled' | 'stroke' | 'shadow' | 'clean';

const BG_OPTIONS: { type: BgType; label: string; previewBg: string; previewShadow?: string }[] = [
  { type: 'filled',  label: 'Com fundo', previewBg: 'rgba(0,0,0,0.75)' },
  { type: 'stroke',  label: 'Traçado',   previewBg: '#1a1a1a', previewShadow: '1px 1px 0 #000,-1px -1px 0 #000,1px -1px 0 #000,-1px 1px 0 #000' },
  { type: 'shadow',  label: 'Sombra',    previewBg: '#1a1a1a', previewShadow: '0 2px 6px #000,0 0 2px #000' },
  { type: 'clean',   label: 'Sem fundo', previewBg: '#333' },
];

const TEXT_STYLE_PRESETS = [
  { label: 'Clássico',  color: '#ffffff', bg: 'rgba(0,0,0,0.75)', font: 'Inter, sans-serif',                   weight: '700', stroke: 0 },
  { label: 'Viral',     color: '#facc15', bg: 'rgba(0,0,0,0.82)', font: 'Inter, sans-serif',                   weight: '700', stroke: 0 },
  { label: 'Neon',      color: '#00f5ff', bg: 'transparent',      font: 'Inter, sans-serif',                   weight: '700', stroke: 0, shadow: { color: '#00f5ff', x: 0, y: 0, blur: 8 } },
  { label: 'Bold',      color: '#ffffff', bg: 'transparent',      font: '"Anton", sans-serif',                 weight: '400', stroke: 3, strokeColor: '#000000' },
  { label: 'Elegante',  color: '#f5f0e8', bg: 'transparent',      font: '"Playfair Display", Georgia, serif',  weight: '700', stroke: 0, shadow: { color: '#000000', x: 1, y: 1, blur: 4 } },
  { label: 'Fire',      color: '#ffffff', bg: 'rgba(220,38,38,0.88)', font: '"Oswald", sans-serif',            weight: '700', stroke: 0 },
  { label: 'Pop',       color: '#ffffff', bg: 'rgba(220,0,120,0.9)',  font: '"Bangers", cursive',              weight: '400', stroke: 0 },
  { label: 'Destaque',  color: '#000000', bg: '#FFE500',              font: 'Inter, sans-serif',               weight: '700', stroke: 0 },
];

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

  // Get details with defaults — spread merge ensures partial objects (e.g. from old JSON imports)
  // never leave fields as undefined/null (which breaks sliders)
  const vd   = { ...DEFAULT_VIDEO_DETAILS,  ...selectedItem?.videoDetails  };
  const ad   = { ...DEFAULT_AUDIO_DETAILS,  ...selectedItem?.audioDetails  };
  const td   = { ...DEFAULT_TEXT_DETAILS,   ...selectedItem?.textDetails   };
  const imgd = { ...DEFAULT_IMAGE_DETAILS,  ...selectedItem?.imageDetails  };

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
                <div className="flex items-center justify-between py-1">
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <MicOff className="h-3.5 w-3.5" /> Redução de Ruído
                  </span>
                  <button
                    onClick={() => updateVideo({ noiseReduction: !vd.noiseReduction })}
                    className={cn('relative inline-flex h-5 w-9 items-center rounded-full transition-colors', vd.noiseReduction ? 'bg-primary' : 'bg-muted')}
                  >
                    <span className={cn('inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform', vd.noiseReduction ? 'translate-x-[18px]' : 'translate-x-[3px]')} />
                  </button>
                </div>
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
                <div className="flex items-center justify-between py-1">
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <MicOff className="h-3.5 w-3.5" /> Redução de Ruído
                  </span>
                  <button
                    onClick={() => updateAudio({ noiseReduction: !ad.noiseReduction })}
                    className={cn('relative inline-flex h-5 w-9 items-center rounded-full transition-colors', ad.noiseReduction ? 'bg-primary' : 'bg-muted')}
                  >
                    <span className={cn('inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform', ad.noiseReduction ? 'translate-x-[18px]' : 'translate-x-[3px]')} />
                  </button>
                </div>
              </Section>
              <Section title="Fades" defaultOpen={false}>
                <SliderRow label="Fade In (s)" value={ad.fadeIn} min={0} max={5} step={0.1} onChange={(v) => updateAudio({ fadeIn: v })} format={(v) => `${v.toFixed(1)}s`} />
                <SliderRow label="Fade Out (s)" value={ad.fadeOut} min={0} max={5} step={0.1} onChange={(v) => updateAudio({ fadeOut: v })} format={(v) => `${v.toFixed(1)}s`} />
              </Section>
            </>
          )}

          {/* ── TEXT controls ── */}
          {selectedItem.type === 'text' && (() => {
            const detectBgType = (): BgType => {
              if ((td.strokeWidth ?? 0) > 0) return 'stroke';
              if ((td.boxShadow?.blur ?? 0) > 0) return 'shadow';
              if (td.backgroundColor && td.backgroundColor !== 'transparent') return 'filled';
              return 'clean';
            };
            const bgType = detectBgType();
            const applyBgType = (type: BgType) => {
              const zero = { color: '#000000', x: 0, y: 0, blur: 0 } as const;
              if (type === 'filled')  updateText({ backgroundColor: 'rgba(0,0,0,0.75)', strokeWidth: 0, strokeColor: undefined, boxShadow: zero });
              if (type === 'stroke')  updateText({ backgroundColor: 'transparent',      strokeWidth: 3, strokeColor: '#000000', boxShadow: zero });
              if (type === 'shadow')  updateText({ backgroundColor: 'transparent',      strokeWidth: 0, strokeColor: undefined, boxShadow: { color: '#000000', x: 0, y: 0, blur: 8 } });
              if (type === 'clean')   updateText({ backgroundColor: 'transparent',      strokeWidth: 0, strokeColor: undefined, boxShadow: zero });
            };
            const applyPreset = (p: typeof TEXT_STYLE_PRESETS[number]) => {
              updateText({
                color: p.color,
                backgroundColor: p.bg,
                fontFamily: p.font,
                fontWeight: p.weight,
                strokeWidth: p.stroke,
                strokeColor: p.strokeColor ?? '#000000',
                boxShadow: p.shadow ?? { color: '#000000', x: 0, y: 0, blur: 0 },
              });
            };

            return (
            <>
              <Section title="Texto">
                <textarea
                  className="w-full rounded-lg bg-muted/60 border border-border text-xs text-foreground p-2 resize-none focus:outline-none focus:border-primary/60 transition-colors"
                  rows={3}
                  value={td.text}
                  onChange={(e) => updateText({ text: e.target.value })}
                />
              </Section>

              {/* Presets */}
              <Section title="Modelos">
                <div className="grid grid-cols-4 gap-1.5">
                  {TEXT_STYLE_PRESETS.map((p) => (
                    <button
                      key={p.label}
                      onClick={() => applyPreset(p)}
                      className="flex flex-col items-center gap-1 p-1.5 rounded-xl border border-border/50 bg-muted/50 hover:border-primary/50 hover:bg-muted transition-all"
                    >
                      <div
                        className="w-full h-7 rounded-lg flex items-center justify-center overflow-hidden"
                        style={{ background: p.bg === 'transparent' ? '#1a1a1a' : p.bg }}
                      >
                        <span
                          className="text-[9px] font-bold px-0.5 leading-none"
                          style={{
                            color: p.color,
                            fontFamily: p.font,
                            fontWeight: p.weight,
                            WebkitTextStroke: p.stroke > 0 ? `${p.stroke}px ${p.strokeColor ?? '#000'}` : undefined,
                            textShadow: p.shadow ? `${p.shadow.x}px ${p.shadow.y}px ${p.shadow.blur}px ${p.shadow.color}` : undefined,
                          }}
                        >
                          Abc
                        </span>
                      </div>
                      <span className="text-[9px] text-muted-foreground leading-none truncate w-full text-center">{p.label}</span>
                    </button>
                  ))}
                </div>
              </Section>

              <Section title="Estilo">
                {/* Text color */}
                <div className="space-y-1.5">
                  <span className="text-[10px] text-muted-foreground">Cor do texto</span>
                  <div className="flex items-center gap-2">
                    <label className="relative cursor-pointer shrink-0">
                      <input
                        type="color"
                        value={td.color}
                        onChange={(e) => updateText({ color: e.target.value })}
                        className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                      />
                      <div className="w-7 h-7 rounded-lg border-2 border-border shadow-sm" style={{ background: td.color }} />
                    </label>
                    <div className="flex gap-1 flex-wrap">
                      {QUICK_COLORS.map((c) => (
                        <button
                          key={c}
                          onClick={() => updateText({ color: c })}
                          className={cn('w-5 h-5 rounded-full border-2 transition-transform hover:scale-110', td.color === c ? 'border-primary scale-110' : 'border-border/50')}
                          style={{ background: c }}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                {/* Background type */}
                <div className="space-y-1.5">
                  <span className="text-[10px] text-muted-foreground">Estilo de fundo</span>
                  <div className="grid grid-cols-4 gap-1.5">
                    {BG_OPTIONS.map(({ type, label, previewBg, previewShadow }) => (
                      <button
                        key={type}
                        onClick={() => applyBgType(type)}
                        className={cn(
                          'flex flex-col items-center gap-1 p-1.5 rounded-xl border transition-all',
                          bgType === type
                            ? 'border-primary bg-primary/10'
                            : 'border-border/50 bg-muted/50 hover:border-primary/50 hover:bg-muted'
                        )}
                      >
                        <div className="w-full h-6 rounded-lg flex items-center justify-center" style={{ background: previewBg }}>
                          <span className="text-[8px] font-bold text-white leading-none" style={{ textShadow: previewShadow }}>Abc</span>
                        </div>
                        <span className="text-[8px] text-muted-foreground leading-none text-center">{label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Font weight */}
                <div className="space-y-1.5">
                  <span className="text-[10px] text-muted-foreground">Peso da fonte</span>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[{ value: '300', label: 'Leve' }, { value: '400', label: 'Normal' }, { value: '700', label: 'Negrito' }].map(
                      ({ value, label }) => (
                        <button
                          key={value}
                          onClick={() => updateText({ fontWeight: value })}
                          className={cn(
                            'py-1.5 rounded-xl border text-xs transition-all',
                            (td.fontWeight ?? '700') === value
                              ? 'border-primary bg-primary/10 text-foreground'
                              : 'border-border/50 bg-muted/50 text-muted-foreground hover:border-primary/50'
                          )}
                          style={{ fontWeight: value }}
                        >
                          {label}
                        </button>
                      )
                    )}
                  </div>
                </div>

                {/* Font size */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground">Tamanho</span>
                    <span className="text-[10px] font-mono text-foreground tabular-nums">{td.fontSize.toFixed(1)}%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateText({ fontSize: Math.max(1, parseFloat((td.fontSize - 0.5).toFixed(1))) })}
                      className="w-6 h-6 rounded-lg border border-border/50 bg-muted/50 text-foreground hover:bg-muted flex items-center justify-center text-xs font-bold shrink-0"
                    >-</button>
                    <Slider min={1} max={30} step={0.5} value={[td.fontSize]} onValueChange={([v]) => updateText({ fontSize: v })} className="flex-1 h-4" />
                    <button
                      onClick={() => updateText({ fontSize: Math.min(30, parseFloat((td.fontSize + 0.5).toFixed(1))) })}
                      className="w-6 h-6 rounded-lg border border-border/50 bg-muted/50 text-foreground hover:bg-muted flex items-center justify-center text-xs font-bold shrink-0"
                    >+</button>
                  </div>
                </div>

                {/* Alignment */}
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

              {/* Font family */}
              <Section title="Fonte">
                <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto pr-0.5">
                  {FONT_OPTIONS.map((f) => {
                    const isActive = td.fontFamily === f.family;
                    return (
                      <button
                        key={f.family}
                        onClick={() => updateText({ fontFamily: f.family })}
                        className={cn(
                          'flex items-center justify-center h-8 rounded-xl border text-xs transition-all px-2',
                          isActive
                            ? 'border-primary bg-primary/10 text-foreground'
                            : 'border-border/50 bg-muted/50 text-muted-foreground hover:border-primary/50 hover:text-foreground'
                        )}
                        style={{ fontFamily: f.family }}
                        title={f.label}
                      >
                        <span className="truncate">{f.label}</span>
                      </button>
                    );
                  })}
                </div>
              </Section>

              {/* Stroke */}
              <Section title="Traçado (Outline)" defaultOpen={false}>
                <SliderRow label="Espessura" value={td.strokeWidth ?? 0} min={0} max={10} step={0.5} onChange={(v) => updateText({ strokeWidth: v })} format={(v) => `${v.toFixed(1)}px`} />
                {(td.strokeWidth ?? 0) > 0 && (
                  <div className="space-y-1">
                    <span className="text-[10px] text-muted-foreground">Cor do traçado</span>
                    <div className="flex items-center gap-2">
                      <input type="color" value={td.strokeColor ?? '#000000'} onChange={(e) => updateText({ strokeColor: e.target.value })} className="w-7 h-7 rounded cursor-pointer bg-transparent border-0" />
                      <span className="text-[10px] font-mono text-foreground">{td.strokeColor ?? '#000000'}</span>
                    </div>
                  </div>
                )}
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
            );
          })()}

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
