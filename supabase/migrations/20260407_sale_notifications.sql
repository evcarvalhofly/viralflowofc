-- Notificações de venda para afiliados e admin
CREATE TABLE IF NOT EXISTS sale_notifications (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount           numeric(10,2) NOT NULL,              -- valor total da venda
  net_amount       numeric(10,2) NOT NULL,              -- valor líquido do destinatário
  plan             text        NOT NULL DEFAULT 'monthly',
  is_affiliate_sale boolean    NOT NULL DEFAULT false,
  affiliate_name   text,                                -- nome do afiliado (só visível pro admin)
  created_at       timestamptz NOT NULL DEFAULT now(),
  read             boolean     NOT NULL DEFAULT false
);

ALTER TABLE sale_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sale_notifications_select"
  ON sale_notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "sale_notifications_update"
  ON sale_notifications FOR UPDATE
  USING (auth.uid() = user_id);
