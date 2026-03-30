import { useState } from 'react';
import { X } from 'lucide-react';
import type { SubtitleStyle } from '@/viralcut/hooks/useSubtitleGeneration';
import type { TextDetails } from '@/viralcut/types';

interface StyleDef {
  id: SubtitleStyle;
  label: string;
  bg: string;
  color: string;
  font: string;
  outlineShadow?: string;
  shadow?: string;
}

const STYLES: StyleDef[] = [
  { id: 'classic',   label: 'Clássico',  bg: 'rgba(0,0,0,0.75)',       color: '#fff',    font: 'Inter, sans-serif' },
  { id: 'minimal',   label: 'Minimal',   bg: '#111',                    color: '#fff',    font: 'Inter, sans-serif',                    shadow: '0 0 6px #000, 1px 1px 3px #000' },
  { id: 'viral',     label: 'Viral',     bg: 'rgba(0,0,0,0.82)',       color: '#facc15', font: 'Inter, sans-serif' },
  { id: 'bold',      label: 'Bold',      bg: '#222',                    color: '#fff',    font: '"Anton", Impact, sans-serif',          outlineShadow: '1px 1px 0 #000,-1px -1px 0 #000,1px -1px 0 #000,-1px 1px 0 #000' },
  { id: 'neon',      label: 'Neon',      bg: '#111',                    color: '#00f5ff', font: 'Inter, sans-serif',                    shadow: '0 0 8px #00f5ff, 0 0 14px #00f5ff' },
  { id: 'cinema',    label: 'Cinema',    bg: 'rgba(0,0,0,0.75)',       color: '#fff',    font: 'Georgia, serif' },
  { id: 'karaoke',   label: 'Karaoke',   bg: 'rgba(234,179,8,0.9)',    color: '#fff',    font: '"Bebas Neue", sans-serif' },
  { id: 'fire',      label: 'Fire',      bg: 'rgba(220,38,38,0.88)',   color: '#fff',    font: '"Oswald", sans-serif' },
  { id: 'american',  label: 'American',  bg: '#222',                    color: '#fff',    font: '"Anton", Impact, sans-serif',          outlineShadow: '1px 1px 0 #000,-1px -1px 0 #000,1px -1px 0 #000,-1px 1px 0 #000' },
  { id: 'outline',   label: 'Outline',   bg: '#222',                    color: '#fff',    font: '"Montserrat", sans-serif',             outlineShadow: '1px 1px 0 #000,-1px -1px 0 #000,1px -1px 0 #000,-1px 1px 0 #000' },
  { id: 'highlight', label: 'Highlight', bg: '#FFE500',                 color: '#000',    font: 'Inter, sans-serif' },
  { id: 'elegant',   label: 'Elegante',  bg: '#1a1218',                 color: '#f5f0e8', font: '"Playfair Display", Georgia, serif',   shadow: '1px 1px 4px rgba(0,0,0,0.8)' },
  { id: 'sport',     label: 'Sport',     bg: 'rgba(255,107,0,0.9)',    color: '#fff',    font: '"Oswald", sans-serif' },
  { id: 'pop',       label: 'Pop',       bg: 'rgba(220,0,120,0.9)',    color: '#fff',    font: '"Bangers", cursive' },
  { id: 'cream',     label: 'Cream',     bg: 'rgba(255,248,220,0.95)', color: '#1a1a1a', font: '"Montserrat", sans-serif' },
  { id: 'horror',    label: 'Horror',    bg: 'rgba(0,0,0,0.88)',       color: '#cc0000', font: '"Oswald", sans-serif',                 shadow: '0 0 8px #cc0000' },
];

type BgType = 'filled' | 'stroke' | 'shadow' | 'clean';

interface FontOption {
  label: string;
  family: string; // value stored in TextDetails.fontFamily
  css: string;    // css font-family for preview
}

const FONT_OPTIONS: FontOption[] = [
  { label: 'Inter',            family: 'Inter, sans-serif',                   css: 'Inter, sans-serif' },
  { label: 'Roboto',           family: '"Roboto", sans-serif',                css: '"Roboto", sans-serif' },
  { label: 'Poppins',          family: '"Poppins", sans-serif',               css: '"Poppins", sans-serif' },
  { label: 'Montserrat',       family: '"Montserrat", sans-serif',            css: '"Montserrat", sans-serif' },
  { label: 'Lato',             family: '"Lato", sans-serif',                  css: '"Lato", sans-serif' },
  { label: 'Nunito',           family: '"Nunito", sans-serif',                css: '"Nunito", sans-serif' },
  { label: 'Raleway',          family: '"Raleway", sans-serif',               css: '"Raleway", sans-serif' },
  { label: 'Oswald',           family: '"Oswald", sans-serif',                css: '"Oswald", sans-serif' },
  { label: 'Anton',            family: '"Anton", sans-serif',                 css: '"Anton", sans-serif' },
  { label: 'Bebas Neue',       family: '"Bebas Neue", sans-serif',            css: '"Bebas Neue", sans-serif' },
  { label: 'Abril Fatface',    family: '"Abril Fatface", serif',              css: '"Abril Fatface", serif' },
  { label: 'Black Han Sans',   family: '"Black Han Sans", sans-serif',        css: '"Black Han Sans", sans-serif' },
  { label: 'Playfair',         family: '"Playfair Display", Georgia, serif',  css: '"Playfair Display", serif' },
  { label: 'Bangers',          family: '"Bangers", cursive',                  css: '"Bangers", cursive' },
  { label: 'Pacifico',         family: '"Pacifico", cursive',                 css: '"Pacifico", cursive' },
  { label: 'Lobster',          family: '"Lobster", cursive',                  css: '"Lobster", cursive' },
  { label: 'Permanent Marker', family: '"Permanent Marker", cursive',         css: '"Permanent Marker", cursive' },
];

interface SubtitleStylePanelProps {
  currentStyle?: SubtitleStyle;
  onChangeStyle: (style: SubtitleStyle) => void;
  onChangeCustom: (patch: Partial<TextDetails>) => void;
  currentTextDetails?: TextDetails | null;
  onClose: () => void;
}

export function SubtitleStylePanel({
  currentStyle,
  onChangeStyle,
  onChangeCustom,
  currentTextDetails,
  onClose,
}: SubtitleStylePanelProps) {
  const [tab, setTab] = useState<'presets' | 'custom'>('presets');

  const detectBgType = (): BgType => {
    if (!currentTextDetails) return 'filled';
    if ((currentTextDetails.strokeWidth ?? 0) > 0) return 'stroke';
    if ((currentTextDetails.boxShadow?.blur ?? 0) > 0) return 'shadow';
    if (currentTextDetails.backgroundColor && currentTextDetails.backgroundColor !== 'transparent') return 'filled';
    return 'clean';
  };

  const currentColor = currentTextDetails?.color ?? '#ffffff';
  const currentFontWeight = currentTextDetails?.fontWeight ?? '700';
  const currentFontFamily = currentTextDetails?.fontFamily ?? 'Inter, sans-serif';
  const bgType = detectBgType();

  const applyBgType = (type: BgType) => {
    const zero = { color: '#000000', x: 0, y: 0, blur: 0 } as const;
    if (type === 'filled')  onChangeCustom({ backgroundColor: 'rgba(0,0,0,0.75)', strokeWidth: 0, strokeColor: undefined, boxShadow: zero });
    if (type === 'stroke')  onChangeCustom({ backgroundColor: 'transparent',      strokeWidth: 3, strokeColor: '#000000', boxShadow: zero });
    if (type === 'shadow')  onChangeCustom({ backgroundColor: 'transparent',      strokeWidth: 0, strokeColor: undefined, boxShadow: { color: '#000000', x: 0, y: 0, blur: 8 } });
    if (type === 'clean')   onChangeCustom({ backgroundColor: 'transparent',      strokeWidth: 0, strokeColor: undefined, boxShadow: zero });
  };

  const BG_OPTIONS: { type: BgType; label: string; previewBg: string; previewShadow?: string }[] = [
    { type: 'filled',  label: 'Com fundo', previewBg: 'rgba(0,0,0,0.75)' },
    { type: 'stroke',  label: 'Traçado',   previewBg: '#1a1a1a', previewShadow: '1px 1px 0 #000,-1px -1px 0 #000,1px -1px 0 #000,-1px 1px 0 #000' },
    { type: 'shadow',  label: 'Sombra',    previewBg: '#1a1a1a', previewShadow: '0 2px 6px #000,0 0 2px #000' },
    { type: 'clean',   label: 'Sem fundo', previewBg: '#333' },
  ];

  const COLORS = ['#ffffff', '#facc15', '#00f5ff', '#ff4444', '#44ff88', '#ff88ff'];

  return (
    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 w-[340px] sm:w-[400px]">
      <div className="bg-card/95 backdrop-blur-sm border border-border rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-border">
          <span className="text-xs font-semibold text-foreground">Legendas — altera todas</span>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border">
          {(['presets', 'custom'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 text-xs font-medium transition-colors border-b-2 ${
                tab === t
                  ? 'text-primary border-primary'
                  : 'text-muted-foreground border-transparent hover:text-foreground'
              }`}
            >
              {t === 'presets' ? 'Modelos' : 'Personalizar'}
            </button>
          ))}
        </div>

        {tab === 'presets' ? (
          <div className="p-2 grid grid-cols-4 gap-1.5 max-h-60 overflow-y-auto">
            {STYLES.map((s) => (
              <button
                key={s.id}
                onClick={() => { onChangeStyle(s.id); onClose(); }}
                className={`flex flex-col items-center gap-1 p-1.5 rounded-xl border transition-all ${
                  currentStyle === s.id
                    ? 'border-violet-500 bg-violet-500/15'
                    : 'border-border/50 bg-muted/50 hover:border-violet-400/50 hover:bg-muted'
                }`}
              >
                <div
                  className="w-full h-7 rounded-lg flex items-center justify-center overflow-hidden"
                  style={{ background: s.bg }}
                >
                  <span
                    className="text-[9px] font-bold px-0.5 leading-none"
                    style={{
                      color: s.color,
                      fontFamily: s.font,
                      textShadow: s.outlineShadow ?? s.shadow,
                    }}
                  >
                    Abc
                  </span>
                </div>
                <span className="text-[9px] text-muted-foreground leading-none truncate w-full text-center">
                  {s.label}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="p-3 space-y-4">
            {/* Text color */}
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-2">Cor do texto</label>
              <div className="flex items-center gap-3">
                <label className="relative cursor-pointer">
                  <input
                    type="color"
                    value={currentColor}
                    onChange={(e) => onChangeCustom({ color: e.target.value })}
                    className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                  />
                  <div
                    className="w-8 h-8 rounded-lg border-2 border-border shadow-sm"
                    style={{ background: currentColor }}
                  />
                </label>
                <div className="flex gap-1.5">
                  {COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => onChangeCustom({ color: c })}
                      className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${
                        currentColor === c ? 'border-violet-500 scale-110' : 'border-border/50'
                      }`}
                      style={{ background: c }}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Background type */}
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-2">Estilo de fundo</label>
              <div className="grid grid-cols-4 gap-1.5">
                {BG_OPTIONS.map(({ type, label, previewBg, previewShadow }) => (
                  <button
                    key={type}
                    onClick={() => applyBgType(type)}
                    className={`flex flex-col items-center gap-1 p-1.5 rounded-xl border transition-all ${
                      bgType === type
                        ? 'border-violet-500 bg-violet-500/15'
                        : 'border-border/50 bg-muted/50 hover:border-violet-400/50 hover:bg-muted'
                    }`}
                  >
                    <div
                      className="w-full h-7 rounded-lg flex items-center justify-center"
                      style={{ background: previewBg }}
                    >
                      <span
                        className="text-[9px] font-bold text-white leading-none"
                        style={{ textShadow: previewShadow }}
                      >
                        Abc
                      </span>
                    </div>
                    <span className="text-[9px] text-muted-foreground leading-none text-center">{label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Font weight */}
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-2">Peso da fonte</label>
              <div className="grid grid-cols-3 gap-1.5">
                {[{ value: '300', label: 'Leve' }, { value: '400', label: 'Normal' }, { value: '700', label: 'Negrito' }].map(
                  ({ value, label }) => (
                    <button
                      key={value}
                      onClick={() => onChangeCustom({ fontWeight: value })}
                      className={`py-2 rounded-xl border text-xs transition-all ${
                        currentFontWeight === value
                          ? 'border-violet-500 bg-violet-500/15 text-foreground'
                          : 'border-border/50 bg-muted/50 text-muted-foreground hover:border-violet-400/50'
                      }`}
                      style={{ fontWeight: value }}
                    >
                      {label}
                    </button>
                  )
                )}
              </div>
            </div>

            {/* Font family */}
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-2">Fonte</label>
              <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto pr-0.5">
                {FONT_OPTIONS.map((f) => {
                  const isActive = currentFontFamily === f.family;
                  return (
                    <button
                      key={f.family}
                      onClick={() => onChangeCustom({ fontFamily: f.family })}
                      className={`flex items-center justify-center h-9 rounded-xl border text-sm transition-all px-2 ${
                        isActive
                          ? 'border-violet-500 bg-violet-500/15 text-foreground'
                          : 'border-border/50 bg-muted/50 text-muted-foreground hover:border-violet-400/50 hover:text-foreground'
                      }`}
                      style={{ fontFamily: f.css }}
                      title={f.label}
                    >
                      <span className="truncate">{f.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
