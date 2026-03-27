import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';

export function useCheckoutReturn() {
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    const checkout = searchParams.get('checkout');
    if (!checkout) return;

    if (checkout === 'success') {
      toast.success('Bem-vindo ao ViralFlow PRO! 🚀', {
        description: 'Sua assinatura foi ativada com sucesso.',
        duration: 6000,
      });
    } else if (checkout === 'cancel') {
      toast.info('Pagamento cancelado', {
        description: 'Você pode assinar o PRO quando quiser.',
      });
    }

    // Remove o parâmetro da URL sem reload
    const next = new URLSearchParams(searchParams);
    next.delete('checkout');
    setSearchParams(next, { replace: true });
  }, []);
}
