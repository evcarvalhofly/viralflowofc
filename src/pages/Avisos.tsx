import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Bell, Image, Send, Trash2, X } from 'lucide-react';

interface Aviso {
  id: string;
  content: string;
  image_url: string | null;
  created_at: string;
}

const ADMIN_EMAIL = 'evcarvalhodev@gmail.com';

const Avisos = () => {
  const { user } = useAuth();
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isAdmin = user?.email === ADMIN_EMAIL;

  const loadAvisos = async () => {
    const db = supabase as any;
    const { data, error } = await db
      .from('avisos')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error && data) setAvisos(data);
    setLoading(false);
  };

  useEffect(() => {
    loadAvisos();

    const db = supabase as any;
    const channel = db
      .channel('avisos_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'avisos' }, () => { loadAvisos(); })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSend = async () => {
    if (!content.trim() && !imageFile) {
      toast.error('Escreva algo ou adicione uma imagem!');
      return;
    }
    if (!user) return;
    setSending(true);

    let imageUrl: string | null = null;

    if (imageFile) {
      const ext = imageFile.name.split('.').pop();
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('avisos')
        .upload(path, imageFile);

      if (uploadError) {
        toast.error('Erro ao fazer upload da imagem');
        setSending(false);
        return;
      }

      const { data: urlData } = supabase.storage.from('avisos').getPublicUrl(path);
      imageUrl = urlData.publicUrl;
    }

    const db = supabase as any;
    const { error } = await db.from('avisos').insert({
      user_id: user.id,
      content: content.trim(),
      image_url: imageUrl,
    });

    if (error) {
      toast.error('Erro ao publicar aviso');
    } else {
      toast.success('Aviso publicado! 📢');
      setContent('');
      removeImage();
      loadAvisos();
    }
    setSending(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja excluir este aviso?')) return;
    const db = supabase as any;
    const { error } = await db.from('avisos').delete().eq('id', id);
    if (error) toast.error('Erro ao excluir');
    else {
      toast.success('Aviso excluído');
      setAvisos(a => a.filter(av => av.id !== id));
    }
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-2xl gradient-viral flex items-center justify-center shadow-lg shadow-primary/20">
            <Bell className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-display text-foreground">Avisos</h1>
            <p className="text-sm text-muted-foreground">Novidades e atualizações do ViralFlow</p>
          </div>
        </div>

        {/* Admin Post Box */}
        {isAdmin && (
          <div className="mb-8 p-5 rounded-2xl border border-primary/30 bg-primary/5 shadow-lg">
            <p className="text-xs font-bold text-primary uppercase tracking-widest mb-3 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse inline-block" />
              Painel Admin — Novo Aviso
            </p>
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="Escreva o aviso para a comunidade..."
              rows={4}
              className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary/50 mb-3"
            />

            {imagePreview && (
              <div className="relative mb-3 inline-block">
                <img src={imagePreview} alt="Preview" className="max-h-48 rounded-xl border border-border" />
                <button
                  onClick={removeImage}
                  className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-destructive text-white flex items-center justify-center shadow"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}

            <div className="flex items-center gap-2">
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground text-sm transition-colors"
              >
                <Image className="w-4 h-4" /> Imagem
              </button>
              <button
                onClick={handleSend}
                disabled={sending || (!content.trim() && !imageFile)}
                className="ml-auto flex items-center gap-1.5 px-4 py-2 rounded-xl gradient-viral text-white text-sm font-bold shadow shadow-primary/30 hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-4 h-4" />
                {sending ? 'Publicando...' : 'Publicar'}
              </button>
            </div>
          </div>
        )}

        {/* List */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="p-5 rounded-2xl border border-border bg-card animate-pulse">
                <div className="h-3 bg-muted rounded w-1/4 mb-3" />
                <div className="h-4 bg-muted rounded w-full mb-2" />
                <div className="h-4 bg-muted rounded w-3/4" />
              </div>
            ))}
          </div>
        ) : avisos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Bell className="h-16 w-16 text-muted-foreground/20 mb-4" />
            <p className="text-muted-foreground font-medium">Nenhum aviso ainda.</p>
            <p className="text-sm text-muted-foreground/70 mt-1">Fique de olho — novidades chegam em breve!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {avisos.map(aviso => (
              <div key={aviso.id} className="group p-5 rounded-2xl border border-border bg-card hover:border-primary/30 transition-all duration-200 shadow-sm hover:shadow-md hover:shadow-primary/5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full gradient-viral flex items-center justify-center shadow">
                      <Bell className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-primary">ViralFlow</p>
                      <p className="text-[10px] text-muted-foreground">{formatDate(aviso.created_at)}</p>
                    </div>
                  </div>
                  {isAdmin && (
                    <button
                      onClick={() => handleDelete(aviso.id)}
                      className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive hover:text-white transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {aviso.content && (
                  <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap mb-3">
                    {aviso.content.split(/(https?:\/\/[^\s]+)/g).map((part, i) =>
                      /^https?:\/\//.test(part)
                        ? <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-primary underline break-all hover:opacity-80">{part}</a>
                        : part
                    )}
                  </p>
                )}

                {aviso.image_url && (
                  <img
                    src={aviso.image_url}
                    alt="Imagem do aviso"
                    className="w-full rounded-xl border border-border max-h-80 object-cover"
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Avisos;
