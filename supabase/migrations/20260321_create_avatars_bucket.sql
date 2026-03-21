-- Cria o bucket de storage 'avatars' para fotos de perfil
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);

-- Permite upload por usuários autenticados
CREATE POLICY "Authenticated users can upload avatars"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars');

-- Permite leitura pública (fotos aparecem no mapa)
CREATE POLICY "Public can view avatars"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'avatars');

-- Permite atualização pelo próprio usuário
CREATE POLICY "Users can update their avatars"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars');
