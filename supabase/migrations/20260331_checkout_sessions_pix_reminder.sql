-- Adiciona controle de lembrete de PIX não pago
ALTER TABLE checkout_sessions ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz;

-- Cron job: verifica sessões PIX não pagas a cada 5 minutos e envia lembrete
-- Usa pg_net para chamar a edge function send-pix-reminder
SELECT cron.schedule(
  'pix-reminder-check',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url     := 'https://dzgotqyikomtapcgdgff.supabase.co/functions/v1/send-pix-reminder',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR6Z290cXlpa29tdGFwY2dkZ2ZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzExNzUxNDMsImV4cCI6MjA4Njc1MTE0M30.cTBDE0bCC6j4j2Pw0QRac220oqgQkAcYbMaJ3zyrmbY'
    ),
    body    := '{}'::jsonb
  ) AS request_id;
  $$
);
