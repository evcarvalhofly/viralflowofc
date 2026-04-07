import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL         = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const MP_ACCESS_TOKEN      = Deno.env.get('MP_ACCESS_TOKEN')!;

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const url    = new URL(req.url);
    const type   = url.searchParams.get('type') ?? '';
    const dataId = url.searchParams.get('data.id') ?? '';

    let bodyType = '';
    let bodyId   = '';
    try {
      const body = await req.json();
      bodyType = body?.type ?? '';
      bodyId   = body?.data?.id ?? body?.id ?? '';
    } catch { /* sem body */ }

    const eventType = type || bodyType;
    const eventId   = dataId || bodyId;

    console.log('MP webhook — type:', eventType, '| id:', eventId);

    if (!eventId) return new Response('ok', { headers: corsHeaders });

    // ── Handle payment events (Checkout Transparente) ─────────────────────────
    if (eventType === 'payment' || (!eventType && eventId)) {
      const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${eventId}`, {
        headers: { 'Authorization': `Bearer ${MP_ACCESS_TOKEN}` },
      });

      if (!mpRes.ok) {
        console.error('MP payment fetch error:', mpRes.status);
        return new Response('error', { status: 500, headers: corsHeaders });
      }

      const payment     = await mpRes.json();
      const status      = payment.status;
      const externalRef = payment.external_reference;

      console.log('Payment status:', status, '| external_ref:', externalRef);

      if (!externalRef) return new Response('ok', { headers: corsHeaders });

      if (status === 'approved') {
        await handleApprovedPayment(admin, externalRef, String(eventId), payment.transaction_amount, payment.metadata?.plan);
      }

      return new Response('ok', { headers: corsHeaders });
    }

    return new Response('ok', { headers: corsHeaders });

  } catch (err) {
    console.error('mp-webhook erro:', err);
    return new Response('error', { status: 500, headers: corsHeaders });
  }
});

// ── Activate or renew subscription ────────────────────────────────────────────
async function handleApprovedPayment(admin: any, externalRef: string, paymentId: string, transactionAmount?: number, plan?: string) {
  // Detect guest session (UUID from checkout_sessions) vs logged-in user
  const { data: guestSession } = await admin
    .from('checkout_sessions')
    .select('id, ref_code, payer_email, payer_phone')
    .eq('id', externalRef)
    .maybeSingle();

  if (guestSession) {
    await admin
      .from('checkout_sessions')
      .update({ status: 'paid', mp_preapproval_id: paymentId })
      .eq('id', guestSession.id);

    console.log('Guest session marked paid:', guestSession.id);

    // Link to existing account if email matches
    if (guestSession.payer_email) {
      const isAnnual = plan === 'annual' || (transactionAmount ?? 0) >= 200;
      const days = isAnnual ? 365 : 30;
      await activateExistingUser(admin, guestSession.payer_email, paymentId, days);
    }
    return;
  }

  // Logged-in user
  const userId  = externalRef;
  const isAnnual = plan === 'annual' || (transactionAmount ?? 0) >= 200;
  const days    = isAnnual ? 365 : 30;
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

  await admin
    .from('profiles')
    .update({
      subscription_status:     'active',
      subscription_expires_at: expiresAt,
      stripe_subscription_id:  paymentId,
    })
    .eq('user_id', userId);

  console.log('Subscription renewed | user:', userId, '| expires:', expiresAt);

  // Affiliate commission
  const { data: referral } = await admin
    .from('referrals')
    .select('id, affiliate_id, status')
    .eq('referred_user_id', userId)
    .neq('status', 'cancelled')
    .maybeSingle();

  if (!referral) return;

  const { data: affiliate } = await admin
    .from('affiliates')
    .select('id, commission_rate')
    .eq('id', referral.affiliate_id)
    .eq('status', 'active')
    .maybeSingle();

  if (!affiliate) return;

  const PRICE          = transactionAmount ?? 37.90;
  const isInitial      = referral.status === 'pending';
  const commAmount     = parseFloat(((affiliate.commission_rate / 100) * PRICE).toFixed(2));
  const availableAfter = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  await admin.from('commissions').insert({
    affiliate_id:    affiliate.id,
    subscription_id: paymentId,
    referral_id:     referral.id,
    type:            isInitial ? 'initial' : 'recurring',
    amount:          commAmount,
    status:          'pending',
    available_after: availableAfter,
    level:           1,
    period_start:    new Date().toISOString(),
  });

  if (isInitial) {
    await admin
      .from('referrals')
      .update({ status: 'converted', converted_at: new Date().toISOString() })
      .eq('id', referral.id);
  }

  console.log('Comissão criada | afiliado:', affiliate.id, '| valor:', commAmount);
}

// ── Activate existing user by email ───────────────────────────────────────────
async function activateExistingUser(admin: any, email: string, paymentId: string, days: number) {
  try {
    const { data: { users } } = await admin.auth.admin.listUsers();
    const user = users?.find((u: any) => u.email?.toLowerCase() === email.toLowerCase());
    if (!user) return;
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
    await admin.from('profiles').update({
      subscription_status:     'active',
      subscription_expires_at: expiresAt,
      stripe_subscription_id:  paymentId,
    }).eq('user_id', user.id);
    console.log('Guest payment linked to existing user:', user.id, '| expires:', expiresAt);
  } catch (e) {
    console.error('activateExistingUser error:', e);
  }
}
