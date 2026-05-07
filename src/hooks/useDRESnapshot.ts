import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const SUPA = supabase as any;

export interface DRESnapshotRow {
  ord: number;
  line_label: string;
  line_label_clean: string;
  level: number;
  parent_label: string | null;
  line_type: "section" | "deduction" | "total" | "item";
  amount: number | null;
  pct: number | null;
}

export function useDRESnapshot(year: number | null, month: number | null) {
  return useQuery<DRESnapshotRow[]>({
    queryKey: ["dre-snapshot", year, month],
    enabled: year != null && month != null,
    queryFn: async () => {
      const { data, error } = await SUPA.rpc("get_dre_snapshot", {
        p_year: year,
        p_month: month,
      });
      if (error) throw error;
      return ((data ?? []) as any[]).map((r) => ({
        ord: Number(r.ord),
        line_label: r.line_label,
        line_label_clean: r.line_label_clean,
        level: Number(r.level),
        parent_label: r.parent_label,
        line_type: r.line_type as DRESnapshotRow["line_type"],
        amount: r.amount != null ? Number(r.amount) : null,
        pct: r.pct != null ? Number(r.pct) : null,
      }));
    },
    staleTime: 60_000,
  });
}

export interface DRESnapshotPeriod {
  period_year: number;
  period_month: number;
  rows_count: number;
  imported_at: string;
}

export function useDRESnapshotPeriods() {
  return useQuery<DRESnapshotPeriod[]>({
    queryKey: ["dre-snapshot", "periods"],
    queryFn: async () => {
      const { data, error } = await SUPA.rpc("get_dre_snapshot_periods");
      if (error) throw error;
      return ((data ?? []) as any[]).map((r) => ({
        period_year: Number(r.period_year),
        period_month: Number(r.period_month),
        rows_count: Number(r.rows_count),
        imported_at: r.imported_at,
      }));
    },
    staleTime: 30_000,
  });
}

export interface DRESnapshotImportLog {
  id: string;
  filename: string;
  periods_imported: string[];
  rows_inserted: number;
  rows_replaced: number;
  imported_at: string;
}

export function useDRESnapshotImportsLog() {
  return useQuery<DRESnapshotImportLog[]>({
    queryKey: ["dre-snapshot", "imports-log"],
    queryFn: async () => {
      const { data, error } = await SUPA.rpc("get_dre_snapshot_imports_log", { p_limit: 20 });
      if (error) throw error;
      return ((data ?? []) as any[]).map((r) => ({
        id: r.id,
        filename: r.filename,
        periods_imported: r.periods_imported ?? [],
        rows_inserted: Number(r.rows_inserted),
        rows_replaced: Number(r.rows_replaced),
        imported_at: r.imported_at,
      }));
    },
    staleTime: 30_000,
  });
}
