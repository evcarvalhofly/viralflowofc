import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Send, Loader2, Bot, User, Sparkles, ClipboardList, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

type Msg = { role: "user" | "assistant"; content: string };

const FUNCTIONS_URL = "https://dzgotqyikomtapcgdgff.supabase.co/functions/v1";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR6Z290cXlpa29tdGFwY2dkZ2ZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzExNzUxNDMsImV4cCI6MjA4Njc1MTE0M30.cTBDE0bCC6j4j2Pw0QRac220oqgQkAcYbMaJ3zyrmbY";

async function streamChat({
  messages,
  onDelta,
  onDone,
}: {
  messages: Msg[];
  onDelta: (text: string) => void;
  onDone: () => void;
}) {
  const resp = await fetch(`${FUNCTIONS_URL}/chat-ai`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ANON_KEY}`,
    },
    body: JSON.stringify({ messages }),
  });

  if (!resp.ok || !resp.body) {
    const errorData = await resp.json().catch(() => ({}));
    throw new Error(errorData.error || `Erro ${resp.status}`);
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let textBuffer = "";
  let streamDone = false;

  while (!streamDone) {
    const { done, value } = await reader.read();
    if (done) break;
    textBuffer += decoder.decode(value, { stream: true });

    let newlineIndex: number;
    while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
      let line = textBuffer.slice(0, newlineIndex);
      textBuffer = textBuffer.slice(newlineIndex + 1);
      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (line.startsWith(":") || line.trim() === "") continue;
      if (!line.startsWith("data: ")) continue;
      const jsonStr = line.slice(6).trim();
      if (jsonStr === "[DONE]") { streamDone = true; break; }
      try {
        const parsed = JSON.parse(jsonStr);
        const content = parsed.choices?.[0]?.delta?.content as string | undefined;
        if (content) onDelta(content);
      } catch {
        textBuffer = line + "\n" + textBuffer;
        break;
      }
    }
  }

  if (textBuffer.trim()) {
    for (let raw of textBuffer.split("\n")) {
      if (!raw) continue;
      if (raw.endsWith("\r")) raw = raw.slice(0, -1);
      if (raw.startsWith(":") || raw.trim() === "") continue;
      if (!raw.startsWith("data: ")) continue;
      const jsonStr = raw.slice(6).trim();
      if (jsonStr === "[DONE]") continue;
      try {
        const parsed = JSON.parse(jsonStr);
        const content = parsed.choices?.[0]?.delta?.content as string | undefined;
        if (content) onDelta(content);
      } catch {}
    }
  }
  onDone();
}

const Chat = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await supabase
        .from("chat_messages")
        .select("role, content")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true })
        .limit(100);
      if (data) setMessages(data.map(m => ({ role: m.role as "user" | "assistant", content: m.content })));
      setLoadingHistory(false);
    };
    load();
  }, [user]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    if (!input.trim() || !user || isLoading) return;
    const text = input.trim();
    setInput("");

    const userMsg: Msg = { role: "user", content: text };
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    await supabase.from("chat_messages").insert({ user_id: user.id, role: "user", content: text });

    let assistantSoFar = "";
    const upsertAssistant = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") {
          return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
        }
        return [...prev, { role: "assistant", content: assistantSoFar }];
      });
    };

    try {
      await streamChat({
        messages: [...messages, userMsg],
        onDelta: upsertAssistant,
        onDone: async () => {
          setIsLoading(false);
          if (assistantSoFar) {
            await supabase.from("chat_messages").insert({
              user_id: user!.id,
              role: "assistant",
              content: assistantSoFar,
            });
          }
        },
      });
    } catch (e: any) {
      setIsLoading(false);
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  const generatePlan = async () => {
    if (!user || messages.length < 2) return;
    setIsGeneratingPlan(true);

    try {
      const resp = await fetch(`${FUNCTIONS_URL}/generate-plan`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ANON_KEY}`,
        },
        body: JSON.stringify({ messages, user_id: user.id }),
      });

      const data = await resp.json();

      // Handle active plan restriction
      if (resp.status === 409 && data.error === "active_plan_exists") {
        const blockMsg: Msg = {
          role: "assistant",
          content: `⚠️ ${data.message}\n\nAcesse a aba **Planejamento** para ver seu plano atual e marcar os itens como concluídos!`,
        };
        setMessages(prev => [...prev, blockMsg]);
        await supabase.from("chat_messages").insert({
          user_id: user.id,
          role: "assistant",
          content: blockMsg.content,
        });
        return;
      }

      if (!resp.ok || !data.success) {
        throw new Error(data.error || "Erro ao gerar plano");
      }

      toast({
        title: "📋 Plano semanal criado!",
        description: `"${data.plan.title}" com ${data.plan.items_count} vídeos foi adicionado ao seu Planejamento.`,
      });

      const planMsg: Msg = {
        role: "assistant",
        content: `✅ Plano semanal criado com sucesso!\n\n📋 **${data.plan.title}** com ${data.plan.items_count} vídeos foi adicionado ao seu Planejamento.\n\nRedirecionando para o Planejamento...`,
      };
      setMessages(prev => [...prev, planMsg]);
      await supabase.from("chat_messages").insert({
        user_id: user.id,
        role: "assistant",
        content: planMsg.content,
      });

      // Redirect to planning after a short delay
      setTimeout(() => navigate("/planning"), 1500);
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setIsGeneratingPlan(false);
    }
  };

  const clearChat = async () => {
    if (!user) return;
    await supabase.from("chat_messages").delete().eq("user_id", user.id);
    setMessages([]);
    toast({ title: "Chat limpo", description: "Conversa reiniciada com sucesso!" });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  if (loadingHistory) {
    return (
      <div className="flex items-center justify-center h-full min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const hasEnoughContext = messages.some(m => m.role === "assistant" && m.content.includes("[PLAN_READY]"));

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] md:h-screen">
      {/* Header */}
      {messages.length > 0 && (
        <div className="flex justify-end p-2 border-b border-border">
          <Button variant="ghost" size="sm" onClick={clearChat} className="text-muted-foreground hover:text-destructive">
            <Trash2 className="h-4 w-4 mr-1" />
            Limpar chat
          </Button>
        </div>
      )}
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-4 text-muted-foreground">
            <Sparkles className="h-12 w-12 text-primary/40" />
            <div>
              <h2 className="text-xl font-bold font-display text-foreground mb-1">ViralFlow IA</h2>
              <p className="text-sm max-w-md">
                Me conte sobre seu nicho e objetivos como criador. Com base na nossa conversa, vou gerar um plano de criação personalizado! 🚀
              </p>
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            {msg.role === "assistant" && (
              <div className="shrink-0 w-8 h-8 rounded-full gradient-viral flex items-center justify-center">
                <Bot className="h-4 w-4 text-primary-foreground" />
              </div>
            )}
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground rounded-br-md"
                  : "bg-card border border-border rounded-bl-md"
              }`}
            >
              {msg.content.replace("[PLAN_READY]", "").trim()}
            </div>
            {msg.role === "user" && (
              <div className="shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                <User className="h-4 w-4 text-muted-foreground" />
              </div>
            )}
          </div>
        ))}

        {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
          <div className="flex gap-3">
            <div className="shrink-0 w-8 h-8 rounded-full gradient-viral flex items-center justify-center">
              <Bot className="h-4 w-4 text-primary-foreground" />
            </div>
            <div className="bg-card border border-border rounded-2xl rounded-bl-md px-4 py-3">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Generate Plan Button */}
      {hasEnoughContext && !isLoading && (
        <div className="px-4 pb-2 flex justify-center">
          <Button
            onClick={generatePlan}
            disabled={isGeneratingPlan}
            variant="outline"
            className="border-primary/30 text-primary hover:bg-primary/10"
          >
            {isGeneratingPlan ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Gerando plano...</>
            ) : (
              <><ClipboardList className="h-4 w-4 mr-2" />Gerar Plano de Criação</>
            )}
          </Button>
        </div>
      )}

      {/* Input */}
      <div className="border-t border-border bg-card/50 backdrop-blur-sm p-4">
        <div className="flex gap-2 max-w-3xl mx-auto">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Conte seus objetivos, nicho, ou peça sugestões de conteúdo..."
            className="min-h-[44px] max-h-32 resize-none"
            rows={1}
          />
          <Button
            onClick={send}
            disabled={!input.trim() || isLoading}
            className="gradient-viral shrink-0 h-11 w-11 p-0"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Chat;
