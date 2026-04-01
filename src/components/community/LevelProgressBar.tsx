import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ChevronDown, ChevronUp } from 'lucide-react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

const LEVEL_ICONS: Record<number, string> = {
  1: '🏚️',
  2: '🏠',
  3: '🏡',
  4: '🏢',
  5: '🏬',
  6: '🏆',
};

interface Requirement {
  label: string;
  detail: string;
  currentLabel: (v: number) => string;
  target: number;
}

const NEXT_LEVEL_REQUIREMENTS: Record<number, Requirement> = {
  1: {
    label: 'Ficar online por 60 segundos',
    detail: 'Basta permanecer na aba da Comunidade por 1 minuto.',
    currentLabel: (v) => `${v}/60 segundos`,
    target: 60,
  },
  2: {
    label: 'Fazer 2 amigos na comunidade',
    detail: 'Clique em perfis de outros usuários e envie pedido de amizade.',
    currentLabel: (v) => `${v}/2 amigos`,
    target: 2,
  },
  3: {
    label: 'Anunciar um produto no Shopping',
    detail: 'Acesse o Shopping do Editor e publique um produto para venda.',
    currentLabel: (v) => v >= 1 ? '1/1 produto anunciado ✓' : '0/1 produto anunciado',
    target: 1,
  },
  4: {
    label: 'Realizar 5 vendas como afiliado',
    detail: 'Compartilhe seu link de afiliado e converta 5 vendas.',
    currentLabel: (v) => `${v}/5 vendas`,
    target: 5,
  },
  5: {
    label: 'Realizar 20 vendas no último mês',
    detail: 'Mantenha um alto volume de vendas pelo seu link de afiliado.',
    currentLabel: (v) => `${v}/20 vendas este mês`,
    target: 20,
  },
};

interface LevelProgressBarProps {
  currentUserId: string | null;
  currentLevel: number | null;
}

export function LevelProgressBar({ currentUserId, currentLevel }: LevelProgressBarProps) {
  const [dbValue, setDbValue] = useState(0);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [showDetail, setShowDetail] = useState(false);

  const level = currentLevel ?? 1;
  const isMaxLevel = level >= 6;
  const req = NEXT_LEVEL_REQUIREMENTS[level];

  // ── Timer client-side para nível 1 → 2 (60s online) ───────────────────────
  useEffect(() => {
    if (level !== 1 || !currentUserId) return;
    const interval = setInterval(() => {
      setTimerSeconds(s => Math.min(s + 1, 60));
    }, 1_000);
    return () => clearInterval(interval);
  }, [level, currentUserId]);

  // ── Busca progresso do DB para níveis 2-5 ─────────────────────────────────
  const fetchProgress = useCallback(async () => {
    if (!currentUserId || isMaxLevel || level === 1) return;

    if (level === 2) {
      const [r1, r2] = await Promise.all([
        db.from('friendships').select('id', { count: 'exact', head: true })
          .eq('user_id', currentUserId).eq('status', 'accepted'),
        db.from('friendships').select('id', { count: 'exact', head: true })
          .eq('friend_id', currentUserId).eq('status', 'accepted'),
      ]);
      setDbValue(Math.min((r1.count ?? 0) + (r2.count ?? 0), 2));
      return;
    }

    if (level === 3) {
      const { count } = await db.from('products')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', currentUserId)
        .neq('status', 'inactive');
      setDbValue(Math.min(count ?? 0, 1));
      return;
    }

    if (level === 4) {
      const { data: aff } = await db.from('affiliates')
        .select('id').eq('user_id', currentUserId).maybeSingle();
      if (!aff) { setDbValue(0); return; }
      const { count } = await db.from('referrals')
        .select('id', { count: 'exact', head: true })
        .eq('affiliate_id', aff.id).eq('status', 'converted');
      setDbValue(Math.min(count ?? 0, 5));
      return;
    }

    if (level === 5) {
      const { data: aff } = await db.from('affiliates')
        .select('id').eq('user_id', currentUserId).maybeSingle();
      if (!aff) { setDbValue(0); return; }
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { count } = await db.from('referrals')
        .select('id', { count: 'exact', head: true })
        .eq('affiliate_id', aff.id).eq('status', 'converted').gte('created_at', since);
      setDbValue(Math.min(count ?? 0, 20));
    }
  }, [currentUserId, level, isMaxLevel]);

  useEffect(() => { fetchProgress(); }, [fetchProgress]);

  // ── Cálculo visual ─────────────────────────────────────────────────────────
  const currentValue = level === 1 ? timerSeconds : dbValue;
  const target = req?.target ?? 1;
  const percent = isMaxLevel ? 100 : Math.min(100, Math.round((currentValue / target) * 100));

  if (!currentUserId || currentLevel === null) return null;

  return (
    <div className="relative shrink-0">
      {/* Barra clicável */}
      <button
        onClick={() => setShowDetail(v => !v)}
        className="w-full flex items-center gap-2 px-4 py-1.5 bg-black/20 border-b border-white/5 hover:bg-white/[0.03] transition-colors"
      >
        <span className="text-base leading-none">{LEVEL_ICONS[level] ?? '🏗️'}</span>

        <span className="text-[11px] text-muted-foreground whitespace-nowrap font-medium">
          Nível {level}
        </span>

        {/* Track */}
        <div className="flex-1 bg-white/10 rounded-full h-1.5 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${
              isMaxLevel
                ? 'bg-amber-400'
                : 'bg-gradient-to-r from-violet-500 to-purple-400'
            }`}
            style={{ width: `${percent}%` }}
          />
        </div>

        {isMaxLevel ? (
          <span className="text-[11px] text-amber-400 font-semibold whitespace-nowrap">
            Nível Máximo 🏆
          </span>
        ) : (
          <>
            <span className="text-[11px] text-muted-foreground whitespace-nowrap">
              {percent}%
            </span>
            <span className="text-[11px] text-violet-400 whitespace-nowrap">
              → Nível {level + 1} {LEVEL_ICONS[level + 1] ?? ''}
            </span>
          </>
        )}

        {!isMaxLevel && (
          showDetail
            ? <ChevronUp  className="w-3 h-3 text-muted-foreground shrink-0" />
            : <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" />
        )}
      </button>

      {/* Painel de detalhes */}
      {showDetail && !isMaxLevel && req && (
        <div
          className="absolute top-full left-0 right-0 z-50 bg-[#13131a] border-b border-x border-white/10 shadow-2xl px-4 py-3 animate-in fade-in slide-in-from-top-1 duration-150"
        >
          <p className="text-[11px] text-violet-400 font-semibold uppercase tracking-wide mb-1">
            Para chegar ao Nível {level + 1} {LEVEL_ICONS[level + 1] ?? ''}
          </p>
          <p className="text-sm text-white font-medium mb-0.5">{req.label}</p>
          <p className="text-xs text-muted-foreground mb-3">{req.detail}</p>

          <div className="flex items-center gap-2">
            <div className="flex-1 bg-white/10 rounded-full h-1.5 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-violet-500 to-purple-400 rounded-full transition-all duration-700"
                style={{ width: `${percent}%` }}
              />
            </div>
            <span className="text-[11px] text-muted-foreground whitespace-nowrap">
              {req.currentLabel(currentValue)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
