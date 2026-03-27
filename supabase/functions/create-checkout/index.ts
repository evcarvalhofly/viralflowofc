import Stripe from 'npm:stripe@14.21.0';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), { status: 401, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Valida o usuário pelo JWT
    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !user) {
      console.error('Auth error:', userError);
      return new Response(JSON.stringify({ error: 'Usuário inválido' }), { status: 401, headers: corsHeaders });
    }

    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    const priceId   = Deno.env.get('STRIPE_PRICE_ID');

    if (!stripeKey || !priceId) {
      console.error('Missing env vars — STRIPE_SECRET_KEY or STRIPE_PRICE_ID not set');
      return new Response(JSON.stringify({ error: 'Configuração interna ausente' }), { status: 500, headers: corsHeaders });
    }

    const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' });

    let body: { success_url?: string; cancel_url?: string } = {};
    try { body = await req.json(); } catch { /* body opcional */ }

    // Busca/cria customer Stripe
    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_customer_id, display_name')
      .eq('user_id', user.id)
      .single();

    let customerId: string | undefined = profile?.stripe_customer_id ?? undefined;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: profile?.display_name ?? undefined,
        metadata: { user_id: user.id },
      });
      customerId = customer.id;
      await supabase.from('profiles').update({ stripe_customer_id: customerId }).eq('user_id', user.id);
    }

    const origin = req.headers.get('origin') ?? 'https://viralflowofc.lovable.app';

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: body.success_url ?? `${origin}/?checkout=success`,
      cancel_url:  body.cancel_url  ?? `${origin}/planopro`,
      metadata: { user_id: user.id },
      subscription_data: { metadata: { user_id: user.id } },
      locale: 'pt-BR',
    });

    console.log('Checkout session created:', session.id, 'for user:', user.id);

    return new Response(
      JSON.stringify({ url: session.url }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('create-checkout unhandled error:', err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: corsHeaders }
    );
  }
});
