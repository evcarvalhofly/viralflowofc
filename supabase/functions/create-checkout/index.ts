const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const MP_ACCESS_TOKEN = Deno.env.get('MP_ACCESS_TOKEN')!;

    // O gateway do Supabase já valida o JWT — decodificamos direto para pegar user_id e email
    const token = authHeader.replace('Bearer ', '');
    const parts = token.split('.');
    if (parts.length !== 3) {
      return new Response(JSON.stringify({ error: 'Token inválido' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    // JWT usa base64url — converte para base64 padrão antes de decodificar
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(base64));
    const userId    = payload.sub as string;
    const userEmail = payload.email as string;

    console.log('userId:', userId, '| email:', userEmail);

    if (!userId) {
      return new Response(JSON.stringify({ error: 'Sessão inválida' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const origin = req.headers.get('origin') ?? 'https://viralflowofc.lovable.app';

    // Cria assinatura no MercadoPago (auto_recurring — sem card_token_id obrigatório)
    const mpRes = await fetch('https://api.mercadopago.com/preapproval', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        reason:             'ViralFlow PRO',
        payer_email:        userEmail,
        back_url:           `${origin}/?checkout=success`,
        notification_url:   'https://dzgotqyikomtapcgdgff.supabase.co/functions/v1/mp-webhook',
        external_reference: userId,
        auto_recurring: {
          frequency:          1,
          frequency_type:     'months',
          transaction_amount: 37.90,
          currency_id:        'BRL',
        },
      }),
    });

    const mpData = await mpRes.json();
    console.log('MP response status:', mpRes.status, '| body:', JSON.stringify(mpData));

    if (!mpRes.ok || !mpData.init_point) {
      return new Response(
        JSON.stringify({ error: mpData?.message ?? mpData?.cause ?? 'Erro ao criar assinatura no MercadoPago' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
