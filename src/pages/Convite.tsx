import { useState, useRef, useEffect } from 'react';
import { Zap, Check, ArrowRight, Shield, Flame } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { CheckoutModal } from '@/components/CheckoutModal';

const STATS = [
  { value: '+1.200', label: 'criadores ativos' },
  { value: '+8.400', label: 'vídeos gerados' },
  { value: '+3.000', label: 'materiais de edição' },
];

const FEATURES = [
  { emoji: '✂️', title: 'Editor com corte e legenda automática', desc: 'Edite sem saber editar' },
  { emoji: '📅', title: 'Planejamento semanal com IA',           desc: 'Nunca mais fique sem saber o que postar' },
  { emoji: '🎯', title: 'Gerador de título, descrição e copy viral', desc: 'Textos que fazem o vídeo bombar' },
  { emoji: '🎬', title: 'Biblioteca de vídeos virais prontos',   desc: 'Use como gancho ou remodele do zero' },
  { emoji: '🎨', title: 'Materiais de edição atualizados',       desc: 'Fundos, elementos — prévia antes de baixar' },
  { emoji: '🏙️', title: 'Comunidade no mapa interativo',         desc: 'Veja outros criadores em tempo real' },
  { emoji: '🛒', title: 'Shopping interno',                      desc: 'Compre e venda serviços dentro da plataforma' },
  { emoji: '💰', title: 'Programa de afiliados',                 desc: 'Indique e ganhe comissão' },
];

export default function Convite() {
  const { user } = useAuth();
  const [showCheckout, setShowCheckout] = useState(
    () => sessionStorage.getItem('vf_checkout_open') === '1'
  );
  const ctaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = document.getElementById('root');
    const prev = document.body.style.overflow;
    document.documentElement.style.overflow = 'auto';
    document.body.style.overflow = 'auto';
    if (root) root.style.overflow = 'auto';
    return () => {
      document.documentElement.style.overflow = '';
      document.body.style.overflow = prev;
      if (root) root.style.overflow = '';
    };
  }, []);

  const openCheckout = () => {
    sessionStorage.setItem('vf_checkout_open', '1');
    setShowCheckout(true);
  };

  const closeCheckout = () => {
    sessionStorage.removeItem('vf_checkout_open');
    setShowCheckout(false);
  };

  const scrollToCta = () =>
    ctaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });

  const handleHeroCta = () => {
    scrollToCta();
    setTimeout(openCheckout, 300);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">

      {/* ── 1. HERO ─────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden px-4 pt-16 pb-20 text-center">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute left-1/2 top-0 h-[500px] w-[700px] -translate-x-1/2 rounded-full bg-violet-600/15 blur-[120px]" />
        </div>

        <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-4 py-1.5 mb-6">
          <Zap className="h-3.5 w-3.5 fill-violet-400 text-violet-400" />
          <span className="text-xs font-semibold uppercase tracking-widest text-violet-400">ViralFlow PRO</span>
        </div>

        <h1 className="mx-auto max-w-2xl text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
          Crie, edite e viralize seus vídeos em minutos{' '}
          <span className="bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent">
            — sem precisar saber editar
          </span>
        </h1>

        <p className="mx-auto mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">
          Corte automático, legenda automática, planejamento semanal com IA e uma comunidade de criadores que cresce todo dia.
        </p>

        <div className="mt-8 flex flex-col items-center gap-3">
          <button
            onClick={() => { scrollToCta(); setTimeout(openCheckout, 300); }}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 px-8 py-4 text-base font-bold text-white shadow-xl shadow-violet-500/30 transition-all hover:from-violet-500 hover:to-purple-500 active:scale-95"
          >
            <Flame className="h-4 w-4" />
            Quero começar agora por R$37,90/mês
          </button>
          <p className="text-xs text-muted-foreground">Garantia de 7 dias. Cancele quando quiser.</p>
        </div>
      </section>

      {/* ── 2. PROVA SOCIAL ─────────────────────────────────────────── */}
      <section className="border-y border-border/60 bg-card/30 py-6 px-4">
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-5 sm:flex-row sm:justify-around">
          {STATS.map(({ value, label }) => (
            <div key={label} className="flex flex-col items-center text-center">
              <p className="text-2xl font-extrabold text-violet-400">{value}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── 3. BLOCO DA DOR ─────────────────────────────────────────── */}
      <section className="mx-auto max-w-2xl px-4 py-16 text-center">
        <p className="text-lg leading-relaxed text-muted-foreground sm:text-xl">
          Você passa horas editando um vídeo, não sabe o que postar essa semana, usa o mesmo fundo de sempre e ainda não sabe se o título vai bombar.
        </p>
        <p className="mt-5 text-xl font-bold text-foreground sm:text-2xl">
          O ViralFlow resolve tudo isso em um só lugar.
        </p>
      </section>

      {/* ── 4. FEATURES ─────────────────────────────────────────────── */}
      <section className="px-4 pb-16">
        <div className="mx-auto max-w-3xl">
          <h2 className="mb-8 text-center text-2xl font-extrabold sm:text-3xl">
            O que você tem acesso
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {FEATURES.map(({ emoji, title, desc }) => (
              <div
                key={title}
                className="flex items-start gap-4 rounded-xl border border-border/60 bg-card/50 p-4 transition-colors hover:border-violet-500/30 hover:bg-card"
              >
                <span className="mt-0.5 text-2xl leading-none">{emoji}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">{title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{desc}</p>
                </div>
                <Check className="ml-auto mt-0.5 h-4 w-4 shrink-0 text-violet-500" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 5. COMUNIDADE ───────────────────────────────────────────── */}
      <section className="relative overflow-hidden px-4 py-16">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute left-1/2 top-1/2 h-[400px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-purple-600/10 blur-[100px]" />
        </div>
        <div className="mx-auto max-w-3xl">
          <div className="overflow-hidden rounded-2xl border border-violet-500/20 bg-card/60">
            {/* placeholder vídeo/GIF do mapa — substitua por <video> ou <img> */}
            <div className="relative flex h-56 items-center justify-center bg-gradient-to-br from-violet-950/60 via-purple-950/40 to-slate-900/80 sm:h-72">
              <div className="absolute bottom-0 left-0 right-0 flex items-end justify-center gap-1 px-8 opacity-20">
                {[28,18,36,22,42,16,30,24,38,20,32,14,26,40,18].map((h, i) => (
                  <div key={i} className="flex-1 rounded-t-sm bg-violet-400" style={{ height: `${h * 2}px` }} />
                ))}
              </div>
              <div className="absolute inset-x-0 bottom-8 flex justify-around opacity-60">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-1.5 w-3 rounded-full bg-yellow-400/80" style={{ marginTop: `${i % 2 === 0 ? 4 : 0}px` }} />
                ))}
              </div>
              <div className="relative z-10 flex flex-col items-center gap-2 text-center">
                <span className="text-5xl">🏙️</span>
                <span className="rounded-full border border-violet-400/40 bg-violet-500/20 px-3 py-1 text-xs text-violet-300">
                  Substitua por vídeo ou GIF do mapa
                </span>
              </div>
            </div>
            <div className="p-6 text-center sm:p-8">
              <h2 className="text-xl font-extrabold sm:text-2xl">
                Uma cidade inteira de criadores —{' '}
                <span className="bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent">
                  e você faz parte dela
                </span>
              </h2>
              <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted-foreground sm:text-base">
                Cada criador é um prédio. Cada carro passando é alguém online agora. Dentro dessa cidade tem shopping, afiliados e uma rede que cresce junto com você.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── 6. GARANTIA ─────────────────────────────────────────────── */}
      <section className="px-4 py-8">
        <div className="mx-auto max-w-md">
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-6 text-center">
            <Shield className="h-9 w-9 text-emerald-400" />
            <h3 className="text-lg font-bold text-emerald-400">7 dias de garantia total</h3>
            <p className="text-sm text-muted-foreground">
              Entrou, usou, não gostou — devolvemos 100% sem perguntas.
            </p>
          </div>
        </div>
      </section>

      {/* ── 7. CTA FINAL ────────────────────────────────────────────── */}
      <section ref={ctaRef} className="relative overflow-hidden px-4 pb-20 pt-12 text-center">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute left-1/2 bottom-0 h-[400px] w-[600px] -translate-x-1/2 rounded-full bg-violet-600/12 blur-[100px]" />
        </div>
        <div className="mx-auto max-w-md">
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-violet-400">pronto para começar?</p>
          <p className="mb-8 text-2xl font-extrabold sm:text-3xl">
            Tudo isso por menos de{' '}
            <span className="bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent">
              R$1,30 por dia.
            </span>
          </p>

          <div className="mb-6 flex items-end justify-center gap-1">
            <span className="mb-1 text-base text-muted-foreground">R$</span>
            <span className="text-6xl font-extrabold tracking-tight">37</span>
            <div className="mb-1 text-left">
              <span className="text-2xl font-bold">,90</span>
              <p className="text-xs leading-none text-muted-foreground">/mês</p>
            </div>
          </div>

          <button
            onClick={openCheckout}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 py-4 text-base font-bold text-white shadow-xl shadow-violet-500/30 transition-all hover:from-violet-500 hover:to-purple-500 active:scale-95"
          >
            <Flame className="h-4 w-4" /> Assinar o ViralFlow agora — R$37,90/mês
          </button>

          <p className="mt-3 text-xs text-muted-foreground">
            Pagamento 100% seguro via MercadoPago · Garantia de 7 dias · Cancele quando quiser
          </p>
        </div>
      </section>

      <div className="border-t border-border/40 py-5 text-center text-xs text-muted-foreground">
        Já é assinante?{' '}
        <a href="/auth" className="text-violet-400 hover:underline">
          Entrar no app
        </a>
      </div>

      {showCheckout && (
        <CheckoutModal
          onClose={closeCheckout}
          onSuccess={() => { sessionStorage.removeItem('vf_checkout_open'); window.location.href = '/auth'; }}
        />
      )}
    </div>
  );
}
