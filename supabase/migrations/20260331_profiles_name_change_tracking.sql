-- Controle de limite de troca de nome (2x por 30 dias)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS name_change_count int NOT NULL DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS name_last_changed_at timestamptz;
