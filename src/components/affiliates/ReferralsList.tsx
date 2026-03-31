/**
 * ReferralsList
 *
 * Lista de usuários indicados pelo afiliado.
 * Exibe: nome/email, status da indicação, data de conversão.
 */

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, Clock, XCircle, ShoppingCart, Info } from 'lucide-react';
import type { Referral } from '@/types/affiliates';

interface Props {
  referrals: Referral[];
  loading: boolean;
}

const statusConfig = {
  pending: {
    label: 'Cadastrado',
    icon: <Clock className="h-3 w-3" />,
    className: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30',
  },
  converted: {
    label: 'Venda Pendente',
    icon: <ShoppingCart className="h-3 w-3" />,
    className: 'text-blue-400 bg-blue-400/10 border-blue-400/30',
  },
  cancelled: {
    label: 'Venda Cancelada',
    icon: <XCircle className="h-3 w-3" />,
    className: 'text-red-400 bg-red-400/10 border-red-400/30',
  },
};

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
  });

const ReferralsList = ({ referrals, loading }: Props) => {
  const converted = referrals.filter(r => r.status === 'converted').length;
  const pending = referrals.filter(r => r.status === 'pending').length;
  const cancelled = referrals.filter(r => r.status === 'cancelled').length;

  return (
    <div className="space-y-4">
      {/* Resumo */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Vendas Pend.', value: converted, color: 'text-blue-400' },
          { label: 'Cadastrados', value: pending, color: 'text-yellow-400' },
          { label: 'Cancelados', value: cancelled, color: 'text-red-400' },
        ].map(s => (
          <Card key={s.label} className="bg-card/50 border-border/60">
            <CardContent className="p-3 text-center">
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-[11px] text-muted-foreground">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Aviso sobre Venda Pendente */}
      {converted > 0 && (
        <div className="flex items-start gap-2.5 rounded-xl border border-blue-500/20 bg-blue-500/5 px-4 py-3">
          <Info className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
          <div className="text-xs text-muted-foreground leading-relaxed">
            <span className="text-blue-400 font-semibold">O que é Venda Pendente?</span>{' '}
            Uma venda que ocorreu, porém o comprador ainda está dentro do período de 7 dias garantido por lei para solicitar reembolso.
            Caso não haja cancelamento, ao fim desse período o valor da comissão será liberado automaticamente no seu saldo disponível para saque.
            Em caso de reembolso, a venda será marcada como <span className="text-red-400 font-medium">Venda Cancelada</span>.
          </div>
        </div>
      )}

      {/* Lista */}
      <Card className="bg-card/50 border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Users className="h-4 w-4" />
            Todos os indicados ({referrals.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 pb-4">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-lg" />
            ))
          ) : referrals.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-sm">
              <Users className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p>Nenhum indicado ainda.</p>
              <p className="text-xs mt-1">Compartilhe seu link para começar!</p>
            </div>
          ) : (
            referrals.map((ref) => {
              const status = statusConfig[ref.status] ?? statusConfig.pending;
              const initials = (ref.profile?.display_name ?? ref.referred_user_id ?? 'U')
                .slice(0, 2)
                .toUpperCase();
              return (
                <div
                  key={ref.id}
                  className="flex items-center gap-3 p-3 rounded-lg border border-border/40 bg-card/30 hover:bg-card/50 transition-colors"
                >
                  <Avatar className="h-8 w-8 flex-shrink-0">
                    <AvatarImage src={ref.profile?.avatar_url ?? undefined} />
                    <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {ref.profile?.display_name ?? `Usuário ${(ref.referred_user_id ?? ref.id).slice(0, 8)}`}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Indicado em {fmtDate(ref.created_at)}
                      {ref.converted_at && ` · Comprou em ${fmtDate(ref.converted_at)}`}
                    </p>
                  </div>

                  <Badge
                    variant="outline"
                    className={`text-[10px] flex items-center gap-1 flex-shrink-0 ${status.className}`}
                  >
                    {status.icon}
                    {status.label}
                  </Badge>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ReferralsList;
