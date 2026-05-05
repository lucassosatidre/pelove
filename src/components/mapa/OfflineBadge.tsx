import { Cloud, CloudOff, RefreshCw, AlertCircle } from "lucide-react";
import { useOfflineStatus } from "@/hooks/useOfflineStatus";
import { cn } from "@/lib/utils";

export function OfflineBadge() {
  const { online, pending, status } = useOfflineStatus();

  let icon = <Cloud className="h-3.5 w-3.5" />;
  let label = "Online";
  let tone = "bg-emerald-500/10 text-emerald-700 border-emerald-500/30";

  if (!online) {
    icon = <CloudOff className="h-3.5 w-3.5" />;
    label = pending > 0 ? `Offline · ${pending} pendente${pending > 1 ? "s" : ""}` : "Offline";
    tone = "bg-amber-500/10 text-amber-700 border-amber-500/30";
  } else if (status === "syncing" || pending > 0) {
    icon = <RefreshCw className="h-3.5 w-3.5 animate-spin" />;
    label = pending > 0 ? `Sincronizando ${pending}…` : "Sincronizando…";
    tone = "bg-sky-500/10 text-sky-700 border-sky-500/30";
  } else if (status === "error") {
    icon = <AlertCircle className="h-3.5 w-3.5" />;
    label = "Erro ao sincronizar";
    tone = "bg-rose-500/10 text-rose-700 border-rose-500/30";
  }

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
        tone
      )}
      title={online ? "Conectado" : "Sem conexão — edições ficam salvas localmente"}
    >
      {icon}
      <span>{label}</span>
    </div>
  );
}
