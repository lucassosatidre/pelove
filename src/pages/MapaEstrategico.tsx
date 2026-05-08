import { useState } from "react";
import { Map as MapIcon, CalendarRange, Printer } from "lucide-react";
import { cn } from "@/lib/utils";
import { MindMapLayout } from "@/components/mapa/MindMapLayout";
import { CalendarioAcompanhamento } from "@/components/mapa/CalendarioAcompanhamento";
import { OfflineBadge } from "@/components/mapa/OfflineBadge";

type View = "mapa" | "calendario";

export default function MapaEstrategico() {
  const [view, setView] = useState<View>(() => {
    if (typeof window === "undefined") return "mapa";
    const params = new URLSearchParams(window.location.search);
    return (params.get("view") as View) === "calendario" ? "calendario" : "mapa";
  });

  const switchView = (v: View) => {
    setView(v);
    const url = new URL(window.location.href);
    if (v === "mapa") url.searchParams.delete("view");
    else url.searchParams.set("view", v);
    window.history.replaceState(null, "", url.toString());
  };

  const printUrl = view === "mapa" ? "/mapa/imprimir" : "/mapa/calendario/imprimir";

  return (
    <div className="flex flex-col h-full relative">
      <div className="flex items-center justify-between border-b border-border px-4 h-11 shrink-0">
        <div className="flex items-center gap-1">
          <SubTab active={view === "mapa"} onClick={() => switchView("mapa")} icon={<MapIcon className="h-3.5 w-3.5" />}>
            Mapa
          </SubTab>
          <SubTab active={view === "calendario"} onClick={() => switchView("calendario")} icon={<CalendarRange className="h-3.5 w-3.5" />}>
            Calendário / Acompanhamento
          </SubTab>
        </div>
        <div className="flex items-center gap-3">
          <a
            href={printUrl}
            target="_blank"
            rel="noopener"
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title={view === "mapa" ? "Imprimir Mapa Estratégico (A4 P&B)" : "Imprimir Calendário por pessoa (A4 P&B)"}
          >
            <Printer className="h-3.5 w-3.5" />
            Imprimir
          </a>
          <OfflineBadge />
        </div>
      </div>

      <div className="flex-1 overflow-auto min-h-0">
        {view === "mapa" ? <MindMapLayout /> : <CalendarioAcompanhamento />}
      </div>
    </div>
  );
}

function SubTab({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md transition-colors",
        active
          ? "bg-primary/10 text-primary font-medium"
          : "text-muted-foreground hover:text-foreground hover:bg-muted",
      )}
    >
      {icon}
      {children}
    </button>
  );
}
