// Filtros compartilhados entre a aba Calendário/Acompanhamento (tela)
// e a página de impressão. Centralizar aqui garante que "imprimir" gera
// exatamente o que está visível na tela.

export type DateBucket = "all" | "overdue" | "this_week" | "next_7" | "next_30" | "no_date";

export type CalendarFilters = {
  status: string[];
  bucket: DateBucket;
  pillar: string;
  person: string;
  search: string;
};

export const EMPTY_FILTERS: CalendarFilters = {
  status: [],
  bucket: "all",
  pillar: "all",
  person: "all",
  search: "",
};

export function hasActiveFilters(f: CalendarFilters): boolean {
  return (
    f.status.length > 0 ||
    f.bucket !== "all" ||
    f.pillar !== "all" ||
    f.person !== "all" ||
    f.search.trim() !== ""
  );
}

export function filtersToQueryString(f: CalendarFilters): string {
  const sp = new URLSearchParams();
  if (f.status.length > 0) sp.set("status", f.status.join(","));
  if (f.bucket !== "all") sp.set("bucket", f.bucket);
  if (f.pillar !== "all") sp.set("pillar", f.pillar);
  if (f.person !== "all") sp.set("person", f.person);
  if (f.search.trim()) sp.set("q", f.search.trim());
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export function filtersFromQueryString(search: string): CalendarFilters {
  const sp = new URLSearchParams(search);
  const bucket = (sp.get("bucket") as DateBucket | null) ?? "all";
  return {
    status: (sp.get("status") ?? "").split(",").map((s) => s.trim()).filter(Boolean),
    bucket: ["all", "overdue", "this_week", "next_7", "next_30", "no_date"].includes(bucket)
      ? bucket
      : "all",
    pillar: sp.get("pillar") ?? "all",
    person: sp.get("person") ?? "all",
    search: sp.get("q") ?? "",
  };
}

function todayISO(): string {
  return new Date().toISOString().substring(0, 10);
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().substring(0, 10);
}

function endOfWeekISO(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const dow = d.getDay();
  const daysUntilSunday = dow === 0 ? 0 : 7 - dow;
  d.setDate(d.getDate() + daysUntilSunday);
  return d.toISOString().substring(0, 10);
}

// Estrutura mínima requerida do item filtrado — bate com FlatAction em
// CalendarioAcompanhamento e CalendarioPrintLayout (que duplicam o tipo).
export type FilterableAction = {
  computed_status: string;
  pillar_id?: string;
  pillar_name: string;
  responsibles: string[];
  description: string;
  expected_result?: string | null;
  deliverable?: string | null;
  obstacle_description?: string | null;
  deadline: string | null;
};

export function applyCalendarFilters<T extends FilterableAction>(
  actions: T[],
  f: CalendarFilters,
): T[] {
  const t = todayISO();
  const eow = endOfWeekISO();
  const in7 = addDays(t, 7);
  const in30 = addDays(t, 30);

  return actions.filter((a) => {
    if (f.status.length > 0 && !f.status.includes(a.computed_status)) return false;
    if (f.pillar !== "all" && a.pillar_id !== f.pillar) return false;
    if (f.person !== "all" && !a.responsibles.includes(f.person)) return false;

    if (f.search.trim()) {
      const needle = f.search.trim().toLowerCase();
      const hay = [
        a.description,
        a.expected_result ?? "",
        a.deliverable ?? "",
        a.obstacle_description ?? "",
        a.pillar_name,
      ]
        .join(" ")
        .toLowerCase();
      if (!hay.includes(needle)) return false;
    }

    switch (f.bucket) {
      case "all":
        return true;
      case "overdue":
        return a.computed_status === "atrasado";
      case "this_week":
        return !!a.deadline && a.deadline >= t && a.deadline <= eow;
      case "next_7":
        return !!a.deadline && a.deadline >= t && a.deadline <= in7;
      case "next_30":
        return !!a.deadline && a.deadline >= t && a.deadline <= in30;
      case "no_date":
        return !a.deadline;
      default:
        return true;
    }
  });
}
