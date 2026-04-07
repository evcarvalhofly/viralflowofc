import { useState, useEffect, useRef, useMemo, useCallback, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, AlertCircle, CheckCircle2, Loader2, Copy, Check } from 'lucide-react';
import { initMercadoPago, CardPayment } from '@mercadopago/sdk-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

const MP_PUBLIC_KEY = import.meta.env.VITE_MP_PUBLIC_KEY ?? '';
const PRICES = { monthly: 37.90, annual: 297.00 } as const;
type Plan = 'monthly' | 'annual';

const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());

/** Verifica se o domínio do e-mail tem MX records (aceita e-mail real) */
const checkEmailDomainMX = async (email: string): Promise<boolean> => {
  const domain = email.trim().split('@')[1];
  if (!domain) return false;
  try {
    const res = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=MX`, {
      headers: { Accept: 'application/dns-json' },
    });
    const data = await res.json();
    // Status 0 = NOERROR, Answer com registros = domínio tem MX
    return data.Status === 0 && Array.isArray(data.Answer) && data.Answer.length > 0;
  } catch {
    return true; // se não conseguir verificar, não bloqueia
  }
};

interface CheckoutModalProps {
  onClose: () => void;
  onSuccess?: () => void;
  initialPlan?: Plan;
}

function CheckoutModalInner({ onClose, onSuccess, initialPlan = 'monthly' }: CheckoutModalProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [plan, setPlan] = useState<Plan>(initialPlan);
  const [tab, setTab] = useState<'pix' | 'card'>('pix');
  const AMOUNT = PRICES[plan];
  const [pixEmail, setPixEmail] = useState(user?.email ?? '');
  const [pendingEmail, setPendingEmail] = useState('');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [approved, setApproved] = useState(false);
  const [pixData, setPixData] = useState<{ qrCode: string; qrBase64: string; paymentId: string } | null>(null);
  const [waitingPix, setWaitingPix] = useState(false);
  const [copied, setCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [validating, setValidating] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Memoize para evitar que o brick do MercadoPago reinicialize a cada render
  const cardInitialization = useMemo(() => ({ amount: AMOUNT }), [AMOUNT]);
  const cardCustomization = useMemo(() => ({
    visual: { style: { theme: 'dark' as const } },
    paymentMethods: { maxInstallments: 1 },
  }), []);
  const handleCardError = useCallback((e: any) => console.warn('MP card error:', e), []);

  useEffect(() => {
    if (MP_PUBLIC_KEY) initMercadoPago(MP_PUBLIC_KEY, { locale: 'pt-BR' });
  }, []);

  // Polling: verifica status do PIX a cada 5s após geração
  useEffect(() => {
    if (!pixData || !waitingPix) return;

    pollRef.current = setInterval(async () => {
      try {
        const { data: status } = await (supabase as any).rpc('check_pix_payment_status', {
          p_payment_id: String(pixData.paymentId),
        });

        if (status === 'paid' || status === 'claimed') {
          clearInterval(pollRef.current!);
          setWaitingPix(false);
          setApproved(true);
          toast.success('Pagamento PIX confirmado! 🎉');
          sendWelcomeEmail(pixEmail);
          setTimeout(() => {
            if (!user) {
              navigate(`/parabens?email=${encodeURIComponent(pixEmail)}&method=pix`);
            } else {
              onSuccess?.();
              onClose();
            }
          }, 1500);
        }
      } catch {
        // RPC ainda não existe ou erro de rede — continua polling silenciosamente
      }
    }, 5000);

    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [pixData, waitingPix]);

  // Para o polling ao desmontar o componente
  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const copyPix = () => {
    if (!pixData) return;
    navigator.clipboard.writeText(pixData.qrCode);
    setCopied(true);
    toast.success('Código PIX copiado!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleManualConfirm = () => {
    // Fallback: usuário clica "Já paguei" — vai para /parabens manualmente
    if (pollRef.current) clearInterval(pollRef.current);
    if (pixData) {
      sessionStorage.setItem('vf_pix_data', JSON.stringify({ qrCode: pixData.qrCode, qrBase64: pixData.qrBase64 }));
    }
    onClose();
    navigate(`/parabens?email=${encodeURIComponent(pixEmail)}&method=pix`);
  };

  const sendWelcomeEmail = (email: string) => {
    if (!email) return;
    supabase.functions.invoke('send-welcome-email', {
      body: { email, is_guest: !user },
    }).catch(() => {});
  };

  const processPayment = async (body: object) => {
    setProcessing(true);
    setError(null);
    try {
      const refCode = !user ? (localStorage.getItem('vf_affiliate_ref') ?? null) : null;
      const { data, error: fnError } = await supabase.functions.invoke('create-checkout', {
        body: { ...body, ref_code: refCode },
      });

      if (fnError) throw new Error(fnError.message);
      if (data?.error) throw new Error(String(data.error));

      const status = data?.status;

      if (status === 'approved') {
        setApproved(true);
        toast.success('Pagamento aprovado! Bem-vindo ao ViralFlow PRO 🎉');
        const cardEmail = (body as any).payer?.email || user?.email || '';
        sendWelcomeEmail(cardEmail);
        setTimeout(() => {
          if (!user) {
            navigate(`/parabens?email=${encodeURIComponent(cardEmail)}&method=card`);
          } else {
            onSuccess?.();
            onClose();
          }
        }, 1500);

      } else if (status === 'pending' && data?.qr_code) {
        setPixData({
          qrCode: data.qr_code,
          qrBase64: data.qr_code_base64,
          paymentId: String(data.payment_id),
        });
        setWaitingPix(true);
        toast.info('PIX gerado! Aguardando confirmação do pagamento.');

      } else if (status === 'in_process' || status === 'pending') {
        toast.info('Pagamento em análise. Você receberá uma notificação em breve.');
        onClose();
      } else {
        setError('Pagamento não aprovado. Verifique os dados e tente novamente.');
      }
    } catch (e: any) {
      setError(e.message ?? 'Erro inesperado. Tente novamente.');
    } finally {
      setProcessing(false);
    }
  };

  const handlePixSubmit = async () => {
    if (!isValidEmail(pixEmail)) {
      setError('E-mail inválido. Verifique e tente novamente.');
      return;
    }
    setError(null);
    setValidating(true);
    const mxOk = await checkEmailDomainMX(pixEmail);
    setValidating(false);
    if (!mxOk) {
      setError('E-mail inválido. Use um e-mail real para receber seu acesso.');
      return;
    }
    processPayment({
      payment_method_id: 'pix',
      payer: { email: pixEmail },
      plan,
    });
  };

  const handleCardSubmit = async (formData: any) => {
    const payerEmail = user?.email || formData.payer?.email || '';
    if (!isValidEmail(payerEmail)) {
      setError('E-mail inválido. Verifique o campo e-mail e tente novamente.');
      return;
    }
    setValidating(true);
    const mxOk = await checkEmailDomainMX(payerEmail);
    setValidating(false);
    if (!mxOk) {
      setError('E-mail inválido. Use um e-mail real para receber seu acesso.');
      return;
    }
    setPendingEmail(payerEmail);
    setSubmitting(true);
    await processPayment({
      ...formData,
      payer: { ...formData.payer, email: payerEmail },
      plan,
    });
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <div className="w-full max-w-md bg-[#0f0f13] border border-white/10 rounded-2xl shadow-2xl overflow-hidden max-h-[90dvh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 shrink-0">
          <div>
            <h2 className="text-white font-bold text-lg">ViralFlow PRO</h2>
            <p className="text-muted-foreground text-xs">
              {plan === 'annual' ? 'R$297,00/ano · Equivale a R$24,75/mês' : 'R$37,90/mês · Cancele quando quiser'}
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-white transition-colors p-1">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">

          {approved ? (
            <div className="flex flex-col items-center justify-center py-8 gap-3 text-center">
              <CheckCircle2 className="h-14 w-14 text-emerald-400" />
              <p className="text-white font-bold text-xl">Pagamento aprovado!</p>
              <p className="text-muted-foreground text-sm">Bem-vindo ao ViralFlow PRO 🎉</p>
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground mt-2" />
            </div>

          ) : pixData ? (
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <p className="text-white font-bold text-base">Pague via PIX</p>
              <p className="text-muted-foreground text-xs">Escaneie o QR Code ou copie o código abaixo</p>
              {pixData.qrBase64 && (
                <img
                  src={`data:image/png;base64,${pixData.qrBase64}`}
                  alt="QR Code PIX"
                  className="w-48 h-48 rounded-xl bg-white p-2"
                />
              )}
              <button
                onClick={copyPix}
                className="flex items-center gap-2 w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-xs text-muted-foreground hover:border-violet-500/40 transition-colors text-left"
              >
                <span className="flex-1 truncate font-mono">{pixData.qrCode}</span>
                {copied
                  ? <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                  : <Copy className="h-4 w-4 shrink-0" />}
              </button>

              {/* Status de espera */}
              {waitingPix && (
                <div className="flex items-center gap-2 text-amber-400 text-xs bg-amber-500/10 border border-amber-500/20 rounded-lg px-4 py-2.5 w-full justify-center">
                  <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
                  <span>Aguardando confirmação do pagamento...</span>
                </div>
              )}

              {/* Fallback manual para guest */}
              {!user && (
                <button
                  onClick={handleManualConfirm}
                  className="text-xs text-violet-400 hover:text-violet-300 transition-colors underline underline-offset-2"
                >
                  Já realizei o pagamento →
                </button>
              )}
            </div>

          ) : (
            <>
              {/* Plan selector */}
              <div className="flex rounded-xl bg-white/5 p-1 gap-1">
                <button
                  onClick={() => { setPlan('monthly'); setError(null); }}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                    plan === 'monthly' ? 'bg-violet-600 text-white' : 'text-muted-foreground hover:text-white'
                  }`}
                >
                  Mensal — R$37,90
                </button>
                <button
                  onClick={() => { setPlan('annual'); setError(null); }}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-colors relative ${
                    plan === 'annual' ? 'bg-violet-600 text-white' : 'text-muted-foreground hover:text-white'
                  }`}
                >
                  Anual — R$297
                  <span className="absolute -top-2 -right-1 bg-emerald-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                    -35%
                  </span>
                </button>
              </div>

              {plan === 'annual' && (
                <div className="flex items-center gap-2 text-emerald-400 text-xs bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">
                  <span>✅</span>
                  <span>Você economiza <strong>R$157,80</strong> comparado ao plano mensal</span>
                </div>
              )}

              {/* Tabs */}
              <div className="flex rounded-xl bg-white/5 p-1 gap-1">
                <button
                  onClick={() => { setTab('pix'); setError(null); }}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
                    tab === 'pix'
                      ? 'bg-violet-600 text-white'
                      : 'text-muted-foreground hover:text-white'
                  }`}
                >
                  PIX
                </button>
                <button
                  onClick={() => { setTab('card'); setError(null); }}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
                    tab === 'card'
                      ? 'bg-violet-600 text-white'
                      : 'text-muted-foreground hover:text-white'
                  }`}
                >
                  Cartão
                </button>
              </div>

              {tab === 'pix' ? (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-white">
                      Qual e-mail você vai usar para criar sua conta?
                    </label>
                    <div className="text-xs text-emerald-400 space-y-0.5">
                      <p>✅ Após a compra permaneça nessa página</p>
                      <p>✅ Enviaremos a compra no email cadastrado</p>
                      <p>✅ Verifique também a Caixa de Spam</p>
                    </div>
                    <input
                      type="email"
                      value={pixEmail}
                      onChange={e => { setPixEmail(e.target.value); setError(null); }}
                      placeholder="seu@email.com"
                      className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-muted-foreground text-sm focus:outline-none focus:border-violet-500/60"
                    />
                  </div>
                  <button
                    onClick={handlePixSubmit}
                    disabled={processing || validating}
                    className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-white font-bold text-sm disabled:opacity-60 hover:from-violet-500 hover:to-purple-500 transition-all active:scale-95"
                  >
                    {(processing || validating) && <Loader2 className="h-4 w-4 animate-spin" />}
                    {validating ? 'Verificando e-mail...' : processing ? 'Gerando PIX...' : `Gerar QR Code PIX — R$${AMOUNT.toFixed(2).replace('.', ',')}`}
                  </button>
                </div>

              ) : MP_PUBLIC_KEY ? (
                <>
                  {!submitting && !processing && (
                    <div className="text-xs text-emerald-400 space-y-0.5">
                      <p>✅ Após a compra permaneça nessa página</p>
                      <p>✅ Enviaremos a compra no email cadastrado</p>
                      <p>✅ Verifique também a Caixa de Spam</p>
                    </div>
                  )}
                  {submitting || processing ? (
                    <div className="flex flex-col items-center justify-center py-12 gap-3">
                      <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
                      <p className="text-sm text-muted-foreground">Processando pagamento...</p>
                    </div>
                  ) : (
                    <CardPayment
                      initialization={cardInitialization}
                      customization={cardCustomization}
                      onSubmit={handleCardSubmit}
                      onError={handleCardError}
                    />
                  )}
                </>
              ) : (
                <div className="flex items-start gap-2 text-amber-400 text-sm bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>Chave pública do MercadoPago não configurada.</span>
                </div>
              )}

              {error && (
                <div className="flex items-start gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <p className="text-center text-[11px] text-muted-foreground">
                Pagamento 100% seguro · Seus dados são criptografados pelo MercadoPago
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export const CheckoutModal = memo(CheckoutModalInner);
