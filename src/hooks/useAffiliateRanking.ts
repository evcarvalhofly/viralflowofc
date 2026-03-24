/**
 * useAffiliateRanking
 *
 * Busca o ranking de afiliados via função SQL `get_affiliate_ranking()`
 * que usa SECURITY DEFINER para ter acesso a todos os afiliados
 * sem violar as políticas de RLS individuais.
 */

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { AffiliateRankingEntry } from '@/types/affiliates';

export const useAffiliateRanking = () => {
  const [ranking, setRanking] = useState<AffiliateRankingEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRanking = async () => {
    setLoading(true);
    setError(null);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error: rpcError } = await (supabase as any).rpc('get_affiliate_ranking');

    if (rpcError) {
      setError(rpcError.message);
    } else {
      setRanking(
        ((data ?? []) as (AffiliateRankingEntry & { rank_position?: number })[]).map((row, idx) => ({
          ...row,
          position: Number(row.rank_position ?? idx + 1),
          active_clients: Number(row.active_clients),
          total_earned: Number(row.total_earned),
        }))
      );
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchRanking();
  }, []);

  return { ranking, loading, error, refetch: fetchRanking };
};
