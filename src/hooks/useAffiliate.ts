/**
 * useAffiliate
 *
 * Hook central do sistema de afiliados v2.
 * Gerencia:
 * - Estado do afiliado do usuário logado
 * - Cadastro como afiliado (com MLM: captura referred_by_affiliate_id)
 * - Métricas do dashboard (pendente/disponível/pago)
 * - Indicações (referrals)
 * - Comissões com carência de 7 dias
 * - Solicitações de saque
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { getStoredRefCode } from '@/hooks/useAffiliateTracking';
import type {
  Affiliate,
  Referral,
  Commission,
  WithdrawalRequest,
  AffiliateDashboardStats,
} from '@/types/affiliates';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

/** Gera código de referência único (8 chars alfanuméricos) */
const generateRefCode = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array.from({ length: 8 }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join('');
};

export const useAffiliate = () => {
  const { user } = useAuth();

  const [affiliate, setAffiliate] = useState<Affiliate | null>(null);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);

  const [stats, setStats] = useState<AffiliateDashboardStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [referralsLoading, setReferralsLoading] = useState(false);

  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [commissionsLoading, setCommissionsLoading] = useState(false);

  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [withdrawalsLoading, setWithdrawalsLoading] = useState(false);
  const [withdrawalSubmitting, setWithdrawalSubmitting] = useState(false);

  // ─── Busca afiliado do usuário logado ───────────────────────────────────────

  const fetchAffiliate = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);

    const { data } = await db
      .from('affiliates')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    setAffiliate(data as Affiliate | null);
    setLoading(false);
  }, [user]);

  // ─── Libera comissões com carência vencida (via função SECURITY DEFINER) ────

  const releaseAvailableCommissions = useCallback(async (affiliateId: string) => {
    await db.rpc('release_available_commissions', { p_affiliate_id: affiliateId });
  }, []);

  // ─── Métricas consolidadas ───────────────────────────────────────────────────

  const fetchStats = useCallback(async (affiliateId: string) => {
    setStatsLoading(true);

    const [clicksRes, referralsRes, commissionsRes] = await Promise.all([
      db.from('ref_clicks').select('id, converted').eq('affiliate_id', affiliateId),
      db.from('referrals').select('id, status').eq('affiliate_id', affiliateId),
      db.from('commissions').select('id, amount, status').eq('affiliate_id', affiliateId),
    ]);

    const clicks = (clicksRes.data ?? []) as { id: string; converted: boolean }[];
    const refs = (referralsRes.data ?? []) as { id: string; status: string }[];
    const comms = (commissionsRes.data ?? []) as { id: string; amount: number; status: string }[];

    const converted = refs.filter(r => r.status === 'converted').length;
    const cancelled = refs.filter(r => r.status === 'cancelled').length;
    const finished = converted + cancelled;

    const pendingBalance = comms
      .filter(c => c.status === 'pending')
      .reduce((sum, c) => sum + Number(c.amount), 0);
    const availableBalance = comms
      .filter(c => c.status === 'available' || c.status === 'approved')
      .reduce((sum, c) => sum + Number(c.amount), 0);
    const paidBalance = comms
      .filter(c => c.status === 'paid')
      .reduce((sum, c) => sum + Number(c.amount), 0);
    const totalEarned = comms
      .filter(c => c.status !== 'cancelled')
      .reduce((sum, c) => sum + Number(c.amount), 0);

    setStats({
      totalClicks: clicks.length,
      totalReferrals: refs.length,
      convertedReferrals: converted,
      activeClients: converted,
      cancelledClients: cancelled,
      churnRate: finished > 0 ? Math.round((cancelled / finished) * 100) : 0,
      pendingBalance,
      availableBalance,
      paidBalance,
      totalEarned,
    });

    setStatsLoading(false);
  }, []);

  // ─── Indicações ──────────────────────────────────────────────────────────────

  const fetchReferrals = useCallback(async (affiliateId: string) => {
    setReferralsLoading(true);

    const { data: refs } = await db
      .from('referrals')
      .select('*')
      .eq('affiliate_id', affiliateId)
      .order('created_at', { ascending: false });

    const list = (refs ?? []) as Referral[];

    const userIds = list
      .map(r => r.referred_user_id)
      .filter(Boolean) as string[];

    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, display_name, avatar_url')
        .in('user_id', userIds);

      const profileMap = new Map(
        (profiles ?? []).map(p => [p.user_id, p])
      );

      list.forEach(r => {
        if (r.referred_user_id && profileMap.has(r.referred_user_id)) {
          const p = profileMap.get(r.referred_user_id)!;
          r.profile = { display_name: p.display_name, avatar_url: p.avatar_url };
        }
      });
    }

    setReferrals(list);
    setReferralsLoading(false);
  }, []);

  // ─── Comissões ───────────────────────────────────────────────────────────────

  const fetchCommissions = useCallback(async (affiliateId: string) => {
    setCommissionsLoading(true);

    const { data } = await db
      .from('commissions')
      .select('*')
      .eq('affiliate_id', affiliateId)
      .order('created_at', { ascending: false });

    setCommissions((data ?? []) as Commission[]);
    setCommissionsLoading(false);
  }, []);

  // ─── Solicitações de saque ───────────────────────────────────────────────────

  const fetchWithdrawals = useCallback(async (affiliateId: string) => {
    setWithdrawalsLoading(true);

    const { data } = await db
      .from('withdrawal_requests')
      .select('*')
      .eq('affiliate_id', affiliateId)
      .order('requested_at', { ascending: false });

    setWithdrawals((data ?? []) as WithdrawalRequest[]);
    setWithdrawalsLoading(false);
  }, []);

  // ─── Solicitar saque ─────────────────────────────────────────────────────────

  const requestWithdrawal = useCallback(
    async (amount: number, pixKey: string, notes?: string): Promise<{ error?: string }> => {
      if (!affiliate) return { error: 'Você não é afiliado' };
      if (withdrawalSubmitting) return { error: 'Aguarde...' };
      setWithdrawalSubmitting(true);

      const { error } = await db.from('withdrawal_requests').insert({
        affiliate_id: affiliate.id,
        amount,
        pix_key: pixKey.trim(),
        notes: notes?.trim() || null,
        status: 'pending',
      });

      setWithdrawalSubmitting(false);
      if (error) return { error: error.message };
      await fetchWithdrawals(affiliate.id);
      return {};
    },
    [affiliate, withdrawalSubmitting, fetchWithdrawals]
  );

  // ─── Cadastro como afiliado ──────────────────────────────────────────────────

  const register = useCallback(async (whatsapp?: string, pixKey?: string): Promise<{ error?: string }> => {
    if (!user || registering) return { error: 'Não autorizado' };
    setRegistering(true);

    // Gera ref_code único (até 3 tentativas)
    let refCode = generateRefCode();
    for (let i = 0; i < 3; i++) {
      const { data: existing } = await db
        .from('affiliates')
        .select('id')
        .eq('ref_code', refCode)
        .maybeSingle();
      if (!existing) break;
      refCode = generateRefCode();
    }

    // Captura quem indicou este afiliado (MLM nível 2)
    let referredByAffiliateId: string | null = null;
    const storedRef = getStoredRefCode();
    if (storedRef) {
      const { data: referrer } = await db
        .from('affiliates')
        .select('id')
        .eq('ref_code', storedRef)
        .eq('status', 'active')
        .maybeSingle();
      referredByAffiliateId = referrer?.id ?? null;
    }

    const { data, error } = await db
      .from('affiliates')
      .insert({
        user_id: user.id,
        ref_code: refCode,
        status: 'active',
        commission_rate: 50.00,
        referred_by_affiliate_id: referredByAffiliateId,
        email: user.email ?? null,
        whatsapp: whatsapp?.trim() || null,
        pix_key: pixKey?.trim() || null,
      })
      .select()
      .maybeSingle();

    setRegistering(false);

    if (error) return { error: error.message };
    setAffiliate(data as Affiliate);
    return {};
  }, [user, registering]);

  // ─── Efeitos ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    fetchAffiliate();
  }, [fetchAffiliate]);

  useEffect(() => {
    if (!affiliate) return;
    // Libera comissões com carência vencida, depois atualiza stats
    releaseAvailableCommissions(affiliate.id).then(() => {
      fetchStats(affiliate.id);
      fetchCommissions(affiliate.id);
    });
    fetchReferrals(affiliate.id);
    fetchWithdrawals(affiliate.id);
  }, [affiliate?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── API Pública ─────────────────────────────────────────────────────────────

  return {
    affiliate,
    loading,
    registering,
    stats,
    statsLoading,
    referrals,
    referralsLoading,
    commissions,
    commissionsLoading,
    withdrawals,
    withdrawalsLoading,
    withdrawalSubmitting,
    register,
    requestWithdrawal,
    refetch: {
      stats: () => affiliate && fetchStats(affiliate.id),
      referrals: () => affiliate && fetchReferrals(affiliate.id),
      commissions: () => affiliate && fetchCommissions(affiliate.id),
      withdrawals: () => affiliate && fetchWithdrawals(affiliate.id),
    },
  };
};
