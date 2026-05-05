import { v4 as uuidv4 } from "uuid";
import { db, tableOf, type Filter, type StrategicTable } from "./db";
import { triggerSync, notifyMutation } from "./sync";

type Row = Record<string, unknown> & { id: string };

function applyFilters<T extends Record<string, unknown>>(rows: T[], filters: Filter[]): T[] {
  return rows.filter((r) =>
    filters.every((f) => {
      const v = r[f.field as keyof T];
      if (f.op === "eq") return v === f.value;
      if (f.op === "in") return Array.isArray(f.value) && (f.value as unknown[]).includes(v);
      return true;
    })
  );
}

class QueryBuilder<T extends Row> {
  private filters: Filter[] = [];
  private orderField: string | null = null;
  private orderAsc = true;
  private limitN: number | null = null;
  private singleMode = false;
  private selectFields: string | null = null;
  private mode: "select" | "insert" | "update" | "delete" = "select";
  private payload: Record<string, unknown> | null = null;
  private inserted: T | null = null;

  constructor(private table: StrategicTable) {}

  select(fields?: string) {
    this.mode = "select";
    this.selectFields = fields ?? "*";
    return this;
  }

  insert(payload: Record<string, unknown>) {
    this.mode = "insert";
    this.payload = payload;
    return this;
  }

  update(payload: Record<string, unknown>) {
    this.mode = "update";
    this.payload = payload;
    return this;
  }

  delete() {
    this.mode = "delete";
    return this;
  }

  eq(field: string, value: unknown) {
    this.filters.push({ field, op: "eq", value });
    return this;
  }

  in(field: string, value: unknown[]) {
    this.filters.push({ field, op: "in", value });
    return this;
  }

  order(field: string, opts?: { ascending?: boolean }) {
    this.orderField = field;
    this.orderAsc = opts?.ascending ?? true;
    return this;
  }

  limit(n: number) {
    this.limitN = n;
    return this;
  }

  single() {
    this.singleMode = true;
    return this;
  }

  private async runSelect(): Promise<{ data: unknown; error: null | { message: string } }> {
    const t = tableOf(this.table);
    let rows = (await t.toArray()) as unknown as T[];
    rows = applyFilters(rows, this.filters);
    if (this.orderField) {
      const f = this.orderField;
      const asc = this.orderAsc ? 1 : -1;
      rows = [...rows].sort((a, b) => {
        const av = a[f] as number | string | null;
        const bv = b[f] as number | string | null;
        if (av == null && bv == null) return 0;
        if (av == null) return 1;
        if (bv == null) return -1;
        if (av < bv) return -1 * asc;
        if (av > bv) return 1 * asc;
        return 0;
      });
    }
    if (this.limitN != null) rows = rows.slice(0, this.limitN);
    if (this.singleMode) {
      if (rows.length === 0) return { data: null, error: { message: "No rows found" } };
      return { data: rows[0], error: null };
    }
    return { data: rows, error: null };
  }

  private async runInsert(): Promise<{ data: unknown; error: null | { message: string } }> {
    const t = tableOf(this.table);
    const row = { ...(this.payload ?? {}) } as Record<string, unknown>;
    if (!row.id) row.id = uuidv4();
    await t.put(row as never);
    this.inserted = row as T;
    await db.mutations.add({
      table: this.table,
      op: "insert",
      payload: row,
      filters: [],
      created_at: Date.now(),
      attempts: 0,
    });
    notifyMutation();
    triggerSync();
    return { data: row, error: null };
  }

  private async runUpdate(): Promise<{ data: unknown; error: null | { message: string } }> {
    const t = tableOf(this.table);
    const all = (await t.toArray()) as unknown as T[];
    const matching = applyFilters(all, this.filters);
    const patch = this.payload ?? {};
    for (const r of matching) {
      await t.put({ ...r, ...patch } as never);
    }
    await db.mutations.add({
      table: this.table,
      op: "update",
      payload: patch,
      filters: this.filters,
      created_at: Date.now(),
      attempts: 0,
    });
    notifyMutation();
    triggerSync();
    return { data: matching, error: null };
  }

  private async runDelete(): Promise<{ data: unknown; error: null | { message: string } }> {
    const t = tableOf(this.table);
    const all = (await t.toArray()) as unknown as T[];
    const matching = applyFilters(all, this.filters);
    const ids = matching.map((r) => r.id);
    if (ids.length > 0) await t.bulkDelete(ids);
    await db.mutations.add({
      table: this.table,
      op: "delete",
      filters: this.filters,
      created_at: Date.now(),
      attempts: 0,
    });
    notifyMutation();
    triggerSync();
    return { data: matching, error: null };
  }

  then<TR1 = unknown, TR2 = never>(
    onFulfilled?: (v: { data: unknown; error: null | { message: string } }) => TR1 | PromiseLike<TR1>,
    onRejected?: (r: unknown) => TR2 | PromiseLike<TR2>
  ): Promise<TR1 | TR2> {
    let p: Promise<{ data: unknown; error: null | { message: string } }>;
    if (this.mode === "select") p = this.runSelect();
    else if (this.mode === "insert") p = this.runInsert();
    else if (this.mode === "update") p = this.runUpdate();
    else p = this.runDelete();
    return p.then(onFulfilled, onRejected);
  }
}

export const supabaseOffline = {
  from<T extends Row = Row>(table: string) {
    return new QueryBuilder<T>(table as StrategicTable);
  },
};
