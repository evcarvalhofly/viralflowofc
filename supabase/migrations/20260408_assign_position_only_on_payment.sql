-- Corrige assign_grid_position para atribuir posição na cidade
-- SOMENTE quando o usuário tiver subscription_expires_at preenchido
-- (ou seja, após o primeiro pagamento confirmado).
-- Usuários free não ocupam espaço na grade, evitando buracos invisíveis.

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
  -- Só atribui posição se o usuário tem subscription_expires_at preenchido
  -- (já realizou pelo menos um pagamento)
  IF NEW.subscription_expires_at IS NULL THEN
    RETURN NEW;
  END IF;

  -- Já tem posição atribuída: não reatribui
  IF NEW.pos_x IS NOT NULL AND NEW.pos_y IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Algoritmo espiral: encontra a próxima posição livre
  LOOP
    SELECT EXISTS(
      SELECT 1 FROM public.profiles
      WHERE pos_x = x AND pos_y = y AND id != NEW.id
    ) INTO is_occupied;

    IF NOT is_occupied THEN
      NEW.pos_x := x;
      NEW.pos_y := y;
      EXIT;
    END IF;

    IF (x = y) OR (x < 0 AND x = -y) OR (x > 0 AND x = 1 - y) THEN
      temp := dx;
      dx := -dy;
      dy := temp;
    END IF;

    x := x + dx;
    y := y + dy;
  END LOOP;

  RETURN NEW;
END;
$$;
