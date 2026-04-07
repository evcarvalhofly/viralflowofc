-- handle_new_user: ativa PRO se pagamento pendente + notifica admin via pg_net
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_session RECORD;
  v_plan    text;
  v_days    integer;
  v_expires_at timestamptz;
BEGIN
  SELECT id, mp_preapproval_id, ref_code INTO v_session
  FROM public.checkout_sessions
  WHERE payer_email = NEW.email AND status = 'paid'
  ORDER BY created_at DESC LIMIT 1;

  IF v_session.id IS NOT NULL THEN
    SELECT plan INTO v_plan FROM public.payment_plans WHERE payment_id = v_session.mp_preapproval_id;
    v_plan       := COALESCE(v_plan, 'monthly');
    v_days       := CASE WHEN v_plan = 'annual' THEN 365 ELSE 30 END;
    v_expires_at := now() + (v_days || ' days')::interval;

    INSERT INTO public.profiles (
      user_id, display_name, subscription_status,
      subscription_expires_at, stripe_subscription_id, subscription_plan
    ) VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email),
      'active', v_expires_at, v_session.mp_preapproval_id, v_plan
    );

    UPDATE public.checkout_sessions SET status = 'claimed' WHERE id = v_session.id;

    -- Notifica admin (assíncrono via pg_net)
    PERFORM net.http_post(
      url     := 'https://dzgotqyikomtapcgdgff.supabase.co/functions/v1/notify-admin-sale',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR6Z290cXlpa29tdGFwY2dkZ2ZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzExNzUxNDMsImV4cCI6MjA4Njc1MTE0M30.cTBDE0bCC6j4j2Pw0QRac220oqgQkAcYbMaJ3zyrmbY'
      ),
      body    := jsonb_build_object(
        'plan',         v_plan,
        'is_affiliate', v_session.ref_code IS NOT NULL
      )
    );
  ELSE
    INSERT INTO public.profiles (user_id, display_name)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email));
  END IF;

  RETURN NEW;
END;
$func$;
