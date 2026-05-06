import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const SUPA = supabase as any;

function toIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// -----------------------------------------------------
// Summary: KPIs gerais da DRE
// -----------------------------------------------------
export interface DRESummary {
  gross_revenue: number;
  total_discount: number;
  total_increase: number;
  delivery_fee_passthrough: number;
  service_charge_passthrough: number;
  net_sales_revenue: number;
  total_orders: number;
  avg_ticket: number;
  other_income: number;
  total_expenses: number;
  net_result: number;
}

export function useDRESummary(start: Date, end: Date) {
  return useQuery<DRESummary | null>({
    queryKey: ["dre", "summary", toIso(start), toIso(end)],
    queryFn: async () => {
      const { data, error } = await SUPA.rpc("get_dre_summary", {
        p_start: toIso(start),
        p_end: toIso(end),
      });
      if (error) throw error;
      const r = data?.[0];
      if (!r) return null;
      return {
        gross_revenue: Number(r.gross_revenue ?? 0),
        total_discount: Number(r.total_discount ?? 0),
        total_increase: Number(r.total_increase ?? 0),
        delivery_fee_passthrough: Number(r.delivery_fee_passthrough ?? 0),
        service_charge_passthrough: Number(r.service_charge_passthrough ?? 0),
        net_sales_revenue: Number(r.net_sales_revenue ?? 0),
        total_orders: Number(r.total_orders ?? 0),
        avg_ticket: Number(r.avg_ticket ?? 0),
        other_income: Number(r.other_income ?? 0),
        total_expenses: Number(r.total_expenses ?? 0),
        net_result: Number(r.net_result ?? 0),
      };
    },
    staleTime: 30_000,
  });
}

// -----------------------------------------------------
// Receita por canal/parceiro
// -----------------------------------------------------
export interface DRERevenueChannel {
  channel: string;
  revenue: number;
  orders: number;
  pct_of_total: number;
}

export function useDRERevenueByChannel(start: Date, end: Date) {
  return useQuery<DRERevenueChannel[]>({
    queryKey: ["dre", "revenue-by-channel", toIso(start), toIso(end)],
    queryFn: async () => {
      const { data, error } = await SUPA.rpc("get_dre_revenue_by_channel", {
        p_start: toIso(start),
        p_end: toIso(end),
      });
      if (error) throw error;
      return ((data ?? []) as any[]).map((r) => ({
        channel: r.channel,
        revenue: Number(r.revenue ?? 0),
        orders: Number(r.orders ?? 0),
        pct_of_total: Number(r.pct_of_total ?? 0),
      }));
    },
    staleTime: 30_000,
  });
}

// -----------------------------------------------------
// Despesas por categoria
// -----------------------------------------------------
export interface DREExpenseCategory {
  category: string;
  amount_total: number;
  txn_count: number;
  paid_amount: number;
  unpaid_amount: number;
  pct_of_total: number;
}

export function useDREExpensesByCategory(start: Date, end: Date) {
  return useQuery<DREExpenseCategory[]>({
    queryKey: ["dre", "expenses-by-category", toIso(start), toIso(end)],
    queryFn: async () => {
      const { data, error } = await SUPA.rpc("get_dre_expenses_by_category", {
        p_start: toIso(start),
        p_end: toIso(end),
      });
      if (error) throw error;
      return ((data ?? []) as any[]).map((r) => ({
        category: r.category,
        amount_total: Number(r.amount_total ?? 0),
        txn_count: Number(r.txn_count ?? 0),
        paid_amount: Number(r.paid_amount ?? 0),
        unpaid_amount: Number(r.unpaid_amount ?? 0),
        pct_of_total: Number(r.pct_of_total ?? 0),
      }));
    },
    staleTime: 30_000,
  });
}

// -----------------------------------------------------
// Evolução mensal (receita × despesa × resultado)
// -----------------------------------------------------
export interface DREMonthlyPoint {
  month_bucket: string;
  revenue: number;
  expenses: number;
  result: number;
}

export function useDREMonthlyEvolution(start: Date, end: Date) {
  return useQuery<DREMonthlyPoint[]>({
    queryKey: ["dre", "monthly", toIso(start), toIso(end)],
    queryFn: async () => {
      const { data, error } = await SUPA.rpc("get_dre_monthly_evolution", {
        p_start: toIso(start),
        p_end: toIso(end),
      });
      if (error) throw error;
      return ((data ?? []) as any[]).map((r) => ({
        month_bucket: r.month_bucket,
        revenue: Number(r.revenue ?? 0),
        expenses: Number(r.expenses ?? 0),
        result: Number(r.result ?? 0),
      }));
    },
    staleTime: 30_000,
  });
}

// -----------------------------------------------------
// Cobertura de dados financeiros
// -----------------------------------------------------
export interface DREDataCoverage {
  earliest_financial_date: string | null;
  latest_financial_date: string | null;
  total_financial_txns: number;
  total_negative_txns: number;
}

export function useDREDataCoverage() {
  return useQuery<DREDataCoverage | null>({
    queryKey: ["dre", "coverage"],
    queryFn: async () => {
      const { data, error } = await SUPA.rpc("get_dre_data_coverage");
      if (error) throw error;
      const r = data?.[0];
      if (!r) return null;
      return {
        earliest_financial_date: r.earliest_financial_date,
        latest_financial_date: r.latest_financial_date,
        total_financial_txns: Number(r.total_financial_txns ?? 0),
        total_negative_txns: Number(r.total_negative_txns ?? 0),
      };
    },
    staleTime: 60_000,
  });
}
