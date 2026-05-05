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
