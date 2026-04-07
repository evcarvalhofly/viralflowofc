import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  CreditCard, CalendarClock, CheckCircle2, AlertTriangle, Clock,
  Mail, User, KeyRound, Loader2, CheckCheck
} from 'lucide-react';

export default function MinhaConta() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<{
    subscription_status: string | null;
    subscription_expires_at: string | null;
    display_name: string | null;
    name_change_count: number;
    name_last_changed_at: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const openCheckout = () =>
    window.dispatchEvent(new CustomEvent('open-checkout', { detail: { plan: 'annual' } }));

  // Name change
  const [newName, setNewName] = useState('');
  const [nameLoading, setNameLoading] = useState(false);
  const [nameMsg, setNameMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Password reset
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMsg, setResetMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchProfile = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('profiles')
      .select('subscription_status, subscription_expires_at, display_name, name_change_count, name_last_changed_at')
      .eq('user_id', user.id)
      .single();
    setProfile(data);
    setNewName(data?.display_name ?? '');
    setLoading(false);
  };

  useEffect(() => {
    fetchProfile();
  }, [user]);

  const daysRemaining = (() => {
    if (!profile?.subscription_expires_at) return null;
    const diff = new Date(profile.subscription_expires_at).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  })();

  const isActive = profile?.subscription_status === 'active' || user?.email === 'evcarvalhodev@gmail.com';
  const isExpired = profile?.subscription_status !== 'active' && profile?.subscription_status !== null && profile?.subscription_status !== 'free';

  const statusInfo = (() => {
    if (user?.email === 'evcarvalhodev@gmail.com') {
      return { label: 'Admin — Acesso permanente', color: 'text-violet-400', bg: 'bg-violet-500/10 border-violet-500/20', icon: <CheckCircle2 className="h-5 w-5 text-violet-400" /> };
    }
    if (isActive && daysRemaining !== null && daysRemaining > 0) {
      return { label: 'PRO Ativo', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', icon: <CheckCircle2 className="h-5 w-5 text-emerald-400" /> };
    }
    if (isExpired || (isActive && daysRemaining === 0)) {
      return { label: 'Assinatura Vencida', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20', icon: <AlertTriangle className="h-5 w-5 text-red-400" /> };
    }
    return { label: 'Sem assinatura PRO', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20', icon: <AlertTriangle className="h-5 w-5 text-amber-400" /> };
  })();

  // Computa quantas trocas restam nos últimos 30 dias
  const nameChangesLeft = (() => {
    if (!profile) return 2;
    const count = profile.name_change_count ?? 0;
    const lastChanged = profile.name_last_changed_at ? new Date(profile.name_last_changed_at) : null;
    if (!lastChanged) return 2;
    const daysSince = (Date.now() - lastChanged.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince >= 30) return 2; // janela resetou
    return Math.max(0, 2 - count);
  })();

  const handleNameSave = async () => {
    if (!user || !profile) return;
    if (!newName.trim()) { setNameMsg({ type: 'error', text: 'Nome não pode ser vazio.' }); return; }
    if (newName.trim() === profile.display_name) { setNameMsg({ type: 'error', text: 'O nome é igual ao atual.' }); return; }
    if (nameChangesLeft <= 0) { setNameMsg({ type: 'error', text: 'Limite de 2 alterações por 30 dias atingido.' }); return; }

    setNameLoading(true);
    setNameMsg(null);

    // Calcula novo count considerando janela de 30 dias
    const lastChanged = profile.name_last_changed_at ? new Date(profile.name_last_changed_at) : null;
    const daysSince = lastChanged ? (Date.now() - lastChanged.getTime()) / (1000 * 60 * 60 * 24) : 999;
    const newCount = daysSince >= 30 ? 1 : (profile.name_change_count ?? 0) + 1;

    const { error } = await supabase
      .from('profiles')
      .update({
        display_name: newName.trim(),
        name_change_count: newCount,
        name_last_changed_at: new Date().toISOString(),
      })
      .eq('user_id', user.id);

    if (error) {
      setNameMsg({ type: 'error', text: 'Erro ao salvar. Tente novamente.' });
    } else {
      setNameMsg({ type: 'success', text: 'Nome atualizado com sucesso!' });
      await fetchProfile();
    }
    setNameLoading(false);
  };

  const handlePasswordReset = async () => {
    if (!user?.email) return;
    setResetLoading(true);
    setResetMsg(null);
    const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: 'https://viralflow-gilt.vercel.app/reset-password',
    });
    if (error) {
      setResetMsg({ type: 'error', text: 'Erro ao enviar e-mail. Tente novamente.' });
    } else {
      setResetMsg({ type: 'success', text: `E-mail enviado para ${user.email}. Verifique sua caixa de entrada.` });
    }
    setResetLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[300px]">
        <div className="animate-pulse text-primary text-2xl">⚡</div>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Minha Conta</h1>
        <p className="text-sm text-muted-foreground mt-1">{profile?.display_name || user?.email}</p>
      </div>

      {/* Subscription card */}
      <div className={`rounded-2xl border p-5 space-y-4 ${statusInfo.bg}`}>
        <div className="flex items-center gap-3">
          {statusInfo.icon}
          <div>
            <p className={`font-semibold text-base ${statusInfo.color}`}>{statusInfo.label}</p>
            <p className="text-xs text-muted-foreground">ViralFlow PRO — R$37,90/mês</p>
          </div>
        </div>

        {daysRemaining !== null && user?.email !== 'evcarvalhodev@gmail.com' && (
          <div className="flex items-center gap-2 text-sm">
            <CalendarClock className="h-4 w-4 text-muted-foreground shrink-0" />
            {daysRemaining > 0 ? (
              <span className="text-white">
                Vence em <span className="font-bold text-emerald-400">{daysRemaining} {daysRemaining === 1 ? 'dia' : 'dias'}</span>
                <span className="text-muted-foreground ml-2 text-xs">
                  ({new Date(profile!.subscription_expires_at!).toLocaleDateString('pt-BR')})
                </span>
              </span>
            ) : (
              <span className="text-red-400 font-medium">Assinatura vencida</span>
            )}
          </div>
        )}

        {daysRemaining !== null && daysRemaining <= 7 && daysRemaining > 0 && (
          <div className="flex items-start gap-2 text-amber-400/90 text-xs bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
            <Clock className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span>Sua assinatura vence em breve. Renove agora para não perder o acesso.</span>
          </div>
        )}
      </div>

      {/* Renew / Subscribe button */}
      {user?.email !== 'evcarvalhodev@gmail.com' && (
        <button
          onClick={openCheckout}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-white font-bold text-sm hover:from-violet-500 hover:to-purple-500 transition-all active:scale-95"
        >
          <CreditCard className="h-4 w-4" />
          {isActive && daysRemaining && daysRemaining > 0 ? 'Renovar Assinatura' : 'Assinar ViralFlow PRO'}
        </button>
      )}

      {/* Email display */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <Mail className="h-4 w-4 text-muted-foreground" />
          E-mail da conta
        </div>
        <p className="text-sm text-muted-foreground bg-white/5 border border-white/10 rounded-xl px-4 py-3 select-all">
          {user?.email}
        </p>
      </div>

      {/* Name change */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <User className="h-4 w-4 text-muted-foreground" />
            Alterar nome
          </div>
          <span className={`text-xs px-2 py-0.5 rounded-full border ${nameChangesLeft > 0 ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' : 'text-red-400 bg-red-500/10 border-red-500/20'}`}>
            {nameChangesLeft}/2 restantes
          </span>
        </div>
        <input
          type="text"
          value={newName}
          onChange={e => { setNewName(e.target.value); setNameMsg(null); }}
          placeholder="Seu nome"
          disabled={nameChangesLeft <= 0}
          className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-muted-foreground text-sm focus:outline-none focus:border-violet-500/60 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        />
        {nameMsg && (
          <p className={`text-xs ${nameMsg.type === 'success' ? 'text-emerald-400' : 'text-red-400'}`}>
            {nameMsg.text}
          </p>
        )}
        {nameChangesLeft <= 0 && (
          <p className="text-xs text-muted-foreground">Limite atingido. Você poderá alterar novamente em até 30 dias.</p>
        )}
        <button
          onClick={handleNameSave}
          disabled={nameLoading || nameChangesLeft <= 0}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-white/10 border border-white/10 text-white text-sm font-medium hover:bg-white/15 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {nameLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCheck className="h-4 w-4" />}
          {nameLoading ? 'Salvando...' : 'Salvar nome'}
        </button>
      </div>

      {/* Password reset */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <KeyRound className="h-4 w-4 text-muted-foreground" />
          Redefinir senha
        </div>
        <p className="text-xs text-muted-foreground">
          Enviaremos um link de redefinição para <span className="text-white">{user?.email}</span>.
        </p>
        {resetMsg && (
          <p className={`text-xs ${resetMsg.type === 'success' ? 'text-emerald-400' : 'text-red-400'}`}>
            {resetMsg.text}
          </p>
        )}
        <button
          onClick={handlePasswordReset}
          disabled={resetLoading || resetMsg?.type === 'success'}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-white/10 border border-white/10 text-white text-sm font-medium hover:bg-white/15 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {resetLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
          {resetLoading ? 'Enviando...' : 'Enviar e-mail de redefinição'}
        </button>
      </div>

      <p className="text-center text-[11px] text-muted-foreground">
        Pagamento 100% seguro · Processado pelo MercadoPago
      </p>


    </div>
  );
}
