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

    const origin = req.headers.get('origin') ?? 'https://viralflowofc.lovable.app';

    // Parse body (ref_code optional for guest flow)
    let refCode: string | null = null;
    try {
      const body = await req.json();
      refCode = body?.ref_code ?? null;
    } catch { /* no body */ }

    // Determine if logged-in user or guest via JWT role
    const authHeader = req.headers.get('Authorization');
    let userId: string | null = null;
    let userEmail: string | null = null;
    let isGuest = true;

    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const parts = token.split('.');
      if (parts.length === 3) {
        try {
          const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
          const payload = JSON.parse(atob(base64));
          if (payload.role === 'authenticated' && payload.sub) {
            userId    = payload.sub as string;
            userEmail = payload.email as string;
            isGuest   = false;
          }
        } catch { /* invalid JWT — treat as guest */ }
      }
    }

    let externalReference: string;
    let backUrl: string;

    if (isGuest) {
      const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
      const { data: session, error: sessionError } = await admin
        .from('checkout_sessions')
        .insert({ ref_code: refCode, status: 'created' })
        .select('id')
        .single();

      if (sessionError || !session) {
        console.error('checkout_sessions insert error:', JSON.stringify(sessionError));
        return new Response(JSON.stringify({ error: 'Erro ao criar sessão de checkout' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      externalReference = session.id;
      // Placeholder — o email real é capturado pelo webhook após o pagamento via payer_email do MP
      userEmail = 'guest@viralflow.app';
      backUrl   = `${origin}/auth?checkout=success`;
      console.log('Guest checkout session:', session.id, '| ref_code:', refCode);
    } else {
      externalReference = userId!;
      backUrl           = `${origin}/?checkout=success`;
      console.log('Logged-in checkout | user:', userId);
    }

    const mpRes = await fetch('https://api.mercadopago.com/preapproval', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MP_ACCESS_TOKEN}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        reason:             'ViralFlow PRO',
        payer_email:        userEmail,
        back_url:           backUrl,
        notification_url:   'https://dzgotqyikomtapcgdgff.supabase.co/functions/v1/mp-webhook',
        external_reference: externalReference,
        auto_recurring: {
          frequency:          1,
          frequency_type:     'months',
          transaction_amount: 37.90,
          currency_id:        'BRL',
        },
      }),
    });

    const mpData = await mpRes.json();
    console.log('MP response status:', mpRes.status, '| id:', mpData.id);

    if (!mpRes.ok || !mpData.init_point) {
      console.error('MP error:', JSON.stringify(mpData));
      return new Response(
        JSON.stringify({ error: mpData?.message ?? mpData?.cause ?? 'Erro ao criar assinatura no MercadoPago' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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
