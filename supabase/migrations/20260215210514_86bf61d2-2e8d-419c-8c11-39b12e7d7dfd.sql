
-- Remove unique constraint so users can have multiple plans per day
ALTER TABLE public.daily_plans DROP CONSTRAINT IF EXISTS daily_plans_user_id_plan_date_key;
