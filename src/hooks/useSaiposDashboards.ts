import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Granularity = "day" | "week" | "month" | "year";
export type SaleType = 1 | 2 | 3 | 4;

export const SALE_TYPE_LABELS: Record<SaleType, string> = {
  1: "Entrega",
  2: "Balcão",
  3: "Salão",
  4: "Ficha",
};

const SUPA = supabase as any;

function toIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function rpcParams(start: Date, end: Date, saleTypes?: SaleType[]) {
  return {
    p_start: toIso(start),
    p_end: toIso(end),
    p_sale_types: saleTypes && saleTypes.length > 0 ? saleTypes : null,
  };
}

// -----------------------------------------------------
// Data coverage: earliest / latest available dates
// -----------------------------------------------------
export function useDataCoverage() {
  return useQuery({
    queryKey: ["saipos", "coverage"],
    queryFn: async () => {
      const { data, error } = await SUPA.rpc("get_data_coverage");
      if (error) throw error;
      const row = data?.[0] ?? null;
      return row as { earliest_date: string | null; latest_date: string | null; total_sales: number } | null;
    },
    staleTime: 60_000,
  });
}

// -----------------------------------------------------
// Totals (single bucket: revenue, orders, avg ticket)
// -----------------------------------------------------
export interface SalesTotals {
  total_revenue: number;
  total_orders: number;
  avg_ticket: number;
}

export function useSalesTotals(start: Date, end: Date, saleTypes?: SaleType[]) {
  return useQuery<SalesTotals | null>({
    queryKey: ["saipos", "totals", toIso(start), toIso(end), saleTypes ?? []],
    queryFn: async () => {
      const { data, error } = await SUPA.rpc("get_sales_totals", rpcParams(start, end, saleTypes));
      if (error) throw error;
      const row = data?.[0];
      return row
        ? {
            total_revenue: Number(row.total_revenue),
            total_orders: Number(row.total_orders),
            avg_ticket: Number(row.avg_ticket),
          }
        : null;
    },
    staleTime: 30_000,
  });
}

// -----------------------------------------------------
// Time series for the comparative chart
// -----------------------------------------------------
export interface SalesSeriesPoint {
  bucket: string; // ISO date
  revenue: number;
  orders: number;
}

export function useSalesSeries(
  start: Date,
  end: Date,
  granularity: Granularity,
  saleTypes?: SaleType[],
) {
  return useQuery<SalesSeriesPoint[]>({
    queryKey: ["saipos", "series", toIso(start), toIso(end), granularity, saleTypes ?? []],
    queryFn: async () => {
      const { data, error } = await SUPA.rpc("get_sales_series", {
        ...rpcParams(start, end, saleTypes),
        p_granularity: granularity,
      });
      if (error) throw error;
      return ((data ?? []) as any[]).map((r) => ({
        bucket: r.bucket as string,
        revenue: Number(r.revenue),
        orders: Number(r.orders),
      }));
    },
    staleTime: 30_000,
  });
}

// -----------------------------------------------------
// By type
// -----------------------------------------------------
export interface SalesByType {
  id_sale_type: number;
  type_label: string;
  revenue: number;
  orders: number;
}

export function useSalesByType(start: Date, end: Date) {
  return useQuery<SalesByType[]>({
    queryKey: ["saipos", "by-type", toIso(start), toIso(end)],
    queryFn: async () => {
      const { data, error } = await SUPA.rpc("get_sales_by_type", {
        p_start: toIso(start),
        p_end: toIso(end),
      });
      if (error) throw error;
      return ((data ?? []) as any[]).map((r) => ({
        id_sale_type: Number(r.id_sale_type),
        type_label: r.type_label,
        revenue: Number(r.revenue),
        orders: Number(r.orders),
      }));
    },
    staleTime: 30_000,
  });
}

// -----------------------------------------------------
// By shift
// -----------------------------------------------------
export interface SalesByShift {
  shift_label: string;
  starting_time: string;
  revenue: number;
  orders: number;
}

export function useSalesByShift(start: Date, end: Date, saleTypes?: SaleType[]) {
  return useQuery<SalesByShift[]>({
    queryKey: ["saipos", "by-shift", toIso(start), toIso(end), saleTypes ?? []],
    queryFn: async () => {
      const { data, error } = await SUPA.rpc("get_sales_by_shift", rpcParams(start, end, saleTypes));
      if (error) throw error;
      return ((data ?? []) as any[]).map((r) => ({
        shift_label: r.shift_label,
        starting_time: r.starting_time,
        revenue: Number(r.revenue),
        orders: Number(r.orders),
      }));
    },
    staleTime: 30_000,
  });
}

// -----------------------------------------------------
// Heatmap: hour × day-of-week
// -----------------------------------------------------
export interface SalesHeatmapCell {
  dow: number; // 0..6
  hour: number; // 0..23
  revenue: number;
  orders: number;
}

export function useSalesHeatmap(start: Date, end: Date, saleTypes?: SaleType[]) {
  return useQuery<SalesHeatmapCell[]>({
    queryKey: ["saipos", "heatmap", toIso(start), toIso(end), saleTypes ?? []],
    queryFn: async () => {
      const { data, error } = await SUPA.rpc("get_sales_heatmap", rpcParams(start, end, saleTypes));
      if (error) throw error;
      return ((data ?? []) as any[]).map((r) => ({
        dow: Number(r.dow),
        hour: Number(r.hour),
        revenue: Number(r.revenue),
        orders: Number(r.orders),
      }));
    },
    staleTime: 30_000,
  });
}

// -----------------------------------------------------
// Period helpers
// -----------------------------------------------------
export type PeriodPreset =
  | "today"
  | "yesterday"
  | "last_7d"
  | "last_30d"
  | "this_month"
  | "last_month"
  | "this_year"
  | "ytd"
  | "custom";

export function suggestedGranularity(start: Date, end: Date): Granularity {
  const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  if (days <= 31) return "day";
  if (days <= 120) return "week";
  if (days <= 365 * 2) return "month";
  return "year";
}

export function presetToRange(preset: PeriodPreset): { start: Date; end: Date } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  switch (preset) {
    case "today":
      return { start: today, end: today };
    case "yesterday":
      return { start: yesterday, end: yesterday };
    case "last_7d": {
      const s = new Date(yesterday); s.setDate(s.getDate() - 6);
      return { start: s, end: yesterday };
    }
    case "last_30d": {
      const s = new Date(yesterday); s.setDate(s.getDate() - 29);
      return { start: s, end: yesterday };
    }
    case "this_month": {
      const s = new Date(today.getFullYear(), today.getMonth(), 1);
      return { start: s, end: yesterday < s ? s : yesterday };
    }
    case "last_month": {
      const s = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const e = new Date(today.getFullYear(), today.getMonth(), 0);
      return { start: s, end: e };
    }
    case "this_year": {
      const s = new Date(today.getFullYear(), 0, 1);
      return { start: s, end: yesterday < s ? s : yesterday };
    }
    case "ytd": {
      const s = new Date(today.getFullYear(), 0, 1);
      return { start: s, end: yesterday < s ? s : yesterday };
    }
    default:
      return { start: yesterday, end: yesterday };
  }
}

// -----------------------------------------------------
// Top products with dedup across channels
// -----------------------------------------------------
export interface TopProduct {
  normalized_name: string;
  display_name: string;
  quantity: number;
  revenue: number;
  orders: number;
  channels: string[];
}

export function useTopProducts(start: Date, end: Date, saleTypes?: SaleType[], limit = 30) {
  return useQuery<TopProduct[]>({
    queryKey: ["saipos", "top-products", toIso(start), toIso(end), saleTypes ?? [], limit],
    queryFn: async () => {
      const { data, error } = await SUPA.rpc("get_top_products", {
        ...rpcParams(start, end, saleTypes),
        p_limit: limit,
      });
      if (error) throw error;
      return ((data ?? []) as any[]).map((r) => ({
        normalized_name: r.normalized_name,
        display_name: r.display_name ?? r.normalized_name,
        quantity: Number(r.quantity),
        revenue: Number(r.revenue),
        orders: Number(r.orders),
        channels: r.channels ?? [],
      }));
    },
    staleTime: 30_000,
  });
}

// -----------------------------------------------------
// Products by hour (top-N products with hourly breakdown)
// -----------------------------------------------------
export interface ProductByHourRow {
  normalized_name: string;
  display_name: string;
  hour: number;
  quantity: number;
  orders: number;
}

export function useProductsByHour(start: Date, end: Date, saleTypes?: SaleType[], topN = 8) {
  return useQuery<ProductByHourRow[]>({
    queryKey: ["saipos", "products-by-hour", toIso(start), toIso(end), saleTypes ?? [], topN],
    queryFn: async () => {
      const { data, error } = await SUPA.rpc("get_product_by_hour", {
        ...rpcParams(start, end, saleTypes),
        p_top_products: topN,
      });
      if (error) throw error;
      return ((data ?? []) as any[]).map((r) => ({
        normalized_name: r.normalized_name,
        display_name: r.display_name ?? r.normalized_name,
        hour: Number(r.hour),
        quantity: Number(r.quantity),
        orders: Number(r.orders),
      }));
    },
    staleTime: 30_000,
  });
}

// -----------------------------------------------------
// Products by day of week
// -----------------------------------------------------
export interface ProductByDowRow {
  normalized_name: string;
  display_name: string;
  dow: number;
  quantity: number;
  orders: number;
}

export function useProductsByDow(start: Date, end: Date, saleTypes?: SaleType[], topN = 8) {
  return useQuery<ProductByDowRow[]>({
    queryKey: ["saipos", "products-by-dow", toIso(start), toIso(end), saleTypes ?? [], topN],
    queryFn: async () => {
      const { data, error } = await SUPA.rpc("get_product_by_dow", {
        ...rpcParams(start, end, saleTypes),
        p_top_products: topN,
      });
      if (error) throw error;
      return ((data ?? []) as any[]).map((r) => ({
        normalized_name: r.normalized_name,
        display_name: r.display_name ?? r.normalized_name,
        dow: Number(r.dow),
        quantity: Number(r.quantity),
        orders: Number(r.orders),
      }));
    },
    staleTime: 30_000,
  });
}

// -----------------------------------------------------
// Top addons / complementos
// -----------------------------------------------------
export interface TopAddon {
  addon_name: string;
  uses: number;
  total_additional_value: number;
  parent_products: string[];
}

export function useTopAddons(start: Date, end: Date, saleTypes?: SaleType[], limit = 30) {
  return useQuery<TopAddon[]>({
    queryKey: ["saipos", "top-addons", toIso(start), toIso(end), saleTypes ?? [], limit],
    queryFn: async () => {
      const { data, error } = await SUPA.rpc("get_top_addons", {
        ...rpcParams(start, end, saleTypes),
        p_limit: limit,
      });
      if (error) throw error;
      return ((data ?? []) as any[]).map((r) => ({
        addon_name: r.addon_name,
        uses: Number(r.uses),
        total_additional_value: Number(r.total_additional_value),
        parent_products: r.parent_products ?? [],
      }));
    },
    staleTime: 30_000,
  });
}

// -----------------------------------------------------
// Operations: average time per status
// -----------------------------------------------------
export interface StatusAvgTime {
  status_label: string;
  avg_seconds: number;
  median_seconds: number;
  p90_seconds: number;
  total_events: number;
}

export function useStatusAvgTimes(start: Date, end: Date, saleTypes?: SaleType[]) {
  return useQuery<StatusAvgTime[]>({
    queryKey: ["saipos", "status-times", toIso(start), toIso(end), saleTypes ?? []],
    queryFn: async () => {
      const { data, error } = await SUPA.rpc("get_status_avg_times", rpcParams(start, end, saleTypes));
      if (error) throw error;
      return ((data ?? []) as any[]).map((r) => ({
        status_label: r.status_label,
        avg_seconds: Number(r.avg_seconds),
        median_seconds: Number(r.median_seconds),
        p90_seconds: Number(r.p90_seconds),
        total_events: Number(r.total_events),
      }));
    },
    staleTime: 30_000,
  });
}

// -----------------------------------------------------
// Slowest orders
// -----------------------------------------------------
export interface SlowOrder {
  id_sale: number;
  shift_date: string;
  id_sale_type: number;
  type_label: string;
  created_at: string | null;
  partner_desc: string | null;
  total_amount: number | null;
  total_seconds: number;
  worst_status: string | null;
  worst_status_seconds: number | null;
}

export function useSlowestOrders(start: Date, end: Date, saleTypes?: SaleType[], limit = 30) {
  return useQuery<SlowOrder[]>({
    queryKey: ["saipos", "slowest-orders", toIso(start), toIso(end), saleTypes ?? [], limit],
    queryFn: async () => {
      const { data, error } = await SUPA.rpc("get_slowest_orders", {
        ...rpcParams(start, end, saleTypes),
        p_limit: limit,
      });
      if (error) throw error;
      return ((data ?? []) as any[]).map((r) => ({
        id_sale: Number(r.id_sale),
        shift_date: r.shift_date,
        id_sale_type: Number(r.id_sale_type),
        type_label: r.type_label,
        created_at: r.created_at,
        partner_desc: r.partner_desc,
        total_amount: r.total_amount != null ? Number(r.total_amount) : null,
        total_seconds: Number(r.total_seconds),
        worst_status: r.worst_status,
        worst_status_seconds: r.worst_status_seconds != null ? Number(r.worst_status_seconds) : null,
      }));
    },
    staleTime: 30_000,
  });
}

// -----------------------------------------------------
// Cancellations
// -----------------------------------------------------
export interface CancellationByReason { reason: string; count: number; }
export interface CancellationByDay { date: string; count: number; value: number; }

export interface CancellationsResult {
  total_cancellations: number;
  total_cancellation_value: number;
  cancellation_rate_pct: number;
  by_reason: CancellationByReason[];
  by_day: CancellationByDay[];
}

export function useCancellations(start: Date, end: Date, saleTypes?: SaleType[]) {
  return useQuery<CancellationsResult | null>({
    queryKey: ["saipos", "cancellations", toIso(start), toIso(end), saleTypes ?? []],
    queryFn: async () => {
      const { data, error } = await SUPA.rpc("get_cancellations", rpcParams(start, end, saleTypes));
      if (error) throw error;
      const row = data?.[0];
      if (!row) return null;
      return {
        total_cancellations: Number(row.total_cancellations ?? 0),
        total_cancellation_value: Number(row.total_cancellation_value ?? 0),
        cancellation_rate_pct: Number(row.cancellation_rate_pct ?? 0),
        by_reason: (row.by_reason ?? []) as CancellationByReason[],
        by_day: (row.by_day ?? []) as CancellationByDay[],
      };
    },
    staleTime: 30_000,
  });
}

// -----------------------------------------------------
// People: waiter ranking
// -----------------------------------------------------
export interface WaiterRanking {
  id_store_waiter: number;
  total_revenue: number;
  total_items: number;
  total_orders: number;
}

export function useWaiterRanking(start: Date, end: Date, limit = 30) {
  return useQuery<WaiterRanking[]>({
    queryKey: ["saipos", "waiter-ranking", toIso(start), toIso(end), limit],
    queryFn: async () => {
      const { data, error } = await SUPA.rpc("get_waiter_ranking", {
        p_start: toIso(start),
        p_end: toIso(end),
        p_limit: limit,
      });
      if (error) throw error;
      return ((data ?? []) as any[]).map((r) => ({
        id_store_waiter: Number(r.id_store_waiter),
        total_revenue: Number(r.total_revenue),
        total_items: Number(r.total_items),
        total_orders: Number(r.total_orders),
      }));
    },
    staleTime: 30_000,
  });
}

// -----------------------------------------------------
// People: table metrics
// -----------------------------------------------------
export interface TableMetrics {
  total_table_orders: number;
  total_customers: number;
  avg_customers_per_table: number | null;
  avg_table_revenue: number | null;
  avg_minutes_open: number | null;
  total_revenue: number;
}

export function useTableMetrics(start: Date, end: Date) {
  return useQuery<TableMetrics | null>({
    queryKey: ["saipos", "table-metrics", toIso(start), toIso(end)],
    queryFn: async () => {
      const { data, error } = await SUPA.rpc("get_table_metrics", {
        p_start: toIso(start),
        p_end: toIso(end),
      });
      if (error) throw error;
      const r = data?.[0];
      if (!r) return null;
      return {
        total_table_orders: Number(r.total_table_orders ?? 0),
        total_customers: Number(r.total_customers ?? 0),
        avg_customers_per_table: r.avg_customers_per_table != null ? Number(r.avg_customers_per_table) : null,
        avg_table_revenue: r.avg_table_revenue != null ? Number(r.avg_table_revenue) : null,
        avg_minutes_open: r.avg_minutes_open != null ? Number(r.avg_minutes_open) : null,
        total_revenue: Number(r.total_revenue ?? 0),
      };
    },
    staleTime: 30_000,
  });
}

// -----------------------------------------------------
// Service charge metrics
// -----------------------------------------------------
export interface ServiceChargeMetrics {
  total_orders_with_charge: number;
  total_charged: number;
  total_paid_estimated: number;
  total_refused_estimated: number;
  refused_pct: number;
}

export function useServiceCharge(start: Date, end: Date) {
  return useQuery<ServiceChargeMetrics | null>({
    queryKey: ["saipos", "service-charge", toIso(start), toIso(end)],
    queryFn: async () => {
      const { data, error } = await SUPA.rpc("get_service_charge_metrics", {
        p_start: toIso(start),
        p_end: toIso(end),
      });
      if (error) throw error;
      const r = data?.[0];
      if (!r) return null;
      return {
        total_orders_with_charge: Number(r.total_orders_with_charge ?? 0),
        total_charged: Number(r.total_charged ?? 0),
        total_paid_estimated: Number(r.total_paid_estimated ?? 0),
        total_refused_estimated: Number(r.total_refused_estimated ?? 0),
        refused_pct: Number(r.refused_pct ?? 0),
      };
    },
    staleTime: 30_000,
  });
}

// -----------------------------------------------------
// Top customers
// -----------------------------------------------------
export interface TopCustomer {
  customer_id_customer: number;
  customer_name: string | null;
  customer_phone: string | null;
  total_revenue: number;
  total_orders: number;
  avg_ticket: number;
  last_order_date: string;
  first_order_date: string;
}

export function useTopCustomers(start: Date, end: Date, limit = 30) {
  return useQuery<TopCustomer[]>({
    queryKey: ["saipos", "top-customers", toIso(start), toIso(end), limit],
    queryFn: async () => {
      const { data, error } = await SUPA.rpc("get_top_customers", {
        p_start: toIso(start),
        p_end: toIso(end),
        p_limit: limit,
      });
      if (error) throw error;
      return ((data ?? []) as any[]).map((r) => ({
        customer_id_customer: Number(r.customer_id_customer),
        customer_name: r.customer_name,
        customer_phone: r.customer_phone,
        total_revenue: Number(r.total_revenue),
        total_orders: Number(r.total_orders),
        avg_ticket: Number(r.avg_ticket ?? 0),
        last_order_date: r.last_order_date,
        first_order_date: r.first_order_date,
      }));
    },
    staleTime: 30_000,
  });
}

// -----------------------------------------------------
// Delivery time
// -----------------------------------------------------
export interface DeliveryTimeMetrics {
  total_delivery_orders: number;
  avg_minutes: number;
  median_minutes: number;
  p90_minutes: number;
}

export function useDeliveryTime(start: Date, end: Date) {
  return useQuery<DeliveryTimeMetrics | null>({
    queryKey: ["saipos", "delivery-time", toIso(start), toIso(end)],
    queryFn: async () => {
      const { data, error } = await SUPA.rpc("get_delivery_time_metrics", {
        p_start: toIso(start),
        p_end: toIso(end),
      });
      if (error) throw error;
      const r = data?.[0];
      if (!r) return null;
      return {
        total_delivery_orders: Number(r.total_delivery_orders ?? 0),
        avg_minutes: Number(r.avg_minutes ?? 0),
        median_minutes: Number(r.median_minutes ?? 0),
        p90_minutes: Number(r.p90_minutes ?? 0),
      };
    },
    staleTime: 30_000,
  });
}

// Comparison range = same length, immediately preceding OR same period last year
export type ComparisonMode = "previous_period" | "previous_year";

export function comparisonRange(
  start: Date,
  end: Date,
  mode: ComparisonMode,
): { start: Date; end: Date } {
  if (mode === "previous_year") {
    const s = new Date(start); s.setFullYear(s.getFullYear() - 1);
    const e = new Date(end); e.setFullYear(e.getFullYear() - 1);
    return { start: s, end: e };
  }
  // previous_period
  const days = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  const e = new Date(start); e.setDate(e.getDate() - 1);
  const s = new Date(e); s.setDate(s.getDate() - (days - 1));
  return { start: s, end: e };
}
