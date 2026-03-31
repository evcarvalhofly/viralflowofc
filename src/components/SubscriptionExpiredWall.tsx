import { useState } from 'react';
import { LockKeyhole, RefreshCcw } from 'lucide-react';
import { CheckoutModal } from '@/components/CheckoutModal';

export function SubscriptionExpiredWall() {
  const [showCheckout, setShowCheckout] = useState(false);

  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[60vh] px-6 text-center gap-6">
      <div className="flex items-center justify-center w-20 h-20 rounded-full bg-red-500/10 border border-red-500/20">
        <LockKeyhole className="h-9 w-9 text-red-400" />
      </div>

      <div className="space-y-2 max-w-sm">
        <h2 className="text-white font-bold text-xl">Sua assinatura venceu</h2>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Realize o pagamento para liberar novamente o acesso completo ao ViralFlow PRO.
        </p>
      </div>

      <button
        onClick={() => setShowCheckout(true)}
        className="flex items-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-white font-bold text-sm hover:from-violet-500 hover:to-purple-500 transition-all active:scale-95"
      >
        <RefreshCcw className="h-4 w-4" />
        Renovar Agora
      </button>

      <p className="text-[11px] text-muted-foreground">
        Pagamento 100% seguro · Processado pelo MercadoPago
      </p>

      {showCheckout && (
        <CheckoutModal
          onClose={() => setShowCheckout(false)}
          onSuccess={() => window.location.reload()}
        />
      )}
    </div>
  );
}
