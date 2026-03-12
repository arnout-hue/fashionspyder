import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

export interface ProductComment {
  id: string;
  product_id: string;
  user_id: string;
  user_email: string | null;
  content: string;
  mentioned_user_ids: string[];
  created_at: string;
}

export function useProductComments(productId: string | null) {
  return useQuery({
    queryKey: ["productComments", productId],
    queryFn: async () => {
      if (!productId) return [];
      const { data, error } = await supabase
        .from("product_comments" as any)
        .select("*")
        .eq("product_id", productId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return (data as any[]) as ProductComment[];
    },
    enabled: !!productId,
  });
}

export function useAddComment() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      productId,
      content,
      mentionedUserIds,
    }: {
      productId: string;
      content: string;
      mentionedUserIds?: string[];
    }) => {
      const { error } = await supabase.from("product_comments" as any).insert({
        product_id: productId,
        user_id: user?.id,
        user_email: user?.email,
        content,
        mentioned_user_ids: mentionedUserIds || [],
      } as any);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["productComments", variables.productId] });
      toast.success("Comment added");
    },
    onError: () => toast.error("Failed to add comment"),
  });
}

export function useDeleteComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ commentId, productId }: { commentId: string; productId: string }) => {
      const { error } = await supabase
        .from("product_comments" as any)
        .delete()
        .eq("id", commentId);

      if (error) throw error;
      return productId;
    },
    onSuccess: (productId) => {
      queryClient.invalidateQueries({ queryKey: ["productComments", productId] });
      toast.success("Comment deleted");
    },
    onError: () => toast.error("Failed to delete comment"),
  });
}

export function useTeamProfiles() {
  return useQuery({
    queryKey: ["teamProfiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, full_name")
        .eq("is_approved", true);

      if (error) throw error;
      return data || [];
    },
    staleTime: 300000,
  });
}
