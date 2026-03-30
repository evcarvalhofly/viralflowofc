import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface LevelUpEvent {
  previousLevel: number;
  newLevel: number;
}

export const LEVEL_UP_MESSAGES: Record<number, { emoji: string; description: string }> = {
  2: { emoji: '🏗️', description: 'Você ficou logado por 60 segundos!' },
  3: { emoji: '🤝', description: 'Você fez 2 amigos na comunidade!' },
  4: { emoji: '🛍️', description: 'Você anunciou um produto no Shopping!' },
  5: { emoji: '💼', description: 'Você realizou 5 vendas como afiliado!' },
  6: { emoji: '🏆', description: 'Você fez 20 vendas no último mês!' },
};

interface UseLevelProgressionOptions {
  currentUserId: string | null;
  /** Current nivel from the profiles table for the logged-in user. */
  currentUserLevel: number | null;
  onLevelUp: (event: LevelUpEvent) => void;
  /** Called after a level-up so the parent can refresh profile data. */
  onRefresh: () => void;
}

/** Calls the DB function and fires onLevelUp if the level increased. */
async function runServerCheck(
  userId: string,
  knownLevel: number,
  onLevelUp: (e: LevelUpEvent) => void,
  onRefresh: () => void,
) {
  try {
    const db = supabase as any;
    const { data: newLevel, error } = await db.rpc('check_and_upgrade_building_level', {
      p_user_id: userId,
    });
    if (!error && newLevel && Number(newLevel) > knownLevel) {
      onLevelUp({ previousLevel: knownLevel, newLevel: Number(newLevel) });
      onRefresh();
    }
  } catch {
    // Non-critical — ignore network/RPC errors
  }
}

/**
 * Manages building level progression for the current user.
 *
 * - Level 1 → 2  is handled client-side: starts a 60-second timer when the
 *   user is online and at nivel 1. Fires a direct DB UPDATE after the timer.
 *
 * - Level 2 → 6  are checked server-side via `check_and_upgrade_building_level`
 *   on mount (after the user is at nivel ≥ 2) and after each level-1→2 upgrade.
 */
export function useLevelProgression({
  currentUserId,
  currentUserLevel,
  onLevelUp,
  onRefresh,
}: UseLevelProgressionOptions) {
  const timerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const checkedRef  = useRef(false);

  // ── Level 1 → 2 : 60-second online timer ──────────────────────────────────
  useEffect(() => {
    if (!currentUserId || currentUserLevel !== 1) return;

    timerRef.current = setTimeout(async () => {
      // Direct update to level 2
      await supabase
        .from('profiles')
        .update({ nivel: 2, updated_at: new Date().toISOString() })
        .eq('user_id', currentUserId);

      onLevelUp({ previousLevel: 1, newLevel: 2 });
      onRefresh();

      // Immediately run server check in case other requirements are already met
      await runServerCheck(currentUserId, 2, onLevelUp, onRefresh);
    }, 60_000); // 60 seconds

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId, currentUserLevel]);

  // ── Level 2+ : server-side check on mount ─────────────────────────────────
  useEffect(() => {
    if (!currentUserId || currentUserLevel === null || currentUserLevel < 2) return;
    if (checkedRef.current) return;
    checkedRef.current = true;

    runServerCheck(currentUserId, currentUserLevel, onLevelUp, onRefresh);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId, currentUserLevel]);
}
