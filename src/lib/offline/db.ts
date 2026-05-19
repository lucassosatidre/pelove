import Dexie, { type Table } from "dexie";

export type StrategicTable = "vision" | "pillars" | "obstacles" | "actions";

export type MutationOp = "insert" | "update" | "delete";

export interface Filter {
  field: string;
  op: "eq" | "in";
  value: unknown;
}

export interface QueuedMutation {
  id?: number;
  table: StrategicTable;
  op: MutationOp;
  payload?: Record<string, unknown>;
  filters: Filter[];
  created_at: number;
  attempts: number;
  last_error?: string | null;
}

export interface VisionRow {
  id: string;
  text: string;
  reference_year: number;
}

export interface PillarRow {
  id: string;
  number: number;
  name: string;
  display_order: number;
  bg_color: string | null;
  text_color: string | null;
  is_bold: boolean | null;
}

export interface ObstacleRow {
  id: string;
  pillar_id: string;
  code: string;
  description: string | null;
  display_order: number;
  bg_color: string | null;
  text_color: string | null;
  is_bold: boolean | null;
}

export interface ActionRow {
  id: string;
  obstacle_id: string;
  description: string;
  area: string | null;
  expected_result: string | null;
  deliverable: string | null;
  responsible: string | null;
  deadline: string | null;
  start_date: string | null;
  status: string;
  importance: number | null;
  urgency: number | null;
  reliability: number | null;
  priority_score: number | null;
  execution_order: number | null;
  bg_color: string | null;
  text_color: string | null;
  is_bold: boolean | null;
}

class StrategicDb extends Dexie {
  vision!: Table<VisionRow, string>;
  pillars!: Table<PillarRow, string>;
  obstacles!: Table<ObstacleRow, string>;
  actions!: Table<ActionRow, string>;
  mutations!: Table<QueuedMutation, number>;
  meta!: Table<{ key: string; value: unknown }, string>;

  constructor() {
    super("pelove-strategic");
    this.version(1).stores({
      vision: "id",
      pillars: "id, display_order",
      obstacles: "id, pillar_id, display_order",
      actions: "id, obstacle_id, execution_order",
      mutations: "++id, table, created_at",
      meta: "key",
    });
    // v2: actions ganhou start_date — schema de índice é o mesmo, só
    // bumpamos pra forçar reabertura limpa em clientes antigos.
    this.version(2).stores({
      vision: "id",
      pillars: "id, display_order",
      obstacles: "id, pillar_id, display_order",
      actions: "id, obstacle_id, execution_order",
      mutations: "++id, table, created_at",
      meta: "key",
    });
  }
}

export const db = new StrategicDb();

export function tableOf(name: StrategicTable) {
  switch (name) {
    case "vision": return db.vision;
    case "pillars": return db.pillars;
    case "obstacles": return db.obstacles;
    case "actions": return db.actions;
  }
}

/**
 * Clear ALL cached strategic data + queued mutations + meta.
 * Used when user logs out or when a different user logs in on the same browser,
 * to prevent cross-user data leakage from IndexedDB.
 */
export async function clearAllOfflineData(): Promise<void> {
  try {
    await Promise.all([
      db.vision.clear(),
      db.pillars.clear(),
      db.obstacles.clear(),
      db.actions.clear(),
      db.mutations.clear(),
      db.meta.clear(),
    ]);
  } catch (e) {
    console.error("[offline] failed to clear Dexie tables", e);
  }
}

/**
 * Reconcile the offline Dexie cache with the currently-authenticated user.
 *
 * Must be called by the auth provider on every onAuthStateChange + getSession,
 * BEFORE `loading` flips to false — so protected routes don't render against
 * stale data from a previous session on the same browser.
 *
 * Returns true when the cache was wiped, so the caller can also reset
 * higher-level caches (React Query). On first boot we compare against a
 * `user_id` stamp persisted in `db.meta` from the previous session.
 */
let __lastUserId: string | null | undefined = undefined;
export async function syncOfflineCacheToUser(userId: string | null): Promise<boolean> {
  let wiped = false;
  if (__lastUserId === undefined) {
    const stamped = (await db.meta.get("user_id"))?.value as string | undefined;
    __lastUserId = stamped ?? null;
    if (stamped && stamped !== userId) {
      await clearAllOfflineData();
      wiped = true;
    }
  }
  if (__lastUserId !== userId) {
    if (__lastUserId !== null || userId === null) {
      await clearAllOfflineData();
      wiped = true;
    }
    __lastUserId = userId;
  }
  if (userId) {
    await db.meta.put({ key: "user_id", value: userId });
  }
  return wiped;
}

