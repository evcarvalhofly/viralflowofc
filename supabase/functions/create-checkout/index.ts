import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Chama a API REST da Stripe diretamente (sem SDK, sem imports externos problemáticos)
async function stripePost(path: string, secretKey: string, params: Record<string, string>) {
  const body = new URLSearchParams(params).toString();
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Stripe ${res.status}: ${data?.error?.message ?? JSON.stringify(data)}`);
  return data;
}

async function stripeGet(path: string, secretKey: string) {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    headers: { 'Authorization': `Bearer ${secretKey}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Stripe ${res.status}: ${data?.error?.message ?? JSON.stringify(data)}`);
  return data;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), { status: 401, headers: corsHeaders });
    }

    const SUPABASE_URL         = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_ANON_KEY    = Deno.env.get('SUPABASE_ANON_KEY')!;
    const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const STRIPE_SECRET_KEY    = Deno.env.get('STRIPE_SECRET_KEY')!;
    const STRIPE_PRICE_ID      = Deno.env.get('STRIPE_PRICE_ID')!;

    if (!STRIPE_SECRET_KEY || !STRIPE_PRICE_ID) {
      return new Response(JSON.stringify({ error: 'Configuração Stripe ausente' }), { status: 500, headers: corsHeaders });
    }

    // Valida o JWT do usuário
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      console.error('Auth error:', authError?.message);
      return new Response(JSON.stringify({ error: 'Sessão inválida' }), { status: 401, headers: corsHeaders });
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    let body: { success_url?: string; cancel_url?: string } = {};
    try { body = await req.json(); } catch { /* opcional */ }

    // Busca ou cria customer Stripe
    const { data: profile } = await admin
      .from('profiles')
      .select('stripe_customer_id, display_name')
      .eq('user_id', user.id)
      .single();

    let customerId: string = profile?.stripe_customer_id ?? '';

    if (!customerId) {
      const params: Record<string, string> = { 'metadata[user_id]': user.id };
      if (user.email)               params['email'] = user.email;
      if (profile?.display_name)    params['name']  = profile.display_name;

      const customer = await stripePost('/customers', STRIPE_SECRET_KEY, params);
      customerId = customer.id;
      await admin.from('profiles').update({ stripe_customer_id: customerId }).eq('user_id', user.id);
    }

    const origin = req.headers.get('origin') ?? 'https://viralflowofc.lovable.app';
    const successUrl = body.success_url ?? `${origin}/?checkout=success`;
    const cancelUrl  = body.cancel_url  ?? `${origin}/planopro`;

    const session = await stripePost('/checkout/sessions', STRIPE_SECRET_KEY, {
      customer:                                customerId,
      mode:                                    'subscription',
      'line_items[0][price]':                  STRIPE_PRICE_ID,
      'line_items[0][quantity]':               '1',
      success_url:                             successUrl,
      cancel_url:                              cancelUrl,
      'metadata[user_id]':                     user.id,
      'subscription_data[metadata][user_id]':  user.id,
      locale:                                  'pt-BR',
    });

    console.log('Checkout criado:', session.id, 'user:', user.id);

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
