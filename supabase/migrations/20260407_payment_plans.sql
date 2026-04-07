-- Armazena o plano por payment_id para garantir detecção correta no webhook
CREATE TABLE IF NOT EXISTS payment_plans (
  payment_id   text        PRIMARY KEY,
  plan         text        NOT NULL CHECK (plan IN ('monthly', 'annual')),
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE payment_plans ENABLE ROW LEVEL SECURITY;
-- Apenas service role acessa (edge functions usam service key)
