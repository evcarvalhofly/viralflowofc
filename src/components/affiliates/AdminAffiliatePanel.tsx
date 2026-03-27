/**
 * AdminAffiliatePanel
 *
 * Painel exclusivo para o administrador (evcarvalhodev@gmail.com).
 * Exibe todos os afiliados e gerencia pedidos de saque.
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Users, ArrowDownToLine, CheckCircle2, ShieldAlert, MessageCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Affiliate, WithdrawalRequest } from '@/types/affiliates';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

interface WithdrawalWithAffiliate extends WithdrawalRequest {
  affiliate?: Pick<Affiliate, 'ref_code' | 'email' | 'whatsapp'>;
}

const fmt = (val: number) =>
  `R$ ${Number(val).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });

const AdminAffiliatePanel = () => {
  const { toast } = useToast();

  const [affiliates, setAffiliates] = useState<Affiliate[]>([]);
  const [affiliatesLoading, setAffiliatesLoading] = useState(true);

  const [withdrawals, setWithdrawals] = useState<WithdrawalWithAffiliate[]>([]);
  const [withdrawalsLoading, setWithdrawalsLoading] = useState(true);

  const [payDialog, setPayDialog] = useState<WithdrawalWithAffiliate | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [paying, setPaying] = useState(false);

  const [search, setSearch] = useState('');

  const fetchAffiliates = useCallback(async () => {
    setAffiliatesLoading(true);
    const { data } = await db
      .from('affiliates')
      .select('*')
      .order('created_at', { ascending: false });
    setAffiliates((data ?? []) as Affiliate[]);
    setAffiliatesLoading(false);
  }, []);

  const fetchWithdrawals = useCallback(async () => {
    setWithdrawalsLoading(true);
    const { data } = await db
      .from('withdrawal_requests')
      .select('*')
      .order('requested_at', { ascending: false });

    const list = (data ?? []) as WithdrawalRequest[];

    // Busca dados dos afiliados para enriquecer
    const affiliateIds = [...new Set(list.map(w => w.affiliate_id))];
    if (affiliateIds.length > 0) {
      const { data: affs } = await db
        .from('affiliates')
        .select('id, ref_code, email, whatsapp')
        .in('id', affiliateIds);

      const affMap = new Map((affs ?? []).map((a: Affiliate) => [a.id, a]));
      const enriched = list.map(w => ({
        ...w,
        affiliate: affMap.get(w.affiliate_id) as Pick<Affiliate, 'ref_code' | 'email' | 'whatsapp'> | undefined,
      }));
      setWithdrawals(enriched);
    } else {
      setWithdrawals(list);
    }

    setWithdrawalsLoading(false);
  }, []);

  useEffect(() => {
    fetchAffiliates();
    fetchWithdrawals();
  }, [fetchAffiliates, fetchWithdrawals]);

  const handleMarkPaid = async () => {
    if (!payDialog) return;
    setPaying(true);

    const { error } = await db
      .from('withdrawal_requests')
      .update({ status: 'paid', admin_notes: adminNotes.trim() || null, processed_at: new Date().toISOString() })
      .eq('id', payDialog.id);

    if (error) {
      toast({ title: 'Erro ao marcar como pago', description: error.message, variant: 'destructive' });
      setPaying(false);
      return;
    }

    // Marca comissões disponíveis do afiliado como pagas (até o valor do saque)
    await db
      .from('commissions')
      .update({ status: 'paid', paid_at: new Date().toISOString() })
      .eq('affiliate_id', payDialog.affiliate_id)
      .in('status', ['available', 'approved']);

    toast({ title: 'Saque marcado como pago!' });
    setPaying(false);
    setPayDialog(null);
    setAdminNotes('');
    fetchWithdrawals();
  };

  const pendingWithdrawals = withdrawals.filter(w => w.status === 'pending');
  const filteredAffiliates = affiliates.filter(a =>
    !search ||
    a.ref_code.toLowerCase().includes(search.toLowerCase()) ||
    (a.email ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (a.whatsapp ?? '').includes(search)
  );

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-border/60 bg-card/30 px-4 sm:px-6 py-4">
        <div className="flex items-center gap-3 max-w-5xl mx-auto">
          <div className="p-2 bg-purple-500/15 rounded-lg">
            <ShieldAlert className="h-5 w-5 text-purple-400" />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight">Painel Admin — Afiliados</h1>
            <p className="text-xs text-muted-foreground">Gerencie afiliados e saques</p>
          </div>
          {pendingWithdrawals.length > 0 && (
            <Badge className="ml-auto bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
              {pendingWithdrawals.length} saque{pendingWithdrawals.length > 1 ? 's' : ''} pendente{pendingWithdrawals.length > 1 ? 's' : ''}
            </Badge>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4">
          <Tabs defaultValue="withdrawals">
            <TabsList className="w-full grid grid-cols-2 h-9 mb-5 bg-card/50">
              <TabsTrigger value="withdrawals" className="text-xs gap-1.5">
                <ArrowDownToLine className="h-3.5 w-3.5 hidden sm:block" />
                Saques
                {pendingWithdrawals.length > 0 && (
                  <span className="ml-1 bg-yellow-500 text-black text-[10px] font-bold rounded-full px-1.5">
                    {pendingWithdrawals.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="affiliates" className="text-xs gap-1.5">
                <Users className="h-3.5 w-3.5 hidden sm:block" />
                Afiliados ({affiliates.length})
              </TabsTrigger>
            </TabsList>

            {/* ── Saques ─────────────────────────────────────────────────────── */}
            <TabsContent value="withdrawals" className="mt-0">
              <Card className="bg-card/50 border-border/60">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Solicitações de saque</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {withdrawalsLoading ? (
                    <div className="p-4 space-y-3">
                      {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                    </div>
                  ) : withdrawals.length === 0 ? (
                    <div className="py-10 text-center text-muted-foreground text-sm">
                      <ArrowDownToLine className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      <p>Nenhum saque solicitado ainda.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="hover:bg-transparent border-border/40">
                            <TableHead className="text-xs">Afiliado</TableHead>
                            <TableHead className="text-xs">WhatsApp</TableHead>
                            <TableHead className="text-xs">Chave PIX</TableHead>
                            <TableHead className="text-xs text-right">Valor</TableHead>
                            <TableHead className="text-xs">Data</TableHead>
                            <TableHead className="text-xs">Status</TableHead>
                            <TableHead className="text-xs">Ação</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {withdrawals.map(w => (
                            <TableRow key={w.id} className="border-border/30 text-sm">
                              <TableCell className="text-xs">
                                <div className="font-mono text-purple-300">{w.affiliate?.ref_code ?? '—'}</div>
                                <div className="text-muted-foreground truncate max-w-[140px]">{w.affiliate?.email ?? '—'}</div>
                              </TableCell>
                              <TableCell className="text-xs">
                                {w.affiliate?.whatsapp ? (
                                  <a
                                    href={`https://wa.me/55${w.affiliate.whatsapp.replace(/\D/g, '')}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex items-center gap-1 text-emerald-400 hover:underline"
                                  >
                                    <MessageCircle className="h-3 w-3" />
                                    {w.affiliate.whatsapp}
                                  </a>
                                ) : '—'}
                              </TableCell>
                              <TableCell className="text-xs font-mono text-muted-foreground max-w-[130px] truncate">
                                {w.pix_key}
                              </TableCell>
                              <TableCell className="text-right font-semibold text-emerald-400 text-xs">
                                {fmt(w.amount)}
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                                {fmtDate(w.requested_at)}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant={w.status === 'paid' ? 'default' : w.status === 'rejected' ? 'destructive' : 'outline'}
                                  className="text-[10px]"
                                >
                                  {w.status === 'paid' ? 'Pago' : w.status === 'rejected' ? 'Rejeitado' : 'Pendente'}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {w.status === 'pending' && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-xs gap-1 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10"
                                    onClick={() => { setPayDialog(w); setAdminNotes(''); }}
                                  >
                                    <CheckCircle2 className="h-3 w-3" />
                                    Marcar pago
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Afiliados ───────────────────────────────────────────────────── */}
            <TabsContent value="affiliates" className="mt-0 space-y-4">
              <Input
                placeholder="Buscar por código, email ou WhatsApp..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="max-w-sm"
              />
              <Card className="bg-card/50 border-border/60">
                <CardContent className="p-0">
                  {affiliatesLoading ? (
                    <div className="p-4 space-y-3">
                      {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                    </div>
                  ) : filteredAffiliates.length === 0 ? (
                    <div className="py-10 text-center text-muted-foreground text-sm">
                      <Users className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      <p>Nenhum afiliado encontrado.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="hover:bg-transparent border-border/40">
                            <TableHead className="text-xs">Código</TableHead>
                            <TableHead className="text-xs">Email</TableHead>
                            <TableHead className="text-xs">WhatsApp</TableHead>
                            <TableHead className="text-xs text-center">Comissão</TableHead>
                            <TableHead className="text-xs">Status</TableHead>
                            <TableHead className="text-xs">Cadastro</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredAffiliates.map(a => (
                            <TableRow key={a.id} className="border-border/30 text-sm">
                              <TableCell className="font-mono text-xs text-purple-300">{a.ref_code}</TableCell>
                              <TableCell className="text-xs text-muted-foreground">{a.email ?? '—'}</TableCell>
                              <TableCell className="text-xs">
                                {a.whatsapp ? (
                                  <a
                                    href={`https://wa.me/55${a.whatsapp.replace(/\D/g, '')}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex items-center gap-1 text-emerald-400 hover:underline"
                                  >
                                    <MessageCircle className="h-3 w-3" />
                                    {a.whatsapp}
                                  </a>
                                ) : '—'}
                              </TableCell>
                              <TableCell className="text-center font-bold text-emerald-400 text-xs">
                                {a.commission_rate}%
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] ${a.status === 'active' ? 'border-emerald-400/50 text-emerald-400' : 'border-red-400/50 text-red-400'}`}
                                >
                                  {a.status === 'active' ? 'Ativo' : 'Suspenso'}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                                {fmtDate(a.created_at)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Dialog confirmar pagamento */}
      <Dialog open={!!payDialog} onOpenChange={open => { if (!open) setPayDialog(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar pagamento</DialogTitle>
          </DialogHeader>
          {payDialog && (
            <div className="space-y-4 py-2">
              <div className="p-3 bg-card rounded-lg border border-border/60 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Afiliado</span>
                  <span className="font-mono text-purple-300">{payDialog.affiliate?.ref_code}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Email</span>
                  <span>{payDialog.affiliate?.email ?? '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">WhatsApp</span>
                  <span>{payDialog.affiliate?.whatsapp ?? '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Chave PIX</span>
                  <span className="font-mono">{payDialog.pix_key}</span>
                </div>
                <div className="flex justify-between font-bold">
                  <span className="text-muted-foreground">Valor</span>
                  <span className="text-emerald-400">{fmt(payDialog.amount)}</span>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Observação (opcional)</Label>
                <Textarea
                  placeholder="Ex: PIX enviado via Nubank às 14h"
                  rows={2}
                  value={adminNotes}
                  onChange={e => setAdminNotes(e.target.value)}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayDialog(null)}>Cancelar</Button>
            <Button
              onClick={handleMarkPaid}
              disabled={paying}
              className="gap-2 bg-emerald-600 hover:bg-emerald-500 text-white"
            >
              <CheckCircle2 className="h-4 w-4" />
              {paying ? 'Salvando...' : 'Confirmar pagamento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminAffiliatePanel;
