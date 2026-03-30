import { useState, useEffect } from 'react';
import { X, Phone, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { initMercadoPago, CardPayment } from '@mercadopago/sdk-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

const MP_PUBLIC_KEY = import.meta.env.VITE_MP_PUBLIC_KEY ?? '';
const AMOUNT = 37.90;

interface CheckoutModalProps {
  onClose: () => void;
  onSuccess?: () => void;
}

export function CheckoutModal({ onClose, onSuccess }: CheckoutModalProps) {
  const { user } = useAuth();
  const [phone, setPhone] = useState('');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [approved, setApproved] = useState(false);

  useEffect(() => {
    if (!MP_PUBLIC_KEY) {
      console.error('VITE_MP_PUBLIC_KEY não configurada');
      return;
    }
    initMercadoPago(MP_PUBLIC_KEY, { locale: 'pt-BR' });
  }, []);

  const onSubmit = async (formData: any) => {
    setProcessing(true);
    setError(null);
    try {
      const refCode = !user ? (localStorage.getItem('vf_ref') ?? null) : null;

      const { data, error: fnError } = await supabase.functions.invoke('create-checkout', {
        body: {
          ...formData,
          phone: phone.trim() || null,
          ref_code: refCode,
        },
      });

      if (fnError) throw new Error(fnError.message);
      if (data?.error) throw new Error(String(data.error));

      const status = data?.status;

      if (status === 'approved') {
        setApproved(true);
        toast.success('Pagamento aprovado! Bem-vindo ao ViralFlow PRO 🎉');
        setTimeout(() => {
          onSuccess?.();
          onClose();
        }, 2500);
      } else if (status === 'in_process' || status === 'pending') {
        toast.info('Pagamento em análise. Você receberá uma notificação em breve.');
        onClose();
      } else {
        setError('Pagamento não aprovado. Verifique os dados do cartão e tente novamente.');
      }
    } catch (e: any) {
      setError(e.message ?? 'Erro inesperado. Tente novamente.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <div className="w-full max-w-md bg-[#0f0f13] border border-white/10 rounded-2xl shadow-2xl overflow-hidden max-h-[90dvh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 shrink-0">
          <div>
            <h2 className="text-white font-bold text-lg">ViralFlow PRO</h2>
            <p className="text-muted-foreground text-xs">R$37,90/mês · Cancele quando quiser</p>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-white transition-colors p-1"
          >
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
          ) : (
            <>
              {!MP_PUBLIC_KEY && (
                <div className="flex items-start gap-2 text-amber-400 text-sm bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>Chave pública do MercadoPago não configurada (VITE_MP_PUBLIC_KEY).</span>
                </div>
              )}

              {/* Phone */}
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground font-medium">
                  Telefone / WhatsApp
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <input
                    type="tel"
                    placeholder="(11) 99999-9999"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-muted-foreground text-sm focus:outline-none focus:border-violet-500/50 transition-colors"
                  />
                </div>
              </div>

              {/* MercadoPago CardPayment Brick */}
              {MP_PUBLIC_KEY && (
                <CardPayment
                  initialization={{
                    amount: AMOUNT,
                    payer: {
                      email: user?.email ?? '',
                    },
                  }}
                  customization={{
                    visual: {
                      style: { theme: 'dark' },
                    },
                    paymentMethods: {
                      maxInstallments: 1,
                    },
                  }}
                  onSubmit={onSubmit}
                  onError={(e) => setError(String(e))}
                />
              )}

              {/* Error */}
              {error && (
                <div className="flex items-start gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {processing && (
                <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm py-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Processando pagamento...</span>
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
