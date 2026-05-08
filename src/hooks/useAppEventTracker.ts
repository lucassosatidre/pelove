import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const SUPA = supabase as any;

// Logs page navigations to advisor_app_events (best-effort, fire & forget).
// Coalesces rapid back-to-back navigations to the same path within 1.5s.
export function useAppEventTracker() {
  const location = useLocation();
  const lastRef = useRef<{ route: string; at: number } | null>(null);

  useEffect(() => {
    const route = location.pathname + location.search;
    const now = Date.now();
    const last = lastRef.current;
    if (last && last.route === route && now - last.at < 1500) return;
    lastRef.current = { route, at: now };

    let cancelled = false;
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user || cancelled) return;
        await SUPA.from("advisor_app_events").insert({
          user_id: session.user.id,
          route,
          kind: "navigation",
          summary: routeSummary(route),
        });
      } catch { /* silencioso — log é best-effort */ }
    })();
    return () => { cancelled = true; };
  }, [location.pathname, location.search]);
}

function routeSummary(route: string): string {
  const r = route.split("?")[0];
  if (r.startsWith("/mapa")) {
    return route.includes("view=calendario")
      ? "Abriu Calendário/Acompanhamento"
      : "Abriu Mapa Estratégico";
  }
  if (r.startsWith("/dashboards")) return "Abriu Dashboards";
  if (r === "/dre") return "Abriu DRE";
  if (r.startsWith("/dre/import")) return "Abriu DRE Import";
  if (r.startsWith("/dre-v2")) return "Abriu DRE v2";
  if (r.startsWith("/advisor")) return "Abriu Advisor (página completa)";
  if (r.startsWith("/configuracoes/saipos")) return "Abriu Configurações Saipos";
  return `Navegou para ${route}`;
}

// Manual logger for relevant in-app actions (e.g. created an action,
// changed a status, etc.). Best-effort.
export async function logAppEvent(opts: {
  kind: "mutation" | "note";
  summary: string;
  route?: string;
  payload?: Record<string, unknown>;
}) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;
    await SUPA.from("advisor_app_events").insert({
      user_id: session.user.id,
      route: opts.route ?? (typeof window !== "undefined" ? window.location.pathname + window.location.search : null),
      kind: opts.kind,
      summary: opts.summary,
      payload: opts.payload ?? null,
    });
  } catch { /* silent */ }
}
