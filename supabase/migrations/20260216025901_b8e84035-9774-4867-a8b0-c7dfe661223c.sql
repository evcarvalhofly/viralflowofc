
CREATE TABLE public.followed_channels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  channel_name TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'YouTube',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.followed_channels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own channels" ON public.followed_channels FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own channels" ON public.followed_channels FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own channels" ON public.followed_channels FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_followed_channels_user ON public.followed_channels(user_id);
