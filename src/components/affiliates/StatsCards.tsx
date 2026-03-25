/**
 * StatsCards
 *
 * Cards de métricas do dashboard do afiliado v2.
 * Layout responsivo: 2 colunas no mobile, 3 no tablet, 6 no desktop.
 */

import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  MousePointerClick, Users, DollarSign, Clock,
  CheckCircle2, XCircle, TrendingDown, ArrowUpRight, Wallet,
} from 'lucide-react';
import type { AffiliateDashboardStats } from '@/types/affiliates';

interface Props {
  stats: AffiliateDashboardStats | null;
  loading: boolean;
}

const fmt = (val: number, currency = false) =>
  currency
    ? `R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
    : val.toLocaleString('pt-BR');

const cards = (s: AffiliateDashboardStats) => [
  {
    label: 'Cliques no link',
    value: fmt(s.totalClicks),
    icon: <MousePointerClick className="h-5 w-5" />,
    color: 'text-cyan-400',
    bg: 'bg-cyan-400/10',
    sub: `${s.convertedReferrals} convertidos`,
    subIcon: <ArrowUpRight className="h-3 w-3 text-emerald-400" />,
  },
  {
    label: 'Clientes ativos',
    value: fmt(s.activeClients),
    icon: <Users className="h-5 w-5" />,
    color: 'text-purple-400',
    bg: 'bg-purple-400/10',
    sub: `${s.totalReferrals} total de indicações`,
    subIcon: null,
  },
  {
    label: 'Receita gerada',
    value: fmt(s.totalEarned, true),
    icon: <DollarSign className="h-5 w-5" />,
    color: 'text-emerald-400',
    bg: 'bg-emerald-400/10',
    sub: `${fmt(s.paidBalance, true)} sacados`,
    subIcon: <CheckCircle2 className="h-3 w-3 text-emerald-400" />,
  },
  {
    label: 'Em carência',
    value: fmt(s.pendingBalance, true),
    icon: <Clock className="h-5 w-5" />,
    color: 'text-orange-400',
    bg: 'bg-orange-400/10',
    sub: 'Libera em 7 dias',
    subIcon: null,
  },
  {
    label: 'Disponível p/ saque',
    value: fmt(s.availableBalance, true),
    icon: <Wallet className="h-5 w-5" />,
    color: 'text-yellow-400',
    bg: 'bg-yellow-400/10',
    sub: 'Pronto para sacar',
    subIcon: s.availableBalance > 0
      ? <CheckCircle2 className="h-3 w-3 text-yellow-400" />
      : null,
  },
  {
    label: 'Taxa de cancelamento',
    value: `${s.churnRate}%`,
    icon: <TrendingDown className="h-5 w-5" />,
    color: s.churnRate > 20 ? 'text-red-400' : 'text-green-400',
    bg: s.churnRate > 20 ? 'bg-red-400/10' : 'bg-green-400/10',
    sub: `${s.cancelledClients} cancelados`,
    subIcon: s.cancelledClients > 0
      ? <XCircle className="h-3 w-3 text-red-400" />
      : null,
  },
];

const StatsCards = ({ stats, loading }: Props) => {
  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="bg-card/50">
            <CardContent className="p-4 space-y-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-7 w-1/2" />
              <Skeleton className="h-3 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {cards(stats).map((card) => (
        <Card
          key={card.label}
          className="bg-card/50 border-border/60 hover:border-border transition-colors"
        >
          <CardContent className="p-4">
            <div className={`inline-flex p-2 rounded-lg ${card.bg} mb-3`}>
              <span className={card.color}>{card.icon}</span>
            </div>
            <p className="text-xs text-muted-foreground font-medium">{card.label}</p>
            <p className="text-xl font-bold mt-0.5 leading-none">{card.value}</p>
            <div className="flex items-center gap-1 mt-1.5">
              {card.subIcon}
              <p className="text-[11px] text-muted-foreground">{card.sub}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default StatsCards;
