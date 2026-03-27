import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, { apiVersion: '2023-10-16' });
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const body = await req.text();
  const sig  = req.headers.get('stripe-signature') ?? '';

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature failed:', err);
    return new Response(JSON.stringify({ error: 'Invalid signature' }), { status: 400 });
  }

  console.log('Webhook event:', event.type);

  // ──────────────────────────────────────────────
  // Assinatura ativada (primeira compra)
  // ──────────────────────────────────────────────
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.mode !== 'subscription') return new Response('ok');

    const userId = session.metadata?.user_id;
    const subscriptionId = session.subscription as string;
    if (!userId) return new Response('no user_id in metadata', { status: 400 });

    await supabase.from('profiles').update({
      subscription_status: 'active',
      stripe_subscription_id: subscriptionId,
    }).eq('user_id', userId);

    // Comissão de afiliado — busca referral do usuário
    await handleAffiliateCommission(supabase, userId, subscriptionId, 'initial');
  }

  // ──────────────────────────────────────────────
  // Renovação mensal
  // ──────────────────────────────────────────────
  if (event.type === 'invoice.payment_succeeded') {
    const invoice = event.data.object as Stripe.Invoice;
    if (invoice.billing_reason === 'subscription_create') return new Response('ok'); // já tratado no checkout
    const sub = invoice.subscription as string;
    if (!sub) return new Response('ok');

    const subscription = await stripe.subscriptions.retrieve(sub);
    const userId = subscription.metadata?.user_id;
    if (!userId) return new Response('ok');

    await supabase.from('profiles').update({ subscription_status: 'active' }).eq('user_id', userId);
    await handleAffiliateCommission(supabase, userId, sub, 'recurring');
  }

  // ──────────────────────────────────────────────
  // Cancelamento / inadimplência
  // ──────────────────────────────────────────────
  if (event.type === 'customer.subscription.deleted' || event.type === 'customer.subscription.updated') {
    const subscription = event.data.object as Stripe.Subscription;
    const userId = subscription.metadata?.user_id;
    if (!userId) return new Response('ok');

    const newStatus = subscription.status === 'active' ? 'active' : 'free';
    await supabase.from('profiles').update({ subscription_status: newStatus }).eq('user_id', userId);

    if (newStatus === 'free') {
      // Cancela comissões em pendente desse usuário
      await supabase.from('commissions')
        .update({ status: 'cancelled' })
        .eq('subscription_id', subscription.id)
        .eq('status', 'pending');
    }
  }

  return new Response(JSON.stringify({ received: true }), { headers: { 'Content-Type': 'application/json' } });
});

// ──────────────────────────────────────────────────────────────────────
// Lógica de comissão de afiliados
// ──────────────────────────────────────────────────────────────────────
async function handleAffiliateCommission(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  subscriptionId: string,
  type: 'initial' | 'recurring',
) {
  // Busca referral desse usuário (quem o indicou)
  const { data: referral } = await supabase
    .from('referrals')
    .select('id, affiliate_id')
    .eq('referred_user_id', userId)
    .eq('status', 'converted')
    .maybeSingle();

  if (!referral) return;

  // Busca o afiliado nível 1
  const { data: affiliate } = await supabase
    .from('affiliates')
    .select('id, commission_rate, referred_by_affiliate_id, status')
    .eq('id', referral.affiliate_id)
    .maybeSingle();

  if (!affiliate || affiliate.status !== 'active') return;

  const PLAN_VALUE = 37.90;
  const availableAfter = new Date();
  availableAfter.setDate(availableAfter.getDate() + 7); // carência 7 dias

  // Comissão nível 1
  const commissionAmount1 = parseFloat(((affiliate.commission_rate / 100) * PLAN_VALUE).toFixed(2));
  await supabase.from('commissions').insert({
    affiliate_id: affiliate.id,
    subscription_id: subscriptionId,
    referral_id: referral.id,
    type,
    amount: commissionAmount1,
    status: 'pending',
    level: 1,
    available_after: availableAfter.toISOString(),
  });

  // Comissão nível 2 (MLM) — quem indicou o afiliado
  if (affiliate.referred_by_affiliate_id) {
    const { data: affiliate2 } = await supabase
      .from('affiliates')
      .select('id, commission_rate, status')
      .eq('id', affiliate.referred_by_affiliate_id)
      .maybeSingle();

    if (affiliate2 && affiliate2.status === 'active') {
      const commissionAmount2 = parseFloat(((affiliate2.commission_rate / 100) * PLAN_VALUE * 0.5).toFixed(2)); // 50% da taxa do nível 2
      await supabase.from('commissions').insert({
        affiliate_id: affiliate2.id,
        subscription_id: subscriptionId,
        referral_id: referral.id,
        type,
        amount: commissionAmount2,
        status: 'pending',
        level: 2,
        available_after: availableAfter.toISOString(),
      });
    }
  }
}
