import React, { useState, useEffect } from 'react';
import { X, Save, Loader2, Plus, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface EditProfileModalProps {
  onClose: () => void;
  onSaved: () => void;
}

const EditProfileModal: React.FC<EditProfileModalProps> = ({ onClose, onSaved }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    nome: '',
    bio: '',
    foto_url: '',
    link1: '',
    link2: '',
    habilidades: [] as string[],
    servicos: [] as string[]
  });

  const [newHab, setNewHab] = useState('');
  const [newServ, setNewServ] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (data) {
        const profile = data as any;
        setFormData({
          nome: profile.display_name || profile.nome || '',
          bio: profile.bio || '',
          foto_url: profile.avatar_url || profile.foto_url || '',
          link1: profile.link1 || '',
          link2: profile.link2 || '',
          habilidades: Array.isArray(profile.habilidades) ? profile.habilidades : [],
          servicos: Array.isArray(profile.servicos) ? profile.servicos : []
        });
      }
      setLoading(false);
    };
    fetchProfile();
  }, [user]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    
    setUploadingAvatar(true);
    const fileExt = file.name.split('.').pop();
    const filePath = `${user.id}-${Math.random()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      toast({ title: 'Erro na Imagem', description: 'Por favor, crie o bucket \'avatars\' no Supabase primeiro!', variant: 'destructive' });
      setUploadingAvatar(false);
      return;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('avatars')
      .getPublicUrl(filePath);

    setFormData(prev => ({ ...prev, foto_url: publicUrl }));
    setUploadingAvatar(false);
  };

  const handleSave = async () => {
    if (!user) return;
    const { error } = await supabase
      .from('profiles')
      .update({
        display_name: formData.nome,
        bio: formData.bio,
        avatar_url: formData.foto_url,
        link1: formData.link1,
        link2: formData.link2,
        habilidades: formData.habilidades,
        servicos: formData.servicos
      })
      .eq('user_id', user.id);

    setSaving(false);
    if (error) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Sucesso', description: 'Seu prédio foi atualizado no mapa!' });
      onSaved();
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm pointer-events-auto">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md shadow-2xl pointer-events-auto overflow-y-auto pt-20 pb-20">
      <div className="bg-[#0a0a0c] border border-white/10 p-6 rounded-2xl w-full max-w-md flex flex-col animate-in zoom-in-95 duration-200 shadow-2xl relative">
        <button onClick={onClose} className="absolute top-4 right-4 p-1.5 bg-white/5 rounded-full text-muted-foreground hover:text-white transition-colors">
          <X className="w-4 h-4" />
        </button>

        <h2 className="text-xl font-bold text-white mb-6 border-b border-white/5 pb-4">
          Editar Meu Prédio
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Nome de Exibição</label>
            <input type="text" value={formData.nome} onChange={e => setFormData({ ...formData, nome: e.target.value })} className="w-full bg-[#111113] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-primary outline-none" placeholder="Seu nome ou marca" />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Foto do Perfil</label>
            <div className="flex items-center gap-3">
              <input 
                type="file" 
                accept="image/*" 
                onChange={handleAvatarUpload}
                disabled={uploadingAvatar}
                className="flex-1 bg-[#111113] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-primary outline-none file:mr-4 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-[10px] file:bg-primary/20 file:text-primary hover:file:bg-primary/30"
              />
              {uploadingAvatar && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
            </div>
            {formData.foto_url && <p className="text-[10px] text-green-400 mt-1">✓ Imagem salva com sucesso!</p>}
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Sua Biografia</label>
            <textarea value={formData.bio} onChange={e => setFormData({ ...formData, bio: e.target.value })} className="w-full bg-[#111113] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-primary outline-none resize-none h-20" placeholder="Escreva sobre você..." />
          </div>

          {/* Habilidades */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Habilidades (Pressione Enter para adicionar)</label>
            <div className="flex gap-2">
              <input 
                type="text" value={newHab} onChange={e => setNewHab(e.target.value)} 
                onKeyDown={e => {
                  if (e.key === 'Enter' && newHab.trim()) {
                    setFormData({ ...formData, habilidades: [...formData.habilidades, newHab.trim()] });
                    setNewHab('');
                  }
                }}
                className="flex-1 bg-[#111113] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-primary outline-none"
                placeholder="Ex: Edição de Vídeo"
              />
              <button onClick={() => { if (newHab.trim()) { setFormData({ ...formData, habilidades: [...formData.habilidades, newHab.trim()] }); setNewHab(''); } }} className="p-2 bg-primary/20 text-primary rounded-lg hover:bg-primary/30">
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {formData.habilidades.map((hab, i) => (
                <span key={i} className="flex items-center gap-1 bg-white/5 border border-white/10 px-2 py-1 rounded-md text-[10px] text-white">
                  {hab}
                  <button onClick={() => setFormData({ ...formData, habilidades: formData.habilidades.filter((_, idx) => idx !== i) })} className="text-red-400 hover:text-red-300 ml-1">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Serviços */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Serviços Prestados</label>
            <div className="flex gap-2">
              <input 
                type="text" value={newServ} onChange={e => setNewServ(e.target.value)} 
                onKeyDown={e => {
                  if (e.key === 'Enter' && newServ.trim()) {
                    setFormData({ ...formData, servicos: [...formData.servicos, newServ.trim()] });
                    setNewServ('');
                  }
                }}
                className="flex-1 bg-[#111113] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-primary outline-none"
                placeholder="Ex: Roteiros"
              />
              <button onClick={() => { if (newServ.trim()) { setFormData({ ...formData, servicos: [...formData.servicos, newServ.trim()] }); setNewServ(''); } }} className="p-2 bg-primary/20 text-primary rounded-lg hover:bg-primary/30">
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {formData.servicos.map((serv, i) => (
                <span key={i} className="flex items-center gap-1 bg-white/5 border border-white/10 px-2 py-1 rounded-md text-[10px] text-white">
                  {serv}
                  <button onClick={() => setFormData({ ...formData, servicos: formData.servicos.filter((_, idx) => idx !== i) })} className="text-red-400 hover:text-red-300 ml-1">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Links */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Link do Portfólio</label>
            <input type="text" value={formData.link1} onChange={e => setFormData({ ...formData, link1: e.target.value })} className="w-full bg-[#111113] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-primary outline-none" placeholder="https://..." />
          </div>
          
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Link Social (Instagram/Outro)</label>
            <input type="text" value={formData.link2} onChange={e => setFormData({ ...formData, link2: e.target.value })} className="w-full bg-[#111113] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-primary outline-none" placeholder="https://..." />
          </div>

        </div>

        <button disabled={saving} onClick={handleSave} className="mt-6 w-full flex items-center justify-center gap-2 bg-[hsl(262,83%,58%)] hover:bg-[hsl(262,83%,50%)] text-white py-3 rounded-xl font-bold transition-all disabled:opacity-50 shadow-lg shadow-[hsl(262,83%,58%)]/20">
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
          Salvar Meu Prédio
        </button>
      </div>
    </div>
  );
};

export default EditProfileModal;
