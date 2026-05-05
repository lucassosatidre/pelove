import { supabase } from "@/integrations/supabase/client";
import { db, tableOf, type Filter, type QueuedMutation, type StrategicTable } from "./db";

const STRATEGIC_TABLES: StrategicTable[] = ["vision", "pillars", "obstacles", "actions"];

type Listener = () => void;
const mutationListeners = new Set<Listener>();
const statusListeners = new Set<Listener>();

let draining = false;
let pendingDrain = false;
let lastSyncStatus: "idle" | "syncing" | "error" = "idle";

export function notifyMutation() {
  for (const l of mutationListeners) l();
}

export function onMutationChange(l: Listener) {
  mutationListeners.add(l);
  return () => mutationListeners.delete(l);
}

export function onStatusChange(l: Listener) {
  statusListeners.add(l);
  return () => statusListeners.delete(l);
}

export function getSyncStatus() {
  return lastSyncStatus;
}

function setStatus(s: typeof lastSyncStatus) {
  lastSyncStatus = s;
  for (const l of statusListeners) l();
}

export async function pendingCount(): Promise<number> {
  return db.mutations.count();
}

function applyFilterToQuery(q: ReturnType<typeof supabase.from>, filters: Filter[]) {
  let chain: any = q;
  for (const f of filters) {
    if (f.op === "eq") chain = chain.eq(f.field, f.value);
    else if (f.op === "in") chain = chain.in(f.field, f.value as unknown[]);
  }
  return chain;
}

async function applyMutation(m: QueuedMutation) {
  const tbl = m.table;
  if (m.op === "insert") {
    const { error } = await supabase.from(tbl).insert(m.payload as never);
    if (error) throw error;
  } else if (m.op === "update") {
    const q = applyFilterToQuery(supabase.from(tbl).update(m.payload as never), m.filters);
    const { error } = await q;
    if (error) throw error;
  } else if (m.op === "delete") {
    const q = applyFilterToQuery(supabase.from(tbl).delete(), m.filters);
    const { error } = await q;
    if (error) throw error;
  }
}

export async function drainQueue(): Promise<void> {
  if (draining) {
    pendingDrain = true;
    return;
  }
  if (!navigator.onLine) return;
  draining = true;
  setStatus("syncing");
  try {
    while (true) {
      const next = await db.mutations.orderBy("id").first();
      if (!next) break;
      try {
        await applyMutation(next);
        if (next.id != null) await db.mutations.delete(next.id);
        notifyMutation();
      } catch (err) {
        const attempts = (next.attempts ?? 0) + 1;
        const message = err instanceof Error ? err.message : String(err);
        if (next.id != null) await db.mutations.update(next.id, { attempts, last_error: message });
        if (attempts >= 5) {
          if (next.id != null) await db.mutations.delete(next.id);
          notifyMutation();
          continue;
        }
        setStatus("error");
        return;
      }
    }
    await refreshFromServer();
    setStatus("idle");
  } finally {
    draining = false;
    if (pendingDrain) {
      pendingDrain = false;
      void drainQueue();
    }
  }
}

export function triggerSync() {
  void drainQueue();
}

export async function refreshFromServer(): Promise<void> {
  if (!navigator.onLine) return;
  if ((await db.mutations.count()) > 0) return;

  for (const tbl of STRATEGIC_TABLES) {
    const { data, error } = await supabase.from(tbl).select("*");
    if (error || !data) continue;
    const t = tableOf(tbl);
    await t.clear();
    if (data.length > 0) await t.bulkPut(data as never);
  }
  await db.meta.put({ key: "last_sync", value: Date.now() });
  notifyMutation();
}

export function startSyncEngine() {
  const handleOnline = () => triggerSync();
  window.addEventListener("online", handleOnline);
  window.addEventListener("focus", handleOnline);
  if (navigator.onLine) triggerSync();
  return () => {
    window.removeEventListener("online", handleOnline);
    window.removeEventListener("focus", handleOnline);
  };
}
