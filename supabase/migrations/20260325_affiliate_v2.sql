-- ================================================================
-- SISTEMA DE AFILIADOS v2 - ViralFlow
-- Versão: 2026-03-25
-- Mudanças: MLM nível 2, carência 7 dias, solicitações de saque
-- COMO APLICAR: Supabase Dashboard → SQL Editor
-- ================================================================

-- ─── 1. affiliates: coluna MLM ───────────────────────────────────────────────
ALTER TABLE affiliates
  ADD COLUMN IF NOT EXISTS referred_by_affiliate_id UUID REFERENCES affiliates(id) ON DELETE SET NULL;

-- ─── 2. commissions: carência e nível ────────────────────────────────────────
ALTER TABLE commissions
  ADD COLUMN IF NOT EXISTS available_after TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS level INT NOT NULL DEFAULT 1;

-- Backfill: comissões existentes ficam disponíveis imediatamente
UPDATE commissions SET available_after = created_at WHERE available_after IS NULL;

-- ─── 3. withdrawal_requests: solicitações de saque ───────────────────────────
CREATE TABLE IF NOT EXISTS withdrawal_requests (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id   UUID          NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
  amount         DECIMAL(10,2) NOT NULL,
  status         TEXT          NOT NULL DEFAULT 'pending',  -- pending | paid | rejected
  pix_key        TEXT          NOT NULL,
  notes          TEXT,
  admin_notes    TEXT,
  requested_at   TIMESTAMPTZ   NOT NULL DEFAULT now(),
  processed_at   TIMESTAMPTZ
);

ALTER TABLE withdrawal_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "wr_select" ON withdrawal_requests;
CREATE POLICY "wr_select" ON withdrawal_requests FOR SELECT USING (
  affiliate_id IN (SELECT id FROM affiliates WHERE user_id = auth.uid())
);

DROP POLICY IF EXISTS "wr_insert" ON withdrawal_requests;
CREATE POLICY "wr_insert" ON withdrawal_requests FOR INSERT WITH CHECK (
  affiliate_id IN (SELECT id FROM affiliates WHERE user_id = auth.uid())
);

-- ─── 4. Função para liberar comissões após carência (SECURITY DEFINER) ───────
CREATE OR REPLACE FUNCTION release_available_commissions(p_affiliate_id UUID)
RETURNS VOID
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE commissions
  SET status = 'available'
  WHERE affiliate_id = p_affiliate_id
    AND status = 'pending'
    AND available_after IS NOT NULL
    AND available_after <= now();
$$;

GRANT EXECUTE ON FUNCTION release_available_commissions(UUID) TO authenticated;

-- ─── 5. Atualiza get_affiliate_ranking para incluir status 'available' ────────
CREATE OR REPLACE FUNCTION get_affiliate_ranking()
RETURNS TABLE (
  affiliate_id  UUID,
  ref_code      TEXT,
  display_name  TEXT,
  avatar_url    TEXT,
  active_clients BIGINT,
  total_earned  NUMERIC,
  rank_position BIGINT
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
      SUM(c.amount) FILTER (WHERE c.status IN ('pending','available','approved','paid')),
      0
    )                                                                   AS total_earned,
    ROW_NUMBER() OVER (
      ORDER BY
        COALESCE(SUM(c.amount) FILTER (WHERE c.status IN ('pending','available','approved','paid')), 0) DESC,
        COUNT(DISTINCT r.id) FILTER (WHERE r.status = 'converted') DESC
    )                                                                   AS rank_position
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
