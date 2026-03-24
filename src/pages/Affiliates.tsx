/**
 * Affiliates — Página principal do sistema de afiliados
 *
 * Lógica de exibição:
 * - Se o usuário NÃO é afiliado → AffiliateRegistration
 * - Se é afiliado → Dashboard com 5 abas:
 *     1. Visão Geral (stats + indicados)
 *     2. Meu Link
 *     3. Comissões
 *     4. Clientes (compra de login / revenda)
 *     5. Ranking
 *
 * Se o usuário logado for o admin (evcarvalhodev@gmail.com),
 * ele também vê botões de ativação na aba "Clientes".
 */

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Handshake, Link2, DollarSign, Users, Trophy, LayoutDashboard } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useAffiliate } from '@/hooks/useAffiliate';

import AffiliateRegistration from '@/components/affiliates/AffiliateRegistration';
import StatsCards from '@/components/affiliates/StatsCards';
import AffiliateLinkPanel from '@/components/affiliates/AffiliateLinkPanel';
import CommissionHistory from '@/components/affiliates/CommissionHistory';
import LoginPurchasePanel from '@/components/affiliates/LoginPurchasePanel';
import AffiliateRanking from '@/components/affiliates/AffiliateRanking';
import ReferralsList from '@/components/affiliates/ReferralsList';

const ADMIN_EMAIL = 'evcarvalhodev@gmail.com';

const Affiliates = () => {
  const { user } = useAuth();
  const isAdmin = user?.email === ADMIN_EMAIL;

  const {
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
  } = useAffiliate();

  // ─── Loading inicial ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  // ─── Sem cadastro → tela de adesão ──────────────────────────────────────────
  if (!affiliate) {
    return (
      <AffiliateRegistration
        onRegister={register}
        registering={registering}
      />
    );
  }

  // ─── Dashboard do afiliado ───────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-border/60 bg-card/30 px-4 sm:px-6 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between max-w-5xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/15 rounded-lg">
              <Handshake className="h-5 w-5 text-purple-400" />
            </div>
            <div>
              <h1 className="font-bold text-lg leading-tight">Programa de Afiliados</h1>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Código:</span>
                <Badge
                  variant="outline"
                  className="font-mono text-xs border-purple-400/50 text-purple-300 h-5 px-2"
                >
                  {affiliate.ref_code}
                </Badge>
                <Badge
                  variant="outline"
                  className={`text-[10px] h-5 px-2 ${
                    affiliate.status === 'active'
                      ? 'border-emerald-400/50 text-emerald-400'
                      : 'border-red-400/50 text-red-400'
                  }`}
                >
                  {affiliate.status === 'active' ? 'Ativo' : 'Suspenso'}
                </Badge>
              </div>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Comissão</p>
            <p className="text-2xl font-black text-emerald-400">
              {affiliate.commission_rate}%
            </p>
            <p className="text-[10px] text-muted-foreground">por mensalidade</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4">
          <Tabs defaultValue="overview">
            <TabsList className="w-full grid grid-cols-5 h-9 mb-5 bg-card/50">
              <TabsTrigger value="overview" className="text-xs gap-1.5">
                <LayoutDashboard className="h-3.5 w-3.5 hidden sm:block" />
                Geral
              </TabsTrigger>
              <TabsTrigger value="link" className="text-xs gap-1.5">
                <Link2 className="h-3.5 w-3.5 hidden sm:block" />
                Link
              </TabsTrigger>
              <TabsTrigger value="commissions" className="text-xs gap-1.5">
                <DollarSign className="h-3.5 w-3.5 hidden sm:block" />
                Comissões
              </TabsTrigger>
              <TabsTrigger value="clients" className="text-xs gap-1.5">
                <Users className="h-3.5 w-3.5 hidden sm:block" />
                Clientes
              </TabsTrigger>
              <TabsTrigger value="ranking" className="text-xs gap-1.5">
                <Trophy className="h-3.5 w-3.5 hidden sm:block" />
                Ranking
              </TabsTrigger>
            </TabsList>

            {/* ── Visão Geral ─────────────────────────────────────────────── */}
            <TabsContent value="overview" className="space-y-5 mt-0">
              <StatsCards stats={stats} loading={statsLoading} />
              <ReferralsList referrals={referrals} loading={referralsLoading} />
            </TabsContent>

            {/* ── Meu Link ─────────────────────────────────────────────────── */}
            <TabsContent value="link" className="mt-0">
              <AffiliateLinkPanel affiliate={affiliate} stats={stats} />
            </TabsContent>

            {/* ── Comissões ────────────────────────────────────────────────── */}
            <TabsContent value="commissions" className="mt-0">
              <CommissionHistory
                commissions={commissions}
                loading={commissionsLoading}
              />
            </TabsContent>

            {/* ── Clientes (revenda de acesso) ─────────────────────────────── */}
            <TabsContent value="clients" className="mt-0">
              <LoginPurchasePanel
                accounts={createdAccounts}
                loading={accountsLoading}
                onAdd={registerClientLogin}
                onUpdateStatus={updateAccountStatus}
                isAdmin={isAdmin}
              />
            </TabsContent>

            {/* ── Ranking ──────────────────────────────────────────────────── */}
            <TabsContent value="ranking" className="mt-0">
              <AffiliateRanking currentAffiliate={affiliate} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default Affiliates;
