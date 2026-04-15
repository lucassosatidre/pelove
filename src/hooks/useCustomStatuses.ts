import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CustomStatus {
  id: string;
  value: string;
  label: string;
  color: string;
  display_order: number;
  is_default: boolean;
}

export function useCustomStatuses() {
  return useQuery({
    queryKey: ["custom-statuses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("custom_statuses")
        .select("*")
        .order("display_order");
      if (error) throw error;
      return data as CustomStatus[];
    },
  });
}

export function useCreateCustomStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { label: string; color: string }) => {
      const value = input.label
        .toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, "_")
        .replace(/[^a-z0-9_]/g, "");

      const { data: max } = await supabase
        .from("custom_statuses")
        .select("display_order")
        .order("display_order", { ascending: false })
        .limit(1)
        .single();

      const nextOrder = (max?.display_order ?? 0) + 1;

      const { data, error } = await supabase
        .from("custom_statuses")
        .insert({ value, label: input.label, color: input.color, display_order: nextOrder })
        .select()
        .single();
      if (error) throw error;
      return data as CustomStatus;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["custom-statuses"] }),
  });
}
