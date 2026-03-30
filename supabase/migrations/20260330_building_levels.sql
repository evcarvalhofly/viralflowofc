-- ============================================================
-- Building Level System
-- ============================================================
-- Each user's building evolves based on in-app achievements:
--   Level 1 → 2 : Stay logged in for 60 seconds (client-side)
--   Level 2 → 3 : Add at least 2 friends in the community
--   Level 3 → 4 : List at least 1 product in the Shopping
--   Level 4 → 5 : Become an affiliate with at least 5 sales
--   Level 5 → 6 : Make 20 affiliate sales in the last 30 days
-- ============================================================

-- Ensure nivel has a default of 1 for new profiles
ALTER TABLE profiles ALTER COLUMN nivel SET DEFAULT 1;

-- Initialize existing null levels to 1
UPDATE profiles SET nivel = 1 WHERE nivel IS NULL;

-- ── Core upgrade function ─────────────────────────────────────────────────────
-- Returns the new level after applying any pending upgrades.
-- Level 1→2 is handled client-side (60-second timer); this function handles 2→6.
-- Safe to call repeatedly — only upgrades, never downgrades.
CREATE OR REPLACE FUNCTION check_and_upgrade_building_level(p_user_id UUID)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_level        INT;
  v_affiliate_id UUID;
  v_count        INT;
  v_changed      BOOLEAN;
BEGIN
  -- Fetch current level (treat NULL as 1)
  SELECT COALESCE(nivel, 1) INTO v_level
  FROM profiles
  WHERE user_id = p_user_id;

  -- Loop so chained upgrades apply in a single call
  LOOP
    v_changed := false;

    -- ── 2 → 3 : two accepted friends ───────────────────────────────────────
    IF v_level = 2 THEN
      SELECT COUNT(*) INTO v_count
      FROM friendships
      WHERE (user_id = p_user_id OR friend_id = p_user_id)
        AND status = 'accepted';
      IF v_count >= 2 THEN
        v_level   := 3;
        v_changed := true;
      END IF;
    END IF;

    -- ── 3 → 4 : at least one active product in the Shopping ────────────────
    IF v_level = 3 THEN
      SELECT COUNT(*) INTO v_count
      FROM products
      WHERE user_id = p_user_id
        AND status = 'active';
      IF v_count >= 1 THEN
        v_level   := 4;
        v_changed := true;
      END IF;
    END IF;

    -- ── 4 → 5 : active affiliate with ≥ 5 commissions (non-cancelled) ──────
    IF v_level = 4 THEN
      SELECT id INTO v_affiliate_id
      FROM affiliates
      WHERE user_id = p_user_id
        AND status = 'active'
      LIMIT 1;

      IF v_affiliate_id IS NOT NULL THEN
        SELECT COUNT(*) INTO v_count
        FROM commissions
        WHERE affiliate_id = v_affiliate_id
          AND status <> 'cancelled';
        IF v_count >= 5 THEN
          v_level   := 5;
          v_changed := true;
        END IF;
      END IF;
    END IF;

    -- ── 5 → 6 : affiliate with ≥ 20 commissions in the last 30 days ────────
    IF v_level = 5 THEN
      SELECT id INTO v_affiliate_id
      FROM affiliates
      WHERE user_id = p_user_id
        AND status = 'active'
      LIMIT 1;

      IF v_affiliate_id IS NOT NULL THEN
        SELECT COUNT(*) INTO v_count
        FROM commissions
        WHERE affiliate_id = v_affiliate_id
          AND status <> 'cancelled'
          AND created_at >= NOW() - INTERVAL '30 days';
        IF v_count >= 20 THEN
          v_level   := 6;
          v_changed := true;
        END IF;
      END IF;
    END IF;

    EXIT WHEN NOT v_changed OR v_level >= 6;
  END LOOP;

  -- Persist only if there was an actual upgrade
  UPDATE profiles
  SET nivel = v_level, updated_at = NOW()
  WHERE user_id = p_user_id
    AND COALESCE(nivel, 1) < v_level;

  RETURN v_level;
END;
$$;

-- Allow authenticated users to call the function on their own profile
REVOKE ALL ON FUNCTION check_and_upgrade_building_level(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION check_and_upgrade_building_level(UUID) TO authenticated;
