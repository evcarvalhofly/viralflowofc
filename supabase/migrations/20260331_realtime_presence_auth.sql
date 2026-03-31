-- Realtime Authorization policies for community_presence channel
-- Required in Supabase projects with Realtime Authorization enabled.
-- Without these policies, presence channels return CHANNEL_ERROR / WebSocket failure.
-- postgres_changes channels are NOT affected (they use table RLS directly).

DO $$
BEGIN
  -- Only proceed if this project uses Realtime Authorization (realtime.messages exists)
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'realtime'
      AND table_name = 'messages'
  ) THEN

    -- Enable RLS if not already enabled
    EXECUTE 'ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY';

    -- Drop existing policies to avoid conflicts on re-run
    DROP POLICY IF EXISTS "community_presence_all" ON realtime.messages;

    -- Allow authenticated users to send/receive on the community_presence channel
    CREATE POLICY "community_presence_all"
      ON realtime.messages
      FOR ALL
      TO authenticated
      USING  (realtime.channel() = 'community_presence')
      WITH CHECK (realtime.channel() = 'community_presence');

  END IF;
END;
$$;
