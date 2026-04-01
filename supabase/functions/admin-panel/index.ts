/**
 * admin-panel — Edge Function exclusiva do administrador
 *
 * Ações suportadas (campo `action` no body):
 *   list           → lista todos os usuários com dados de perfil e subscrição
 *   create         → cria novo usuário (email + password)
 *   delete         → exclui usuário pelo user_id
 *   update_days    → adiciona ou remove dias de acesso (pode ser negativo)
 *
 * Segurança: verifica que o JWT pertence ao e-mail do admin antes de qualquer operação.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ADMIN_EMAIL = 'evcarvalhodev@gmail.com';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL         = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // ── Cliente admin (service role) ─────────────────────────────────────────
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // ── Verifica autenticação do chamador via JWT ────────────────────────────
    const authHeader = req.headers.get('Authorization') ?? '';
    const jwt = authHeader.replace('Bearer ', '').trim();
    if (!jwt) return json({ error: 'Acesso negado' }, 403);

    const { data: { user: caller }, error: authErr } = await admin.auth.getUser(jwt);
    if (authErr || !caller || caller.email !== ADMIN_EMAIL) {
      return json({ error: 'Acesso negado' }, 403);
    }

    const body = req.method === 'GET' ? {} : await req.json().catch(() => ({}));
    const action: string = body.action ?? 'list';

    // ── LIST ─────────────────────────────────────────────────────────────────
    if (action === 'list') {
      // Busca todos os usuários do auth
      const { data: { users }, error: listErr } = await admin.auth.admin.listUsers({ perPage: 1000 });
      if (listErr) return json({ error: listErr.message }, 500);

      // Busca todos os perfis
      const { data: profiles } = await admin
        .from('profiles')
        .select('user_id, display_name, subscription_status, subscription_expires_at, updated_at');

      const profileMap = new Map((profiles ?? []).map((p: any) => [p.user_id, p]));

      const result = users.map((u: any) => {
        const p = profileMap.get(u.id) ?? {};
        return {
          user_id: u.id,
          email: u.email,
          display_name: p.display_name ?? null,
          subscription_status: p.subscription_status ?? 'free',
          subscription_expires_at: p.subscription_expires_at ?? null,
          updated_at: p.updated_at ?? u.created_at,
          created_at: u.created_at,
        };
      });

      // Ordena: quem tem subscription_expires_at mais recente sobe (= comprou mais recentemente)
      // Usuários sem compra ficam no final
      result.sort((a: any, b: any) => {
        const aTime = a.subscription_expires_at ? new Date(a.subscription_expires_at).getTime() : 0;
        const bTime = b.subscription_expires_at ? new Date(b.subscription_expires_at).getTime() : 0;
        // Se ambos têm expiry, ordena pelo updated_at (última atividade de compra)
        if (aTime > 0 && bTime > 0) {
          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
        }
        return bTime - aTime;
      });

      return json({ users: result });
    }

    // ── CREATE ───────────────────────────────────────────────────────────────
    if (action === 'create') {
      const { email, password } = body;
      if (!email || !password) return json({ error: 'email e password são obrigatórios' }, 400);

      const { data, error } = await admin.auth.admin.createUser({
        email: email.trim(),
        password,
        email_confirm: true,
      });
      if (error) return json({ error: error.message }, 400);
      return json({ user_id: data.user?.id, email: data.user?.email });
    }

    // ── DELETE ───────────────────────────────────────────────────────────────
    if (action === 'delete') {
      const { user_id } = body;
      if (!user_id) return json({ error: 'user_id é obrigatório' }, 400);

      const { error } = await admin.auth.admin.deleteUser(user_id);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    // ── UPDATE_DAYS ──────────────────────────────────────────────────────────
    if (action === 'update_days') {
      const { user_id, days } = body;
      if (!user_id || days === undefined) return json({ error: 'user_id e days são obrigatórios' }, 400);

      // Lê expiração atual
      const { data: profile } = await admin
        .from('profiles')
        .select('subscription_expires_at, subscription_status')
        .eq('user_id', user_id)
        .maybeSingle();

      const now = Date.now();
      const currentExpiry = profile?.subscription_expires_at
        ? new Date(profile.subscription_expires_at).getTime()
        : null;

      // Base: se tem expiry no futuro, adiciona a partir dela; senão, a partir de agora
      const base = currentExpiry && currentExpiry > now ? currentExpiry : now;
      const newExpiry = new Date(base + days * 24 * 60 * 60 * 1000);

      // Define status
      const newStatus = newExpiry.getTime() > now ? 'active' : 'canceled';

      const { error } = await admin
        .from('profiles')
        .update({
          subscription_expires_at: newExpiry.toISOString(),
          subscription_status: newStatus,
        })
        .eq('user_id', user_id);

      if (error) return json({ error: error.message }, 500);
      return json({ ok: true, subscription_expires_at: newExpiry.toISOString(), subscription_status: newStatus });
    }

    return json({ error: 'Ação desconhecida' }, 400);

  } catch (err: any) {
    return json({ error: err?.message ?? 'Erro interno' }, 500);
  }
});
