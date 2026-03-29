import { useState, useEffect } from 'react';
import { X, Captions, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSubtitleGeneration, SubtitleSegment, SubtitleStyle } from '@/viralcut/hooks/useSubtitleGeneration';
import type { TrackItem, MediaFile } from '@/viralcut/types';

interface SubtitleModalProps {
  videoItem: TrackItem | null;       // clip de vídeo selecionado ou primeiro da timeline
  mediaFile: MediaFile | null;        // arquivo correspondente ao videoItem
  userId: string;
  onGenerate: (segments: SubtitleSegment[], videoItem: TrackItem, style: SubtitleStyle, maxWords: number, isWordLevel: boolean) => void;
  onClose: () => void;
}

const STYLE_OPTIONS: { id: SubtitleStyle; label: string; preview: React.CSSProperties }[] = [
  { id: 'classic',   label: 'Clássico',    preview: { color: '#ffffff', background: 'rgba(0,0,0,0.75)',     fontFamily: 'Inter, sans-serif' } },
  { id: 'minimal',   label: 'Minimal',     preview: { color: '#ffffff', background: 'transparent',          fontFamily: 'Inter, sans-serif', textShadow: '0 0 6px #000, 1px 1px 3px #000' } },
  { id: 'viral',     label: 'Viral',       preview: { color: '#facc15', background: 'rgba(0,0,0,0.82)',     fontFamily: 'Inter, sans-serif' } },
  { id: 'bold',      label: 'Bold',        preview: { color: '#ffffff', background: 'transparent',          fontFamily: '"Anton", Impact, sans-serif', WebkitTextStroke: '1.5px #000' } },
  { id: 'neon',      label: 'Neon',        preview: { color: '#00f5ff', background: 'transparent',          fontFamily: 'Inter, sans-serif', textShadow: '0 0 8px #00f5ff, 0 0 14px #00f5ff' } },
  { id: 'cinema',    label: 'Cinema',      preview: { color: '#ffffff', background: 'rgba(0,0,0,0.55)',     fontFamily: 'Georgia, serif' } },
  { id: 'karaoke',   label: 'Karaoke',     preview: { color: '#ffffff', background: 'rgba(234,179,8,0.9)', fontFamily: '"Bebas Neue", sans-serif' } },
  { id: 'fire',      label: 'Fire',        preview: { color: '#ffffff', background: 'rgba(220,38,38,0.88)',fontFamily: '"Oswald", sans-serif' } },
  { id: 'american',  label: 'American',    preview: { color: '#ffffff', background: 'transparent',          fontFamily: '"Anton", Impact, sans-serif', WebkitTextStroke: '2px #000', letterSpacing: '1px' } },
  { id: 'outline',   label: 'Outline',     preview: { color: '#ffffff', background: 'transparent',          fontFamily: '"Montserrat", sans-serif', WebkitTextStroke: '1.5px #000' } },
  { id: 'highlight', label: 'Highlight',   preview: { color: '#000000', background: '#FFE500',              fontFamily: 'Inter, sans-serif', fontWeight: 'bold' } },
  { id: 'elegant',   label: 'Elegante',    preview: { color: '#f5f0e8', background: 'transparent',          fontFamily: '"Playfair Display", Georgia, serif', textShadow: '1px 1px 4px rgba(0,0,0,0.8)' } },
  { id: 'sport',     label: 'Sport',       preview: { color: '#ffffff', background: 'rgba(255,107,0,0.9)', fontFamily: '"Oswald", sans-serif', letterSpacing: '1px' } },
  { id: 'pop',       label: 'Pop',         preview: { color: '#ffffff', background: 'rgba(220,0,120,0.9)', fontFamily: '"Bangers", cursive', letterSpacing: '2px' } },
  { id: 'cream',     label: 'Cream',       preview: { color: '#1a1a1a', background: 'rgba(255,248,220,0.95)', fontFamily: '"Montserrat", sans-serif', fontWeight: 'bold' } },
  { id: 'horror',    label: 'Horror',      preview: { color: '#cc0000', background: 'rgba(0,0,0,0.88)',    fontFamily: '"Oswald", sans-serif', textShadow: '0 0 8px #cc0000' } },
];

const LANGUAGES = [
  { code: 'pt', label: 'Português (BR)' },
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
];

export function SubtitleModal({ videoItem, mediaFile, userId, onGenerate, onClose }: SubtitleModalProps) {
  const { generating, statusLabel, generate, getMonthlyUsed, MONTHLY_LIMIT_SECONDS } = useSubtitleGeneration();
  const [style, setStyle] = useState<SubtitleStyle>('classic');
  const [language, setLanguage] = useState('pt');
  const [maxWords, setMaxWords] = useState(3);
  const [error, setError] = useState('');
  const [monthlyUsed, setMonthlyUsed] = useState(0);

  const clipDuration = videoItem ? (videoItem.mediaEnd - videoItem.mediaStart) : 0;
  const remainingSec = MONTHLY_LIMIT_SECONDS - monthlyUsed;
  const remainingMin = Math.floor(remainingSec / 60);
  const usedMin = Math.floor(monthlyUsed / 60);
  const limitMin = MONTHLY_LIMIT_SECONDS / 60;
  const usagePercent = Math.min(100, (monthlyUsed / MONTHLY_LIMIT_SECONDS) * 100);

  useEffect(() => {
    if (userId) getMonthlyUsed(userId).then(setMonthlyUsed);
  }, [userId, getMonthlyUsed]);

  const handleGenerate = async () => {
    if (!videoItem || !mediaFile) return;
    setError('');
    const result = await generate({ videoFile: mediaFile.file, clipDurationSec: clipDuration, language, userId });
    if (result.error) {
      setError(result.error);
      return;
    }
    onGenerate(result.segments, videoItem, style, maxWords, result.isWordLevel);
    onClose();
  };

  const canGenerate = !!videoItem && !!mediaFile && !generating && clipDuration > 0 && clipDuration <= remainingSec;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm pointer-events-auto" onClick={onClose}>
      <div
        className="bg-card border border-border rounded-2xl w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <Captions className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-sm text-foreground">Legendas Automáticas</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4 overflow-y-auto flex-1">
          {/* Clipe selecionado */}
          <div className="bg-muted rounded-xl p-3">
            {videoItem && mediaFile ? (
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground truncate max-w-[180px]">{mediaFile.name}</span>
                <span className="text-foreground font-medium ml-2 shrink-0">
                  {Math.floor(clipDuration / 60)}:{String(Math.floor(clipDuration % 60)).padStart(2, '0')} min
                </span>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Nenhum vídeo na timeline. Importe um vídeo primeiro.</p>
            )}
          </div>

          {/* Uso mensal */}
          <div>
            <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
              <span>Uso mensal</span>
              <span className={remainingMin < 10 ? 'text-orange-400' : 'text-foreground'}>
                {usedMin}/{limitMin} min usados
              </span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${usagePercent}%`,
                  background: usagePercent > 80 ? '#f97316' : 'hsl(var(--primary))',
                }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">{remainingMin} minutos restantes este mês</p>
          </div>

          {/* Idioma */}
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1.5">Idioma do vídeo</label>
            <select
              value={language}
              onChange={e => setLanguage(e.target.value)}
              className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              {LANGUAGES.map(l => (
                <option key={l.code} value={l.code}>{l.label}</option>
              ))}
            </select>
          </div>

          {/* Palavras por legenda */}
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1.5">Palavras por legenda</label>
            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3].map(n => (
                <button
                  key={n}
                  onClick={() => setMaxWords(n)}
                  className={`py-2 rounded-xl border text-xs font-medium transition-all ${
                    maxWords === n
                      ? 'border-primary bg-primary/10 text-foreground'
                      : 'border-border bg-muted text-muted-foreground hover:border-primary/50'
                  }`}
                >
                  {n} {n === 1 ? 'palavra' : 'palavras'}
                </button>
              ))}
            </div>
          </div>

          {/* Estilo */}
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1.5">Estilo da legenda</label>
            <div className="grid grid-cols-2 gap-2">
              {STYLE_OPTIONS.map(s => (
                <button
                  key={s.id}
                  onClick={() => setStyle(s.id)}
                  className={`flex flex-col items-center gap-1.5 p-2.5 rounded-xl border transition-all ${
                    style === s.id
                      ? 'border-primary bg-primary/10'
                      : 'border-border bg-muted hover:border-primary/50'
                  }`}
                >
                  <div
                    className="w-full h-8 rounded-lg flex items-center justify-center"
                    style={{ background: (!s.preview.background || s.preview.background === 'transparent') ? '#111' : s.preview.background as string }}
                  >
                    <span className="text-xs font-bold px-1.5" style={{ ...s.preview, background: undefined, fontSize: '12px' }}>
                      Exemplo
                    </span>
                  </div>
                  <span className={`text-xs font-medium ${style === s.id ? 'text-foreground' : 'text-muted-foreground'}`}>{s.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Erro */}
          {error && (
            <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded-xl p-3">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <p className="text-xs text-red-400">{error}</p>
            </div>
          )}

          {/* Status de geração */}
          {generating && statusLabel && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>{statusLabel}</span>
            </div>
          )}

          {/* Aviso de clipe muito longo */}
          {videoItem && clipDuration > remainingSec && (
            <div className="flex items-start gap-2 bg-orange-500/10 border border-orange-500/30 rounded-xl p-3">
              <AlertCircle className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
              <p className="text-xs text-orange-400">
                Este clipe ({Math.ceil(clipDuration / 60)} min) excede seu limite restante ({remainingMin} min).
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 pt-3 flex gap-2 border-t border-border shrink-0">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-border text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancelar
          </button>
          <Button
            onClick={handleGenerate}
            disabled={!canGenerate}
            className="flex-1 gap-1.5 gradient-viral text-white border-0 h-10"
          >
            {generating ? (
              <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Gerando...</>
            ) : (
              <><CheckCircle2 className="w-3.5 h-3.5" /> Gerar Legendas</>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
