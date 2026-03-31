-- Replace unreliable Realtime Presence with a DB heartbeat approach.
-- Community page updates last_seen_at every 30s; users inactive > 90s are shown as offline.
-- This avoids Supabase Realtime Authorization issues with presence channels.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ DEFAULT NULL;
