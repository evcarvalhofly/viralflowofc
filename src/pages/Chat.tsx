import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  Send, Loader2, Bot, User, Sparkles, ClipboardList,
  Trash2, Youtube, Instagram, Zap, CheckCircle2, AlertCircle, ArrowRight
} from "lucide-react";
import { useNavigate } from "react-router-dom";

type Msg = { role: "user" | "assistant"; content: string };

type ConnectedAccount = {
  platform: "YouTube" | "TikTok" | "Instagram";
  handle: string;
};

type ChatPhase = "welcome" | "connect" | "analyzing" | "conversation" | "ready";

const FUNCTIONS_URL = "https://dzgotqyikomtapcgdgff.supabase.co/functions/v1";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR6Z290cXlpa29tdGFwY2dkZ2ZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzExNzUxNDMsImV4cCI6MjA4Njc1MTE0M30.cTBDE0bCC6j4j2Pw0QRac220oqgQkAcYbMaJ3zyrmbY";

const SYSTEM_PROMPT = `Você é o ViralFlow AI, um estrategista de conteúdo viral especializado no Brasil.

CONTEXTO: O usuário já conectou suas redes sociais e você já tem os dados das contas dele. Você está em modo de conversa estratégica.

Seu comportamento:
- Respostas CURTAS (2-4 frases), como num chat entre amigos
- Use emojis com moderação
- NÃO crie listas ou planos no chat

Fluxo da conversa (siga EXATAMENTE esta ordem):
1. Pergunte sobre o OBJETIVO principal: conseguir mais seguidores, ser reconhecido como autoridade, usar o perfil para vender produtos/serviços, ou outro objetivo
2. Depois pergunte QUANTOS VÍDEOS por semana o usuário consegue produzir
3. Após receber as respostas, diga que já tem tudo que precisa e inclua a tag [PLAN_READY] no final

REGRAS:
- Faça APENAS UMA pergunta por vez
- Quando tiver: objetivo + frequência semanal → inclua [PLAN_READY]
- NÃO pergunte sobre nicho, plataformas ou outros detalhes (você já tem esses dados das métricas)
- Sempre responda em português do Brasil`;

async function streamChat({
  messages,
  accountsContext,
  onDelta,
  onDone,
}: {
  messages: Msg[];
  accountsContext?: any;
  onDelta: (text: string) => void;
  onDone: () => void;
}) {
  const systemWithContext = accountsContext
    ? SYSTEM_PROMPT + `\n\nDados das contas conectadas:\n${JSON.stringify(accountsContext, null, 2)}`
    : SYSTEM_PROMPT;

  const resp = await fetch(`${FUNCTIONS_URL}/chat-ai`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ANON_KEY}`,
    },
    body: JSON.stringify({
      messages,
      system_override: systemWithContext,
    }),
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

// ── Platform icons ──────────────────────────────────────────────────────────

const TikTokIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
    <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.78 1.52V6.75a4.85 4.85 0 01-1.01-.06z" />
  </svg>
);

// ── Platform connection step ─────────────────────────────────────────────────

const PLATFORMS: { id: "YouTube" | "TikTok" | "Instagram"; label: string; icon: React.ReactNode; placeholder: string; color: string }[] = [
  { id: "YouTube", label: "YouTube", icon: <Youtube className="h-5 w-5" />, placeholder: "@seucanal ou nome do canal", color: "text-red-500" },
  { id: "TikTok", label: "TikTok", icon: <TikTokIcon />, placeholder: "@seutiktok", color: "text-foreground" },
  { id: "Instagram", label: "Instagram", icon: <Instagram className="h-5 w-5" />, placeholder: "@seuinstagram", color: "text-pink-500" },
];

// ── Main component ───────────────────────────────────────────────────────────

const Chat = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [phase, setPhase] = useState<ChatPhase>("welcome");
  const [handles, setHandles] = useState<Record<string, string>>({ YouTube: "", TikTok: "", Instagram: "" });
  const [connectedAccounts, setConnectedAccounts] = useState<ConnectedAccount[]>([]);
  const [accountsContext, setAccountsContext] = useState<any>(null);

  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const atLeastOneHandle = Object.values(handles).some(h => h.trim().length > 0);

  const handleConnect = async () => {
    const accounts: ConnectedAccount[] = PLATFORMS
      .filter(p => handles[p.id].trim())
      .map(p => ({ platform: p.id, handle: handles[p.id].trim() }));

    if (accounts.length === 0) {
      toast({ title: "Conecte pelo menos uma rede social", variant: "destructive" });
      return;
    }

    setConnectedAccounts(accounts);
    setPhase("analyzing");

    try {
      const resp = await fetch(`${FUNCTIONS_URL}/analyze-accounts`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${ANON_KEY}` },
        body: JSON.stringify({ accounts }),
      });
      const data = await resp.json();

      if (!resp.ok) throw new Error(data.error || "Erro ao analisar contas");

      setAccountsContext(data);

      // Start conversation with AI summary
      const summaryMsg: Msg = { role: "assistant", content: data.summary };
      setMessages([summaryMsg]);

      // Save to DB
      if (user) {
        await supabase.from("chat_messages").delete().eq("user_id", user.id);
        await supabase.from("chat_messages").insert({ user_id: user.id, role: "assistant", content: data.summary });
      }

      setPhase("conversation");

      // Trigger AI first question
      let firstQ = "";
      const upsert = (chunk: string) => {
        firstQ += chunk;
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant" && last.content === data.summary) {
            // Don't merge — append new
            if (prev.length > 0 && prev[prev.length - 1].content === firstQ) {
              return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: firstQ } : m);
            }
            return [...prev, { role: "assistant", content: firstQ }];
          }
          if (last?.role === "assistant" && prev.length > 1) {
            return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: firstQ } : m);
          }
          return [...prev, { role: "assistant", content: firstQ }];
        });
      };

      await streamChat({
        messages: [summaryMsg],
        accountsContext: data,
        onDelta: upsert,
        onDone: async () => {
          if (firstQ && user) {
            await supabase.from("chat_messages").insert({ user_id: user.id, role: "assistant", content: firstQ });
          }
          if (firstQ.includes("[PLAN_READY]")) setPhase("ready");
        },
      });
    } catch (e: any) {
      toast({ title: "Erro ao analisar contas", description: e.message, variant: "destructive" });
      setPhase("connect");
    }
  };

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
        accountsContext,
        onDelta: upsertAssistant,
        onDone: async () => {
          setIsLoading(false);
          if (assistantSoFar) {
            await supabase.from("chat_messages").insert({
              user_id: user!.id,
              role: "assistant",
              content: assistantSoFar,
            });
            if (assistantSoFar.includes("[PLAN_READY]")) setPhase("ready");
          }
        },
      });
    } catch (e: any) {
      setIsLoading(false);
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  const generatePlan = async () => {
    if (!user) return;
    setIsGeneratingPlan(true);

    try {
      const resp = await fetch(`${FUNCTIONS_URL}/generate-plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${ANON_KEY}` },
        body: JSON.stringify({ messages, user_id: user.id, accounts_context: accountsContext }),
      });

      const data = await resp.json();

      if (resp.status === 409) {
        // Incomplete plan
        toast({
          title: "📋 Planejamento em andamento",
          description: data.message || "Conclua o seu planejamento atual para criar outro",
          variant: "destructive",
        });
        navigate("/planning");
        return;
      }

      if (!resp.ok || !data.success) {
        throw new Error(data.error || "Erro ao gerar plano");
      }

      toast({
        title: "🚀 Planejamento criado!",
        description: `"${data.plan.title}" com ${data.plan.items_count} ideias de conteúdo!`,
      });

      navigate("/planning");
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setIsGeneratingPlan(false);
    }
  };

  const clearAndRestart = async () => {
    if (!user) return;
    await supabase.from("chat_messages").delete().eq("user_id", user.id);
    setMessages([]);
    setPhase("welcome");
    setHandles({ YouTube: "", TikTok: "", Instagram: "" });
    setConnectedAccounts([]);
    setAccountsContext(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  // ── WELCOME SCREEN ─────────────────────────────────────────────────────────
  if (phase === "welcome") {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-3.5rem)] md:h-screen p-6 text-center">
        <div className="max-w-md space-y-6">
          <div className="w-20 h-20 rounded-full gradient-viral flex items-center justify-center mx-auto">
            <Sparkles className="h-10 w-10 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-3xl font-bold font-display mb-2">ViralFlow IA</h1>
            <p className="text-muted-foreground">
              Conecte suas redes sociais e eu analiso suas métricas para criar um planejamento de conteúdo viral personalizado 🚀
            </p>
          </div>
          <Button
            onClick={() => setPhase("connect")}
            className="gradient-viral w-full h-12 text-base font-semibold"
          >
            Começar
            <ArrowRight className="h-5 w-5 ml-2" />
          </Button>
        </div>
      </div>
    );
  }

  // ── CONNECT SCREEN ─────────────────────────────────────────────────────────
  if (phase === "connect") {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-3.5rem)] md:h-screen p-6">
        <div className="max-w-md w-full space-y-6">
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-bold font-display">Conecte suas contas</h2>
            <p className="text-muted-foreground text-sm">
              Conecte na plataforma que você posta para que possamos criar o melhor planejamento viral para você
            </p>
          </div>

          <div className="space-y-3">
            {PLATFORMS.map((p) => (
              <div key={p.id} className="flex items-center gap-3 bg-card border border-border rounded-xl p-3">
                <span className={p.color}>{p.icon}</span>
                <span className="font-medium text-sm w-20 shrink-0">{p.label}</span>
                <Input
                  value={handles[p.id]}
                  onChange={e => setHandles(prev => ({ ...prev, [p.id]: e.target.value }))}
                  placeholder={p.placeholder}
                  className="h-9 text-sm border-0 bg-transparent focus-visible:ring-0 px-0"
                />
                {handles[p.id].trim() && (
                  <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                )}
              </div>
            ))}
          </div>

          {!atLeastOneHandle && (
            <div className="flex items-center gap-2 text-muted-foreground text-xs bg-muted/50 rounded-lg p-3">
              <AlertCircle className="h-4 w-4 shrink-0" />
              Conecte pelo menos uma rede social para continuar
            </div>
          )}

          <Button
            onClick={handleConnect}
            disabled={!atLeastOneHandle}
            className="gradient-viral w-full h-12 text-base font-semibold"
          >
            Analisar minhas contas
            <Zap className="h-5 w-5 ml-2" />
          </Button>

          <button
            onClick={() => setPhase("welcome")}
            className="text-xs text-muted-foreground hover:text-foreground w-full text-center transition-colors"
          >
            ← Voltar
          </button>
        </div>
      </div>
    );
  }

  // ── ANALYZING SCREEN ───────────────────────────────────────────────────────
  if (phase === "analyzing") {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-3.5rem)] md:h-screen p-6 text-center">
        <div className="space-y-4">
          <div className="w-16 h-16 rounded-full gradient-viral flex items-center justify-center mx-auto animate-pulse">
            <Zap className="h-8 w-8 text-primary-foreground" />
          </div>
          <div>
            <h2 className="text-xl font-bold font-display mb-1">Analisando suas contas...</h2>
            <p className="text-muted-foreground text-sm">
              Estou analisando seus dados para criar a melhor estratégia 🔍
            </p>
          </div>
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            {connectedAccounts.map(a => (
              <span key={a.platform} className="bg-card border border-border rounded-full px-3 py-1 text-xs">
                {a.platform}: {a.handle}
              </span>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── CONVERSATION + READY ───────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] md:h-screen">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card/50">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {connectedAccounts.map(a => (
            <span key={a.platform} className="bg-muted rounded-full px-2 py-0.5">
              {a.platform}
            </span>
          ))}
        </div>
        <Button variant="ghost" size="sm" onClick={clearAndRestart} className="text-muted-foreground hover:text-destructive text-xs">
          <Trash2 className="h-3 w-3 mr-1" />
          Recomeçar
        </Button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
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
      {phase === "ready" && !isLoading && (
        <div className="px-4 pb-3">
          <Button
            onClick={generatePlan}
            disabled={isGeneratingPlan}
            className="gradient-viral w-full h-12 text-base font-semibold"
          >
            {isGeneratingPlan ? (
              <><Loader2 className="h-5 w-5 mr-2 animate-spin" />Gerando planejamento...</>
            ) : (
              <><ClipboardList className="h-5 w-5 mr-2" />Gerar Planejamento</>
            )}
          </Button>
        </div>
      )}

      {/* Input — hidden when plan is ready */}
      {phase !== "ready" && (
        <div className="border-t border-border bg-card/50 backdrop-blur-sm p-4">
          <div className="flex gap-2 max-w-3xl mx-auto">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Responda aqui..."
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
      )}
    </div>
  );
};

export default Chat;
