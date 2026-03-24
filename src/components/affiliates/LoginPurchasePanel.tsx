/**
 * LoginPurchasePanel
 *
 * Sistema de "Compra de Login" — permite ao afiliado:
 * 1. Registrar clientes que ele está revendendo o acesso
 * 2. Acompanhar o status de cada conta (aguardando ativação / ativo / cancelado)
 * 3. Solicitar compra de pacotes de acesso (pending → processado pelo admin)
 *
 * FLUXO:
 * Afiliado registra e-mail do cliente → admin ativa a conta →
 * status vira "active" → comissão recorrente começa automaticamente
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Users, Plus, CheckCircle2, Clock, XCircle, Info,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { AffiliateCreatedAccount } from '@/types/affiliates';

interface Props {
  accounts: AffiliateCreatedAccount[];
  loading: boolean;
  onAdd: (email: string, name?: string, notes?: string) => Promise<{ error?: string }>;
  onUpdateStatus: (id: string, status: string) => Promise<{ error?: string }>;
  isAdmin?: boolean;
}

const statusConfig = {
  available: {
    label: 'Aguardando ativação',
    icon: <Clock className="h-3 w-3" />,
    className: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30',
  },
  active: {
    label: 'Ativo',
    icon: <CheckCircle2 className="h-3 w-3" />,
    className: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30',
  },
  cancelled: {
    label: 'Cancelado',
    icon: <XCircle className="h-3 w-3" />,
    className: 'text-red-400 bg-red-400/10 border-red-400/30',
  },
};

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });

const LoginPurchasePanel = ({
  accounts, loading, onAdd, onUpdateStatus, isAdmin = false,
}: Props) => {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [email, setEmail] = useState('');
  const [clientName, setClientName] = useState('');
  const [notes, setNotes] = useState('');
  const [search, setSearch] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setSubmitting(true);
    const result = await onAdd(email, clientName, notes);
    setSubmitting(false);

    if (result.error) {
      toast({ title: 'Erro', description: result.error, variant: 'destructive' });
    } else {
      toast({ title: 'Cliente registrado!', description: `${email} adicionado com sucesso.` });
      setEmail('');
      setClientName('');
      setNotes('');
      setOpen(false);
    }
  };

  const handleActivate = async (id: string) => {
    const result = await onUpdateStatus(id, 'active');
    if (result.error) {
      toast({ title: 'Erro', description: result.error, variant: 'destructive' });
    } else {
      toast({ title: 'Conta ativada!', description: 'Comissão recorrente iniciada.' });
    }
  };

  const handleCancel = async (id: string) => {
    if (!confirm('Cancelar esta conta? A comissão será interrompida.')) return;
    const result = await onUpdateStatus(id, 'cancelled');
    if (result.error) {
      toast({ title: 'Erro', description: result.error, variant: 'destructive' });
    }
  };

  const filtered = accounts.filter(
    a =>
      a.login_email.toLowerCase().includes(search.toLowerCase()) ||
      (a.client_name ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const stats = {
    total: accounts.length,
    active: accounts.filter(a => a.status === 'active').length,
    pending: accounts.filter(a => a.status === 'available').length,
    cancelled: accounts.filter(a => a.status === 'cancelled').length,
  };

  return (
    <div className="space-y-4">
      {/* Info sobre o sistema */}
      <Card className="bg-blue-900/20 border-blue-500/30">
        <CardContent className="flex gap-3 p-4">
          <Info className="h-4 w-4 text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-blue-300 space-y-1">
            <p className="font-medium">Como funciona a revenda de acessos</p>
            <p>
              Registre o e-mail do seu cliente aqui. Um administrador irá criar o acesso no sistema
              e ativar a conta. A partir da ativação, você recebe comissão recorrente todo mês
              enquanto o cliente estiver ativo.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Resumo */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total', value: stats.total, color: 'text-white' },
          { label: 'Ativos', value: stats.active, color: 'text-emerald-400' },
          { label: 'Pendentes', value: stats.pending, color: 'text-yellow-400' },
          { label: 'Cancelados', value: stats.cancelled, color: 'text-red-400' },
        ].map((s) => (
          <Card key={s.label} className="bg-card/50 border-border/60">
            <CardContent className="p-3 text-center">
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-[11px] text-muted-foreground">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Header com busca e botão */}
      <Card className="bg-card/50 border-border/60">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Users className="h-4 w-4" />
              Clientes registrados
            </CardTitle>
            <div className="flex gap-2 w-full sm:w-auto">
              <Input
                placeholder="Buscar cliente..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="text-xs h-8 bg-background/50 w-full sm:w-48"
              />
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="bg-[hsl(262,83%,58%)] hover:bg-[hsl(262,83%,50%)] shrink-0">
                    <Plus className="h-4 w-4 mr-1" />
                    Adicionar
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Registrar cliente</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleSubmit} className="space-y-4 mt-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="email" className="text-sm">
                        E-mail do cliente <span className="text-red-400">*</span>
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder="cliente@email.com"
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="name" className="text-sm">
                        Nome do cliente (opcional)
                      </Label>
                      <Input
                        id="name"
                        value={clientName}
                        onChange={e => setClientName(e.target.value)}
                        placeholder="João da Silva"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="notes" className="text-sm">
                        Observações (opcional)
                      </Label>
                      <Textarea
                        id="notes"
                        value={notes}
                        onChange={e => setNotes(e.target.value)}
                        placeholder="Ex: cliente indicado pelo Instagram..."
                        rows={2}
                        className="resize-none"
                      />
                    </div>
                    <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-3 text-xs text-yellow-300">
                      Após registrar, aguarde a ativação pelo administrador.
                      Você será notificado quando a conta estiver ativa.
                    </div>
                    <Button
                      type="submit"
                      className="w-full bg-[hsl(262,83%,58%)] hover:bg-[hsl(262,83%,50%)]"
                      disabled={submitting}
                    >
                      {submitting ? 'Registrando...' : 'Registrar cliente'}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-sm">
              <Users className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p>{search ? 'Nenhum cliente encontrado.' : 'Nenhum cliente registrado ainda.'}</p>
              <p className="text-xs mt-1">Clique em "Adicionar" para registrar seu primeiro cliente.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-border/40">
                    <TableHead className="text-xs">Cliente</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs">Cadastrado em</TableHead>
                    {isAdmin && (
                      <TableHead className="text-xs text-right">Ações</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((acc) => {
                    const status = statusConfig[acc.status] ?? statusConfig.available;
                    return (
                      <TableRow key={acc.id} className="border-border/30">
                        <TableCell>
                          <div>
                            <p className="text-sm font-medium">
                              {acc.client_name || acc.login_email}
                            </p>
                            {acc.client_name && (
                              <p className="text-xs text-muted-foreground">{acc.login_email}</p>
                            )}
                            {acc.notes && (
                              <p className="text-xs text-muted-foreground italic mt-0.5">
                                {acc.notes}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`text-[10px] flex items-center gap-1 w-fit ${status.className}`}
                          >
                            {status.icon}
                            {status.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {fmtDate(acc.created_at)}
                        </TableCell>
                        {isAdmin && (
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              {acc.status === 'available' && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10"
                                  onClick={() => handleActivate(acc.id)}
                                >
                                  Ativar
                                </Button>
                              )}
                              {acc.status === 'active' && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs border-red-500/40 text-red-400 hover:bg-red-500/10"
                                  onClick={() => handleCancel(acc.id)}
                                >
                                  Cancelar
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        )}
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

export default LoginPurchasePanel;
