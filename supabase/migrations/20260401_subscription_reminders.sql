-- Tabela para controlar quais lembretes de renovação já foram enviados
-- Garante que cada tipo de lembrete seja enviado apenas uma vez por ciclo de vencimento

CREATE TABLE IF NOT EXISTS subscription_reminders (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reminder_type text        NOT NULL CHECK (reminder_type IN ('7d', '2d', '0d', 'post2d')),
  expires_at    timestamptz NOT NULL,
  sent_at       timestamptz DEFAULT now(),
  UNIQUE (user_id, reminder_type, expires_at)
);

ALTER TABLE subscription_reminders ENABLE ROW LEVEL SECURITY;

-- Só service role acessa (a edge function usa service role key)
