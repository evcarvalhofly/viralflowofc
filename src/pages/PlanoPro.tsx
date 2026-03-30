import { useState } from 'react';
import { Zap, Check, Loader2, ArrowRight, Sparkles, Type, Scissors, MessageSquare, BarChart2, Users, Video, Layers, Share2, Mail } from 'lucide-react';
import { useSubscription } from '@/hooks/useSubscription';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';

const FEATURES = [
  { icon: Scissors,     label: 'ViralCut — Editor de vídeo com IA' },
  { icon: Sparkles,     label: 'Auto Corte e Legendas automáticas' },
  { icon: Type,         label: 'Gerador de título e descrição' },
  { icon: BarChart2,    label: 'Planejamento de conteúdo completo' },
  { icon: MessageSquare,label: 'Chat com IA ilimitado' },
  { icon: Users,        label: 'Comunidade' },
  { icon: Video,        label: 'Biblioteca Vídeos Virais' },
  { icon: Layers,       label: 'Material de edição' },
  { icon: Share2,       label: 'Afiliado' },
];

export default function PlanoPro() {
  const { user } = useAuth();
  const { startCheckout } = useSubscription();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [emailStep, setEmailStep] = useState(false);

  const isGuest = !user;

  const handleCheckout = async () => {
    if (isGuest && !emailStep) { setEmailStep(true); return; }
    if (isGuest && !email.trim()) return;
    setLoading(true);
    await startCheckout(isGuest ? email.trim() : undefined);
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* Logo / branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-violet-500/10 border border-violet-500/30 rounded-full px-4 py-1.5 mb-4">
            <Zap className="h-3.5 w-3.5 fill-violet-400 text-violet-400" />
            <span className="text-xs font-semibold text-violet-400 tracking-wide uppercase">ViralFlow PRO</span>
          </div>
          <h1 className="text-3xl font-extrabold text-foreground leading-tight">
            Desbloqueie todo o<br />
            <span className="bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent">
              potencial da ViralFlow
            </span>
          </h1>
          <p className="text-muted-foreground text-sm mt-3">
            Assine o PRO e tenha acesso completo a todas as ferramentas para criar conteúdo viral.
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-border bg-card shadow-xl overflow-hidden">

          {/* Preço */}
          <div className="bg-gradient-to-br from-violet-600/20 via-purple-600/10 to-transparent border-b border-border p-6 text-center">
            <div className="flex items-end justify-center gap-1">
              <span className="text-lg text-muted-foreground mb-1">R$</span>
              <span className="text-6xl font-extrabold text-foreground tracking-tight">37</span>
              <div className="mb-1 text-left">
                <span className="text-2xl font-bold text-foreground">,90</span>
                <p className="text-xs text-muted-foreground leading-none">/mês</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">Cancele quando quiser · Sem fidelidade</p>
          </div>

          {/* Features */}
          <div className="p-5 space-y-3">
            {FEATURES.map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-3">
                <div className="h-7 w-7 rounded-lg bg-violet-500/10 flex items-center justify-center shrink-0">
                  <Icon className="h-3.5 w-3.5 text-violet-400" />
                </div>
                <span className="text-sm text-foreground">{label}</span>
                <Check className="h-4 w-4 text-violet-500 ml-auto shrink-0" />
              </div>
            ))}
          </div>

          {/* CTA */}
          <div className="px-5 pb-5 space-y-3">
            {emailStep && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Mail className="h-4 w-4 text-violet-400 shrink-0" />
                  <span>Qual email você usará para acessar o ViralFlow?</span>
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
              </div>
            )}
            <button
              onClick={handleCheckout}
              disabled={loading || (emailStep && !email.trim())}
              className="w-full flex items-center justify-center gap-2 py-4 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white font-bold text-sm transition-all shadow-lg shadow-violet-500/30 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Redirecionando para o pagamento...</>
              ) : emailStep ? (
                <>Continuar para pagamento <ArrowRight className="h-4 w-4" /></>
              ) : (
                <>Assinar agora por R$37,90/mês <ArrowRight className="h-4 w-4" /></>
              )}
            </button>
            <p className="text-center text-[11px] text-muted-foreground">
              Pagamento 100% seguro via MercadoPago
            </p>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Já é assinante?{' '}
          <a href="/" className="text-violet-400 hover:underline">
            Voltar ao app
          </a>
        </p>
      </div>
    </div>
  );
}
