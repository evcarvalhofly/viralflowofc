-- Atualiza handle_new_user para ativar PRO automaticamente
-- se o email já tiver um checkout_session com status 'paid'

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session RECORD;
BEGIN
  -- Verifica se existe pagamento guest com esse email
  SELECT id, mp_preapproval_id
  INTO v_session
  FROM public.checkout_sessions
  WHERE payer_email = NEW.email
    AND status = 'paid'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_session.id IS NOT NULL THEN
    -- Cria perfil já com PRO ativo por 30 dias
    INSERT INTO public.profiles (
      user_id,
      display_name,
      subscription_status,
      subscription_expires_at,
      stripe_subscription_id
    )
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email),
      'active',
      now() + interval '30 days',
      v_session.mp_preapproval_id
    );

    -- Marca a sessão como vinculada
    UPDATE public.checkout_sessions
    SET status = 'claimed'
    WHERE id = v_session.id;
  ELSE
    -- Cadastro normal sem pagamento prévio
    INSERT INTO public.profiles (user_id, display_name)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email)
    );
  END IF;

  RETURN NEW;
END;
$$;
