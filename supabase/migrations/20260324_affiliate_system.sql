-- ================================================================
-- SISTEMA DE AFILIADOS - ViralFlow
-- Versão: 2026-03-24
--
-- COMO APLICAR:
--   Acesse o Supabase Dashboard → SQL Editor → cole este arquivo e execute.
--   URL: https://supabase.com/dashboard/project/dzgotqyikomtapcgdgff/sql/new
--
-- TABELAS CRIADAS:
--   1. affiliates               — Afiliados cadastrados
--   2. referrals                — Indicações (quem indicou quem)
--   3. subscriptions            — Assinaturas mensais dos usuários
--   4. commissions              — Comissões individuais por ciclo
--   5. affiliate_login_purchases — Solicitações de compra de slots de login
--   6. affiliate_created_accounts — Contas criadas pelo afiliado p/ revenda
--   7. ref_clicks               — Cliques em links de afiliado
--   + FUNCTION get_affiliate_ranking() para o leaderboard
-- ================================================================

-- ─── 1. affiliates ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS affiliates (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  ref_code        TEXT        UNIQUE NOT NULL,
  status          TEXT        NOT NULL DEFAULT 'active',      -- active | suspended
  commission_rate DECIMAL(5,2) NOT NULL DEFAULT 30.00,        -- percentual (ex: 30.00 = 30%)
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE affiliates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "affiliates_select" ON affiliates;
CREATE POLICY "affiliates_select" ON affiliates FOR SELECT USING (true);

DROP POLICY IF EXISTS "affiliates_insert" ON affiliates;
CREATE POLICY "affiliates_insert" ON affiliates FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "affiliates_update" ON affiliates;
CREATE POLICY "affiliates_update" ON affiliates FOR UPDATE USING (auth.uid() = user_id);

-- ─── 2. referrals ────────────────────────────────────────────────────────────
-- Um "referral" é criado quando um usuário se cadastra via link de afiliado.
-- O vínculo é permanente: referred_user_id nunca muda de afiliado.
CREATE TABLE IF NOT EXISTS referrals (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id      UUID        NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
  referred_user_id  UUID        UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  ref_code          TEXT        NOT NULL,
  status            TEXT        NOT NULL DEFAULT 'pending',   -- pending | converted | cancelled
  converted_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "referrals_select" ON referrals;
CREATE POLICY "referrals_select" ON referrals FOR SELECT USING (
  affiliate_id IN (SELECT id FROM affiliates WHERE user_id = auth.uid())
);

DROP POLICY IF EXISTS "referrals_insert" ON referrals;
CREATE POLICY "referrals_insert" ON referrals FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "referrals_update" ON referrals;
CREATE POLICY "referrals_update" ON referrals FOR UPDATE USING (
  affiliate_id IN (SELECT id FROM affiliates WHERE user_id = auth.uid())
);

-- ─── 3. subscriptions ────────────────────────────────────────────────────────
-- Assinatura mensal de cada usuário. affiliate_id guarda qual afiliado
-- deve receber comissão pelas renovações deste usuário.
CREATE TABLE IF NOT EXISTS subscriptions (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID        NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  affiliate_id      UUID        REFERENCES affiliates(id) ON DELETE SET NULL,
  status            TEXT        NOT NULL DEFAULT 'active',    -- active | cancelled | expired
  plan              TEXT        NOT NULL DEFAULT 'monthly',
  amount            DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  started_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  cancelled_at      TIMESTAMPTZ,
  next_billing_date TIMESTAMPTZ
);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "subscriptions_select" ON subscriptions;
CREATE POLICY "subscriptions_select" ON subscriptions FOR SELECT USING (
  auth.uid() = user_id OR
  affiliate_id IN (SELECT id FROM affiliates WHERE user_id = auth.uid())
);

DROP POLICY IF EXISTS "subscriptions_insert" ON subscriptions;
CREATE POLICY "subscriptions_insert" ON subscriptions FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "subscriptions_update" ON subscriptions;
CREATE POLICY "subscriptions_update" ON subscriptions FOR UPDATE USING (auth.uid() = user_id);

-- ─── 4. commissions ──────────────────────────────────────────────────────────
-- Uma comissão é gerada a cada cobrança bem-sucedida de um assinante indicado.
-- type = 'initial' → primeira venda | 'recurring' → renovações mensais
CREATE TABLE IF NOT EXISTS commissions (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id    UUID        NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
  subscription_id UUID        REFERENCES subscriptions(id) ON DELETE SET NULL,
  referral_id     UUID        REFERENCES referrals(id) ON DELETE SET NULL,
  type            TEXT        NOT NULL DEFAULT 'recurring',   -- initial | recurring
  amount          DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  status          TEXT        NOT NULL DEFAULT 'pending',     -- pending | approved | paid | cancelled
  period_start    TIMESTAMPTZ,
  period_end      TIMESTAMPTZ,
  paid_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE commissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "commissions_select" ON commissions;
CREATE POLICY "commissions_select" ON commissions FOR SELECT USING (
  affiliate_id IN (SELECT id FROM affiliates WHERE user_id = auth.uid())
);

DROP POLICY IF EXISTS "commissions_insert" ON commissions;
CREATE POLICY "commissions_insert" ON commissions FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "commissions_update" ON commissions;
CREATE POLICY "commissions_update" ON commissions FOR UPDATE USING (
  affiliate_id IN (SELECT id FROM affiliates WHERE user_id = auth.uid())
);

-- ─── 5. affiliate_login_purchases ────────────────────────────────────────────
-- O afiliado solicita N "slots" de acesso para revender.
-- Fluxo: pending → paid (pagamento confirmado) → delivered (logins entregues)
CREATE TABLE IF NOT EXISTS affiliate_login_purchases (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID        NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
  quantity     INT         NOT NULL DEFAULT 1,
  unit_price   DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  total_price  DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  notes        TEXT,
  status       TEXT        NOT NULL DEFAULT 'pending',        -- pending | paid | delivered | cancelled
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE affiliate_login_purchases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "login_purchases_select" ON affiliate_login_purchases;
CREATE POLICY "login_purchases_select" ON affiliate_login_purchases FOR SELECT USING (
  affiliate_id IN (SELECT id FROM affiliates WHERE user_id = auth.uid())
);

DROP POLICY IF EXISTS "login_purchases_insert" ON affiliate_login_purchases;
CREATE POLICY "login_purchases_insert" ON affiliate_login_purchases FOR INSERT WITH CHECK (
  affiliate_id IN (SELECT id FROM affiliates WHERE user_id = auth.uid())
);

DROP POLICY IF EXISTS "login_purchases_update" ON affiliate_login_purchases;
CREATE POLICY "login_purchases_update" ON affiliate_login_purchases FOR UPDATE USING (
  affiliate_id IN (SELECT id FROM affiliates WHERE user_id = auth.uid())
);

-- ─── 6. affiliate_created_accounts ───────────────────────────────────────────
-- Contas criadas/gerenciadas pelo afiliado para seus clientes de revenda.
-- O admin ativa a conta manualmente (ou via webhook de pagamento no futuro).
CREATE TABLE IF NOT EXISTS affiliate_created_accounts (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID        NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
  purchase_id  UUID        REFERENCES affiliate_login_purchases(id) ON DELETE SET NULL,
  user_id      UUID        REFERENCES auth.users(id) ON DELETE SET NULL,  -- preenchido após ativação
  login_email  TEXT        NOT NULL,
  client_name  TEXT,
  notes        TEXT,
  status       TEXT        NOT NULL DEFAULT 'available',      -- available | active | cancelled
  sold_at      TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE affiliate_created_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "created_accounts_select" ON affiliate_created_accounts;
CREATE POLICY "created_accounts_select" ON affiliate_created_accounts FOR SELECT USING (
  affiliate_id IN (SELECT id FROM affiliates WHERE user_id = auth.uid())
);

DROP POLICY IF EXISTS "created_accounts_insert" ON affiliate_created_accounts;
CREATE POLICY "created_accounts_insert" ON affiliate_created_accounts FOR INSERT WITH CHECK (
  affiliate_id IN (SELECT id FROM affiliates WHERE user_id = auth.uid())
);

DROP POLICY IF EXISTS "created_accounts_update" ON affiliate_created_accounts;
CREATE POLICY "created_accounts_update" ON affiliate_created_accounts FOR UPDATE USING (
  affiliate_id IN (SELECT id FROM affiliates WHERE user_id = auth.uid())
);

-- ─── 7. ref_clicks ───────────────────────────────────────────────────────────
-- Cada acesso ao app via link de afiliado gera um registro aqui.
-- Quando o visitante se cadastra, converted = true.
CREATE TABLE IF NOT EXISTS ref_clicks (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID        NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
  ref_code     TEXT        NOT NULL,
  converted    BOOLEAN     NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE ref_clicks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ref_clicks_select" ON ref_clicks;
CREATE POLICY "ref_clicks_select" ON ref_clicks FOR SELECT USING (
  affiliate_id IN (SELECT id FROM affiliates WHERE user_id = auth.uid())
);

DROP POLICY IF EXISTS "ref_clicks_insert" ON ref_clicks;
CREATE POLICY "ref_clicks_insert" ON ref_clicks FOR INSERT WITH CHECK (true);

-- ─── 8. Função de ranking ─────────────────────────────────────────────────────
-- SECURITY DEFINER: ignora RLS para agregar dados de todos os afiliados.
-- Retorna os top 50 afiliados ordenados por receita gerada.
CREATE OR REPLACE FUNCTION get_affiliate_ranking()
RETURNS TABLE (
  affiliate_id  UUID,
  ref_code      TEXT,
  display_name  TEXT,
  avatar_url    TEXT,
  active_clients BIGINT,
  total_earned  NUMERIC,
  position      BIGINT
)
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    a.id,
    a.ref_code,
    p.display_name,
    p.avatar_url,
    COUNT(DISTINCT r.id) FILTER (WHERE r.status = 'converted')        AS active_clients,
    COALESCE(
      SUM(c.amount) FILTER (WHERE c.status IN ('pending','approved','paid')),
      0
    )                                                                   AS total_earned,
    ROW_NUMBER() OVER (
      ORDER BY
        COALESCE(SUM(c.amount) FILTER (WHERE c.status IN ('pending','approved','paid')), 0) DESC,
        COUNT(DISTINCT r.id) FILTER (WHERE r.status = 'converted') DESC
    )                                                                   AS position
  FROM affiliates a
  JOIN profiles p ON p.user_id = a.user_id
  LEFT JOIN referrals r   ON r.affiliate_id = a.id
  LEFT JOIN commissions c ON c.affiliate_id = a.id
  WHERE a.status = 'active'
  GROUP BY a.id, a.ref_code, p.display_name, p.avatar_url
  ORDER BY total_earned DESC, active_clients DESC
  LIMIT 50;
$$;

GRANT EXECUTE ON FUNCTION get_affiliate_ranking() TO authenticated;
GRANT EXECUTE ON FUNCTION get_affiliate_ranking() TO anon;

-- ─── FIM DA MIGRAÇÃO ──────────────────────────────────────────────────────────
