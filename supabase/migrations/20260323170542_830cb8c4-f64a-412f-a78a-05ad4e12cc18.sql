
CREATE TABLE public.avisos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.avisos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Avisos are publicly viewable" ON public.avisos
  FOR SELECT USING (true);

CREATE POLICY "Only admin can insert avisos" ON public.avisos
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND email = 'evcarvalhodev@gmail.com')
  );

CREATE POLICY "Only admin can update avisos" ON public.avisos
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND email = 'evcarvalhodev@gmail.com')
  );

CREATE POLICY "Only admin can delete avisos" ON public.avisos
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND email = 'evcarvalhodev@gmail.com')
  );

INSERT INTO storage.buckets (id, name, public)
VALUES ('avisos', 'avisos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Avisos images are publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avisos');

CREATE POLICY "Admin can upload avisos images"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'avisos' AND
    EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND email = 'evcarvalhodev@gmail.com')
  );

CREATE POLICY "Admin can delete avisos images"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'avisos' AND
    EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND email = 'evcarvalhodev@gmail.com')
  );

CREATE TRIGGER update_avisos_updated_at
  BEFORE UPDATE ON public.avisos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
