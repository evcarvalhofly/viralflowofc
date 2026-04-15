import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ADMIN_EMAIL = 'evcarvalhodev@gmail.com';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Sempre retorna 200 - o cliente le data.error para detectar falhas
const json = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL         = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const SUPABASE_ANON_KEY    = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Verifica JWT via createClient
    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader) return json({ error: 'Sem autorizacao' });

    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: { user: caller }, error: authError } = await userClient.auth.getUser(token);
    if (authError || !caller?.email) return json({ error: `Auth falhou: ${authError?.message ?? 'sem usuario'}` });
    if (caller.email !== ADMIN_EMAIL) return json({ error: 'Acesso negado' });

    // Cliente admin (service role)
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const body = await req.json().catch(() => ({}));
    const action: string = body.action ?? 'list';

    // LIST
    if (action === 'list') {
      const { data: usersData, error: listError } = await admin.auth.admin.listUsers({ perPage: 1000, page: 1 });
      if (listError) return json({ error: `listUsers: ${listError.message}` });
      const authUsers: any[] = usersData?.users ?? [];

      const { data: profiles, error: profErr } = await admin
        .from('profiles')
        .select('user_id, display_name, subscription_status, subscription_expires_at, updated_at');
      if (profErr) return json({ error: `profiles: ${profErr.message}` });

      const profileMap = new Map((profiles ?? []).map((p: any) => [p.user_id, p]));

      const result = authUsers.map((u: any) => {
        const p: any = profileMap.get(u.id) ?? {};
        return {
          user_id: u.id,
          email: u.email ?? '',
          display_name: p.display_name ?? null,
          subscription_status: p.subscription_status ?? 'free',
          subscription_expires_at: p.subscription_expires_at ?? null,
          updated_at: p.updated_at ?? u.created_at,
          created_at: u.created_at,
        };
      });

      result.sort((a: any, b: any) => {
        const aTime = a.subscription_expires_at ? new Date(a.subscription_expires_at).getTime() : 0;
        const bTime = b.subscription_expires_at ? new Date(b.subscription_expires_at).getTime() : 0;
        if (aTime > 0 && bTime > 0) {
          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
        }
        return bTime - aTime;
      });

      return json({ users: result, total: authUsers.length });
    }

    // GET_USER_DETAIL
    if (action === 'get_user_detail') {
      const { user_id } = body;
      if (!user_id) return json({ error: 'user_id e obrigatorio' });

      const { data: authUserData, error: getUserError } = await admin.auth.admin.getUserById(user_id);
      if (getUserError) return json({ error: `getUser: ${getUserError.message}` });
      const authUser = authUserData?.user;

      const { data: profile } = await admin
        .from('profiles')
        .select('display_name, subscription_status, subscription_expires_at, updated_at')
        .eq('user_id', user_id)
        .maybeSingle();

      const { data: affiliate } = await admin
        .from('affiliates')
        .select('id, ref_code, status, commission_rate, whatsapp, pix_key, created_at')
        .eq('user_id', user_id)
        .maybeSingle();

      return json({
        user_id,
        email: authUser.email ?? '',
        phone: authUser.phone ?? null,
        created_at: authUser.created_at,
        last_sign_in_at: authUser.last_sign_in_at ?? null,
        display_name: profile?.display_name ?? null,
        subscription_status: profile?.subscription_status ?? 'free',
        subscription_expires_at: profile?.subscription_expires_at ?? null,
        affiliate: affiliate ?? null,
      });
    }

    // CREATE
    if (action === 'create') {
      const { email, password } = body;
      if (!email || !password) return json({ error: 'email e password sao obrigatorios' });

      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email: email.trim(),
        password,
        email_confirm: true,
      });
      if (createError) return json({ error: createError.message });
      return json({ user_id: created.user.id, email: created.user.email });
    }

    // RESET_PASSWORD
    if (action === 'reset_password') {
      const { user_id, new_password } = body;
      if (!user_id || !new_password) return json({ error: 'user_id e new_password sao obrigatorios' });
      if (new_password.length < 6) return json({ error: 'Senha deve ter no mínimo 6 caracteres' });

      const { error: resetError } = await admin.auth.admin.updateUserById(user_id, { password: new_password });
      if (resetError) return json({ error: resetError.message });
      return json({ ok: true });
    }

    // DELETE
    if (action === 'delete') {
      const { user_id } = body;
      if (!user_id) return json({ error: 'user_id e obrigatorio' });

      const { error: deleteError } = await admin.auth.admin.deleteUser(user_id);
      if (deleteError) return json({ error: deleteError.message });
      return json({ ok: true });
    }

    // UPDATE_DAYS
    if (action === 'update_days') {
      const { user_id, days } = body;
      if (!user_id || days === undefined) return json({ error: 'user_id e days sao obrigatorios' });

      const { data: profile } = await admin
        .from('profiles')
        .select('subscription_expires_at')
        .eq('user_id', user_id)
        .maybeSingle();

      const now = Date.now();
      const currentExpiry = profile?.subscription_expires_at
        ? new Date(profile.subscription_expires_at).getTime()
        : null;
      const base = currentExpiry && currentExpiry > now ? currentExpiry : now;
      const newExpiry = new Date(base + days * 24 * 60 * 60 * 1000);
      const newStatus = newExpiry.getTime() > now ? 'active' : 'canceled';

      const { error } = await admin
        .from('profiles')
        .update({ subscription_expires_at: newExpiry.toISOString(), subscription_status: newStatus })
        .eq('user_id', user_id);

      if (error) return json({ error: error.message });
      return json({ ok: true, subscription_expires_at: newExpiry.toISOString(), subscription_status: newStatus });
    }

    // DELETE_PRODUCT
    if (action === 'delete_product') {
      const { product_id } = body;
      if (!product_id) return json({ error: 'product_id e obrigatorio' });

      const patchRes = await fetch(
        `${SUPABASE_URL}/rest/v1/products?id=eq.${product_id}`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
            'apikey': SUPABASE_SERVICE_KEY,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal',
          },
          body: JSON.stringify({ status: 'inactive' }),
        }
      );
      if (!patchRes.ok) {
        const e = await patchRes.json().catch(() => ({}));
        return json({ error: e.message ?? e.hint ?? `REST ${patchRes.status}` });
      }
      return json({ ok: true });
    }

    return json({ error: 'Acao desconhecida' });

  } catch (err: any) {
    return json({ error: err?.message ?? 'Erro interno' });
  }
});
