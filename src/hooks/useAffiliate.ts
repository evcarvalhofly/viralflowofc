/**
 * useAffiliate
 *
 * Hook central do sistema de afiliados.
 * Gerencia:
 * - Estado do afiliado do usuário logado
 * - Cadastro como afiliado
 * - Métricas do dashboard
 * - Indicações (referrals)
 * - Comissões
 * - Contas criadas para revenda
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type {
  Affiliate,
  Referral,
  Commission,
  AffiliateCreatedAccount,
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

  const [createdAccounts, setCreatedAccounts] = useState<AffiliateCreatedAccount[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(false);

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

  // ─── Métricas consolidadas ───────────────────────────────────────────────────

  const fetchStats = useCallback(async (affiliateId: string) => {
    setStatsLoading(true);

    const [clicksRes, referralsRes, commissionsRes, accountsRes] =
      await Promise.all([
        db.from('ref_clicks').select('id, converted').eq('affiliate_id', affiliateId),
        db.from('referrals').select('id, status').eq('affiliate_id', affiliateId),
        db.from('commissions').select('id, amount, status').eq('affiliate_id', affiliateId),
        db.from('affiliate_created_accounts').select('id, status').eq('affiliate_id', affiliateId),
      ]);

    const clicks = (clicksRes.data ?? []) as { id: string; converted: boolean }[];
    const refs = (referralsRes.data ?? []) as { id: string; status: string }[];
    const comms = (commissionsRes.data ?? []) as { id: string; amount: number; status: string }[];
    const accounts = (accountsRes.data ?? []) as { id: string; status: string }[];

    const converted = refs.filter(r => r.status === 'converted').length;
    const cancelled = refs.filter(r => r.status === 'cancelled').length;
    const finished = converted + cancelled;

    const pendingComm = comms
      .filter(c => c.status === 'pending' || c.status === 'approved')
      .reduce((sum, c) => sum + Number(c.amount), 0);
    const paidComm = comms
      .filter(c => c.status === 'paid')
      .reduce((sum, c) => sum + Number(c.amount), 0);
    const totalEarned = comms.reduce((sum, c) => sum + Number(c.amount), 0);

    setStats({
      totalClicks: clicks.length,
      totalReferrals: refs.length,
      convertedReferrals: converted,
      activeClients: converted,
      cancelledClients: cancelled,
      churnRate: finished > 0 ? Math.round((cancelled / finished) * 100) : 0,
      pendingCommissions: pendingComm,
      totalEarned,
      paidCommissions: paidComm,
      loginsRegistered: accounts.length,
      loginsActive: accounts.filter(a => a.status === 'active').length,
      loginsPending: accounts.filter(a => a.status === 'available').length,
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

    // Busca profiles dos usuários indicados
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

  // ─── Contas criadas para revenda ─────────────────────────────────────────────

  const fetchCreatedAccounts = useCallback(async (affiliateId: string) => {
    setAccountsLoading(true);

    const { data } = await db
      .from('affiliate_created_accounts')
      .select('*')
      .eq('affiliate_id', affiliateId)
      .order('created_at', { ascending: false });

    setCreatedAccounts((data ?? []) as AffiliateCreatedAccount[]);
    setAccountsLoading(false);
  }, []);

  // ─── Cadastro como afiliado ──────────────────────────────────────────────────

  const register = useCallback(async (): Promise<{ error?: string }> => {
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

    const { data, error } = await db
      .from('affiliates')
      .insert({
        user_id: user.id,
        ref_code: refCode,
        status: 'active',
        commission_rate: 30.00,
      })
      .select()
      .maybeSingle();

    setRegistering(false);

    if (error) return { error: error.message };
    setAffiliate(data as Affiliate);
    return {};
  }, [user, registering]);

  // ─── Registrar cliente (compra de login) ─────────────────────────────────────

  const registerClientLogin = useCallback(
    async (
      email: string,
      clientName?: string,
      notes?: string
    ): Promise<{ error?: string }> => {
      if (!affiliate) return { error: 'Você não é afiliado' };

      const { error } = await db.from('affiliate_created_accounts').insert({
        affiliate_id: affiliate.id,
        login_email: email.trim().toLowerCase(),
        client_name: clientName?.trim() || null,
        notes: notes?.trim() || null,
        status: 'available',
      });

      if (error) return { error: error.message };
      await fetchCreatedAccounts(affiliate.id);
      return {};
    },
    [affiliate, fetchCreatedAccounts]
  );

  // ─── Atualizar status de conta ───────────────────────────────────────────────

  const updateAccountStatus = useCallback(
    async (accountId: string, status: string): Promise<{ error?: string }> => {
      const updateData: Record<string, unknown> = { status };
      if (status === 'cancelled') updateData.cancelled_at = new Date().toISOString();

      const { error } = await db
        .from('affiliate_created_accounts')
        .update(updateData)
        .eq('id', accountId);

      if (error) return { error: error.message };
      if (affiliate) await fetchCreatedAccounts(affiliate.id);
      return {};
    },
    [affiliate, fetchCreatedAccounts]
  );

  // ─── Efeitos ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    fetchAffiliate();
  }, [fetchAffiliate]);

  useEffect(() => {
    if (!affiliate) return;
    fetchStats(affiliate.id);
    fetchReferrals(affiliate.id);
    fetchCommissions(affiliate.id);
    fetchCreatedAccounts(affiliate.id);
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
    createdAccounts,
    accountsLoading,
    register,
    registerClientLogin,
    updateAccountStatus,
    refetch: {
      stats: () => affiliate && fetchStats(affiliate.id),
      referrals: () => affiliate && fetchReferrals(affiliate.id),
      commissions: () => affiliate && fetchCommissions(affiliate.id),
      accounts: () => affiliate && fetchCreatedAccounts(affiliate.id),
    },
  };
};
