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
    const AMOUNT = plan === 'annual' ? 0.10 : 0.08;
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
      metadata:           { plan },
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

    // Persist plan by payment_id so the webhook always detects correctly
    if (payment?.id) {
      await admin.from('payment_plans').upsert({ payment_id: String(payment.id), plan });
    }

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
          subscription_status:     'active',
          subscription_expires_at: expiresAt,
          stripe_subscription_id:  String(payment.id),
          subscription_plan:       plan,
        })
        .eq('user_id', userId!);

      console.log('Subscription activated for user:', userId, '| plan:', plan, '| expires:', expiresAt);

      // Process affiliate commission
      await processCommission(admin, userId!, String(payment.id), AMOUNT);

      // Sale notification
      await notifySale(admin, userId!, AMOUNT, plan);
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

      // Link to existing account if email matches + sale notification
      if (payerEmail) {
        const linkedId = await activateExistingUser(admin, payerEmail, String(payment.id), plan, DAYS);
        if (linkedId) await notifySale(admin, linkedId, AMOUNT, plan);
      }
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

// ── Activate existing user by email ───────────────────────────────────────────
async function activateExistingUser(admin: any, email: string, paymentId: string, plan: string, days: number): Promise<string | null> {
  try {
    const { data: { users } } = await admin.auth.admin.listUsers();
    const user = users?.find((u: any) => u.email?.toLowerCase() === email.toLowerCase());
    if (!user) return null;
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
    await admin.from('profiles').update({
      subscription_status:     'active',
      subscription_expires_at: expiresAt,
      stripe_subscription_id:  paymentId,
      subscription_plan:       plan,
    }).eq('user_id', user.id);
    console.log('Guest payment linked to existing user:', user.id, '| plan:', plan, '| expires:', expiresAt);
    return user.id;
  } catch (e) {
    console.error('activateExistingUser error:', e);
    return null;
  }
}

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

// ── Sale notifications ─────────────────────────────────────────────────────────
const ADMIN_EMAIL = 'evcarvalhodev@gmail.com';

async function notifySale(admin: any, buyerUserId: string, amount: number, plan: string) {
  try {
    const { data: { users } } = await admin.auth.admin.listUsers();
    const adminUser = users?.find((u: any) => u.email === ADMIN_EMAIL);

    // Find affiliate for this buyer
    const { data: referral } = await admin
      .from('referrals')
      .select('affiliate_id')
      .eq('referred_user_id', buyerUserId)
      .neq('status', 'cancelled')
      .maybeSingle();

    let affiliateUserId: string | null = null;
    let affiliateName: string | null = null;
    let commissionAmount = 0;

    if (referral?.affiliate_id) {
      const { data: affiliate } = await admin
        .from('affiliates')
        .select('user_id, commission_rate')
        .eq('id', referral.affiliate_id)
        .eq('status', 'active')
        .maybeSingle();
      if (affiliate) {
        affiliateUserId = affiliate.user_id;
        commissionAmount = parseFloat(((affiliate.commission_rate / 100) * amount).toFixed(2));
        const { data: profile } = await admin
          .from('profiles')
          .select('display_name')
          .eq('user_id', affiliate.user_id)
          .maybeSingle();
        affiliateName = profile?.display_name ?? 'Afiliado';
      }
    }

    const rows: any[] = [];

    // Notify affiliate — net = their commission
    if (affiliateUserId) {
      rows.push({
        user_id: affiliateUserId,
        amount,
        net_amount: commissionAmount,
        plan,
        is_affiliate_sale: true,
        affiliate_name: affiliateName,
      });
    }

    // Notify admin — net = amount minus commission paid out
    if (adminUser) {
      rows.push({
        user_id: adminUser.id,
        amount,
        net_amount: parseFloat((amount - commissionAmount).toFixed(2)),
        plan,
        is_affiliate_sale: !!affiliateUserId,
        affiliate_name: affiliateName,
      });
    }

    if (rows.length > 0) {
      await admin.from('sale_notifications').insert(rows);
      // Send Web Push to each recipient (works even with app closed)
      const planLabel = plan === 'annual' ? 'Anual' : 'Mensal';
      await Promise.all(rows.map(row =>
        sendWebPush(row.user_id, '💰 Nova venda!', `Plano ${planLabel} · R$${row.net_amount.toFixed(2).replace('.', ',')}`)
      ));
    }
    console.log('notifySale done | rows:', rows.length);
  } catch (e) {
    console.error('notifySale error:', e);
  }
}

async function sendWebPush(userId: string, title: string, body: string) {
  try {
    const SUPABASE_URL  = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_KEY   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    await fetch(`${SUPABASE_URL}/functions/v1/send-web-push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SERVICE_KEY}` },
      body: JSON.stringify({ user_id: userId, title, body }),
    });
  } catch (e) {
    console.warn('sendWebPush error:', e);
  }
}
