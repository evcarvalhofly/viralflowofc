import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const MP_ACCESS_TOKEN      = Deno.env.get('MP_ACCESS_TOKEN')!;
    const SUPABASE_URL         = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Parse body
    let body: any = {};
    try { body = await req.json(); } catch { /* empty */ }

    // Detect logged-in user from JWT
    const authHeader = req.headers.get('Authorization');
    let userId: string | null = null;
    let userEmail: string | null = null;

    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const parts = token.split('.');
      if (parts.length === 3) {
        try {
          const base64  = parts[1].replace(/-/g, '+').replace(/_/g, '/');
          const payload = JSON.parse(atob(base64));
          if (payload.role === 'authenticated' && payload.sub) {
            userId    = payload.sub as string;
            userEmail = payload.email as string;
          }
        } catch { /* invalid JWT */ }
      }
    }

    const isGuest = !userId;
    const payerEmail: string = body.payer?.email ?? userEmail ?? '';
    const phone: string | null = body.phone ?? null;
    const refCode: string | null = body.ref_code ?? null;
    const plan: 'monthly' | 'annual' = body.plan === 'annual' ? 'annual' : 'monthly';
    const AMOUNT = plan === 'annual' ? 297.00 : 37.90;
    const DAYS   = plan === 'annual' ? 365 : 30;

    // ── Create or find external_reference ─────────────────────────────────────
    let externalReference: string;

    if (isGuest) {
      const { data: session, error: sessionError } = await admin
        .from('checkout_sessions')
        .insert({
          ref_code:    refCode,
          status:      'created',
          payer_email: payerEmail || null,
          payer_phone: phone,
        })
        .select('id')
        .single();

      if (sessionError || !session) {
        console.error('checkout_sessions insert error:', JSON.stringify(sessionError));
        return new Response(JSON.stringify({ error: 'Erro ao criar sessão de checkout' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      externalReference = session.id;
      console.log('Guest checkout session:', session.id, '| ref_code:', refCode);
    } else {
      externalReference = userId!;
      console.log('Logged-in checkout | user:', userId);
    }

    // ── Call MercadoPago /v1/payments (Checkout Transparente) ─────────────────
    const isPix = body.payment_method_id === 'pix' || body.formData?.payment_method_id === 'pix';

    const paymentBody: any = {
      transaction_amount: AMOUNT,
      description:        'ViralFlow PRO',
      payment_method_id:  body.payment_method_id,
      payer: {
        email:          payerEmail,
        identification: body.payer?.identification ?? undefined,
      },
      external_reference: externalReference,
      notification_url:   'https://dzgotqyikomtapcgdgff.supabase.co/functions/v1/mp-webhook',
    };

    if (!isPix) {
      paymentBody.token        = body.token;
      paymentBody.installments = body.installments ?? 1;
      paymentBody.issuer_id    = body.issuer_id;
    }

    if (phone) {
      paymentBody.payer.phone = { area_code: '', number: phone };
    }

    const mpRes = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        'Authorization':    `Bearer ${MP_ACCESS_TOKEN}`,
        'Content-Type':     'application/json',
        'X-Idempotency-Key': `vf-${externalReference}-${Date.now()}`,
      },
      body: JSON.stringify(paymentBody),
    });

    const payment = await mpRes.json();
    console.log('MP payment status:', payment.status, '| id:', payment.id, '| detail:', payment.status_detail);

    if (!mpRes.ok) {
      console.error('MP error:', JSON.stringify(payment));
      const cause = payment?.cause?.[0]?.description ?? payment?.message ?? 'Erro no pagamento';
      return new Response(JSON.stringify({ error: cause }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── On approval: activate subscription immediately for logged-in user ─────
    if (payment.status === 'approved' && !isGuest) {
      const expiresAt = new Date(Date.now() + DAYS * 24 * 60 * 60 * 1000).toISOString();
      await admin
        .from('profiles')
        .update({
          subscription_status:    'active',
          subscription_expires_at: expiresAt,
          stripe_subscription_id:  String(payment.id),
        })
        .eq('user_id', userId!);

      console.log('Subscription activated for user:', userId, '| expires:', expiresAt);

      // Process affiliate commission
      await processCommission(admin, userId!, String(payment.id), AMOUNT);
    }

    if (payment.status === 'approved' && isGuest) {
      await admin
        .from('checkout_sessions')
        .update({
          status:      'paid',
          payer_email: payerEmail || null,
          payer_phone: phone,
          mp_preapproval_id: String(payment.id),
        })
        .eq('id', externalReference);
    }

    // For PIX, return QR code data
    const pixInfo = payment.point_of_interaction?.transaction_data;
    return new Response(
      JSON.stringify({
        status:          payment.status,
        payment_id:      payment.id,
        qr_code:         pixInfo?.qr_code         ?? null,
        qr_code_base64:  pixInfo?.qr_code_base64  ?? null,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );

  } catch (err) {
    console.error('create-checkout erro:', err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});

// ── Affiliate commission helper ────────────────────────────────────────────────
async function processCommission(admin: any, userId: string, paymentId: string, price = 37.90) {
  try {
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

    const PRICE          = price;
    const isInitial      = referral.status === 'pending';
    const commType       = isInitial ? 'initial' : 'recurring';
    const availableAfter = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const commAmount     = parseFloat(((affiliate.commission_rate / 100) * PRICE).toFixed(2));

    await admin.from('commissions').insert({
      affiliate_id:    affiliate.id,
      subscription_id: paymentId,
      referral_id:     referral.id,
      type:            commType,
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

    console.log('Comissão criada | afiliado:', affiliate.id, '| valor:', commAmount, '| tipo:', commType);
  } catch (e) {
    console.error('processCommission error:', e);
  }
}
