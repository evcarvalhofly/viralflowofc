import { useEffect } from 'react';
import { LevelUpEvent, LEVEL_UP_MESSAGES } from '@/hooks/useLevelProgression';

interface LevelUpModalProps {
  event: LevelUpEvent;
  onClose: () => void;
}

const LEVEL_COLORS: Record<number, string> = {
  2: 'from-blue-900/95 to-blue-800/95 border-blue-500/50 shadow-blue-500/20',
  3: 'from-emerald-900/95 to-green-800/95 border-emerald-500/50 shadow-emerald-500/20',
  4: 'from-slate-800/95 to-slate-700/95 border-slate-400/50 shadow-slate-400/20',
  5: 'from-violet-900/95 to-purple-800/95 border-violet-500/50 shadow-violet-500/20',
  6: 'from-amber-900/95 to-yellow-800/95 border-amber-400/50 shadow-amber-400/30',
};

export function LevelUpModal({ event, onClose }: LevelUpModalProps) {
  const msg    = LEVEL_UP_MESSAGES[event.newLevel];
  const colors = LEVEL_COLORS[event.newLevel] ?? LEVEL_COLORS[5];

  // Auto-dismiss after 6 seconds
  useEffect(() => {
    const t = setTimeout(onClose, 6_000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center pointer-events-none p-4">
      <div
        className={`
          bg-gradient-to-br ${colors} border rounded-2xl p-6
          shadow-2xl mx-auto w-full max-w-xs pointer-events-auto text-center
          animate-in slide-in-from-bottom-4 fade-in duration-500
        `}
      >
        <div className="text-5xl mb-3 animate-bounce">{msg?.emoji ?? '⬆️'}</div>

        <p className="text-yellow-400 font-extrabold text-sm tracking-widest uppercase mb-1">
          Level Up!
        </p>
        <p className="text-white font-bold text-xl mb-2">
          Nível {event.newLevel} Desbloqueado
        </p>
        <p className="text-muted-foreground text-sm mb-5">
          {msg?.description ?? 'Parabéns pela evolução!'}
        </p>

        {/* Progress bar (auto-dismiss countdown visual) */}
        <div className="h-0.5 bg-white/10 rounded-full overflow-hidden mb-4">
          <div
            className="h-full bg-yellow-400/60 rounded-full"
            style={{ animation: 'shrink 6s linear forwards' }}
          />
        </div>

        <button
          onClick={onClose}
          className="text-xs text-muted-foreground hover:text-white transition-colors"
        >
          Fechar
        </button>
      </div>

      <style>{`
        @keyframes shrink {
          from { width: 100%; }
          to   { width: 0%; }
        }
      `}</style>
    </div>
  );
}
