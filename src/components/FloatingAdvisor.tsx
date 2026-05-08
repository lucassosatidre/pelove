import { useState, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import {
  Sparkles, Send, Loader2, X, Minimize2, Maximize2, Bot, User, Wrench, Plus,
  MessageSquare, ChevronDown, History, ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuRadioGroup, DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  AGENT_PRESETS, MODEL_PRESETS, DEFAULT_AGENT_ID, DEFAULT_MODEL_ID,
  loadModel, saveModel, loadAgent, saveAgent,
} from "@/lib/advisor/presets";
import {
  useConversations, useMessages, useSendMessage, type Message,
} from "@/hooks/useAdvisor";
import { useToast } from "@/hooks/use-toast";

const STATE_KEY = "pelove.advisor.floating.state";

type FloatingState = "closed" | "open";

function loadState(): FloatingState {
  if (typeof window === "undefined") return "closed";
  return (localStorage.getItem(STATE_KEY) as FloatingState) || "closed";
}

function saveState(s: FloatingState) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STATE_KEY, s);
}

export function FloatingAdvisor() {
  const location = useLocation();
  const { toast } = useToast();

  const [state, setState] = useState<FloatingState>(loadState);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [input, setInput] = useState("");
  const [model, setModel] = useState<string>(loadModel);
  const [agent, setAgent] = useState<string>(loadAgent);

  // Hide on /advisor and /login (already has full chat)
  const hideOnRoutes = ["/advisor", "/login"];
  const shouldHide = hideOnRoutes.some((r) => location.pathname.startsWith(r));

  useEffect(() => { saveState(state); }, [state]);
  useEffect(() => { saveModel(model); }, [model]);
  useEffect(() => { saveAgent(agent); }, [agent]);

  const { data: messages, isLoading: loadingMessages } = useMessages(activeConvId);
  const { data: conversations } = useConversations();
  const send = useSendMessage();

  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, send.isPending]);

  if (shouldHide) return null;

  const open = () => setState("open");
  const close = () => setState("closed");

  const handleSend = async () => {
    const text = input.trim();
    if (!text) return;
    setInput("");
    try {
      const r = await send.mutateAsync({
        message: text,
        conversationId: activeConvId,
        model,
        agent,
        currentRoute: location.pathname + location.search,
      });
      if (!activeConvId) setActiveConvId(r.conversation_id);
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  const handleNew = () => {
    setActiveConvId(null);
    setInput("");
    setShowHistory(false);
  };

  const currentAgent = AGENT_PRESETS.find((a) => a.id === agent) ?? AGENT_PRESETS[0];
  const currentModel = MODEL_PRESETS.find((m) => m.id === model) ?? MODEL_PRESETS[0];

  // ---------------------------------------------------
  // Closed state — floating bubble
  // ---------------------------------------------------
  if (state === "closed") {
    return (
      <button
        onClick={open}
        aria-label="Abrir Advisor"
        className="fixed bottom-5 right-5 z-50 h-12 w-12 rounded-full bg-primary text-primary-foreground shadow-lg hover:scale-105 transition-transform flex items-center justify-center"
      >
        <Sparkles className="h-5 w-5" />
      </button>
    );
  }

  // ---------------------------------------------------
  // Open state — chat panel
  // ---------------------------------------------------
  return (
    <div className="fixed bottom-5 right-5 z-50 w-[400px] max-w-[calc(100vw-2rem)] h-[640px] max-h-[calc(100vh-3rem)] flex flex-col bg-background border border-border rounded-xl shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-card shrink-0">
        <div className="h-7 w-7 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold leading-tight truncate">Advisor</div>
          <div className="text-[10px] text-muted-foreground leading-tight truncate">
            {currentAgent.emoji} {currentAgent.label} · {currentModel.label}
          </div>
        </div>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          onClick={() => setShowHistory((v) => !v)}
          title="Conversas anteriores"
        >
          <History className="h-3.5 w-3.5" />
        </Button>
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleNew} title="Nova conversa">
          <Plus className="h-3.5 w-3.5" />
        </Button>
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={close} title="Minimizar">
          <Minimize2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Selectors */}
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-border bg-muted/30 shrink-0">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 text-[11px] px-2 gap-1">
              {currentAgent.emoji} {currentAgent.label}
              <ChevronDown className="h-3 w-3 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-72">
            <DropdownMenuLabel className="text-[10px] uppercase tracking-wider">Tipo de agente</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuRadioGroup value={agent} onValueChange={setAgent}>
              {AGENT_PRESETS.map((a) => (
                <DropdownMenuRadioItem key={a.id} value={a.id} className="flex flex-col items-start gap-0.5 py-2">
                  <span className="text-xs font-medium">
                    {a.emoji} {a.label}
                  </span>
                  <span className="text-[10px] text-muted-foreground">{a.description}</span>
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 text-[11px] px-2 gap-1">
              {currentModel.label}
              <ChevronDown className="h-3 w-3 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
            <DropdownMenuLabel className="text-[10px] uppercase tracking-wider">Modelo</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuRadioGroup value={model} onValueChange={setModel}>
              {MODEL_PRESETS.map((m) => (
                <DropdownMenuRadioItem key={m.id} value={m.id} className="flex flex-col items-start gap-0.5 py-2">
                  <span className="text-xs font-medium">{m.label}</span>
                  <span className="text-[10px] text-muted-foreground">{m.hint}</span>
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <a
          href="/advisor"
          className="ml-auto text-[10px] text-muted-foreground hover:text-foreground inline-flex items-center gap-0.5"
          title="Abrir página completa"
        >
          completo <ExternalLink className="h-2.5 w-2.5" />
        </a>
      </div>

      {/* Body */}
      {showHistory ? (
        <ConversationList
          conversations={conversations ?? []}
          onPick={(id) => { setActiveConvId(id); setShowHistory(false); }}
          activeId={activeConvId}
        />
      ) : (
        <>
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-3 min-h-0">
            {!activeConvId && (!messages || messages.length === 0) && !send.isPending && (
              <FirstMessageHint route={location.pathname} />
            )}
            {loadingMessages && (
              <div className="space-y-2">
                {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
              </div>
            )}
            {messages?.map((m) => <MiniBubble key={m.id} message={m} />)}
            {send.isPending && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                <Loader2 className="h-3 w-3 animate-spin" /> pensando...
              </div>
            )}
          </div>

          <div className="p-2 border-t border-border shrink-0">
            <div className="flex items-end gap-1.5">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                rows={2}
                placeholder="Pergunte algo..."
                className="resize-none text-xs min-h-[48px]"
                disabled={send.isPending}
              />
              <Button
                onClick={handleSend}
                disabled={send.isPending || !input.trim()}
                size="icon"
                className="h-12 w-10 shrink-0"
              >
                {send.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function ConversationList({
  conversations, onPick, activeId,
}: {
  conversations: any[];
  onPick: (id: string) => void;
  activeId: string | null;
}) {
  if (conversations.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground p-4 text-center">
        Nenhuma conversa ainda. Pergunte algo no campo abaixo pra começar.
      </div>
    );
  }
  return (
    <div className="flex-1 overflow-y-auto p-2 space-y-1 min-h-0">
      {conversations.map((c) => (
        <button
          key={c.id}
          onClick={() => onPick(c.id)}
          className={cn(
            "w-full text-left p-2 rounded text-xs flex items-start gap-2",
            activeId === c.id ? "bg-primary/10 text-primary" : "hover:bg-muted",
          )}
        >
          <MessageSquare className="h-3 w-3 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="truncate font-medium">{c.title || "Sem título"}</p>
            <p className="text-[10px] text-muted-foreground">
              {new Date(c.last_message_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
            </p>
          </div>
        </button>
      ))}
    </div>
  );
}

function FirstMessageHint({ route }: { route: string }) {
  const routeHint = route.startsWith("/mapa")
    ? "Você está no Mapa Estratégico"
    : route.startsWith("/dashboards")
    ? "Você está em Dashboards"
    : route.startsWith("/dre")
    ? "Você está na DRE"
    : route.startsWith("/configuracoes/saipos")
    ? "Você está em Configurações Saipos"
    : "Pergunte sobre seu negócio";

  return (
    <div className="text-center py-6 text-xs text-muted-foreground">
      <Sparkles className="h-6 w-6 mx-auto mb-2 text-primary/60" />
      <p className="font-medium text-foreground mb-1">{routeHint}</p>
      <p>O advisor enxerga essa tela e seu contexto.</p>
    </div>
  );
}

function MiniBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";
  const text = String(message.content?.text ?? "");
  const toolCalls = (message.tool_calls ?? []) as any[];

  return (
    <div className={cn("flex gap-2", isUser && "flex-row-reverse")}>
      <div
        className={cn(
          "h-6 w-6 rounded-md flex items-center justify-center shrink-0",
          isUser ? "bg-muted" : "bg-primary/10",
        )}
      >
        {isUser ? <User className="h-3 w-3" /> : <Bot className="h-3 w-3 text-primary" />}
      </div>
      <div className={cn("flex-1 min-w-0", isUser && "text-right")}>
        {text && (
          <Card className={cn("inline-block max-w-full", isUser && "bg-primary text-primary-foreground")}>
            <CardContent className="p-2 text-xs whitespace-pre-wrap leading-snug">{text}</CardContent>
          </Card>
        )}
        {toolCalls.length > 0 && !isUser && (
          <div className="mt-1 space-y-0.5">
            {toolCalls.map((tc, i) => (
              <div key={i} className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Wrench className="h-2.5 w-2.5" />
                <code className="bg-muted px-1 rounded text-[9px]">{tc.name}</code>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
