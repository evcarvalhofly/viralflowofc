-- Security-definer function: returns global favorite counts per asset (bypasses RLS)
-- Returns only aggregate counts, never exposes user_id
CREATE OR REPLACE FUNCTION public.get_asset_favorite_counts()
RETURNS TABLE(asset_id text, fav_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT asset_id, COUNT(*) AS fav_count
  FROM public.favorites
  GROUP BY asset_id;
$$;