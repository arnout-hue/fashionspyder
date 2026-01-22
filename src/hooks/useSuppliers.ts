import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Supplier } from "@/data/mockData";
import { toast } from "sonner";

// Hook to fetch all suppliers
export function useSuppliers() {
  return useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suppliers")
        .select("*")
        .order("name");

      if (error) {
        console.error("Error fetching suppliers:", error);
        throw error;
      }

      return data as Supplier[];
    },
    staleTime: 60000, // 1 minute
  });
}

// Mutation to add a new supplier
export function useAddSupplier() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      supplier: Omit<Supplier, "id" | "created_at" | "updated_at">
    ) => {
      const { data, error } = await supabase
        .from("suppliers")
        .insert(supplier)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      toast.success("Supplier added");
    },
    onError: (error) => {
      console.error("Error adding supplier:", error);
      toast.error("Failed to add supplier");
    },
  });
}

// Mutation to update an existing supplier
export function useUpdateSupplier() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<Supplier>;
    }) => {
      const { error } = await supabase
        .from("suppliers")
        .update(updates)
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      toast.success("Supplier updated");
    },
    onError: (error) => {
      console.error("Error updating supplier:", error);
      toast.error("Failed to update supplier");
    },
  });
}

// Mutation to delete a supplier
export function useDeleteSupplier() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // First unassign products from this supplier
      await supabase
        .from("products")
        .update({ supplier_id: null })
        .eq("supplier_id", id);

      const { error } = await supabase.from("suppliers").delete().eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Supplier deleted");
    },
    onError: (error) => {
      console.error("Error deleting supplier:", error);
      toast.error("Failed to delete supplier");
    },
  });
}
