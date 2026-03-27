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

    // MP envia como query params ou body JSON
    const url    = new URL(req.url);
    const type   = url.searchParams.get('type') ?? '';
    const dataId = url.searchParams.get('data.id') ?? '';

    // Também aceita body JSON
    let bodyId = '';
    try {
      const body = await req.json();
      bodyId = body?.data?.id ?? body?.id ?? '';
    } catch { /* sem body */ }

    const preapprovalId = dataId || bodyId;

    console.log('MP webhook recebido — type:', type, 'id:', preapprovalId);

    // Só processa eventos de preapproval (assinatura)
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

    const preapproval = await mpRes.json();
    const userId      = preapproval.external_reference;
    const mpStatus    = preapproval.status; // authorized | paused | cancelled | pending

    console.log('Preapproval status:', mpStatus, '| user:', userId);

    if (!userId) {
      return new Response('ok', { headers: corsHeaders });
    }

    // Mapeia status do MP para status interno
    const subscriptionStatus =
      mpStatus === 'authorized' ? 'active' :
      mpStatus === 'paused'     ? 'active' : // paused ainda tem acesso
      'free';

    await admin
      .from('profiles')
      .update({
        subscription_status:   subscriptionStatus,
        stripe_subscription_id: preapprovalId, // reutilizamos a coluna para guardar o ID do MP
      })
      .eq('user_id', userId);

    console.log('Perfil atualizado:', userId, '->', subscriptionStatus);

    return new Response('ok', { headers: corsHeaders });
  } catch (err) {
    console.error('mp-webhook erro:', err);
    return new Response('error', { status: 500, headers: corsHeaders });
  }
});
