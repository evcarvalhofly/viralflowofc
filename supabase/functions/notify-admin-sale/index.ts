import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ADMIN_EMAIL = 'evcarvalhodev@gmail.com';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  // Require authenticated user
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return new Response('Unauthorized', { status: 401, headers: corsHeaders });

  try {
    const SUPABASE_URL  = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_KEY   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const { plan, is_affiliate, affiliate_name } = await req.json();
    const resolvedPlan = plan === 'annual' ? 'annual' : 'monthly';
    const amount = resolvedPlan === 'annual' ? 297.00 : 37.90;
    const planLabel = resolvedPlan === 'annual' ? 'Anual' : 'Mensal';

    const { data: { user: adminUser }, error } = await admin.auth.admin.getUserByEmail(ADMIN_EMAIL);
    if (error || !adminUser) {
      console.warn('notify-admin-sale: admin user not found');
      return new Response(JSON.stringify({ ok: false, reason: 'admin not found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Insert sale notification (triggers realtime in-app toast)
    await admin.from('sale_notifications').insert({
      user_id:         adminUser.id,
      amount,
      net_amount:      amount,
      plan:            resolvedPlan,
      is_affiliate_sale: !!is_affiliate,
      affiliate_name:  affiliate_name ?? null,
    });

    // Send web push (background notification)
    await fetch(`${SUPABASE_URL}/functions/v1/send-web-push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SERVICE_KEY}` },
      body: JSON.stringify({
        user_id: adminUser.id,
        title: '💰 Nova venda!',
        body: `Plano ${planLabel} · R$${amount.toFixed(2).replace('.', ',')}`,
      }),
    });

    console.log('notify-admin-sale | plan:', resolvedPlan, '| admin:', adminUser.id);
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('notify-admin-sale error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
