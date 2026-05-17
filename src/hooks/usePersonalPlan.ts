import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const SUPA = supabase as any;

export interface PersonalProfile {
  user_id: string;
  age: number | null;
  values: string[];
  energizes: string | null;
  drains: string | null;
  life_marker: string | null;
  wizard_completed: boolean;
  wizard_step: number;
  last_review_at: string | null;
}

export interface LifePillar {
  id: string;
  user_id: string;
  name: string;
  icon: string | null;
  priority: number | null;
  vision_text: string | null;
  horizon_years: number;
  is_custom: boolean;
  display_order: number;
}

export interface LifeObstacle {
  id: string;
  pillar_id: string;
  title: string;
  display_order: number;
}

export interface LifeAction {
  id: string;
  pillar_id: string | null;
  obstacle_id: string | null;
  title: string;
  deadline: string | null;
  status: string;
  mapped_to_strategic_action_id: string | null;
  display_order: number;
}

export interface PersonalPerson {
  id: string;
  name: string;
  role: string | null;
  importance: number | null;
  needs_alignment: boolean;
  notes: string | null;
  display_order: number;
}

export interface PersonalMilestone {
  id: string;
  label: string;
  target_date: string | null;
  horizon_years: number | null;
  pillar_id: string | null;
  display_order: number;
}

const KEY = ["personal-plan"];

export function usePersonalPlan() {
  const { user } = useAuth();
  const enabled = !!user;

  const profile = useQuery<PersonalProfile | null>({
    queryKey: [...KEY, "profile", user?.id],
    enabled,
    queryFn: async () => {
      const { data, error } = await SUPA.from("personal_profile").select("*").maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const pillars = useQuery<LifePillar[]>({
    queryKey: [...KEY, "pillars", user?.id],
    enabled,
    queryFn: async () => {
      const { data, error } = await SUPA.from("life_pillars").select("*").order("display_order");
      if (error) throw error;
      return data ?? [];
    },
  });

  const obstacles = useQuery<LifeObstacle[]>({
    queryKey: [...KEY, "obstacles", user?.id],
    enabled,
    queryFn: async () => {
      const { data, error } = await SUPA.from("life_obstacles").select("*").order("display_order");
      if (error) throw error;
      return data ?? [];
    },
  });

  const actions = useQuery<LifeAction[]>({
    queryKey: [...KEY, "actions", user?.id],
    enabled,
    queryFn: async () => {
      const { data, error } = await SUPA.from("life_actions").select("*").order("display_order");
      if (error) throw error;
      return data ?? [];
    },
  });

  const people = useQuery<PersonalPerson[]>({
    queryKey: [...KEY, "people", user?.id],
    enabled,
    queryFn: async () => {
      const { data, error } = await SUPA.from("personal_people").select("*").order("display_order");
      if (error) throw error;
      return data ?? [];
    },
  });

  const milestones = useQuery<PersonalMilestone[]>({
    queryKey: [...KEY, "milestones", user?.id],
    enabled,
    queryFn: async () => {
      const { data, error } = await SUPA.from("personal_milestones").select("*").order("horizon_years");
      if (error) throw error;
      return data ?? [];
    },
  });

  return { profile, pillars, obstacles, actions, people, milestones };
}

// ---------- mutations ----------
export function useUpsertProfile() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (patch: Partial<PersonalProfile>) => {
      const payload = { user_id: user!.id, ...patch };
      const { error } = await SUPA.from("personal_profile").upsert(payload, { onConflict: "user_id" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [...KEY, "profile"] }),
  });
}

export function useCreatePillar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: Partial<LifePillar>) => {
      const { data, error } = await SUPA.from("life_pillars").insert(p).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [...KEY, "pillars"] }),
  });
}

export function useUpdatePillar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<LifePillar> & { id: string }) => {
      const { error } = await SUPA.from("life_pillars").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [...KEY, "pillars"] }),
  });
}

export function useDeletePillar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await SUPA.from("life_pillars").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [...KEY] });
    },
  });
}

export function useCreateObstacle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (o: Partial<LifeObstacle>) => {
      const { data, error } = await SUPA.from("life_obstacles").insert(o).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [...KEY, "obstacles"] }),
  });
}

export function useDeleteObstacle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await SUPA.from("life_obstacles").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [...KEY] }),
  });
}

export function useCreateAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (a: Partial<LifeAction>) => {
      const { data, error } = await SUPA.from("life_actions").insert(a).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [...KEY, "actions"] }),
  });
}

export function useUpdateAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<LifeAction> & { id: string }) => {
      const { error } = await SUPA.from("life_actions").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [...KEY, "actions"] }),
  });
}

export function useDeleteAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await SUPA.from("life_actions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [...KEY, "actions"] }),
  });
}

export function useCreatePerson() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: Partial<PersonalPerson>) => {
      const { error } = await SUPA.from("personal_people").insert(p);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [...KEY, "people"] }),
  });
}

export function useDeletePerson() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await SUPA.from("personal_people").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [...KEY, "people"] }),
  });
}

export function useCreateMilestone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (m: Partial<PersonalMilestone>) => {
      const { error } = await SUPA.from("personal_milestones").insert(m);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [...KEY, "milestones"] }),
  });
}

export function useDeleteMilestone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await SUPA.from("personal_milestones").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [...KEY, "milestones"] }),
  });
}

export const PREDEFINED_PILLARS = [
  { name: "Saúde", icon: "Heart" },
  { name: "Família", icon: "Users" },
  { name: "Financeiro", icon: "Wallet" },
  { name: "Carreira/Negócio", icon: "Briefcase" },
  { name: "Propósito", icon: "Compass" },
  { name: "Relacionamentos", icon: "HeartHandshake" },
  { name: "Conhecimento", icon: "BookOpen" },
  { name: "Lazer", icon: "Sparkles" },
];

export const TOTAL_WIZARD_STEPS = 6;
