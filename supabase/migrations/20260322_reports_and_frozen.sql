-- ======================================================
-- Tabela de Denúncias (Reports)
-- ======================================================
CREATE TABLE IF NOT EXISTS public.reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reporter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reported_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(reporter_id, reported_id)
);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- Qualquer autenticado pode criar denúncias (apenas as próprias)
CREATE POLICY "Users can insert own reports"
ON public.reports FOR INSERT TO authenticated
WITH CHECK (auth.uid() = reporter_id);

-- Usuários podem ver denúncias que fizeram
CREATE POLICY "Users can view own reports"
ON public.reports FOR SELECT TO authenticated
USING (auth.uid() = reporter_id);

-- ======================================================
-- Coluna is_frozen em profiles
-- ======================================================
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS is_frozen BOOLEAN DEFAULT false;

-- ======================================================
-- Trigger para congelar conta com 5+ denúncias
-- ======================================================
CREATE OR REPLACE FUNCTION public.check_freeze_account()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  report_count INT;
BEGIN
  SELECT COUNT(*) INTO report_count
  FROM public.reports
  WHERE reported_id = NEW.reported_id;

  IF report_count >= 5 THEN
    UPDATE public.profiles
    SET is_frozen = true
    WHERE user_id = NEW.reported_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_check_freeze ON public.reports;
CREATE TRIGGER trigger_check_freeze
AFTER INSERT ON public.reports
FOR EACH ROW
EXECUTE FUNCTION public.check_freeze_account();
