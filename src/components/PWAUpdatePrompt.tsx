import { usePWAUpdate } from "@/hooks/usePWAUpdate";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

export function PWAUpdatePrompt() {
  const { needRefresh, updateServiceWorker, dismiss } = usePWAUpdate();

  if (!needRefresh) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-3 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 rounded-full border border-border bg-background/95 backdrop-blur px-4 py-2 shadow-lg"
    >
      <RefreshCw className="h-4 w-4 text-primary" />
      <span className="text-sm font-medium">Nova versão disponível</span>
      <Button size="sm" onClick={() => updateServiceWorker(true)}>
        Recarregar agora
      </Button>
      <button
        onClick={dismiss}
        className="text-xs text-muted-foreground hover:text-foreground"
        aria-label="Dispensar"
      >
        depois
      </button>
    </div>
  );
}
