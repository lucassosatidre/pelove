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
// Summary (estrutura clássica DRE Saipos)
// -----------------------------------------------------
export interface DRESummary {
  gross_revenue: number;
  total_orders: number;
  avg_ticket: number;
  total_taxes: number;
  net_revenue: number;
  total_cogs: number;
  total_sales_cost: number;
  gross_operating_profit: number;
  total_admin: number;
  total_financial_expenses: number;
  operating_profit: number;
  non_operational_income: number;
  profit_before_tax: number;
  income_tax: number;
  profit_before_prolabore: number;
  prolabore: number;
  net_profit: number;
  excluded_amount: number;
}

export function useDRESummary(start: Date, end: Date) {
  return useQuery<DRESummary | null>({
    queryKey: ["dre", "summary-v2", toIso(start), toIso(end)],
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
        total_orders: Number(r.total_orders ?? 0),
        avg_ticket: Number(r.avg_ticket ?? 0),
        total_taxes: Number(r.total_taxes ?? 0),
        net_revenue: Number(r.net_revenue ?? 0),
        total_cogs: Number(r.total_cogs ?? 0),
        total_sales_cost: Number(r.total_sales_cost ?? 0),
        gross_operating_profit: Number(r.gross_operating_profit ?? 0),
        total_admin: Number(r.total_admin ?? 0),
        total_financial_expenses: Number(r.total_financial_expenses ?? 0),
        operating_profit: Number(r.operating_profit ?? 0),
        non_operational_income: Number(r.non_operational_income ?? 0),
        profit_before_tax: Number(r.profit_before_tax ?? 0),
        income_tax: Number(r.income_tax ?? 0),
        profit_before_prolabore: Number(r.profit_before_prolabore ?? 0),
        prolabore: Number(r.prolabore ?? 0),
        net_profit: Number(r.net_profit ?? 0),
        excluded_amount: Number(r.excluded_amount ?? 0),
      };
    },
    staleTime: 30_000,
  });
}

// -----------------------------------------------------
// Receita por canal/parceiro (mantida)
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
// Despesas por grupo DRE (com detalhes de categoria)
// -----------------------------------------------------
export type DREGroup =
  | "tax"
  | "cogs"
  | "sales_cost"
  | "admin"
  | "financial"
  | "income_tax"
  | "prolabore"
  | "exclude";

export const DRE_GROUP_LABELS: Record<DREGroup, string> = {
  tax: "Impostos sobre vendas",
  cogs: "CMV — Custo das Mercadorias Vendidas",
  sales_cost: "Custo com vendas",
  admin: "Despesas administrativas",
  financial: "Despesas financeiras",
  income_tax: "IR (Imposto de Renda)",
  prolabore: "Pró-Labore",
  exclude: "Excluído do DRE",
};

export interface DREExpenseRow {
  dre_group: DREGroup;
  category: string;
  amount_total: number;
  txn_count: number;
  paid_amount: number;
  unpaid_amount: number;
  pct_of_group: number;
}

export function useDREExpensesByGroup(start: Date, end: Date) {
  return useQuery<DREExpenseRow[]>({
    queryKey: ["dre", "expenses-by-group", toIso(start), toIso(end)],
    queryFn: async () => {
      const { data, error } = await SUPA.rpc("get_dre_expenses_by_group", {
        p_start: toIso(start),
        p_end: toIso(end),
      });
      if (error) throw error;
      return ((data ?? []) as any[]).map((r) => ({
        dre_group: r.dre_group as DREGroup,
        category: r.category,
        amount_total: Number(r.amount_total ?? 0),
        txn_count: Number(r.txn_count ?? 0),
        paid_amount: Number(r.paid_amount ?? 0),
        unpaid_amount: Number(r.unpaid_amount ?? 0),
        pct_of_group: Number(r.pct_of_group ?? 0),
      }));
    },
    staleTime: 30_000,
  });
}

// -----------------------------------------------------
// Evolução mensal (novo formato)
// -----------------------------------------------------
export interface DREMonthlyPoint {
  month_bucket: string;
  gross_revenue: number;
  net_revenue: number;
  total_expenses: number;
  operating_profit: number;
  net_profit: number;
}

export function useDREMonthlyEvolution(start: Date, end: Date) {
  return useQuery<DREMonthlyPoint[]>({
    queryKey: ["dre", "monthly-v2", toIso(start), toIso(end)],
    queryFn: async () => {
      const { data, error } = await SUPA.rpc("get_dre_monthly_evolution", {
        p_start: toIso(start),
        p_end: toIso(end),
      });
      if (error) throw error;
      return ((data ?? []) as any[]).map((r) => ({
        month_bucket: r.month_bucket,
        gross_revenue: Number(r.gross_revenue ?? 0),
        net_revenue: Number(r.net_revenue ?? 0),
        total_expenses: Number(r.total_expenses ?? 0),
        operating_profit: Number(r.operating_profit ?? 0),
        net_profit: Number(r.net_profit ?? 0),
      }));
    },
    staleTime: 30_000,
  });
}

// -----------------------------------------------------
// Cobertura financeira (mantida)
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
