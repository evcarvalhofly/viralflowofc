import { useState } from 'react';
import { Zap, Check, X, Loader2, Mail, ArrowRight } from 'lucide-react';
import { useSubscription } from '@/hooks/useSubscription';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';

const FEATURES = [
  'ViralCut — Editor de vídeo com IA',
  'Auto Corte inteligente',
  'Legendas automáticas',
  'Análise de tendências',
  'Gerador de roteiros virais',
  'Planejamento de conteúdo',
  'Chat com IA ilimitado',
  'Todas as funcionalidades futuras',
];

interface Props {
  open: boolean;
  onClose: () => void;
}

export function UpgradeModal({ open, onClose }: Props) {
  const { user } = useAuth();
  const { startCheckout } = useSubscription();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [emailStep, setEmailStep] = useState(false);

  if (!open) return null;

  const isGuest = !user;

  const handleCheckout = async () => {
    // Guest sem email → mostra passo de email
    if (isGuest && !emailStep) {
      setEmailStep(true);
      return;
    }

    if (isGuest && !email.trim()) return;

    setLoading(true);
    await startCheckout(isGuest ? email.trim() : undefined);
    setLoading(false);
  };

  const handleClose = () => {
    setEmailStep(false);
    setEmail('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={handleClose} />

      {/* Card */}
      <div className="relative w-full max-w-sm rounded-2xl bg-card border border-border shadow-2xl overflow-hidden">
        {/* Header gradiente */}
        <div className="bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-600 p-6 text-white text-center">
          <div className="flex justify-end mb-2">
            <button onClick={handleClose} className="text-white/70 hover:text-white transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="flex items-center justify-center gap-2 mb-1">
            <Zap className="h-6 w-6 fill-yellow-300 text-yellow-300" />
            <span className="text-2xl font-bold">ViralFlow PRO</span>
          </div>
          <p className="text-white/80 text-sm">Tudo desbloqueado, sem limites</p>

          <div className="mt-4 flex items-end justify-center gap-1">
            <span className="text-sm text-white/70 mb-1">R$</span>
            <span className="text-5xl font-extrabold tracking-tight">37</span>
            <span className="text-2xl font-bold mb-1">,90</span>
            <span className="text-sm text-white/70 mb-1">/mês</span>
          </div>
        </div>

        {emailStep ? (
          /* ── Passo de email (apenas guests) ─────────────────────── */
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Mail className="h-4 w-4 text-violet-400 shrink-0" />
              <p>Qual email você usará para acessar o ViralFlow?</p>
            </div>
            <Input
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCheckout()}
              autoFocus
              className="bg-background"
            />
            <p className="text-[11px] text-muted-foreground">
              Após o pagamento, crie sua conta com este email para ativar o PRO automaticamente.
            </p>
            <button
              onClick={handleCheckout}
              disabled={loading || !email.trim()}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white font-semibold text-sm transition-all shadow-lg shadow-violet-500/30 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Redirecionando...</>
              ) : (
                <>Continuar para pagamento <ArrowRight className="h-4 w-4" /></>
              )}
            </button>
          </div>
        ) : (
          <>
            {/* Features */}
            <div className="p-5 space-y-2.5">
              {FEATURES.map((f) => (
                <div key={f} className="flex items-center gap-2.5 text-sm text-foreground">
                  <Check className="h-4 w-4 shrink-0 text-violet-500" />
                  {f}
                </div>
              ))}
            </div>

            {/* CTA */}
            <div className="px-5 pb-5">
              <button
                onClick={handleCheckout}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white font-semibold text-sm transition-all shadow-lg shadow-violet-500/30 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Redirecionando...</>
                ) : (
                  <><Zap className="h-4 w-4" /> Assinar agora</>
                )}
              </button>
              <p className="text-center text-[11px] text-muted-foreground mt-3">
                Pagamento seguro via MercadoPago · Cancele quando quiser
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
