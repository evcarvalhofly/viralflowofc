-- Add session guard column to prevent account sharing
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS current_session_id TEXT;
