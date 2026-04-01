import { useState } from 'react';
import { Phone, KeyRound, Loader2, CheckCheck, AlertCircle } from 'lucide-react';
import type { Affiliate } from '@/types/affiliates';

interface Props {
  affiliate: Affiliate;
  onSave: (whatsapp: string, pixKey: string) => Promise<{ error?: string }>;
}

export default function AffiliateProfilePanel({ affiliate, onSave }: Props) {
  const [whatsapp, setWhatsapp] = useState(affiliate.whatsapp ?? '');
  const [pixKey, setPixKey] = useState(affiliate.pix_key ?? '');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSave = async () => {
    if (!whatsapp.trim() && !pixKey.trim()) {
      setMsg({ type: 'error', text: 'Preencha pelo menos um dos campos.' });
      return;
    }
    setSaving(true);
    setMsg(null);
    const result = await onSave(whatsapp.trim(), pixKey.trim());
    setSaving(false);
    if (result.error) {
      setMsg({ type: 'error', text: result.error });
    } else {
      setMsg({ type: 'success', text: 'Dados atualizados com sucesso!' });
    }
  };

  return (
    <div className="max-w-md space-y-5">
      <div>
        <h2 className="text-base font-bold text-white">Meus Dados</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Mantenha seu WhatsApp e chave PIX atualizados para receber saques corretamente.
        </p>
      </div>

      {/* Email (read-only) */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-white">E-mail</label>
        <p className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-muted-foreground text-sm select-all">
          {affiliate.email ?? '—'}
        </p>
      </div>

      {/* WhatsApp */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-white flex items-center gap-2">
          <Phone className="h-3.5 w-3.5 text-muted-foreground" />
          WhatsApp
        </label>
        <input
          type="tel"
          value={whatsapp}
          onChange={e => { setWhatsapp(e.target.value); setMsg(null); }}
          placeholder="+55 11 99999-9999"
          className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-muted-foreground text-sm focus:outline-none focus:border-violet-500/60 transition-colors"
        />
      </div>

      {/* Chave PIX */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-white flex items-center gap-2">
          <KeyRound className="h-3.5 w-3.5 text-muted-foreground" />
          Chave PIX
        </label>
        <input
          type="text"
          value={pixKey}
          onChange={e => { setPixKey(e.target.value); setMsg(null); }}
          placeholder="CPF, e-mail, telefone ou chave aleatória"
          className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-muted-foreground text-sm focus:outline-none focus:border-violet-500/60 transition-colors"
        />
      </div>

      {msg && (
        <div className={`flex items-start gap-2 text-sm rounded-lg px-3 py-2 ${
          msg.type === 'success'
            ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20'
            : 'text-red-400 bg-red-500/10 border border-red-500/20'
        }`}>
          {msg.type === 'error' && <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />}
          <span>{msg.text}</span>
        </div>
      )}

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-white font-bold text-sm disabled:opacity-60 hover:from-violet-500 hover:to-purple-500 transition-all active:scale-95"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCheck className="h-4 w-4" />}
        {saving ? 'Salvando...' : 'Salvar dados'}
      </button>
    </div>
  );
}
