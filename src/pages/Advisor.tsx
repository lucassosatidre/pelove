import { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sparkles, Send, Loader2, Plus, Trash2, MessageSquare, Bot, User, Wrench,
  CheckCircle2, X, Lightbulb, Brain,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  useConversations, useMessages, useSendMessage, useDeleteConversation,
  useFacts, useDeleteFact, useConfirmFact,
} from "@/hooks/useAdvisor";

export default function Advisor() {
  const { toast } = useToast();
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [showFacts, setShowFacts] = useState(false);

  const { data: conversations, isLoading: convsLoading } = useConversations();
  const { data: messages, isLoading: messagesLoading } = useMessages(activeConvId);
  const send = useSendMessage();
  const deleteConv = useDeleteConversation();

  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, send.isPending]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text) return;
    setInput("");
    try {
      const r = await send.mutateAsync({ message: text, conversationId: activeConvId });
      if (!activeConvId) setActiveConvId(r.conversation_id);
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  const handleNewChat = () => {
    setActiveConvId(null);
    setInput("");
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Apagar essa conversa? A memória de fatos não é apagada.")) return;
    await deleteConv.mutateAsync(id);
    if (activeConvId === id) setActiveConvId(null);
  };

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* Sidebar de conversas */}
      <aside className="w-64 border-r border-border bg-card flex flex-col shrink-0">
        <div className="p-3 border-b border-border space-y-2">
          <Button onClick={handleNewChat} className="w-full" size="sm">
            <Plus className="w-4 h-4 mr-2" /> Nova conversa
          </Button>
          <Button
            onClick={() => setShowFacts(!showFacts)}
            variant={showFacts ? "default" : "outline"}
            className="w-full"
            size="sm"
          >
            <Brain className="w-4 h-4 mr-2" />
            {showFacts ? "Ver conversas" : "Ver memória"}
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {showFacts ? (
            <FactsList />
          ) : convsLoading ? (
            <div className="p-3 space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : !conversations || conversations.length === 0 ? (
            <p className="p-4 text-xs text-muted-foreground text-center">Nenhuma conversa ainda. Comece com uma pergunta sobre o negócio.</p>
          ) : (
            <div className="p-2 space-y-1">
              {conversations.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setActiveConvId(c.id)}
                  className={`w-full text-left p-2 rounded text-xs flex items-start gap-2 group ${
                    activeConvId === c.id
                      ? "bg-primary/10 text-primary"
                      : "hover:bg-muted"
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="truncate font-medium">{c.title || "Sem título"}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(c.last_message_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                    </p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(c.id); }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive shrink-0"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </button>
              ))}
            </div>
          )}
        </div>
      </aside>

      {/* Chat */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="p-4 border-b border-border flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h1 className="font-bold">Advisor</h1>
            <p className="text-xs text-muted-foreground">Conversa com Claude — tem acesso ao mapa estratégico, métricas e memória persistente</p>
          </div>
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4">
          <div className="max-w-3xl mx-auto py-6 space-y-4">
            {!activeConvId && (!messages || messages.length === 0) && (
              <Welcome onSuggest={(s) => setInput(s)} />
            )}
            {messagesLoading && (
              <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
            )}
            {messages?.map((m) => (
              <MessageBubble key={m.id} message={m} />
            ))}
            {send.isPending && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-3">
                <Loader2 className="w-4 h-4 animate-spin" />
                Pensando...
              </div>
            )}
          </div>
        </div>

        <div className="p-4 border-t border-border">
          <div className="max-w-3xl mx-auto flex items-end gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Pergunte sobre vendas, produtos, operação, clientes ou estratégia... (Enter envia, Shift+Enter quebra linha)"
              rows={2}
              className="resize-none"
              disabled={send.isPending}
            />
            <Button onClick={handleSend} disabled={send.isPending || !input.trim()} size="icon" className="h-[60px] w-[60px] shrink-0">
              {send.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}

// -----------------------------------------------------
// Message bubble — supports text + tool use rendering
// -----------------------------------------------------
function MessageBubble({ message }: { message: any }) {
  const isUser = message.role === "user";
  const text = String(message.content?.text ?? "");
  const toolCalls = (message.tool_calls ?? []) as any[];

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isUser ? "bg-muted" : "bg-primary/10"}`}>
        {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4 text-primary" />}
      </div>
      <div className={`flex-1 min-w-0 ${isUser ? "text-right" : ""}`}>
        {text && (
          <Card className={isUser ? "bg-primary text-primary-foreground inline-block" : "inline-block max-w-full"}>
            <CardContent className="p-3 text-sm whitespace-pre-wrap">{text}</CardContent>
          </Card>
        )}
        {toolCalls.length > 0 && !isUser && (
          <div className="mt-2 space-y-1">
            {toolCalls.map((tc, i) => (
              <div key={i} className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                <Wrench className="w-3 h-3" />
                <code className="bg-muted px-1.5 py-0.5 rounded text-[10px]">{tc.name}</code>
                <span className="opacity-70 truncate" title={JSON.stringify(tc.input)}>
                  {Object.entries(tc.input ?? {}).slice(0, 3).map(([k, v]) =>
                    `${k}=${typeof v === "object" ? JSON.stringify(v) : v}`
                  ).join(" • ")}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// -----------------------------------------------------
function Welcome({ onSuggest }: { onSuggest: (s: string) => void }) {
  const suggestions = [
    "Como foi a semana passada vs a anterior?",
    "Qual produto cresceu mais nos últimos 30 dias?",
    "Tem algum gargalo na operação que merece atenção?",
    "Quais clientes andam sumindo que costumavam pedir muito?",
  ];

  return (
    <div className="text-center py-12 max-w-xl mx-auto">
      <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
        <Sparkles className="w-8 h-8 text-primary" />
      </div>
      <h2 className="text-xl font-bold mb-2">Pronto pra ajudar</h2>
      <p className="text-sm text-muted-foreground mb-6">
        Pergunta o que quiser sobre seu negócio. Tenho acesso ao mapa estratégico, vendas dos últimos meses, produtos, status de operação e clientes.
        Lembro de tudo que você me ensinar.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {suggestions.map((s) => (
          <button
            key={s}
            onClick={() => onSuggest(s)}
            className="text-left text-xs p-3 border border-border rounded-lg hover:bg-muted hover:border-primary/50 transition-colors flex items-start gap-2"
          >
            <Lightbulb className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
            <span>{s}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// -----------------------------------------------------
function FactsList() {
  const { data: facts, isLoading } = useFacts();
  const deleteFact = useDeleteFact();
  const confirmFact = useConfirmFact();

  if (isLoading) return <div className="p-3 space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>;
  if (!facts || facts.length === 0) {
    return <p className="p-4 text-xs text-muted-foreground text-center">Nenhum fato salvo ainda. Conforme você conversar, o advisor vai aprender e salvar fatos automáticos.</p>;
  }

  // Group by topic
  const grouped = facts.reduce<Record<string, typeof facts>>((acc, f) => {
    (acc[f.topic] ??= []).push(f);
    return acc;
  }, {});

  return (
    <div className="p-2 space-y-3">
      {Object.entries(grouped).map(([topic, list]) => (
        <div key={topic}>
          <p className="text-[10px] uppercase font-bold text-muted-foreground px-2 mb-1">{topic}</p>
          <div className="space-y-1">
            {list.map((f) => (
              <div key={f.id} className="p-2 rounded bg-muted/50 text-xs space-y-1.5 group">
                <p className="leading-snug">{f.fact}</p>
                <div className="flex items-center gap-1">
                  {!f.user_confirmed ? (
                    <Badge variant="outline" className="text-[10px] px-1 py-0 cursor-pointer" onClick={() => confirmFact.mutate(f.id)}>
                      <CheckCircle2 className="w-2.5 h-2.5 mr-1" /> Confirmar
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-[10px] px-1 py-0">
                      <CheckCircle2 className="w-2.5 h-2.5 mr-1" /> Confirmado
                    </Badge>
                  )}
                  <button
                    onClick={() => deleteFact.mutate(f.id)}
                    className="ml-auto opacity-0 group-hover:opacity-100 text-destructive"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
