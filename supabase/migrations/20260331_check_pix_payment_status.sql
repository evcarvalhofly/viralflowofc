-- RPC para frontend verificar status do pagamento PIX sem precisar de auth
-- SECURITY DEFINER bypassa RLS (anon pode chamar mas não lê a tabela diretamente)
CREATE OR REPLACE FUNCTION public.check_pix_payment_status(p_payment_id text)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT status FROM checkout_sessions
  WHERE mp_preapproval_id = p_payment_id
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.check_pix_payment_status(text) TO anon;
