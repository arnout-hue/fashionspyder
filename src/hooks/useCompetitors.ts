import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Hook to fetch active competitors for filter dropdown
export function useCompetitors() {
  return useQuery({
    queryKey: ["competitors"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("competitors")
        .select("name")
        .eq("is_active", true)
        .order("name");

      if (error) {
        console.error("Error fetching competitors:", error);
        throw error;
      }

      return ["All", ...(data?.map((c) => c.name) || [])];
    },
    staleTime: 300000, // 5 minutes
  });
}
