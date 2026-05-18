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

// Auth-aware cache isolation: wipe Dexie on sign-out or when the active user
// changes between sessions on the same browser. Imported lazily to avoid a
// circular import with the supabase client module.
let __lastUserId: string | null | undefined = undefined;
async function __handleAuthChange(userId: string | null) {
  if (__lastUserId === undefined) {
    // First boot: compare with stamped user_id from previous session
    const stamped = (await db.meta.get("user_id"))?.value as string | undefined;
    __lastUserId = stamped ?? null;
    if (stamped && stamped !== userId) {
      await clearAllOfflineData();
    }
  }
  if (__lastUserId !== userId) {
    if (__lastUserId !== null || userId === null) {
      // User switched (or signed out) — wipe everything cached for the old user.
      await clearAllOfflineData();
    }
    __lastUserId = userId;
  }
  if (userId) {
    await db.meta.put({ key: "user_id", value: userId });
  }
}

if (typeof window !== "undefined") {
  import("@/integrations/supabase/client").then(({ supabase }) => {
    supabase.auth.getSession().then(({ data }) => {
      void __handleAuthChange(data.session?.user.id ?? null);
    });
    supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        void __handleAuthChange(null);
      } else if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
        void __handleAuthChange(session?.user.id ?? null);
      }
    });
  });
}

