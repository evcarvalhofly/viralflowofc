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

    const SUPABASE_URL            = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_ANON_KEY       = Deno.env.get('SUPABASE_ANON_KEY')!;
    const SUPABASE_SERVICE_KEY    = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const STRIPE_SECRET_KEY       = Deno.env.get('STRIPE_SECRET_KEY')!;
    const STRIPE_PRICE_ID         = Deno.env.get('STRIPE_PRICE_ID')!;

    if (!STRIPE_SECRET_KEY || !STRIPE_PRICE_ID) {
      console.error('STRIPE_SECRET_KEY ou STRIPE_PRICE_ID não configurados');
      return new Response(JSON.stringify({ error: 'Configuração interna ausente' }), { status: 500, headers: corsHeaders });
    }

    // Client com JWT do usuário — o padrão correto para obter identidade
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();

    if (userError || !user) {
      console.error('Auth getUser error:', userError?.message);
      return new Response(JSON.stringify({ error: 'Sessão inválida' }), { status: 401, headers: corsHeaders });
    }

    // Admin client para operações privilegiadas no banco
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });

    let body: { success_url?: string; cancel_url?: string } = {};
    try { body = await req.json(); } catch { /* body opcional */ }

    // Busca perfil para customer_id e nome
    const { data: profile } = await admin
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
      await admin.from('profiles').update({ stripe_customer_id: customerId }).eq('user_id', user.id);
    }

    const origin = req.headers.get('origin') ?? 'https://viralflowofc.lovable.app';

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: STRIPE_PRICE_ID, quantity: 1 }],
      success_url: body.success_url ?? `${origin}/?checkout=success`,
      cancel_url:  body.cancel_url  ?? `${origin}/planopro`,
      metadata: { user_id: user.id },
      subscription_data: { metadata: { user_id: user.id } },
      locale: 'pt-BR',
    });

    console.log('Checkout session criada:', session.id, '| user:', user.id);

    return new Response(
      JSON.stringify({ url: session.url }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('create-checkout erro:', err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: corsHeaders }
    );
  }
});
