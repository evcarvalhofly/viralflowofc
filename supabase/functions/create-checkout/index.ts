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

    const MP_ACCESS_TOKEN = Deno.env.get('MP_ACCESS_TOKEN')!;
    const MP_PLAN_ID      = Deno.env.get('MP_PLAN_ID')!;

    // O gateway do Supabase já valida o JWT — decodificamos direto para pegar user_id e email
    const token = authHeader.replace('Bearer ', '');
    const parts = token.split('.');
    if (parts.length !== 3) {
      return new Response(JSON.stringify({ error: 'Token inválido' }), { status: 401, headers: corsHeaders });
    }
    const payload = JSON.parse(atob(parts[1]));
    const userId     = payload.sub as string;
    const userEmail  = payload.email as string;

    if (!userId) {
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
        payer_email:         userEmail,
        back_url:            `${origin}/?checkout=success`,
        notification_url:    'https://dzgotqyikomtapcgdgff.supabase.co/functions/v1/mp-webhook',
        external_reference:  userId,
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

    console.log('MP preapproval criado:', mpData.id, '| user:', userId);

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
