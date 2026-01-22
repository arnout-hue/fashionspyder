import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ProductWithCollections, ProductCollection } from "@/data/mockData";
import { toast } from "sonner";

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

// Hook to get product counts for navigation badges
export function useProductCounts(competitor: string) {
  return useQuery({
    queryKey: ["productCounts", competitor],
    queryFn: async () => {
      let baseQuery = supabase.from("products").select("status");
      
      if (competitor !== "All") {
        baseQuery = baseQuery.eq("competitor", competitor);
      }

      const { data, error } = await baseQuery;

      if (error) throw error;

      const counts = {
        pending: 0,
        positive: 0,
        negative: 0,
        trash: 0,
      };

      data?.forEach((p) => {
        if (p.status in counts) {
          counts[p.status as keyof typeof counts]++;
        }
      });

      return counts;
    },
    staleTime: 10000, // 10 seconds
  });
}

// Mutation to update product status
export function useUpdateProductStatus() {
  const queryClient = useQueryClient();

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
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["productCounts"] });
    },
    onError: () => {
      toast.error("Failed to update product");
    },
  });
}

// Mutation for bulk status updates
export function useBulkUpdateStatus() {
  const queryClient = useQueryClient();

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
      return { count: productIds.length, status };
    },
    onSuccess: ({ count, status }) => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["productCounts"] });
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
