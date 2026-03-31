/**
 * useAffiliateTracking
 *
 * Responsável por:
 * 1. Ler `?ref=` da URL ao acessar o app
 * 2. Persistir o código de referência no localStorage
 * 3. Registrar o clique no banco de dados
 *
 * Deve ser chamado UMA VEZ no nível raiz do app (AppShell).
 * O código ref fica salvo até o usuário fazer uma conversão.
 */

import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

const STORAGE_KEY = 'vf_affiliate_ref';

/** Retorna o código de referência armazenado (se houver) */
export const getStoredRefCode = (): string | null =>
  localStorage.getItem(STORAGE_KEY);

/** Remove o código de referência após conversão bem-sucedida */
export const clearStoredRefCode = (): void =>
  localStorage.removeItem(STORAGE_KEY);

export const useAffiliateTracking = () => {
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const ref = params.get('ref');
    if (!ref) return;

    const code = ref.toUpperCase();

    // Persiste mesmo se o usuário fechar e voltar antes de se cadastrar
    localStorage.setItem(STORAGE_KEY, code);

    // Registra o clique de forma assíncrona (fire-and-forget)
    (async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = supabase as any;
      const { data: affiliate } = await db
        .from('affiliates')
        .select('id')
        .eq('ref_code', code)
        .eq('status', 'active')
        .maybeSingle();

      if (affiliate?.id) {
        await db.from('ref_clicks').insert({
          affiliate_id: affiliate.id,
          ref_code: code,
          converted: false,
        });
      }
    })();
  // Só re-executa se a query string mudar
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);
};

/**
 * Atribui um cadastro/conversão ao afiliado armazenado no localStorage.
 * Chame isto após o usuário se cadastrar com sucesso.
 * Usa a edge function process-affiliate-referral para garantir que:
 * - Se o usuário já tem assinatura ativa (pagou como guest antes de registrar),
 *   o referral é criado como 'converted' e a comissão é gerada imediatamente.
 * - Caso contrário, cria como 'pending' (fluxo normal).
 *
 * @param newUserId — ID do usuário recém-criado (auth.users.id)
 * @returns Promise<void>
 */
export const attributeReferral = async (newUserId: string): Promise<void> => {
  const code = getStoredRefCode();
  if (!code) return;

  // Delega para edge function com service role (lida com commission e status correto)
  await supabase.functions.invoke('process-affiliate-referral', {
    body: { user_id: newUserId, ref_code: code },
  });

  // Limpa o ref armazenado — vínculo já está no banco
  clearStoredRefCode();
};
