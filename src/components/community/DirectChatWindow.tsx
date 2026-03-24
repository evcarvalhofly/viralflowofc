import { useState, useEffect, useRef } from 'react';
import { X, Send, MessageCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
  read_at: string | null;
}

interface DirectChatWindowProps {
  peerId: string;          // auth.users UUID do outro usuário
  peerName: string;
  peerAvatar?: string | null;
  onClose: () => void;
}

const DirectChatWindow = ({ peerId, peerName, peerAvatar, onClose }: DirectChatWindowProps) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadMessages = async () => {
    if (!user) return;
    const db = supabase as any;
    const { data } = await db
      .from('direct_messages')
      .select('*')
      .or(
        `and(sender_id.eq.${user.id},receiver_id.eq.${peerId}),and(sender_id.eq.${peerId},receiver_id.eq.${user.id})`
      )
      .order('created_at', { ascending: true });

    if (data) setMessages(data);

    // Mark received messages as read
    await db
      .from('direct_messages')
      .update({ read_at: new Date().toISOString() })
      .eq('receiver_id', user.id)
      .eq('sender_id', peerId)
      .is('read_at', null);
  };

  useEffect(() => {
    loadMessages();

    const db = supabase as any;
    const channel = db
      .channel(`chat_${user?.id}_${peerId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'direct_messages' }, (payload: any) => {
        const msg = payload.new;
        if (
          (msg.sender_id === user?.id && msg.receiver_id === peerId) ||
          (msg.sender_id === peerId && msg.receiver_id === user?.id)
        ) {
          setMessages(prev => {
            // Remove optimistic duplicate and add real message
            const filtered = prev.filter(m => !m.id.startsWith('temp_') || m.sender_id !== msg.sender_id || m.content !== msg.content);
            if (filtered.some(m => m.id === msg.id)) return filtered;
            return [...filtered, msg];
          });
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [peerId, user?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || !user) return;
    setSending(true);
    const text = input.trim();
    setInput('');

    // Optimistic update
    const tempId = `temp_${Date.now()}`;
    const optimistic: Message = {
      id: tempId,
      sender_id: user.id,
      receiver_id: peerId,
      content: text,
      created_at: new Date().toISOString(),
      read_at: null,
    };
    setMessages(prev => [...prev, optimistic]);

    const db = supabase as any;
    const { error } = await db.from('direct_messages').insert({
      sender_id: user.id,
      receiver_id: peerId,
      content: text,
    });
    if (error) {
      toast.error('Erro ao enviar mensagem');
      setMessages(prev => prev.filter(m => m.id !== tempId));
      setInput(text);
    }
    setSending(false);
  };

  const formatTime = (iso: string) => {
    return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="fixed bottom-4 right-4 z-[60] w-80 flex flex-col rounded-2xl border border-border bg-card shadow-2xl shadow-black/40 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border bg-muted/30">
        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center overflow-hidden shrink-0">
          {peerAvatar ? (
            <img src={peerAvatar} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="text-xs font-bold text-primary">{peerName[0]?.toUpperCase()}</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{peerName}</p>
          <div className="flex items-center gap-1">
            <MessageCircle className="w-3 h-3 text-primary" />
            <p className="text-[10px] text-muted-foreground">Mensagem direta</p>
          </div>
        </div>
        <button onClick={onClose} className="p-1 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 max-h-72 min-h-[180px]">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full py-8">
            <p className="text-xs text-muted-foreground text-center">Nenhuma mensagem ainda.<br />Diga olá! 👋</p>
          </div>
        )}
        {messages.map(msg => {
          const isMe = msg.sender_id === user?.id;
          return (
            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm break-words ${
                isMe
                  ? 'bg-primary text-primary-foreground rounded-br-sm'
                  : 'bg-muted text-foreground rounded-bl-sm'
              }`}>
                <p className="leading-snug">{msg.content}</p>
                <p className={`text-[9px] mt-1 ${isMe ? 'text-primary-foreground/60 text-right' : 'text-muted-foreground'}`}>
                  {formatTime(msg.created_at)}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-t border-border">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
          placeholder="Digite uma mensagem..."
          className="flex-1 bg-muted rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
        />
        <button
          onClick={handleSend}
          disabled={sending || !input.trim()}
          className="p-2 rounded-xl gradient-viral text-white shadow shadow-primary/30 hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default DirectChatWindow;
