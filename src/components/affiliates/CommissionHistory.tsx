/**
 * CommissionHistory
 *
 * Histórico de comissões com carência de 7 dias.
 * Mostra: data, tipo, valor, status, disponível em.
 */

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from '@/components/ui/table';
import { DollarSign, RefreshCcw, Zap } from 'lucide-react';
import type { Commission } from '@/types/affiliates';

interface Props {
  commissions: Commission[];
  loading: boolean;
}

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pending:   { label: 'Em carência', variant: 'outline' },
  available: { label: 'Disponível',  variant: 'secondary' },
  approved:  { label: 'Disponível',  variant: 'secondary' }, // legado
  paid:      { label: 'Pago',        variant: 'default' },
  cancelled: { label: 'Cancelado',   variant: 'destructive' },
};

const typeConfig = {
  initial: {
    label: 'Inicial',
    icon: <Zap className="h-3 w-3" />,
    className: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30',
  },
  recurring: {
    label: 'Recorrente',
    icon: <RefreshCcw className="h-3 w-3" />,
    className: 'text-blue-400 bg-blue-400/10 border-blue-400/30',
  },
};

const fmt = (val: number) =>
  `R$ ${Number(val).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

const fmtDate = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
    : '—';

/** Mostra countdown até a comissão ficar disponível */
const CarenciaLabel = ({ availableAfter }: { availableAfter: string }) => {
  const diff = new Date(availableAfter).getTime() - Date.now();
  if (diff <= 0) return <span className="text-emerald-400 text-[11px]">Liberando...</span>;
  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  return (
    <span className="text-orange-400 text-[11px]">
      {days > 0 ? `${days}d ${hours}h` : `${hours}h`}
    </span>
  );
};

const CommissionHistory = ({ commissions, loading }: Props) => {
  const total = commissions
    .filter(c => c.status !== 'cancelled')
    .reduce((sum, c) => sum + Number(c.amount), 0);
  const paid = commissions
    .filter(c => c.status === 'paid')
    .reduce((sum, c) => sum + Number(c.amount), 0);
  const inHold = commissions
    .filter(c => c.status === 'pending')
    .reduce((sum, c) => sum + Number(c.amount), 0);
  const available = commissions
    .filter(c => c.status === 'available' || c.status === 'approved')
    .reduce((sum, c) => sum + Number(c.amount), 0);

  return (
    <div className="space-y-4">
      {/* Resumo */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total gerado',  value: total,     color: 'text-white' },
          { label: 'Em carência',   value: inHold,    color: 'text-orange-400' },
          { label: 'Disponível',    value: available,  color: 'text-yellow-400' },
          { label: 'Total pago',    value: paid,      color: 'text-emerald-400' },
        ].map((item) => (
          <Card key={item.label} className="bg-card/50 border-border/60">
            <CardContent className="p-4 text-center">
              <DollarSign className={`h-4 w-4 mx-auto mb-1 ${item.color}`} />
              <p className={`text-lg font-bold ${item.color}`}>{fmt(item.value)}</p>
              <p className="text-[11px] text-muted-foreground">{item.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabela */}
      <Card className="bg-card/50 border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Histórico detalhado</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : commissions.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-sm">
              <DollarSign className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p>Nenhuma comissão ainda.</p>
              <p className="text-xs mt-1">As comissões aparecem quando seus indicados assinarem.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-border/40">
                    <TableHead className="text-xs w-24">Data</TableHead>
                    <TableHead className="text-xs">Tipo</TableHead>
                    <TableHead className="text-xs hidden sm:table-cell">Período</TableHead>
                    <TableHead className="text-xs text-right">Valor</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs">Disponível em</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {commissions.map((c) => {
                    const type = typeConfig[c.type] ?? typeConfig.recurring;
                    const status = statusConfig[c.status] ?? statusConfig.pending;
                    return (
                      <TableRow key={c.id} className="border-border/30 text-sm">
                        <TableCell className="text-xs text-muted-foreground">
                          {fmtDate(c.created_at)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`text-[10px] flex items-center gap-1 w-fit ${type.className}`}
                          >
                            {type.icon}
                            {type.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground hidden sm:table-cell">
                          {c.period_start
                            ? `${fmtDate(c.period_start)} → ${fmtDate(c.period_end)}`
                            : '—'}
                        </TableCell>
                        <TableCell className="text-right font-semibold text-emerald-400">
                          {fmt(Number(c.amount))}
                        </TableCell>
                        <TableCell>
                          <Badge variant={status.variant} className="text-[10px]">
                            {status.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {c.status === 'pending' && c.available_after
                            ? <CarenciaLabel availableAfter={c.available_after} />
                            : (c.status === 'available' || c.status === 'approved')
                            ? <span className="text-emerald-400 text-[11px]">Liberado ✓</span>
                            : <span className="text-muted-foreground text-[11px]">—</span>
                          }
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default CommissionHistory;
