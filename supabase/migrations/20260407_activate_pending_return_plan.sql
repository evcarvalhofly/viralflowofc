-- Atualiza activate_pending_checkout para retornar o plano no resultado
-- Necessário para o frontend disparar notificação ao admin após novo cadastro guest

CREATE OR REPLACE FUNCTION public.activate_pending_checkout(p_user_id uuid, p_user_email text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $func$
DECLARE
  v_session_id uuid;
  v_ref_code text;
  v_mp_preapproval_id text;
  v_affiliate_id uuid;
  v_commission_rate numeric;
  v_referral_id uuid;
  v_plan text;
  v_days integer;
  v_expires_at timestamptz;
BEGIN
  SELECT id, ref_code, mp_preapproval_id INTO v_session_id, v_ref_code, v_mp_preapproval_id
  FROM checkout_sessions
  WHERE payer_email = p_user_email AND status = 'paid'
  ORDER BY created_at DESC LIMIT 1;

  IF v_session_id IS NULL THEN
    RETURN jsonb_build_object('activated', false);
  END IF;

  SELECT plan INTO v_plan FROM payment_plans WHERE payment_id = v_mp_preapproval_id;
  v_plan := COALESCE(v_plan, 'monthly');
  v_days := CASE WHEN v_plan = 'annual' THEN 365 ELSE 30 END;
  v_expires_at := now() + (v_days || ' days')::interval;

  UPDATE profiles
  SET subscription_status = 'active',
      stripe_subscription_id = v_mp_preapproval_id,
      subscription_plan = v_plan,
      subscription_expires_at = v_expires_at
  WHERE user_id = p_user_id;

  IF v_ref_code IS NOT NULL THEN
    SELECT id INTO v_affiliate_id FROM affiliates WHERE ref_code = v_ref_code AND status = 'active';
    IF v_affiliate_id IS NOT NULL THEN
      INSERT INTO referrals (affiliate_id, referred_user_id, ref_code, status, converted_at)
      VALUES (v_affiliate_id, p_user_id, v_ref_code, 'converted', now());
      SELECT id INTO v_referral_id FROM referrals
      WHERE affiliate_id = v_affiliate_id AND referred_user_id = p_user_id
      ORDER BY created_at DESC LIMIT 1;
      SELECT commission_rate INTO v_commission_rate FROM affiliates WHERE id = v_affiliate_id;
      IF v_referral_id IS NOT NULL AND v_commission_rate IS NOT NULL THEN
        INSERT INTO commissions (affiliate_id, subscription_id, referral_id, type, amount, status, available_after, level, period_start)
        VALUES (v_affiliate_id, v_mp_preapproval_id, v_referral_id, 'initial',
                ROUND((v_commission_rate / 100.0) * 37.90, 2), 'pending',
                now() + interval '7 days', 1, now());
      END IF;
    END IF;
  END IF;

  UPDATE checkout_sessions SET status = 'activated' WHERE id = v_session_id;
  RETURN jsonb_build_object('activated', true, 'plan', v_plan, 'ref_code', v_ref_code);
END;
$func$;
