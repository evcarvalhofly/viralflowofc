-- Adiciona colunas Stripe na tabela profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text;

-- subscription_status já existe; garante default 'free'
ALTER TABLE profiles
  ALTER COLUMN subscription_status SET DEFAULT 'free';

-- Índice para lookup rápido por customer_id
CREATE INDEX IF NOT EXISTS profiles_stripe_customer_id_idx ON profiles(stripe_customer_id);
