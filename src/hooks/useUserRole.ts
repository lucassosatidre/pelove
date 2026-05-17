import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type AppRole = "admin" | "operador";

export function useUserRole() {
  const { user } = useAuth();
  const query = useQuery({
    queryKey: ["user-role", user?.id],
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<AppRole> => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id);
      if (error) throw error;
      const roles = (data ?? []).map((r) => r.role as AppRole);
      if (roles.includes("admin")) return "admin";
      if (roles.includes("operador")) return "operador";
      return "operador";
    },
  });

  return {
    role: query.data,
    isAdmin: query.data === "admin",
    isOperador: query.data === "operador",
    loading: query.isLoading,
  };
}
