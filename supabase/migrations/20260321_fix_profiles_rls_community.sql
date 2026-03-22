-- =================================================================
-- FIX CRÍTICO DEFINITIVO: Comunidade - Todos veem todos
-- Executar no SQL Editor do Supabase
-- =================================================================

-- 1. Remove TODAS as policies existentes do profiles para começar limpo
DROP POLICY IF EXISTS "All authenticated users can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.profiles;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.profiles;
DROP POLICY IF EXISTS "Enable update for users based on id" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;

-- 2. Garante que RLS está ativo
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. SELECT: Qualquer usuário autenticado vê TODOS os perfis (essencial para o mapa comunitário!)
CREATE POLICY "community_read_all_profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (true);

-- 4. INSERT: Usuário pode criar o próprio perfil
CREATE POLICY "community_insert_own_profile"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 5. UPDATE: Usuário só edita o próprio perfil
CREATE POLICY "community_update_own_profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- =================================================================
-- 6. FIX: Algoritmo de espiral agora PULA as rodovias e zona do shopping
-- =================================================================
CREATE OR REPLACE FUNCTION public.assign_grid_position()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  x INT := 2;
  y INT := 2;
  dx INT := 0;
  dy INT := -1;
  temp INT;
  is_occupied BOOLEAN;
  max_attempts INT := 500;
  attempt INT := 0;
BEGIN
  IF NEW.pos_x IS NULL OR NEW.pos_y IS NULL THEN
    LOOP
      attempt := attempt + 1;
      IF attempt > max_attempts THEN
        NEW.pos_x := attempt;
        NEW.pos_y := attempt;
        EXIT;
      END IF;

      -- PULA posições inválidas: rodovias (x=0 ou y=0) e zona do shopping (|x|<=1 e |y|<=1)
      IF x = 0 OR y = 0 OR (abs(x) <= 1 AND abs(y) <= 1) THEN
        -- Avança espiral sem alocar
        IF (x = y) OR (x < 0 AND x = -y) OR (x > 0 AND x = 1 - y) THEN
          temp := dx;
          dx := -dy;
          dy := temp;
        END IF;
        x := x + dx;
        y := y + dy;
        CONTINUE;
      END IF;

      -- Verifica se já tem alguém nessa posição
      SELECT EXISTS(SELECT 1 FROM public.profiles WHERE pos_x = x AND pos_y = y AND id != NEW.id) INTO is_occupied;
      IF NOT is_occupied THEN
        NEW.pos_x := x;
        NEW.pos_y := y;
        EXIT;
      END IF;

      -- Avança espiral
      IF (x = y) OR (x < 0 AND x = -y) OR (x > 0 AND x = 1 - y) THEN
        temp := dx;
        dx := -dy;
        dy := temp;
      END IF;
      x := x + dx;
      y := y + dy;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$;
