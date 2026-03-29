import type { SubtitleStyle } from '@/viralcut/hooks/useSubtitleGeneration';
import { X } from 'lucide-react';

interface StyleDef {
  id: SubtitleStyle;
  label: string;
  bg: string;
  color: string;
  font: string;
  stroke?: string;
  shadow?: string;
}

const STYLES: StyleDef[] = [
  { id: 'classic',   label: 'Clássico',  bg: 'rgba(0,0,0,0.75)',      color: '#fff',    font: 'Inter, sans-serif' },
  { id: 'minimal',   label: 'Minimal',   bg: 'transparent',           color: '#fff',    font: 'Inter, sans-serif',            shadow: '0 0 6px #000, 1px 1px 3px #000' },
  { id: 'viral',     label: 'Viral',     bg: 'rgba(0,0,0,0.82)',      color: '#facc15', font: 'Inter, sans-serif' },
  { id: 'bold',      label: 'Bold',      bg: 'transparent',           color: '#fff',    font: '"Anton", Impact, sans-serif',  stroke: '1.5px #000' },
  { id: 'neon',      label: 'Neon',      bg: 'transparent',           color: '#00f5ff', font: 'Inter, sans-serif',            shadow: '0 0 8px #00f5ff, 0 0 14px #00f5ff' },
  { id: 'cinema',    label: 'Cinema',    bg: 'rgba(0,0,0,0.55)',      color: '#fff',    font: 'Georgia, serif' },
  { id: 'karaoke',   label: 'Karaoke',   bg: 'rgba(234,179,8,0.9)',   color: '#fff',    font: '"Bebas Neue", sans-serif' },
  { id: 'fire',      label: 'Fire',      bg: 'rgba(220,38,38,0.88)',  color: '#fff',    font: '"Oswald", sans-serif' },
  { id: 'american',  label: 'American',  bg: 'transparent',           color: '#fff',    font: '"Anton", Impact, sans-serif',  stroke: '2px #000' },
  { id: 'outline',   label: 'Outline',   bg: 'transparent',           color: '#fff',    font: '"Montserrat", sans-serif',     stroke: '1.5px #000' },
  { id: 'highlight', label: 'Highlight', bg: '#FFE500',               color: '#000',    font: 'Inter, sans-serif' },
  { id: 'elegant',   label: 'Elegante',  bg: 'transparent',           color: '#f5f0e8', font: '"Playfair Display", Georgia, serif', shadow: '1px 1px 4px rgba(0,0,0,0.8)' },
  { id: 'sport',     label: 'Sport',     bg: 'rgba(255,107,0,0.9)',   color: '#fff',    font: '"Oswald", sans-serif' },
  { id: 'pop',       label: 'Pop',       bg: 'rgba(220,0,120,0.9)',   color: '#fff',    font: '"Bangers", cursive' },
  { id: 'cream',     label: 'Cream',     bg: 'rgba(255,248,220,0.95)',color: '#1a1a1a', font: '"Montserrat", sans-serif' },
  { id: 'horror',    label: 'Horror',    bg: 'rgba(0,0,0,0.88)',      color: '#cc0000', font: '"Oswald", sans-serif',         shadow: '0 0 8px #cc0000' },
];

interface SubtitleStylePanelProps {
  currentStyle?: SubtitleStyle;
  onChangeStyle: (style: SubtitleStyle) => void;
  onClose: () => void;
}

export function SubtitleStylePanel({ currentStyle, onChangeStyle, onClose }: SubtitleStylePanelProps) {
  return (
    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 w-[320px] sm:w-[380px]">
      <div className="bg-card/95 backdrop-blur-sm border border-border rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-border">
          <span className="text-xs font-semibold text-foreground">Estilo das legendas — aplica em todas</span>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        {/* Grid */}
        <div className="p-2 grid grid-cols-4 gap-1.5 max-h-56 overflow-y-auto">
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
                style={{ background: s.bg !== 'transparent' ? s.bg : 'rgba(80,80,80,0.4)' }}
              >
                <span
                  className="text-[9px] font-bold px-0.5 leading-none"
                  style={{
                    color: s.color,
                    fontFamily: s.font,
                    WebkitTextStroke: s.stroke,
                    textShadow: s.shadow,
                  }}
                >
                  Abc
                </span>
              </div>
              <span className="text-[9px] text-muted-foreground leading-none truncate w-full text-center">{s.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
