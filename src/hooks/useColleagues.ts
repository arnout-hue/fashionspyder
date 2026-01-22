import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Colleague } from "@/components/ColleagueManagement";
import { toast } from "sonner";

// Hook to fetch all colleagues
export function useColleagues() {
  return useQuery({
    queryKey: ["colleagues"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("colleagues")
        .select("*")
        .order("name");

      if (error) {
        console.error("Error fetching colleagues:", error);
        throw error;
      }

      return data as Colleague[];
    },
    staleTime: 60000, // 1 minute
  });
}

// Mutation to add a new colleague
export function useAddColleague() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      colleague: Omit<Colleague, "id" | "created_at" | "updated_at">
    ) => {
      const { data, error } = await supabase
        .from("colleagues")
        .insert(colleague)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["colleagues"] });
      toast.success("Colleague added");
    },
    onError: (error) => {
      console.error("Error adding colleague:", error);
      toast.error("Failed to add colleague");
    },
  });
}

// Mutation to update an existing colleague
export function useUpdateColleague() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<Colleague>;
    }) => {
      const { error } = await supabase
        .from("colleagues")
        .update(updates)
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["colleagues"] });
      toast.success("Colleague updated");
    },
    onError: (error) => {
      console.error("Error updating colleague:", error);
      toast.error("Failed to update colleague");
    },
  });
}

// Mutation to delete a colleague
export function useDeleteColleague() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("colleagues").delete().eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["colleagues"] });
      toast.success("Colleague deleted");
    },
    onError: (error) => {
      console.error("Error deleting colleague:", error);
      toast.error("Failed to delete colleague");
    },
  });
}
