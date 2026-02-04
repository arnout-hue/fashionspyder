import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ProductWithCollections, ProductCollection } from "@/data/mockData";
import { toast } from "sonner";
import { useActivityLog } from "./useActivityLog";

const PAGE_SIZE = 50;

// Fetch products with server-side status and competitor filtering
async function fetchProductsByStatus(
  status: string | string[],
  competitor: string,
  page: number
): Promise<{ data: ProductWithCollections[]; count: number; hasMore: boolean }> {
  const from = page * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase
    .from("products")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  // Apply status filter (single or multiple)
  if (Array.isArray(status)) {
    query = query.in("status", status);
  } else {
    query = query.eq("status", status);
  }

  if (competitor !== "All") {
    query = query.eq("competitor", competitor);
  }

  const { data: productsData, count, error } = await query;

  if (error) {
    console.error("Error fetching products:", error);
    throw error;
  }

  // Fetch product collections in a single query (fixes N+1)
  const productIds = productsData?.map((p) => p.id) || [];
  const collectionsMap = new Map<string, ProductCollection[]>();

  if (productIds.length > 0) {
    const { data: productCollectionsData } = await supabase
      .from("product_collections")
      .select("product_id, collection_id, collections(id, name, color)")
      .in("product_id", productIds);

    if (productCollectionsData) {
      for (const pc of productCollectionsData) {
        if (pc.product_id && pc.collections) {
          const collection = pc.collections as unknown as {
            id: string;
            name: string;
            color: string;
          };
          if (!collectionsMap.has(pc.product_id)) {
            collectionsMap.set(pc.product_id, []);
          }
          collectionsMap.get(pc.product_id)!.push({
            id: collection.id,
            name: collection.name,
            color: collection.color || "#6366f1",
          });
        }
      }
    }
  }

  const mappedProducts: ProductWithCollections[] = (productsData || []).map(
    (p) => ({
      id: p.id,
      name: p.name,
      competitor: p.competitor,
      price: p.price || undefined,
      image_url: p.image_url || undefined,
      product_url: p.product_url,
      sku: p.sku || undefined,
      status: p.status as "pending" | "positive" | "negative" | "requested" | "trash",
      supplier_id: p.supplier_id || undefined,
      notes: p.notes || undefined,
      is_sent: p.is_sent,
      created_at: p.created_at,
      updated_at: p.updated_at,
      collections: collectionsMap.get(p.id) || [],
    })
  );

  return {
    data: mappedProducts,
    count: count || 0,
    hasMore: (productsData?.length || 0) === PAGE_SIZE,
  };
}

// Hook to fetch products by status with pagination support
export function useProducts(
  status: string | string[],
  competitor: string,
  page: number = 0
) {
  return useQuery({
    queryKey: ["products", status, competitor, page],
    queryFn: () => fetchProductsByStatus(status, competitor, page),
    staleTime: 30000, // 30 seconds
  });
}

// Hook to get product counts for navigation badges (uses server-side RPC to avoid row limits)
export function useProductCounts(competitor: string) {
  return useQuery({
    queryKey: ["productCounts", competitor],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_product_counts", {
        filter_competitor: competitor === "All" ? null : competitor,
      });

      if (error) throw error;

      // RPC returns a single row with the counts
      const row = data?.[0];
      return {
        pending: Number(row?.pending_count || 0),
        positive: Number(row?.positive_count || 0),
        negative: Number(row?.negative_count || 0),
        trash: Number(row?.trash_count || 0),
      };
    },
    staleTime: 10000, // 10 seconds
  });
}

// Mutation to update product status with activity logging
export function useUpdateProductStatus() {
  const queryClient = useQueryClient();
  const { logActivity } = useActivityLog();

  return useMutation({
    mutationFn: async ({
      productId,
      status,
      additionalUpdates = {},
    }: {
      productId: string;
      status: string;
      additionalUpdates?: Record<string, unknown>;
    }) => {
      const { error } = await supabase
        .from("products")
        .update({ status, ...additionalUpdates })
        .eq("id", productId);

      if (error) throw error;
      return { productId, status };
    },
    onSuccess: ({ productId, status }) => {
      // Log swipe activity for analytics
      const action =
        status === "positive"
          ? "Swiped right (positive)"
          : status === "negative"
          ? "Swiped left (negative)"
          : status === "trash"
          ? "Moved to trash"
          : `Status changed to ${status}`;

      logActivity(action, "product", "product", productId, undefined, {
        new_status: status,
      });

      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["productCounts"] });
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
    },
    onError: () => {
      toast.error("Failed to update product");
    },
  });
}

// Mutation for bulk status updates with activity logging
export function useBulkUpdateStatus() {
  const queryClient = useQueryClient();
  const { logActivity } = useActivityLog();

  return useMutation({
    mutationFn: async ({
      productIds,
      status,
      clearSupplier = false,
    }: {
      productIds: string[];
      status: string;
      clearSupplier?: boolean;
    }) => {
      const updates: Record<string, unknown> = { status };
      if (clearSupplier) {
        updates.supplier_id = null;
      }

      const { error } = await supabase
        .from("products")
        .update(updates)
        .in("id", productIds);

      if (error) throw error;
      return { count: productIds.length, status, productIds };
    },
    onSuccess: ({ count, status, productIds }) => {
      // Log bulk action
      const action =
        status === "positive"
          ? `Bulk marked ${count} products positive`
          : status === "negative"
          ? `Bulk marked ${count} products negative`
          : status === "trash"
          ? `Bulk moved ${count} products to trash`
          : `Bulk changed ${count} products to ${status}`;

      logActivity(action, "product", undefined, undefined, undefined, {
        new_status: status,
        product_count: count,
        product_ids: productIds,
      });

      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["productCounts"] });
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
      toast.success(`${count} products moved to ${status}`);
    },
    onError: () => {
      toast.error("Failed to update products");
    },
  });
}

// Mutation to assign supplier to products
export function useBulkAssignSupplier() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      productIds,
      supplierId,
    }: {
      productIds: string[];
      supplierId: string;
    }) => {
      const { error } = await supabase
        .from("products")
        .update({ supplier_id: supplierId })
        .in("id", productIds);

      if (error) throw error;
      return productIds.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success(`Supplier assigned to ${count} products`);
    },
    onError: () => {
      toast.error("Failed to assign supplier");
    },
  });
}

// Mutation to update a single product
export function useUpdateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      productId,
      updates,
    }: {
      productId: string;
      updates: Record<string, unknown>;
    }) => {
      const { error } = await supabase
        .from("products")
        .update(updates)
        .eq("id", productId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
    onError: () => {
      toast.error("Failed to update product");
    },
  });
}

// Mutation to permanently delete products
export function useDeleteProducts() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (productIds: string[]) => {
      // First delete from product_collections
      await supabase
        .from("product_collections")
        .delete()
        .in("product_id", productIds);

      const { error } = await supabase
        .from("products")
        .delete()
        .in("id", productIds);

      if (error) throw error;
      return productIds.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["productCounts"] });
      toast.success(`${count} products permanently deleted`);
    },
    onError: () => {
      toast.error("Failed to delete products");
    },
  });
}
