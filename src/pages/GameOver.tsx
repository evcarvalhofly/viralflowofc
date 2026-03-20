import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Zap, Loader2, Mic, MicOff, Copy,
  Sparkles, CheckCircle2, Type
} from "lucide-react";
import { cn } from "@/lib/utils";

// Web Speech API Types
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

interface ViralResult {
  titulo: string;
  descricao: string;
  copy: string;
}

const GameOver = () => {
  const { toast } = useToast();
  const [text, setText] = useState("");
  const [interimText, setInterimText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ViralResult | null>(null);
  const [copiedStates, setCopiedStates] = useState<Record<string, boolean>>({});

  const recognitionRef = useRef<any>(null);

  // Initialize Speech Recognition
  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = "pt-BR";

        recognition.onresult = (event: any) => {
          let finalTranscript = "";
          let currentInterim = "";
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              finalTranscript += transcript + " ";
            } else {
              currentInterim += transcript;
            }
          }
          if (finalTranscript) {
            setText((prev) => prev + (prev.endsWith(" ") || prev.length === 0 ? "" : " ") + finalTranscript);
          }
          setInterimText(currentInterim);
        };

        recognition.onerror = (event: any) => {
          console.error("Speech recognition error", event.error);
          setIsRecording(false);
          setInterimText("");
        };

        recognition.onend = () => {
          setIsRecording(false);
          setInterimText("");
        };

        recognitionRef.current = recognition;
      }
    }
    
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  const toggleRecording = () => {
    if (!recognitionRef.current) {
      toast({
        title: "Microfone não suportado",
        description: "Seu navegador não suporta digitação por voz. Use o Chrome ou Safari no celular.",
        variant: "destructive",
      });
      return;
    }

    if (isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsRecording(true);
      } catch (e) {
        console.error(e);
      }
    }
  };

  const handleGenerate = async () => {
    if (!text.trim()) {
      toast({
        title: "Descrição vazia",
        description: "Digite ou fale o que acontece no vídeo.",
        variant: "destructive",
      });
      return;
    }
    
    setLoading(true);
    setResult(null);
    setCopiedStates({});

    if (isRecording && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsRecording(false);
    }

    try {
      const { data, error } = await supabase.functions.invoke("viral-copy-generator", {
        body: { text: text.trim() },
      });
      
      if (error) throw new Error(error.message);
      if (!data.success) throw new Error(data.error || "Erro ao gerar copy viral.");
      
      setResult(data.data);
    } catch (err: any) {
      toast({ title: "Erro ao gerar", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (content: string, key: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedStates((prev) => ({ ...prev, [key]: true }));
      toast({
        title: "Copiado! ✨",
        description: "Texto copiado para a área de transferência.",
      });
      setTimeout(() => {
        setCopiedStates((prev) => ({ ...prev, [key]: false }));
      }, 2000);
    } catch (err) {
      toast({ title: "Erro ao copiar", variant: "destructive" });
    }
  };

  const ResultCard = ({ title, content, icon: Icon, objKey }: { title: string; content: string; icon: any; objKey: string }) => (
    <Card className="overflow-hidden border-border/50 bg-card/50 backdrop-blur-sm transition-all hover:border-primary/50 relative group">
      <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-primary to-primary/30" />
      <CardContent className="p-5 pl-6 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-primary">
            <Icon className="h-5 w-5" />
            <h3 className="font-bold text-base text-foreground">{title}</h3>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 group-hover:bg-primary/10 transition-colors"
            onClick={() => copyToClipboard(content, objKey)}
          >
            {copiedStates[objKey] ? (
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            ) : (
              <><Copy className="h-4 w-4 mr-1.5" /> Copiar</>
            )}
          </Button>
        </div>
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{content}</p>
      </CardContent>
    </Card>
  );

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] md:h-screen overflow-y-auto">
      <div className="p-4 md:p-6 max-w-3xl mx-auto w-full space-y-6 pb-10">

        {/* Header */}
        <div className="space-y-3 text-center md:text-left mt-4 md:mt-8">
          <div className="inline-flex items-center justify-center p-3 bg-primary/10 rounded-2xl mb-2">
            <Zap className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold font-display">
            GameOver
          </h1>
          <p className="text-base text-muted-foreground w-full max-w-lg mx-auto md:mx-0">
            Aposente seus dedos. Fale o que acontece no vídeo e nós geramos as descrições mais virais do mercado pra você em segundos.
          </p>
        </div>

        {/* Input Card */}
        <Card className="border-primary/20 shadow-lg relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 gradient-viral" />
          <CardContent className="p-6 space-y-4 pt-8">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-semibold flex items-center gap-2">
                <Type className="h-4 w-4 text-primary" />
                Descreva a cena e o contexto do vídeo
              </label>
            </div>
            
            <div className="relative">
              <Textarea
                placeholder="Exemplo: Fui na padaria comprar pão e encontrei um fisiculturista comprando 10kg de frango..."
                value={text + (interimText ? (text.length > 0 && !text.endsWith(" ") ? " " : "") + interimText : "")}
                onChange={(e) => setText(e.target.value)}
                disabled={loading}
                readOnly={isRecording}
                className={cn(
                  "min-h-[160px] resize-none text-base p-4 pr-16 bg-muted/30 focus-visible:ring-primary/50",
                  isRecording && "border-primary/60 ring-1 ring-primary/30"
                )}
              />
              <div className="absolute bottom-3 right-3 flex flex-col items-center">
                <button
                  onClick={toggleRecording}
                  type="button"
                  disabled={loading}
                  className={cn(
                    "p-3 rounded-full transition-all duration-300 shadow-md",
                    isRecording 
                      ? "bg-red-500 hover:bg-red-600 text-white animate-pulse shadow-red-500/40" 
                      : "bg-primary text-primary-foreground hover:bg-primary/90 hover:scale-105"
                  )}
                  title={isRecording ? "Parar gravação" : "Clique para falar"}
                >
                  {isRecording ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <Button
              onClick={handleGenerate}
              disabled={loading || !text.trim()}
              className="w-full gradient-viral text-white font-bold h-12 text-base shadow-lg hover:opacity-90 transition-opacity mt-4"
            >
              {loading ? (
                <><Loader2 className="h-5 w-5 animate-spin mr-2" /> Gerando Magia Viral…</>
              ) : (
                <><Sparkles className="h-5 w-5 mr-2" /> Gerar Copy Viral</>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Results */}
        {result && (
          <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500 pt-4">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" /> Resultados Prontinhos
            </h2>
            
            <div className="grid gap-4">
              <ResultCard 
                title="Título Viral"
                content={result.titulo}
                icon={Zap} 
                objKey="titulo" 
              />
              
              <ResultCard 
                title="Descrição Estratégica"
                content={result.descricao}
                icon={Type} 
                objKey="descricao" 
              />
              
              <ResultCard 
                title="Copy Focada em Comentários"
                content={result.copy}
                icon={Sparkles} 
                objKey="copy" 
              />
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default GameOver;
