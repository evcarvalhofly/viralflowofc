-- Adicionando campos à tabela `profiles`
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS habilidades JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS servicos JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS link1 TEXT,
ADD COLUMN IF NOT EXISTS link2 TEXT,
ADD COLUMN IF NOT EXISTS nivel INT DEFAULT 1,
ADD COLUMN IF NOT EXISTS pos_x INT,
ADD COLUMN IF NOT EXISTS pos_y INT,
ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT false;

-- Tabela de amizades
CREATE TABLE IF NOT EXISTS public.friendships (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  friend_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, friend_id)
);

ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own friendships"
ON public.friendships FOR SELECT TO authenticated
USING (auth.uid() = user_id OR auth.uid() = friend_id);

CREATE POLICY "Users can insert friendships"
ON public.friendships FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own friendships"
ON public.friendships FOR UPDATE TO authenticated
USING (auth.uid() = user_id OR auth.uid() = friend_id);

CREATE POLICY "Users can delete own friendships"
ON public.friendships FOR DELETE TO authenticated
USING (auth.uid() = user_id OR auth.uid() = friend_id);

-- Algoritmo de spiral para posições automaticamente sem colisão
CREATE OR REPLACE FUNCTION public.assign_grid_position()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  x INT := 0;
  y INT := 0;
  dx INT := 0;
  dy INT := -1;
  temp INT;
  is_occupied BOOLEAN;
BEGIN
  -- Apenas tenta alocar espaço se o registro ainda não tem x e y definidos
  IF NEW.pos_x IS NULL OR NEW.pos_y IS NULL THEN
    LOOP
      -- Verifica se (x,y) está ocupado na cidade principal
      SELECT EXISTS(SELECT 1 FROM public.profiles WHERE pos_x = x AND pos_y = y AND id != NEW.id) INTO is_occupied;
      IF NOT is_occupied THEN
        NEW.pos_x := x;
        NEW.pos_y := y;
        EXIT;
      END IF;

      -- Matemátca em espiral:
      -- if (x == y) or (x < 0 and x == -y) or (x > 0 and x == 1 - y)
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

-- Trigger para rodar ao inserir novos profiles
DROP TRIGGER IF EXISTS trigger_assign_grid_position ON public.profiles;
CREATE TRIGGER trigger_assign_grid_position
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.assign_grid_position();
