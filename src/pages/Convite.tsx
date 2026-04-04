import { useState, useRef, useEffect } from 'react';
import {
  Zap, Check, ArrowRight, Shield, Flame, Star, X,
  Brain, Calendar, Trophy, Film, Layers, Scissors,
  Users, ShoppingBag, Handshake, ChevronDown, Play,
} from 'lucide-react';
import { CheckoutModal } from '@/components/CheckoutModal';

type Plan = 'monthly' | 'annual';

/* ─── Dados ─────────────────────────────────────────────────── */

const PAIN_POINTS = [
  'Passa horas editando e o vídeo não engaja nada',
  'Não sabe o que postar essa semana',
  'O algoritmo ignora o seu conteúdo',
  'Fica travado na frente do computador sem saber por onde começar',
  'Assiste tutorial atrás de tutorial e ainda não evoluiu',
  'Vê outros criadores crescendo e se pergunta o que eles têm que você não tem',
];

const FEATURES = [
  {
    icon: Brain,
    title: 'IA que planeja sua semana inteira',
    desc: 'Informe seu nicho. A IA monta o calendário completo de posts. Nunca mais fique sem saber o que postar.',
    highlight: 'Planejamento semanal automático',
  },
  {
    icon: Trophy,
    title: 'GameOver — Títulos que fazem bombar',
    desc: 'Fala sobre o vídeo. Recebe título, descrição e copy viral gerados em segundos. Mais cliques, mais views.',
    highlight: 'Título + Descrição + Copy em segundos',
  },
  {
    icon: Film,
    title: 'Biblioteca de vídeos virais prontos',
    desc: 'Vídeos que já provaram funcionar. Adapte, poste e cresça — sem partir do zero.',
    highlight: 'Conteúdo pronto para reutilizar',
  },
  {
    icon: Layers,
    title: 'Biblioteca de edição completa',
    desc: 'Fundos, efeitos e overlays com prévia antes de baixar. Atualização semanal. Material infinito.',
    highlight: 'Atualizado toda semana',
  },
  {
    icon: Scissors,
    title: 'ViralCut — Editor com IA embutida',
    desc: 'Sobe o vídeo. A IA corta as pausas e coloca legenda automática. Edição sem saber editar.',
    highlight: 'Corte + legenda automáticos com IA',
  },
  {
    icon: Users,
    title: 'Comunidade no mapa interativo',
    desc: 'Cada criador é um prédio na cidade. Veja quem está online, faça amizades e networking real dentro do app.',
    highlight: 'Só no ViralFlow',
  },
  {
    icon: ShoppingBag,
    title: 'Shopping interno',
    desc: 'Compre e venda serviços para outros criadores. Monetize além do conteúdo.',
    highlight: 'Monetize para outros criadores',
  },
  {
    icon: Handshake,
    title: 'Programa de afiliados — 50%',
    desc: 'Indique o ViralFlow e receba 50% por cada venda. A melhor taxa do mercado.',
    highlight: '50% de comissão',
  },
];

const COMPARE = [
  { without: 'Horas editando sem resultado', with: 'ViralCut edita por você em minutos' },
  { without: 'Travado sem saber o que postar', with: 'Planejamento semanal pronto com 1 clique' },
  { without: 'Títulos genéricos sem engajamento', with: 'Copy viral gerada pela IA do GameOver' },
  { without: 'Efeitos espalhados em mil pastas', with: 'Biblioteca organizada com prévia e favoritos' },
  { without: 'Isolado, sem networking', with: 'Comunidade ativa no mapa interativo' },
  { without: 'Ganha só com seus próprios vídeos', with: 'Afiliado: 50% por cada indicação' },
];

const FAQS = [
  {
    q: 'Preciso saber editar para usar?',
    a: 'Não. O ViralCut faz o corte e a legenda automaticamente. Você só precisa enviar o vídeo.',
  },
  {
    q: 'Funciona para qualquer nicho?',
    a: 'Sim. O planejamento é feito com base no seu nicho específico — a IA se adapta a qualquer área.',
  },
  {
    q: 'Posso cancelar quando quiser?',
    a: 'Sim, sem fidelidade. O plano mensal você cancela a qualquer momento. O plano anual tem garantia de 7 dias.',
  },
  {
    q: 'O programa de afiliados é real?',
    a: 'Sim, pagamos 50% de comissão por cada venda indicada. Você acompanha tudo dentro do painel de afiliados.',
  },
  {
    q: 'A biblioteca de edição é atualizada sempre?',
    a: 'Toda semana novos fundos, overlays e efeitos são adicionados. Você nunca fica sem material novo.',
  },
  {
    q: 'Posso testar antes de comprar?',
    a: 'Oferecemos 7 dias de garantia total. Se não gostar por qualquer motivo, devolvemos 100% do valor.',
  },
];

/* ─── Carousel ──────────────────────────────────────────────── */
function Carousel({ images, direction = 'forward' }: { images: string[]; direction?: 'forward' | 'backward' }) {
  // Doubled array: [0..n-1, 0..n-1] — idx resets silently at midpoint for seamless loop
  const doubled = [...images, ...images];
  const [idx, setIdx] = useState(0);
  const [animated, setAnimated] = useState(true);
  const [paused, setPaused] = useState(false);
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const advance = (delta: number) => {
    setAnimated(true);
    setIdx(i => i + delta);
  };

  const prev = () => { advance(-1); handleInteraction(); };
  const next = () => { advance(1); handleInteraction(); };

  const handleInteraction = () => {
    setPaused(true);
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
    resumeTimer.current = setTimeout(() => setPaused(false), 10000);
  };

  // When we reach the end of the first copy, snap silently to equivalent position in range [0, n-1]
  useEffect(() => {
    if (idx >= images.length) {
      const timer = setTimeout(() => {
        setAnimated(false);
        setIdx(i => i - images.length);
      }, 620); // just after transition ends
      return () => clearTimeout(timer);
    }
    if (idx < 0) {
      const timer = setTimeout(() => {
        setAnimated(false);
        setIdx(i => i + images.length);
      }, 620);
      return () => clearTimeout(timer);
    }
  }, [idx, images.length]);

  useEffect(() => {
    if (paused) return;
    const timer = setInterval(() => {
      advance(direction === 'forward' ? 1 : -1);
    }, 2200);
    return () => clearInterval(timer);
  }, [direction, paused]);

  useEffect(() => () => { if (resumeTimer.current) clearTimeout(resumeTimer.current); }, []);

  return (
    <div className="relative" onMouseDown={handleInteraction} onTouchStart={handleInteraction}>
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
        <div
          className="flex"
          style={{
            transform: `translateX(-${idx * 100}%)`,
            transition: animated ? 'transform 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94)' : 'none',
          }}
        >
          {doubled.map((src, i) => (
            <img
              key={i}
              src={src}
              alt={`Resultado ${i + 1}`}
              className="w-full shrink-0 h-auto"
              loading="lazy"
            />
          ))}
        </div>
      </div>
      <button
        onClick={prev}
        className="absolute left-2 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-black/60 border border-white/10 flex items-center justify-center text-white hover:bg-black/80 transition-colors"
        aria-label="Anterior"
      >
        <ChevronDown className="h-5 w-5 rotate-90" />
      </button>
      <button
        onClick={next}
        className="absolute right-2 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-black/60 border border-white/10 flex items-center justify-center text-white hover:bg-black/80 transition-colors"
        aria-label="Próximo"
      >
        <ChevronDown className="h-5 w-5 -rotate-90" />
      </button>
    </div>
  );
}

/* ─── FAQ Item ───────────────────────────────────────────────── */
function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-white/10 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left text-sm font-semibold text-white hover:bg-white/5 transition-colors"
      >
        <span>{q}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="px-5 pb-4 text-sm text-muted-foreground leading-relaxed border-t border-white/5 pt-3">
          {a}
        </div>
      )}
    </div>
  );
}

/* ─── Pricing Card ───────────────────────────────────────────── */
function PricingCard({
  plan, selected, onSelect, onBuy,
}: {
  plan: Plan; selected: boolean; onSelect: () => void; onBuy: () => void;
}) {
  const isAnnual = plan === 'annual';
  return (
    <div
      onClick={onSelect}
      className={`relative rounded-2xl border-2 p-6 cursor-pointer transition-all ${
        isAnnual
          ? selected ? 'border-emerald-400 bg-emerald-500/10' : 'border-emerald-500/30 bg-emerald-500/5 hover:border-emerald-500/60'
          : selected ? 'border-violet-400 bg-violet-500/10' : 'border-white/10 bg-white/5 hover:border-white/20'
      }`}
    >
      {isAnnual && (
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-emerald-500 text-white text-xs font-bold px-4 py-1 rounded-full whitespace-nowrap">
          MELHOR CUSTO-BENEFÍCIO — ECONOMIZE R$157,80
        </div>
      )}

      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <p className="text-white font-bold text-base">{isAnnual ? 'Plano Anual' : 'Plano Mensal'}</p>
          <p className="text-muted-foreground text-xs mt-0.5">
            {isAnnual ? 'Pague uma vez, use o ano todo' : 'Cancele quando quiser'}
          </p>
        </div>
        <div className={`h-5 w-5 rounded-full border-2 shrink-0 mt-0.5 flex items-center justify-center ${
          selected
            ? isAnnual ? 'border-emerald-400 bg-emerald-400' : 'border-violet-400 bg-violet-400'
            : 'border-white/30'
        }`}>
          {selected && <Check className="h-3 w-3 text-white" />}
        </div>
      </div>

      <div className="flex items-end gap-1 mb-1">
        <span className="text-muted-foreground text-base mb-1">R$</span>
        {isAnnual ? (
          <>
            <span className="text-5xl font-extrabold text-white">297</span>
            <span className="text-muted-foreground text-sm mb-1">/ano</span>
          </>
        ) : (
          <>
            <span className="text-5xl font-extrabold text-white">37</span>
            <span className="text-white text-2xl font-bold mb-1">,90</span>
            <span className="text-muted-foreground text-sm mb-1">/mês</span>
          </>
        )}
      </div>

      {isAnnual && (
        <p className="text-emerald-400 text-xs font-medium mb-4">
          Equivale a R$24,75/mês · 12 meses inclusos
        </p>
      )}
      {!isAnnual && <p className="text-muted-foreground text-xs mb-4">Cobrado mensalmente</p>}

      <button
        onClick={e => { e.stopPropagation(); onBuy(); }}
        className={`w-full py-3.5 rounded-xl font-bold text-sm transition-all active:scale-95 ${
          isAnnual
            ? 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white shadow-lg shadow-emerald-500/30'
            : 'bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white shadow-lg shadow-violet-500/30'
        }`}
      >
        {isAnnual ? 'Assinar Plano Anual — R$297' : 'Assinar Plano Mensal — R$37,90'}
      </button>
    </div>
  );
}

/* ─── Page ───────────────────────────────────────────────────── */
export default function Convite() {
  const [showCheckout, setShowCheckout] = useState(
    () => sessionStorage.getItem('vf_checkout_open') === '1',
  );
  const [checkoutPlan, setCheckoutPlan] = useState<Plan>('annual');
  const [selectedPlan, setSelectedPlan] = useState<Plan>('annual');
  const [scrollProgress, setScrollProgress] = useState(0);
  const [viewers, setViewers] = useState(() => Math.floor(Math.random() * (187 - 127 + 1)) + 127);
  const pricingRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => {
      const root = document.getElementById('root');
      // Try #root first (may be the actual scroll container), fallback to window
      const el = (root && root.scrollHeight > root.clientHeight && root.scrollTop > 0)
        ? root
        : document.documentElement;
      const scrolled = el.scrollTop || document.body.scrollTop || window.scrollY;
      const total = el.scrollHeight - el.clientHeight;
      setScrollProgress(total > 0 ? Math.min((scrolled / total) * 100, 100) : 0);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    document.getElementById('root')?.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      document.getElementById('root')?.removeEventListener('scroll', onScroll);
    };
  }, []);

  // Fix: override global overflow:hidden for this public page
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

  useEffect(() => {
    const timer = setInterval(() => {
      setViewers(v => {
        const delta = Math.floor(Math.random() * 5) - 2;
        return Math.min(187, Math.max(127, v + delta));
      });
    }, 4500);
    return () => clearInterval(timer);
  }, []);

  const openCheckout = (plan: Plan) => {
    setCheckoutPlan(plan);
    sessionStorage.setItem('vf_checkout_open', '1');
    setShowCheckout(true);
  };

  const closeCheckout = () => {
    sessionStorage.removeItem('vf_checkout_open');
    setShowCheckout(false);
  };

  const scrollToPricing = () =>
    pricingRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });

  const handleCtaClick = () => {
    scrollToPricing();
    setTimeout(() => openCheckout(selectedPlan), 400);
  };

  return (
    <div className="bg-[#09090b] text-foreground overflow-x-hidden">

      {/* ── BARRA DE PROGRESSO ─────────────────────────────────── */}
      {/* ── BARRA DE PROGRESSO ─────────────────────────────────── */}
      <div className="fixed top-0 left-0 w-full z-50 h-[3px] bg-white/10">
        <div
          className="h-full bg-violet-500"
          style={{
            width: `${scrollProgress}%`,
            transition: 'width 0.15s ease-out',
            boxShadow: '0 0 10px 3px rgba(139, 92, 246, 0.8)',
          }}
        />
      </div>

      {/* ── HERO ───────────────────────────────────────────────── */}
      <section className="relative overflow-hidden px-4 pt-8 pb-20 text-center">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute left-1/2 top-0 h-[600px] w-[800px] -translate-x-1/2 rounded-full bg-violet-600/20 blur-[140px]" />
        </div>

        <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/40 bg-violet-500/10 px-4 py-1.5 mb-6">
          <Zap className="h-3.5 w-3.5 fill-violet-400 text-violet-400" />
          <span className="text-xs font-bold uppercase tracking-widest text-violet-400">ViralFlow PRO</span>
        </div>

        <h1 className="mx-auto max-w-xl text-2xl font-extrabold leading-tight tracking-tight sm:text-4xl">
          Pare de postar e ser ignorado.{' '}
          <span className="bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent">
            Conheça o sistema que faz o algoritmo trabalhar por você!
          </span>
        </h1>

        <img
          src="https://goupwin.com/wp-content/uploads/2026/04/flow.png"
          alt="ViralFlow"
          className="mx-auto mt-8 w-full sm:max-w-sm rounded-2xl"
        />

        <p className="mx-auto mt-6 max-w-xl text-base text-zinc-400 sm:text-xl leading-relaxed">
          Dor de cabeça pra editar? Travado em visualizações? — Conheça o ViralFlow ⬇️
        </p>

        <div className="mt-8 text-center leading-none w-full rounded-2xl py-5 px-4 overflow-hidden" style={{ background: 'linear-gradient(135deg, #2d0057 0%, #6b00a8 25%, #c0008a 55%, #ff2dcc 75%, #7b00c4 100%)', boxShadow: 'inset 0 0 60px rgba(255,255,255,0.08)' }}>
          <p className="text-sm font-bold uppercase tracking-[0.25em] text-white/80 mb-2" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.5)', WebkitTextStroke: '0.3px rgba(255,255,255,0.4)' }}>Seja Visualmente</p>
          <p className="text-7xl uppercase text-white sm:text-9xl" style={{ fontFamily: "'Anton', sans-serif", textShadow: '0 2px 8px rgba(0,0,0,0.5)', WebkitTextStroke: '0.5px rgba(255,255,255,0.3)', letterSpacing: '-0.02em' }}>IMPOSSÍVEL</p>
          <p className="text-2xl font-bold italic tracking-wide text-white sm:text-3xl" style={{ fontFamily: "'Playfair Display', serif", textShadow: '0 2px 6px rgba(0,0,0,0.5)', WebkitTextStroke: '0.3px rgba(255,255,255,0.3)' }}>de ignorar</p>
        </div>

        {/* ── GIF GRID ───────────────────────────────────────────── */}
        <div className="mx-auto mt-8 w-full max-w-sm">
          <div className="grid grid-cols-2 gap-2 mb-2">
            <img src="https://membros.goupwin.com/wp-content/uploads/2025/07/lv_0_20250308142307-2-1.gif" alt="" className="w-full rounded-xl object-cover aspect-[9/16]" />
            <img src="https://membros.goupwin.com/wp-content/uploads/2025/07/02283-1.gif" alt="" className="w-full rounded-xl object-cover aspect-[9/16]" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <img src="https://membros.goupwin.com/wp-content/uploads/2025/07/lv_0_20250719021025-1.gif" alt="" className="w-full rounded-xl object-cover aspect-[9/16]" />
            <img src="https://membros.goupwin.com/wp-content/uploads/2025/07/lv_0_20250719023826-1.gif" alt="" className="w-full rounded-xl object-cover aspect-[9/16]" />
            <img src="https://membros.goupwin.com/wp-content/uploads/2025/07/lv_0_20250308142508-1.gif" alt="" className="w-full rounded-xl object-cover aspect-[9/16]" />
          </div>
        </div>

        {/* ── SOCIAL PROOF ───────────────────────────────────────── */}
        <div className="mt-8 flex flex-col items-center gap-3">
          <p className="text-sm font-semibold text-red-400 flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-full bg-red-400 animate-pulse" />
            {viewers} pessoas visualizando agora
          </p>
          <div className="flex items-center gap-2 flex-wrap justify-center">
            {[
              'https://membros.goupwin.com/wp-content/uploads/2025/04/imagem_2024-08-29_233135709.png',
              'https://membros.goupwin.com/wp-content/uploads/2025/04/imagem_2024-08-29_233209217.png',
              'https://membros.goupwin.com/wp-content/uploads/2025/04/imagem_2024-08-29_232900624.png',
              'https://membros.goupwin.com/wp-content/uploads/2021/02/outdoor-image-02.jpg',
              'https://digitalize.goupwin.com/wp-content/uploads/2026/01/image-9.webp',
            ].map((src, i) => (
              <img key={i} src={src} alt="" className="w-9 h-9 rounded-full object-cover border-2 border-white/20 -ml-2 first:ml-0" />
            ))}
            <div className="flex items-center gap-1.5 ml-1">
              <span className="text-yellow-400 text-lg leading-none">★★★★★</span>
              <span className="text-sm text-zinc-400">4.9/5 <span className="text-zinc-500">(2.847)</span></span>
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={handleCtaClick}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl px-8 py-4 text-base font-bold text-white shadow-2xl active:scale-95 transition-all"
            style={{ background: 'linear-gradient(135deg, #6b00a8 0%, #c0008a 50%, #ff2dcc 100%)', boxShadow: '0 4px 24px rgba(192,0,138,0.45)' }}
          >
            <Flame className="h-5 w-5" />
            Quero viralizar agora
          </button>
          <button
            onClick={scrollToPricing}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-8 py-4 text-sm font-semibold text-white hover:bg-white/10 transition-colors"
          >
            Ver os planos <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-xs text-zinc-500">
          <span className="flex items-center gap-1.5"><Shield className="h-3.5 w-3.5 text-emerald-400" /> 7 dias de garantia</span>
          <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-violet-400" /> Sem fidelidade no mensal</span>
          <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-violet-400" /> Cancele quando quiser</span>
        </div>
      </section>

      {/* ── NÚMEROS ─────────────────────────────────────────────── */}
      <section className="border-y border-white/5 bg-white/[0.02] py-8 px-4">
        <div className="mx-auto grid max-w-3xl grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-2xl sm:text-3xl font-extrabold text-violet-400">+4.200</p>
            <p className="text-xs text-zinc-500 mt-1 leading-tight">Vendas<br />(antigo ViralCut)</p>
          </div>
          {[
            { v: '+8.400', l: 'vídeos gerados' },
            { v: '+3.000', l: 'materiais de edição' },
          ].map(({ v, l }) => (
            <div key={l}>
              <p className="text-2xl sm:text-3xl font-extrabold text-violet-400">{v}</p>
              <p className="text-xs text-zinc-500 mt-1">{l}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── IMAGEM COM PERGUNTAS ────────────────────────────────── */}
      <div className="px-4 pb-8">
        <img
          src="https://goupwin.com/wp-content/uploads/2026/04/Generated-Image-April-04-2026-1_17PM-Photoroom.png"
          alt=""
          className="mx-auto w-full max-w-sm rounded-2xl"
        />
      </div>

      {/* ── RESPOSTAS ÀS PERGUNTAS DA IMAGEM ───────────────────── */}
      <section className="px-4 pb-12">
        <div className="mx-auto max-w-2xl">
          <p className="text-center text-xs font-bold uppercase tracking-widest text-violet-400 mb-2">Respondendo de uma vez</p>
          <h2 className="text-center text-2xl sm:text-3xl font-extrabold text-white mb-8 leading-snug">
            Suas dúvidas têm{' '}
            <span className="bg-gradient-to-r from-violet-400 to-pink-400 bg-clip-text text-transparent">resposta aqui</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              {
                question: 'Editar é cansativo?',
                answer: 'Edição automática com IA — você aprova, o ViralFlow faz.',
                icon: '🎬',
              },
              {
                question: 'Conteúdo Viral ou Apelativo?',
                answer: 'Roteiro infalível com método viral entregue pela IA.',
                icon: '🚀',
              },
              {
                question: 'Travado no CapCut?',
                answer: 'Biblioteca infinita de materiais que supera qualquer editor.',
                icon: '♾️',
              },
              {
                question: 'Arriscar sozinho?',
                answer: 'Comunidade ativa de criadores do seu lado a cada passo.',
                icon: '🤝',
              },
            ].map((item) => (
              <div
                key={item.question}
                className="rounded-2xl p-px"
                style={{ background: 'linear-gradient(135deg, #6b00a8, #c0008a)' }}
              >
                <div className="rounded-2xl bg-[#0d0d1a] p-5 h-full flex flex-col gap-2">
                  <span className="text-2xl">{item.icon}</span>
                  <p className="text-sm text-white/50 font-medium">{item.question}</p>
                  <p className="text-white font-bold leading-snug">{item.answer}</p>
                </div>
              </div>
            ))}
            {/* Card largo — 5º item */}
            <div
              className="sm:col-span-2 rounded-2xl p-px"
              style={{ background: 'linear-gradient(135deg, #6b00a8, #ff2dcc)' }}
            >
              <div className="rounded-2xl bg-[#0d0d1a] p-5 flex flex-col sm:flex-row sm:items-center gap-3">
                <span className="text-3xl">⚡</span>
                <div>
                  <p className="text-sm text-white/50 font-medium">Constância sem resultado?</p>
                  <p className="text-white font-bold leading-snug">
                    Método + consistência = crescimento real —{' '}
                    <span className="text-pink-400">não apenas posts no vazio.</span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── COMPARATIVO ─────────────────────────────────────────── */}
      <section className="px-4 py-12">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-center text-2xl sm:text-3xl font-extrabold text-white mb-10">
            Comparativo
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-red-500/5 border border-red-500/10 p-4">
              <p className="text-xs font-bold text-red-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                <X className="h-3.5 w-3.5" /> Sem ViralFlow
              </p>
              <div className="space-y-2.5">
                {COMPARE.map(c => (
                  <p key={c.without} className="text-xs text-zinc-500 flex items-start gap-2">
                    <span className="text-red-500 shrink-0 mt-0.5">✕</span>
                    {c.without}
                  </p>
                ))}
              </div>
            </div>
            <div className="rounded-xl bg-violet-500/5 border border-violet-500/20 p-4">
              <p className="text-xs font-bold text-violet-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5" /> Com ViralFlow
              </p>
              <div className="space-y-2.5">
                {COMPARE.map(c => (
                  <p key={c.with} className="text-xs text-zinc-300 flex items-start gap-2">
                    <span className="text-violet-400 shrink-0 mt-0.5">✓</span>
                    {c.with}
                  </p>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── PERFIS QUE DESTRAVARAM ───────────────────────────────── */}
      <section
        className="px-4 py-12"
        style={{
          background: `
            linear-gradient(rgba(0,0,0,0.62), rgba(0,0,0,0.62)),
            radial-gradient(ellipse at 100% 50%, #ff2dcc 0%, transparent 55%),
            radial-gradient(ellipse at 0% 80%, #ff3a00 0%, transparent 50%),
            radial-gradient(ellipse at 30% 10%, #7ecfff 0%, transparent 50%),
            radial-gradient(ellipse at 60% 60%, #c0008a 0%, transparent 45%),
            #1a0030
          `,
        }}
      >
        <div className="mx-auto max-w-xs">
          <h2 className="text-center text-2xl sm:text-3xl font-extrabold text-white mb-8 leading-snug">
            Perfis que destravaram e monetizaram
          </h2>
          <div className="space-y-6">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-3 text-center">TikTok</p>
              <Carousel direction="forward" images={[
                'https://membros.goupwin.com/wp-content/uploads/2026/02/II1.png',
                'https://membros.goupwin.com/wp-content/uploads/2026/02/II2.png',
                'https://membros.goupwin.com/wp-content/uploads/2026/02/II3.png',
              ]} />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-3 text-center">Instagram</p>
              <Carousel direction="forward" images={[
                'https://membros.goupwin.com/wp-content/uploads/2026/02/perfil3.png',
                'https://membros.goupwin.com/wp-content/uploads/2026/02/perfil2.png',
                'https://membros.goupwin.com/wp-content/uploads/2026/02/PERFIL1.png',
              ]} />
            </div>
          </div>
        </div>
      </section>

      {/* ── PROVA SOCIAL ─────────────────────────────────────────── */}
      <section
        className="px-4 py-16"
        style={{
          background: `
            linear-gradient(rgba(0,0,0,0.62), rgba(0,0,0,0.62)),
            radial-gradient(ellipse at 80% 20%, #ff2dcc 0%, transparent 50%),
            radial-gradient(ellipse at 10% 60%, #6b00a8 0%, transparent 55%),
            radial-gradient(ellipse at 50% 90%, #3d0080 0%, transparent 50%),
            radial-gradient(ellipse at 90% 80%, #c0008a 0%, transparent 45%),
            #0d0020
          `,
        }}
      >
        <div className="mx-auto max-w-xs">
          <p className="text-center text-xs font-bold uppercase tracking-widest text-violet-400 mb-3">Resultados reais</p>
          <h2 className="text-center text-2xl sm:text-3xl font-extrabold text-white mb-10 leading-snug">
            Criadores que usam o ViralFlow já estão colhendo resultados
          </h2>

          <div className="space-y-6">
            <Carousel direction="forward" images={[
              'https://goupwin.com/wp-content/uploads/2026/04/WhatsApp-Image-2026-04-01-at-23.54.46-1.jpeg',
              'https://goupwin.com/wp-content/uploads/2026/04/WhatsApp-Image-2026-04-01-at-23.54.46.jpeg',
              'https://goupwin.com/wp-content/uploads/2026/04/WhatsApp-Image-2026-04-01-at-23.54.45-3.jpeg',
            ]} />
            <Carousel direction="forward" images={[
              'https://goupwin.com/wp-content/uploads/2026/04/WhatsApp-Image-2026-04-01-at-23.54.45-2.jpeg',
              'https://goupwin.com/wp-content/uploads/2026/04/WhatsApp-Image-2026-04-01-at-23.54.45-1.jpeg',
              'https://goupwin.com/wp-content/uploads/2026/04/WhatsApp-Image-2026-04-01-at-23.54.45.jpeg',
            ]} />
          </div>

          <div className="mt-8 text-center">
            <a
              href="https://www.instagram.com/goupcreations?igsh=OTRoN2tlb2t1dXg="
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10 transition-colors"
            >
              <Star className="h-4 w-4 text-violet-400" />
              Ver mais resultados no Instagram →
            </a>
          </div>
        </div>
      </section>

      {/* ── SOLUÇÃO ─────────────────────────────────────────────── */}
      <section className="relative px-4 py-4 pb-20">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute left-1/2 top-1/2 h-[500px] w-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-purple-600/10 blur-[120px]" />
        </div>
        <div className="mx-auto max-w-3xl">
          <p className="text-center text-xs font-bold uppercase tracking-widest text-violet-400 mb-3">O que você tem acesso</p>
          <h2 className="text-center text-2xl sm:text-3xl font-extrabold text-white mb-12 leading-snug">
            8 ferramentas que{' '}
            <span className="bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent">
              trabalham por você enquanto você cria
            </span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {FEATURES.map(({ icon: Icon, title, desc, highlight }) => (
              <div
                key={title}
                className="group rounded-2xl border border-white/8 bg-white/[0.03] p-5 hover:border-violet-500/30 hover:bg-violet-500/5 transition-all"
              >
                <div className="flex items-start gap-4 mb-3">
                  <div className="h-10 w-10 rounded-xl bg-violet-500/15 flex items-center justify-center shrink-0 group-hover:bg-violet-500/25 transition-colors">
                    <Icon className="h-5 w-5 text-violet-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-white leading-snug">{title}</p>
                    <span className="inline-block mt-1 text-[10px] font-bold uppercase tracking-wide text-violet-400 bg-violet-500/10 px-2 py-0.5 rounded-full">
                      {highlight}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── COMUNIDADE DESTAQUE ──────────────────────────────────── */}
      <section className="px-4 py-16 bg-gradient-to-b from-transparent via-violet-950/20 to-transparent">
        <div className="mx-auto max-w-3xl">
          <div className="overflow-hidden rounded-3xl border border-violet-500/20 bg-[#0f0f13]">
            <div className="relative flex h-64 sm:h-80 items-center justify-center bg-gradient-to-br from-violet-950 via-purple-950/60 to-slate-900">
              <div className="absolute inset-0 flex items-end justify-around px-8 pb-0 opacity-20">
                {[28,18,42,22,36,16,30,24,38,20,44,14,26,40,18,32].map((h, i) => (
                  <div key={i} className="flex-1 rounded-t bg-violet-400 mx-px" style={{ height: `${h * 2.5}px` }} />
                ))}
              </div>
              {/* Carros / pontos online */}
              <div className="absolute inset-x-0 bottom-12 flex justify-around">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className={`h-2 w-4 rounded-full bg-yellow-400 opacity-${i % 2 === 0 ? '80' : '40'}`} />
                ))}
              </div>
              <div className="relative z-10 flex flex-col items-center gap-3 text-center px-6">
                <span className="text-6xl">🏙️</span>
                <span className="rounded-full border border-violet-400/30 bg-violet-500/20 px-4 py-1.5 text-xs font-semibold text-violet-300">
                  Cada prédio é um criador · Cada carro = 1 usuário online
                </span>
              </div>
            </div>
            <div className="p-6 sm:p-8 text-center">
              <h2 className="text-xl sm:text-2xl font-extrabold text-white leading-snug">
                A única plataforma com{' '}
                <span className="bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent">
                  comunidade em mapa interativo
                </span>
              </h2>
              <p className="mx-auto mt-3 max-w-md text-sm text-zinc-400 leading-relaxed">
                Quando você entra na comunidade, vê uma cidade inteira de criadores. Faça amizades, mande mensagens, compre e venda serviços no Shopping — networking de verdade, dentro do app.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── AFILIADOS DESTAQUE ───────────────────────────────────── */}
      <section className="px-4 py-12">
        <div className="mx-auto max-w-2xl">
          <div className="rounded-3xl bg-gradient-to-br from-emerald-950/60 via-teal-950/40 to-slate-900/80 border border-emerald-500/20 p-8 text-center">
            <span className="text-4xl mb-4 block">💰</span>
            <h2 className="text-2xl font-extrabold text-white mb-3">Indique e ganhe 50% por venda</h2>
            <p className="text-sm text-zinc-400 max-w-md mx-auto leading-relaxed mb-6">
              O programa de afiliados do ViralFlow paga <strong className="text-emerald-400">50% de comissão</strong> por cada assinante que você indicar. Você acompanha tudo em tempo real no painel de afiliados.
            </p>
            <div className="grid grid-cols-3 gap-4 text-center">
              {[
                { v: '50%', l: 'de comissão' },
                { v: 'R$18,95', l: 'por venda mensal' },
                { v: 'R$148,50', l: 'por venda anual' },
              ].map(({ v, l }) => (
                <div key={l} className="bg-white/5 rounded-xl py-3 px-2">
                  <p className="text-lg font-extrabold text-emerald-400">{v}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">{l}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── PRICING ─────────────────────────────────────────────── */}
      <section ref={pricingRef} className="relative px-4 py-20 text-center">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute left-1/2 bottom-0 h-[500px] w-[700px] -translate-x-1/2 rounded-full bg-violet-600/15 blur-[140px]" />
        </div>
        <p className="text-xs font-bold uppercase tracking-widest text-violet-400 mb-3">Escolha seu plano</p>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-white mb-3">
          Tudo isso por menos de R$1,30 por dia
        </h2>
        <p className="text-sm text-zinc-500 mb-10">Sem contrato longo. Cancele quando quiser.</p>

        <div className="mx-auto max-w-2xl grid grid-cols-1 sm:grid-cols-2 gap-5 mb-6">
          <PricingCard
            plan="monthly"
            selected={selectedPlan === 'monthly'}
            onSelect={() => setSelectedPlan('monthly')}
            onBuy={() => openCheckout('monthly')}
          />
          <PricingCard
            plan="annual"
            selected={selectedPlan === 'annual'}
            onSelect={() => setSelectedPlan('annual')}
            onBuy={() => openCheckout('annual')}
          />
        </div>

        <div className="mx-auto max-w-xs">
          <button
            onClick={() => openCheckout(selectedPlan)}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-white font-bold text-sm shadow-2xl shadow-violet-500/40 hover:from-violet-500 hover:to-purple-500 transition-all active:scale-95 mb-3"
          >
            <Flame className="h-4 w-4" />
            {selectedPlan === 'annual' ? 'Assinar agora — R$297/ano' : 'Assinar agora — R$37,90/mês'}
          </button>
          <p className="text-[11px] text-zinc-600">
            Pagamento 100% seguro via MercadoPago · Seus dados são criptografados
          </p>
        </div>
      </section>

      {/* ── GARANTIA ─────────────────────────────────────────────── */}
      <section className="px-4 pb-16">
        <div className="mx-auto max-w-md">
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-7 text-center">
            <Shield className="h-12 w-12 text-emerald-400" />
            <h3 className="text-xl font-bold text-white">Garantia total de 7 dias</h3>
            <p className="text-sm text-zinc-400 leading-relaxed">
              Entrou, testou e não gostou por qualquer motivo — devolvemos <strong className="text-white">100% do valor</strong> sem perguntas, sem burocracia.
            </p>
          </div>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────── */}
      <section className="px-4 pb-20">
        <div className="mx-auto max-w-2xl">
          <p className="text-center text-xs font-bold uppercase tracking-widest text-zinc-500 mb-3">Dúvidas frequentes</p>
          <h2 className="text-center text-2xl font-extrabold text-white mb-8">Ainda com dúvida?</h2>
          <div className="space-y-2">
            {FAQS.map(f => <FaqItem key={f.q} q={f.q} a={f.a} />)}
          </div>
        </div>
      </section>

      {/* ── CTA FINAL ────────────────────────────────────────────── */}
      <section className="relative px-4 pb-24 pt-12 text-center overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute left-1/2 top-0 h-[400px] w-[600px] -translate-x-1/2 rounded-full bg-violet-600/20 blur-[120px]" />
        </div>
        <div className="mx-auto max-w-lg">
          <span className="text-5xl block mb-6">⚡</span>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-white mb-4 leading-snug">
            Criadores que não agem hoje{' '}
            <span className="bg-gradient-to-r from-red-400 to-orange-400 bg-clip-text text-transparent">
              continuarão onde estão amanhã.
            </span>
          </h2>
          <p className="text-sm text-zinc-400 mb-8 leading-relaxed">
            Cada semana sem planejamento é uma semana de conteúdo perdida. Cada vídeo sem copy viral é uma oportunidade de crescimento jogada fora. O ViralFlow resolve isso agora.
          </p>
          <button
            onClick={handleCtaClick}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 px-10 py-5 text-base font-bold text-white shadow-2xl shadow-violet-500/40 hover:from-violet-500 hover:to-purple-500 active:scale-95 transition-all"
          >
            <Flame className="h-5 w-5" /> Começar agora com garantia de 7 dias
          </button>
          <p className="mt-4 text-xs text-zinc-600">
            Mais de 1.200 criadores já estão usando · Cancele quando quiser
          </p>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────────── */}
      <div className="border-t border-white/5 py-6 text-center text-xs text-zinc-600 px-4">
        <p>ViralFlow · Pagamento seguro via MercadoPago</p>
        <p className="mt-1">
          Já é assinante?{' '}
          <a href="/auth" className="text-violet-400 hover:underline">Entrar no app</a>
        </p>
      </div>

      {showCheckout && (
        <CheckoutModal
          onClose={closeCheckout}
          onSuccess={() => {
            sessionStorage.removeItem('vf_checkout_open');
            window.location.href = '/auth';
          }}
          initialPlan={checkoutPlan}
        />
      )}
    </div>
  );
}
