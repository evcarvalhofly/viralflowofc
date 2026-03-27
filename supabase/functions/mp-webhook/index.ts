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

    let bodyId = '';
    try {
      const body = await req.json();
      bodyId = body?.data?.id ?? body?.id ?? '';
    } catch { /* sem body */ }

    const preapprovalId = dataId || bodyId;

    console.log('MP webhook recebido — type:', type, 'id:', preapprovalId);

    if (type !== 'preapproval' && !preapprovalId) {
      return new Response('ok', { headers: corsHeaders });
    }

    if (!preapprovalId) {
      return new Response('ok', { headers: corsHeaders });
    }

    // Busca status da assinatura no MP
    const mpRes = await fetch(`https://api.mercadopago.com/preapproval/${preapprovalId}`, {
      headers: { 'Authorization': `Bearer ${MP_ACCESS_TOKEN}` },
    });

    if (!mpRes.ok) {
      console.error('MP fetch error:', mpRes.status);
      return new Response('error', { status: 500, headers: corsHeaders });
    }

    const preapproval    = await mpRes.json();
    const externalRef    = preapproval.external_reference;
    const mpStatus       = preapproval.status;
    const mpPayerId      = String(preapproval.payer_id ?? '');

    console.log('Preapproval status:', mpStatus, '| external_ref:', externalRef);

    if (!externalRef) {
      return new Response('ok', { headers: corsHeaders });
    }

    // ── Detecta se é sessão guest (checkout_sessions) ou usuário logado ──────────
    const { data: guestSession } = await admin
      .from('checkout_sessions')
      .select('id, ref_code, status')
      .eq('id', externalRef)
      .maybeSingle();

    if (guestSession) {
      // ── FLUXO GUEST: atualiza checkout_session com email do pagador ────────────
      if (mpStatus !== 'authorized') {
        console.log('Guest session — status not authorized, skipping:', mpStatus);
        return new Response('ok', { headers: corsHeaders });
      }

      // Tenta obter email do pagador
      let payerEmail: string | null = preapproval.payer_email ?? null;

      if (!payerEmail && mpPayerId) {
        // Fallback: busca via customers API do MP
        const custRes = await fetch(`https://api.mercadopago.com/v1/customers/${mpPayerId}`, {
          headers: { 'Authorization': `Bearer ${MP_ACCESS_TOKEN}` },
        });
        if (custRes.ok) {
          const custData = await custRes.json();
          payerEmail = custData.email ?? null;
        }
        console.log('Payer email from customers API:', payerEmail);
      }

      await admin.from('checkout_sessions').update({
        mp_preapproval_id: preapprovalId,
        payer_email:       payerEmail,
        payer_id:          mpPayerId,
        status:            'paid',
      }).eq('id', guestSession.id);

      console.log('Guest session updated — email:', payerEmail, '| session:', guestSession.id);
      return new Response('ok', { headers: corsHeaders });
    }

    // ── FLUXO USUÁRIO LOGADO (external_ref = userId) ──────────────────────────────
    const userId = externalRef;

    const subscriptionStatus =
      mpStatus === 'authorized' ? 'active' :
      mpStatus === 'paused'     ? 'active' :
      'free';

    await admin
      .from('profiles')
      .update({
        subscription_status:    subscriptionStatus,
        stripe_subscription_id: preapprovalId,
      })
      .eq('user_id', userId);

    console.log('Perfil atualizado:', userId, '->', subscriptionStatus);

    // === COMISSÕES DE AFILIADOS ===
    if (subscriptionStatus === 'active') {
      const { data: referral } = await admin
        .from('referrals')
        .select('id, affiliate_id, status')
        .eq('referred_user_id', userId)
        .neq('status', 'cancelled')
        .maybeSingle();

      if (referral) {
        const { data: affiliate } = await admin
          .from('affiliates')
          .select('id, commission_rate')
          .eq('id', referral.affiliate_id)
          .eq('status', 'active')
          .maybeSingle();

        if (affiliate) {
          const PRICE        = 37.90;
          const isInitial    = referral.status === 'pending';
          const commType     = isInitial ? 'initial' : 'recurring';
          const availableAfter = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
          const periodStart  = new Date().toISOString();
          const commAmount   = parseFloat(((affiliate.commission_rate / 100) * PRICE).toFixed(2));

          await admin.from('commissions').insert({
            affiliate_id:    affiliate.id,
            subscription_id: preapprovalId,
            referral_id:     referral.id,
            type:            commType,
            amount:          commAmount,
            status:          'pending',
            available_after: availableAfter,
            level:           1,
            period_start:    periodStart,
          });

          if (isInitial) {
            await admin
              .from('referrals')
              .update({ status: 'converted', converted_at: periodStart })
              .eq('id', referral.id);
          }

          console.log('Comissão criada para afiliado:', affiliate.id, '| valor:', commAmount, '| tipo:', commType);
        }
      }
    }

    return new Response('ok', { headers: corsHeaders });
  } catch (err) {
    console.error('mp-webhook erro:', err);
    return new Response('error', { status: 500, headers: corsHeaders });
  }
});
