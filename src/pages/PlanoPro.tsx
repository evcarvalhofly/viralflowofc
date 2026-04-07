import { useState, useEffect } from 'react';
type Plan = 'monthly' | 'annual';
import { Zap, Check, ArrowRight, Sparkles, Type, Scissors, MessageSquare, BarChart2, Users, Video, Layers, Share2 } from 'lucide-react';

const FEATURES = [
  { icon: Scissors,      label: 'ViralCut — Editor de vídeo com IA' },
  { icon: Sparkles,      label: 'Auto Corte e Legendas automáticas' },
  { icon: Type,          label: 'Gerador de título e descrição' },
  { icon: BarChart2,     label: 'Planejamento de conteúdo completo' },
  { icon: MessageSquare, label: 'Chat com IA ilimitado' },
  { icon: Users,         label: 'Comunidade' },
  { icon: Video,         label: 'Biblioteca Vídeos Virais' },
  { icon: Layers,        label: 'Material de edição' },
  { icon: Share2,        label: 'Afiliado' },
];

export default function PlanoPro() {
  const [selectedPlan, setSelectedPlan] = useState<Plan>('monthly');

  useEffect(() => {
    const root = document.getElementById('root');
    document.documentElement.style.overflow = 'auto';
    document.body.style.overflow = 'auto';
    if (root) root.style.overflow = 'auto';
    return () => {
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
      if (root) root.style.overflow = '';
    };
  }, []);

  const openCheckout = (plan: Plan) => {
    window.dispatchEvent(new CustomEvent('open-checkout', { detail: { plan, successRedirect: '/' } }));
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 overflow-y-auto">
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

          {/* Seletor de plano */}
          <div className="p-5 pb-0 space-y-3">
            <button
              onClick={() => setSelectedPlan('monthly')}
              className={`w-full flex items-center justify-between rounded-xl border p-4 transition-colors ${
                selectedPlan === 'monthly'
                  ? 'border-violet-500 bg-violet-500/10'
                  : 'border-border bg-card hover:border-violet-500/40'
              }`}
            >
              <div className="text-left">
                <p className="text-sm font-bold text-foreground">Mensal</p>
                <p className="text-xs text-muted-foreground">Cancele quando quiser</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-extrabold text-foreground">R$37,90<span className="text-xs font-normal text-muted-foreground">/mês</span></p>
              </div>
            </button>
            <button
              onClick={() => setSelectedPlan('annual')}
              className={`w-full flex items-center justify-between rounded-xl border p-4 transition-colors relative ${
                selectedPlan === 'annual'
                  ? 'border-emerald-500 bg-emerald-500/10'
                  : 'border-border bg-card hover:border-emerald-500/40'
              }`}
            >
              <span className="absolute -top-2.5 left-4 bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                ECONOMIZE R$157,80
              </span>
              <div className="text-left">
                <p className="text-sm font-bold text-foreground">Anual</p>
                <p className="text-xs text-muted-foreground">Equivale a R$24,75/mês</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-extrabold text-foreground">R$297<span className="text-xs font-normal text-muted-foreground">/ano</span></p>
              </div>
            </button>
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
          <div className="px-5 pb-5">
            <button
              onClick={() => openCheckout(selectedPlan)}
              className="w-full flex items-center justify-center gap-2 py-4 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white font-bold text-sm transition-all shadow-lg shadow-violet-500/30"
            >
              {selectedPlan === 'annual'
                ? <>Assinar anual por R$297/ano <ArrowRight className="h-4 w-4" /></>
                : <>Assinar agora por R$37,90/mês <ArrowRight className="h-4 w-4" /></>
              }
            </button>
            <p className="text-center text-[11px] text-muted-foreground mt-3">
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
