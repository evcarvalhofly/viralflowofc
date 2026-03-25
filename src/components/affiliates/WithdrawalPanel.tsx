/**
 * WithdrawalPanel
 *
 * Painel de solicitações de saque do afiliado.
 * Mostra saldo disponível, formulário de saque e histórico.
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from '@/components/ui/table';
import { Wallet, ArrowDownToLine, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { WithdrawalRequest } from '@/types/affiliates';

interface Props {
  availableBalance: number;
  withdrawals: WithdrawalRequest[];
  loading: boolean;
  submitting: boolean;
  onRequest: (amount: number, pixKey: string, notes?: string) => Promise<{ error?: string }>;
}

const fmt = (val: number) =>
  `R$ ${Number(val).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pending:  { label: 'Pendente',  variant: 'outline' },
  paid:     { label: 'Pago',      variant: 'default' },
  rejected: { label: 'Rejeitado', variant: 'destructive' },
};

const WithdrawalPanel = ({ availableBalance, withdrawals, loading, submitting, onRequest }: Props) => {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [pixKey, setPixKey] = useState('');
  const [notes, setNotes] = useState('');

  const handleSubmit = async () => {
    const numAmount = parseFloat(amount.replace(',', '.'));
    if (!pixKey.trim()) {
      toast({ title: 'Informe sua chave PIX', variant: 'destructive' });
      return;
    }
    if (isNaN(numAmount) || numAmount <= 0) {
      toast({ title: 'Valor inválido', variant: 'destructive' });
      return;
    }
    if (numAmount > availableBalance) {
      toast({ title: 'Valor maior que o saldo disponível', variant: 'destructive' });
      return;
    }

    const result = await onRequest(numAmount, pixKey, notes);
    if (result.error) {
      toast({ title: 'Erro ao solicitar saque', description: result.error, variant: 'destructive' });
    } else {
      toast({ title: 'Saque solicitado!', description: 'Você receberá em até 48 horas úteis.' });
      setOpen(false);
      setAmount('');
      setPixKey('');
      setNotes('');
    }
  };

  return (
    <div className="space-y-4">
      {/* Saldo disponível */}
      <Card className="bg-card/50 border-border/60">
        <CardContent className="p-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-yellow-400/10 rounded-xl">
                <Wallet className="h-6 w-6 text-yellow-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Saldo disponível para saque</p>
                <p className="text-3xl font-black text-yellow-400">{fmt(availableBalance)}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Comissões com carência de 7 dias cumprida
                </p>
              </div>
            </div>
            <Button
              onClick={() => setOpen(true)}
              disabled={availableBalance <= 0}
              className="shrink-0 gap-2"
            >
              <ArrowDownToLine className="h-4 w-4" />
              Sacar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Histórico de saques */}
      <Card className="bg-card/50 border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            Histórico de saques
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : withdrawals.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground text-sm">
              <Wallet className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p>Nenhum saque solicitado ainda.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-border/40">
                    <TableHead className="text-xs">Solicitado em</TableHead>
                    <TableHead className="text-xs text-right">Valor</TableHead>
                    <TableHead className="text-xs">Chave PIX</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs hidden sm:table-cell">Obs. Admin</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {withdrawals.map((w) => {
                    const s = statusConfig[w.status] ?? statusConfig.pending;
                    return (
                      <TableRow key={w.id} className="border-border/30 text-sm">
                        <TableCell className="text-xs text-muted-foreground">
                          {fmtDate(w.requested_at)}
                        </TableCell>
                        <TableCell className="text-right font-semibold text-emerald-400">
                          {fmt(w.amount)}
                        </TableCell>
                        <TableCell className="text-xs font-mono text-muted-foreground max-w-[120px] truncate">
                          {w.pix_key}
                        </TableCell>
                        <TableCell>
                          <Badge variant={s.variant} className="text-[10px]">
                            {s.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground hidden sm:table-cell">
                          {w.admin_notes ?? '—'}
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

      {/* Dialog de saque */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Solicitar saque</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="p-3 bg-yellow-400/10 rounded-lg border border-yellow-400/20">
              <p className="text-xs text-yellow-400 font-medium">
                Saldo disponível: {fmt(availableBalance)}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Pagamentos processados em até 48 horas úteis via PIX.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount" className="text-sm">Valor (R$)</Label>
              <Input
                id="amount"
                type="number"
                placeholder="0,00"
                min="0.01"
                max={availableBalance}
                step="0.01"
                value={amount}
                onChange={e => setAmount(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pix" className="text-sm">Chave PIX</Label>
              <Input
                id="pix"
                placeholder="CPF, e-mail, telefone ou chave aleatória"
                value={pixKey}
                onChange={e => setPixKey(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes" className="text-sm">Observação (opcional)</Label>
              <Textarea
                id="notes"
                placeholder="Alguma observação para o admin?"
                rows={2}
                value={notes}
                onChange={e => setNotes(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={submitting} className="gap-2">
              <ArrowDownToLine className="h-4 w-4" />
              {submitting ? 'Enviando...' : 'Solicitar saque'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WithdrawalPanel;
