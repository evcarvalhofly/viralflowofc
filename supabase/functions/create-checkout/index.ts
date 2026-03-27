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

    const SUPABASE_URL         = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_ANON_KEY    = Deno.env.get('SUPABASE_ANON_KEY')!;
    const MP_ACCESS_TOKEN      = Deno.env.get('MP_ACCESS_TOKEN')!;
    const MP_PLAN_ID           = Deno.env.get('MP_PLAN_ID')!;

    // Valida sessão do usuário
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Sessão inválida' }), { status: 401, headers: corsHeaders });
    }

    const origin = req.headers.get('origin') ?? 'https://viralflowofc.lovable.app';

    // Cria assinatura no MercadoPago
    const mpRes = await fetch('https://api.mercadopago.com/preapproval', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        preapproval_plan_id: MP_PLAN_ID,
        reason:              'ViralFlow PRO',
        payer_email:         user.email,
        back_url:            `${origin}/?checkout=success`,
        notification_url:    'https://dzgotqyikomtapcgdgff.supabase.co/functions/v1/mp-webhook',
        external_reference:  user.id,
        status:              'pending',
      }),
    });

    const mpData = await mpRes.json();

    if (!mpRes.ok || !mpData.init_point) {
      console.error('MP error:', JSON.stringify(mpData));
      return new Response(
        JSON.stringify({ error: mpData?.message ?? 'Erro ao criar assinatura' }),
        { status: 500, headers: corsHeaders }
      );
    }

    console.log('MP preapproval criado:', mpData.id, '| user:', user.id);

    return new Response(
      JSON.stringify({ url: mpData.init_point }),
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
