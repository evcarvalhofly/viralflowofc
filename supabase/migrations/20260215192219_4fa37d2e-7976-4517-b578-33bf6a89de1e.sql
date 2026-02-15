
-- Create niches table (public read)
CREATE TABLE public.niches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  icon TEXT,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.niches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Niches are publicly readable"
ON public.niches FOR SELECT
USING (true);

-- Seed popular niches
INSERT INTO public.niches (name, slug, icon, description) VALUES
  ('Tecnologia', 'tecnologia', '💻', 'Tech, gadgets, IA, programação'),
  ('Fitness', 'fitness', '💪', 'Treino, saúde, nutrição'),
  ('Finanças', 'financas', '💰', 'Investimentos, economia, renda extra'),
  ('Games', 'games', '🎮', 'Jogos, esports, reviews'),
  ('Beleza', 'beleza', '💄', 'Maquiagem, skincare, cabelo'),
  ('Culinária', 'culinaria', '🍳', 'Receitas, restaurantes, dicas'),
  ('Humor', 'humor', '😂', 'Comédia, memes, entretenimento'),
  ('Educação', 'educacao', '📚', 'Estudos, cursos, desenvolvimento pessoal'),
  ('Viagens', 'viagens', '✈️', 'Destinos, dicas, roteiros'),
  ('Música', 'musica', '🎵', 'Artistas, produção, tendências'),
  ('Moda', 'moda', '👗', 'Estilo, tendências, outfit'),
  ('Pets', 'pets', '🐾', 'Animais, cuidados, diversão'),
  ('Esportes', 'esportes', '⚽', 'Futebol, basquete, esportes em geral'),
  ('Empreendedorismo', 'empreendedorismo', '🚀', 'Negócios, startups, marketing digital'),
  ('Lifestyle', 'lifestyle', '🌟', 'Dia a dia, produtividade, bem-estar');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  subscription_status TEXT NOT NULL DEFAULT 'inactive',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
ON public.profiles FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile"
ON public.profiles FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

-- Create user_niches table
CREATE TABLE public.user_niches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  niche_id UUID NOT NULL REFERENCES public.niches(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, niche_id)
);

ALTER TABLE public.user_niches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own niches"
ON public.user_niches FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own niches"
ON public.user_niches FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own niches"
ON public.user_niches FOR DELETE TO authenticated
USING (auth.uid() = user_id);

-- Create notes table
CREATE TABLE public.notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notes"
ON public.notes FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own notes"
ON public.notes FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own notes"
ON public.notes FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own notes"
ON public.notes FOR DELETE TO authenticated
USING (auth.uid() = user_id);

-- Create content_plans table
CREATE TABLE public.content_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  checklist JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.content_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own plans"
ON public.content_plans FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own plans"
ON public.content_plans FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own plans"
ON public.content_plans FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own plans"
ON public.content_plans FOR DELETE TO authenticated
USING (auth.uid() = user_id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_notes_updated_at
BEFORE UPDATE ON public.notes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_content_plans_updated_at
BEFORE UPDATE ON public.content_plans
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
