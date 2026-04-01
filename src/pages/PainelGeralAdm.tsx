/**
 * PainelGeralAdm — Painel de controle total de usuários
 * Restrito ao e-mail: evcarvalhodev@gmail.com
 */

import { useState, useEffect, useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import {
  Search, Plus, Trash2, Loader2, UserCog, ShieldCheck,
  ChevronUp, ChevronDown, X, CheckCircle2, AlertTriangle,
  Eye, Calendar, Clock, Handshake, Phone, CreditCard,
  LogIn, User,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

const ADMIN_EMAIL = 'evcarvalhodev@gmail.com';

interface UserRow {
  user_id: string;
  email: string;
  display_name: string | null;
  subscription_status: string;
  subscription_expires_at: string | null;
  updated_at: string;
  created_at: string;
}

interface UserDetail {
  user_id: string;
  email: string;
  phone: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  display_name: string | null;
  subscription_status: string;
  subscription_expires_at: string | null;
  affiliate: {
    id: string;
    ref_code: string;
    status: string;
    commission_rate: number;
    whatsapp: string | null;
    pix_key: string | null;
    created_at: string;
  } | null;
}

type Toast = { id: number; type: 'success' | 'error'; msg: string };

let toastId = 0;

// ── helpers ──────────────────────────────────────────────────────────────────

const callAdmin = async (body: object) => {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error('Sessão não encontrada. Faça login novamente.');

  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-panel`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify(body),
    }
  );

  const data = await res.json();
  if (data?.error) throw new Error(data.error);
  return data;
};

const fmtDate = (iso: string | null) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const fmtDateTime = (iso: string | null) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
};

const daysRemaining = (expiresAt: string | null): number | null => {
  if (!expiresAt) return null;
  const diff = new Date(expiresAt).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

const statusLabel = (status: string, expiresAt: string | null) => {
  if (status === 'active' && expiresAt) {
    const expired = new Date(expiresAt).getTime() < Date.now();
    if (expired) return { label: 'Expirado', color: 'text-orange-400 bg-orange-500/10 border-orange-500/20' };
    return { label: 'Ativo', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' };
  }
  if (status === 'canceled') return { label: 'Cancelado', color: 'text-red-400 bg-red-500/10 border-red-500/20' };
  return { label: 'Gratuito', color: 'text-muted-foreground bg-white/5 border-white/10' };
};

// ── Detail Modal ──────────────────────────────────────────────────────────────

function DetailModal({ detail, onClose }: { detail: UserDetail; onClose: () => void }) {
  const { label, color } = statusLabel(detail.subscription_status, detail.subscription_expires_at);
  const days = daysRemaining(detail.subscription_expires_at);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-[#111] border border-white/10 rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-violet-500/15 flex items-center justify-center">
              <User className="h-4 w-4 text-violet-300" />
            </div>
            <div>
              <p className="font-bold text-sm truncate max-w-[260px]">{detail.email}</p>
              {detail.display_name && (
                <p className="text-xs text-muted-foreground">{detail.display_name}</p>
              )}
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-white transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">

          {/* Assinatura */}
          <section className="space-y-3">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Assinatura</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white/[0.04] border border-white/8 rounded-xl p-3 space-y-1">
                <p className="text-[10px] text-muted-foreground">Status</p>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-lg border text-[11px] font-semibold ${color}`}>
                  {label}
                </span>
              </div>
              <div className="bg-white/[0.04] border border-white/8 rounded-xl p-3 space-y-1">
                <p className="text-[10px] text-muted-foreground">Dias restantes</p>
                <p className={`text-sm font-bold ${days !== null && days > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {days === null ? '—' : days > 0 ? `${days} dias` : 'Expirado'}
                </p>
              </div>
              <div className="bg-white/[0.04] border border-white/8 rounded-xl p-3 space-y-1">
                <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> Expira em
                </p>
                <p className="text-xs font-semibold">{fmtDate(detail.subscription_expires_at)}</p>
              </div>
              <div className="bg-white/[0.04] border border-white/8 rounded-xl p-3 space-y-1">
                <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> Membro desde
                </p>
                <p className="text-xs font-semibold">{fmtDate(detail.created_at)}</p>
              </div>
            </div>
          </section>

          {/* Conta */}
          <section className="space-y-3">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Conta</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between py-2 border-b border-white/5">
                <span className="text-xs text-muted-foreground flex items-center gap-2">
                  <LogIn className="h-3.5 w-3.5" /> Último login
                </span>
                <span className="text-xs font-semibold">{fmtDateTime(detail.last_sign_in_at)}</span>
              </div>
              {detail.phone && (
                <div className="flex items-center justify-between py-2 border-b border-white/5">
                  <span className="text-xs text-muted-foreground flex items-center gap-2">
                    <Phone className="h-3.5 w-3.5" /> Telefone
                  </span>
                  <span className="text-xs font-semibold">{detail.phone}</span>
                </div>
              )}
              <div className="flex items-center justify-between py-2 border-b border-white/5">
                <span className="text-xs text-muted-foreground">User ID</span>
                <span className="text-[10px] font-mono text-muted-foreground truncate max-w-[180px]">{detail.user_id}</span>
              </div>
            </div>
          </section>

          {/* Afiliado */}
          <section className="space-y-3">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <Handshake className="h-3.5 w-3.5" /> Afiliado
            </h3>
            {detail.affiliate ? (
              <div className="bg-purple-500/5 border border-purple-500/20 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Código de referência</p>
                    <p className="font-mono font-bold text-purple-300">{detail.affiliate.ref_code}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Comissão</p>
                    <p className="font-bold text-emerald-400">{detail.affiliate.commission_rate}%</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center justify-between py-1.5 border-b border-white/5">
                    <span className="text-muted-foreground">Status</span>
                    <span className={`font-semibold ${detail.affiliate.status === 'active' ? 'text-emerald-400' : 'text-red-400'}`}>
                      {detail.affiliate.status === 'active' ? 'Ativo' : 'Suspenso'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-1.5 border-b border-white/5">
                    <span className="text-muted-foreground">Afiliado desde</span>
                    <span className="font-semibold">{fmtDate(detail.affiliate.created_at)}</span>
                  </div>
                </div>
                {(detail.affiliate.whatsapp || detail.affiliate.pix_key) && (
                  <div className="space-y-1.5 pt-1">
                    {detail.affiliate.whatsapp && (
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground flex items-center gap-1.5">
                          <Phone className="h-3 w-3" /> WhatsApp
                        </span>
                        <span className="font-semibold">{detail.affiliate.whatsapp}</span>
                      </div>
                    )}
                    {detail.affiliate.pix_key && (
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground flex items-center gap-1.5">
                          <CreditCard className="h-3 w-3" /> Chave PIX
                        </span>
                        <span className="font-semibold truncate max-w-[180px]">{detail.affiliate.pix_key}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground bg-white/[0.03] border border-white/8 rounded-xl p-4 text-center">
                Não é afiliado
              </p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

// ── componente principal ──────────────────────────────────────────────────────

export default function PainelGeralAdm() {
  const { user, loading: authLoading } = useAuth();

  const [users, setUsers]             = useState<UserRow[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [search, setSearch]           = useState('');
  const [toasts, setToasts]           = useState<Toast[]>([]);

  // modal criação
  const [showCreate, setShowCreate]   = useState(false);
  const [createEmail, setCreateEmail] = useState('');
  const [createPass, setCreatePass]   = useState('');
  const [creating, setCreating]       = useState(false);

  // dias por usuário
  const [daysInput, setDaysInput]     = useState<Record<string, string>>({});
  const [applying, setApplying]       = useState<Record<string, boolean>>({});

  // confirmar exclusão
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deleting, setDeleting]           = useState<string | null>(null);

  // detalhe do usuário
  const [loadingDetail, setLoadingDetail] = useState<string | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<UserDetail | null>(null);

  // ── toast ────────────────────────────────────────────────────────────────

  const addToast = (type: 'success' | 'error', msg: string) => {
    const id = ++toastId;
    setToasts(prev => [...prev, { id, type, msg }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  };

  // ── buscar usuários ──────────────────────────────────────────────────────

  const fetchUsers = async () => {
    setLoadingList(true);
    try {
      const data = await callAdmin({ action: 'list' });
      setUsers(data.users ?? []);
    } catch (e: any) {
      addToast('error', e.message);
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    if (!authLoading && user?.email === ADMIN_EMAIL) fetchUsers();
  }, [authLoading, user?.email]);

  // ── filtro de busca ──────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(u =>
      u.email.toLowerCase().includes(q) ||
      (u.display_name ?? '').toLowerCase().includes(q)
    );
  }, [users, search]);

  // ── ver detalhes ─────────────────────────────────────────────────────────

  const handleViewDetail = async (userId: string) => {
    setLoadingDetail(userId);
    try {
      const data = await callAdmin({ action: 'get_user_detail', user_id: userId });
      setSelectedDetail(data as UserDetail);
    } catch (e: any) {
      addToast('error', e.message);
    } finally {
      setLoadingDetail(null);
    }
  };

  // ── criar usuário ────────────────────────────────────────────────────────

  const handleCreate = async () => {
    if (!createEmail.trim() || !createPass.trim()) return;
    setCreating(true);
    try {
      await callAdmin({ action: 'create', email: createEmail, password: createPass });
      addToast('success', `Usuário ${createEmail} criado com sucesso!`);
      setShowCreate(false);
      setCreateEmail('');
      setCreatePass('');
      await fetchUsers();
    } catch (e: any) {
      addToast('error', e.message);
    } finally {
      setCreating(false);
    }
  };

  // ── excluir usuário ──────────────────────────────────────────────────────

  const handleDelete = async (userId: string) => {
    setDeleting(userId);
    try {
      await callAdmin({ action: 'delete', user_id: userId });
      addToast('success', 'Usuário excluído.');
      setUsers(prev => prev.filter(u => u.user_id !== userId));
    } catch (e: any) {
      addToast('error', e.message);
    } finally {
      setDeleting(null);
      setConfirmDelete(null);
    }
  };

  // ── ajustar dias ─────────────────────────────────────────────────────────

  const handleDays = async (userId: string, sign: 1 | -1) => {
    const raw = daysInput[userId] ?? '';
    const days = parseInt(raw, 10);
    if (!days || days <= 0) {
      addToast('error', 'Informe um número de dias válido.');
      return;
    }
    setApplying(prev => ({ ...prev, [userId]: true }));
    try {
      const result = await callAdmin({ action: 'update_days', user_id: userId, days: days * sign });
      setUsers(prev =>
        prev.map(u =>
          u.user_id === userId
            ? { ...u, subscription_expires_at: result.subscription_expires_at, subscription_status: result.subscription_status }
            : u
        )
      );
      addToast('success', sign > 0 ? `+${days} dias adicionados!` : `-${days} dias removidos.`);
      setDaysInput(prev => ({ ...prev, [userId]: '' }));
    } catch (e: any) {
      addToast('error', e.message);
    } finally {
      setApplying(prev => ({ ...prev, [userId]: false }));
    }
  };

  // ── guards ───────────────────────────────────────────────────────────────

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-violet-400" />
      </div>
    );
  }

  if (!user || user.email !== ADMIN_EMAIL) {
    return <Navigate to="/" replace />;
  }

  // ── render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background text-white">

      {/* Toasts */}
      <div className="fixed top-4 right-4 z-50 space-y-2 w-80 max-w-[calc(100vw-2rem)]">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`flex items-start gap-2 px-4 py-3 rounded-xl border text-sm shadow-lg backdrop-blur-md ${
              t.type === 'success'
                ? 'bg-emerald-950/80 border-emerald-500/30 text-emerald-300'
                : 'bg-red-950/80 border-red-500/30 text-red-300'
            }`}
          >
            {t.type === 'success'
              ? <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
              : <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            }
            <span>{t.msg}</span>
          </div>
        ))}
      </div>

      {/* Modal detalhes */}
      {selectedDetail && (
        <DetailModal detail={selectedDetail} onClose={() => setSelectedDetail(null)} />
      )}

      {/* Modal criar usuário */}
      {showCreate && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-[#111] border border-white/10 rounded-2xl p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-lg">Criar Usuário</h2>
              <button onClick={() => setShowCreate(false)} className="text-muted-foreground hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-sm text-muted-foreground">E-mail</label>
                <input
                  type="email"
                  value={createEmail}
                  onChange={e => setCreateEmail(e.target.value)}
                  placeholder="usuario@email.com"
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-muted-foreground text-sm focus:outline-none focus:border-violet-500/60"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm text-muted-foreground">Senha temporária</label>
                <input
                  type="text"
                  value={createPass}
                  onChange={e => setCreatePass(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-muted-foreground text-sm focus:outline-none focus:border-violet-500/60"
                />
              </div>
            </div>
            <button
              onClick={handleCreate}
              disabled={creating || !createEmail.trim() || !createPass.trim()}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-white font-bold text-sm disabled:opacity-50 hover:from-violet-500 hover:to-purple-500 transition-all flex items-center justify-center gap-2"
            >
              {creating && <Loader2 className="h-4 w-4 animate-spin" />}
              {creating ? 'Criando...' : 'Criar usuário'}
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="sticky top-0 z-30 border-b border-white/10 bg-[#0a0a0a]/90 backdrop-blur-md px-4 sm:px-6 py-4">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-violet-500/15 rounded-xl">
              <ShieldCheck className="h-5 w-5 text-violet-400" />
            </div>
            <div>
              <h1 className="font-black text-lg leading-tight">Painel Geral ADM</h1>
              <p className="text-xs text-muted-foreground">{users.length} usuários cadastrados</p>
            </div>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-bold transition-colors"
          >
            <Plus className="h-4 w-4" />
            Criar usuário
          </button>
        </div>
      </div>

      {/* Conteúdo */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-5">

        {/* Barra de pesquisa */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Pesquisar por e-mail ou nome..."
            className="w-full pl-11 pr-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-muted-foreground text-sm focus:outline-none focus:border-violet-500/60 transition-colors"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Loading */}
        {loadingList && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-violet-400" />
          </div>
        )}

        {/* Vazio */}
        {!loadingList && filtered.length === 0 && (
          <div className="text-center py-20 text-muted-foreground text-sm">
            Nenhum usuário encontrado.
          </div>
        )}

        {/* Lista */}
        {!loadingList && filtered.length > 0 && (
          <div className="space-y-3">
            {filtered.map((u, idx) => {
              const { label, color } = statusLabel(u.subscription_status, u.subscription_expires_at);
              const isDeleting  = deleting === u.user_id;
              const isApplying  = applying[u.user_id] ?? false;
              const isLoadingDt = loadingDetail === u.user_id;
              const days = daysRemaining(u.subscription_expires_at);

              return (
                <div
                  key={u.user_id}
                  className="rounded-2xl bg-white/[0.03] border border-white/8 hover:border-white/15 transition-colors p-4"
                >
                  {/* Linha principal */}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    {/* Avatar / número */}
                    <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-violet-500/15 flex items-center justify-center text-xs font-bold text-violet-300">
                      {idx + 1}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{u.email}</p>
                      {u.display_name && (
                        <p className="text-xs text-muted-foreground truncate">{u.display_name}</p>
                      )}
                    </div>

                    {/* Badge status */}
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-lg border text-[11px] font-semibold flex-shrink-0 ${color}`}>
                      {label}
                    </span>

                    {/* Dias restantes + expiração */}
                    <div className="text-right flex-shrink-0">
                      <p className="text-[10px] text-muted-foreground">
                        {days !== null && days > 0 ? `${days} dias restantes` : 'Expira em'}
                      </p>
                      <p className="text-xs font-semibold">{fmtDate(u.subscription_expires_at)}</p>
                    </div>

                    {/* Botão ver detalhes */}
                    <button
                      onClick={() => handleViewDetail(u.user_id)}
                      disabled={isLoadingDt}
                      title="Ver detalhes"
                      className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-muted-foreground hover:text-white text-xs font-semibold transition-colors disabled:opacity-50"
                    >
                      {isLoadingDt
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <Eye className="h-3.5 w-3.5" />
                      }
                      <span className="hidden sm:inline">Detalhes</span>
                    </button>
                  </div>

                  {/* Controles de dias + excluir */}
                  <div className="mt-3 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-3 border-t border-white/5">

                    {/* Input dias */}
                    <div className="flex items-center gap-2 flex-1">
                      <UserCog className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <input
                        type="number"
                        min="1"
                        value={daysInput[u.user_id] ?? ''}
                        onChange={e => setDaysInput(prev => ({ ...prev, [u.user_id]: e.target.value }))}
                        placeholder="Dias"
                        className="w-20 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-muted-foreground text-xs focus:outline-none focus:border-violet-500/60 text-center"
                      />
                      <button
                        onClick={() => handleDays(u.user_id, 1)}
                        disabled={isApplying}
                        title="Adicionar dias"
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600/80 hover:bg-emerald-600 text-white text-xs font-bold transition-colors disabled:opacity-50"
                      >
                        {isApplying ? <Loader2 className="h-3 w-3 animate-spin" /> : <ChevronUp className="h-3.5 w-3.5" />}
                        <span className="hidden sm:inline">Adicionar</span>
                      </button>
                      <button
                        onClick={() => handleDays(u.user_id, -1)}
                        disabled={isApplying}
                        title="Remover dias"
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-orange-600/80 hover:bg-orange-600 text-white text-xs font-bold transition-colors disabled:opacity-50"
                      >
                        {isApplying ? <Loader2 className="h-3 w-3 animate-spin" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        <span className="hidden sm:inline">Remover</span>
                      </button>
                    </div>

                    {/* Excluir */}
                    {confirmDelete === u.user_id ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-red-400">Confirmar exclusão?</span>
                        <button
                          onClick={() => handleDelete(u.user_id)}
                          disabled={isDeleting}
                          className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-colors flex items-center gap-1"
                        >
                          {isDeleting && <Loader2 className="h-3 w-3 animate-spin" />}
                          Sim, excluir
                        </button>
                        <button
                          onClick={() => setConfirmDelete(null)}
                          className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white text-xs font-bold transition-colors"
                        >
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDelete(u.user_id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 text-xs font-bold transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>Excluir</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
