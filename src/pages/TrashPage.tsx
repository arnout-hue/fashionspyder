import { useState, useEffect } from "react";
import { TrashView } from "@/components/TrashView";
import { ProductSkeleton } from "@/components/ProductSkeleton";
import { useAppContext } from "@/components/AppLayout";
import {
  useProducts,
  useBulkUpdateStatus,
  useDeleteProducts,
} from "@/hooks/useProducts";
import { ProductWithCollections } from "@/data/mockData";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

export default function TrashPage() {
  const { selectedCompetitor } = useAppContext();
  const [page, setPage] = useState(0);
  const [allProducts, setAllProducts] = useState<ProductWithCollections[]>([]);

  const { data, isLoading, isFetching } = useProducts(
    "trash",
    selectedCompetitor,
    page
  );

  const bulkUpdateStatus = useBulkUpdateStatus();
  const deleteProducts = useDeleteProducts();

  // Reset products when competitor changes
  useEffect(() => {
    setAllProducts([]);
    setPage(0);
  }, [selectedCompetitor]);

  // Sync fetched data with accumulated products
  useEffect(() => {
    if (data?.data) {
      if (page === 0) {
        setAllProducts(data.data);
      } else {
        setAllProducts((prev) => {
          const existingIds = new Set(prev.map((p) => p.id));
          const newProducts = data.data.filter((p) => !existingIds.has(p.id));
          return [...prev, ...newProducts];
        });
      }
    }
  }, [data?.data, page]);

  const handleRestoreProducts = (
    productIds: string[],
    status: "pending" | "positive" | "negative"
  ) => {
    bulkUpdateStatus.mutate({ productIds, status });
    // Optimistically remove from local state
    setAllProducts((prev) => prev.filter((p) => !productIds.includes(p.id)));
  };

  const handlePermanentDelete = (productIds: string[]) => {
    deleteProducts.mutate(productIds);
    // Optimistically remove from local state
    setAllProducts((prev) => prev.filter((p) => !productIds.includes(p.id)));
  };

  const handleLoadMore = () => {
    setPage((p) => p + 1);
  };

  const hasMore = data?.hasMore ?? false;

  if (isLoading && allProducts.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-3xl font-semibold">Trash</h1>
          <p className="mt-2 text-muted-foreground">
            Products you've cleared — restore or permanently delete
          </p>
        </div>
        <ProductSkeleton count={12} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <TrashView
        products={allProducts}
        onRestoreProducts={handleRestoreProducts}
        onPermanentDelete={handlePermanentDelete}
      />

      {hasMore && (
        <div className="flex justify-center pt-4">
          <Button
            variant="outline"
            onClick={handleLoadMore}
            disabled={isFetching}
          >
            {isFetching ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading...
              </>
            ) : (
              `Load More (${allProducts.length} of ${data?.count || 0})`
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
