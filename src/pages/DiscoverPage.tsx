import { useState } from "react";
import { DiscoverView } from "@/components/DiscoverView";
import { SwipeSkeleton } from "@/components/ProductSkeleton";
import { useAppContext } from "@/components/AppLayout";
import {
  useProducts,
  useUpdateProductStatus,
  useBulkUpdateStatus,
} from "@/hooks/useProducts";
import { ProductWithCollections } from "@/data/mockData";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

export default function DiscoverPage() {
  const { selectedCompetitor } = useAppContext();
  const [page, setPage] = useState(0);

  const { data, isLoading, isFetching } = useProducts(
    "pending",
    selectedCompetitor,
    page
  );

  const updateStatus = useUpdateProductStatus();
  const bulkUpdateStatus = useBulkUpdateStatus();

  // Accumulate products across pages
  const [allProducts, setAllProducts] = useState<ProductWithCollections[]>([]);

  // Sync fetched data with accumulated products
  if (data?.data && page === 0 && allProducts.length === 0) {
    setAllProducts(data.data);
  }

  const handleSwipeRight = (product: ProductWithCollections) => {
    updateStatus.mutate({ productId: product.id, status: "positive" });
    // Optimistically remove from local state
    setAllProducts((prev) => prev.filter((p) => p.id !== product.id));
  };

  const handleSwipeLeft = (product: ProductWithCollections) => {
    updateStatus.mutate({ productId: product.id, status: "negative" });
    // Optimistically remove from local state
    setAllProducts((prev) => prev.filter((p) => p.id !== product.id));
  };

  const handleBulkStatusChange = (
    productIds: string[],
    status: "positive" | "negative"
  ) => {
    bulkUpdateStatus.mutate({ productIds, status });
    // Optimistically remove from local state
    setAllProducts((prev) => prev.filter((p) => !productIds.includes(p.id)));
  };

  const handleClearToTrash = (productIds: string[]) => {
    bulkUpdateStatus.mutate({
      productIds,
      status: "trash",
      clearSupplier: true,
    });
    // Optimistically remove from local state
    setAllProducts((prev) => prev.filter((p) => !productIds.includes(p.id)));
  };

  const handleLoadMore = async () => {
    const nextPage = page + 1;
    setPage(nextPage);
    // Data will be fetched automatically by the query
  };

  // Merge new data when loading more
  if (data?.data && page > 0 && !isFetching) {
    const existingIds = new Set(allProducts.map((p) => p.id));
    const newProducts = data.data.filter((p) => !existingIds.has(p.id));
    if (newProducts.length > 0) {
      setAllProducts((prev) => [...prev, ...newProducts]);
    }
  }

  // Use accumulated products or initial data
  const products =
    allProducts.length > 0 ? allProducts : data?.data || [];
  const hasMore = data?.hasMore ?? false;

  if (isLoading && products.length === 0) {
    return <SwipeSkeleton />;
  }

  return (
    <div className="space-y-6">
      <DiscoverView
        products={products}
        onSwipeRight={handleSwipeRight}
        onSwipeLeft={handleSwipeLeft}
        onBulkStatusChange={handleBulkStatusChange}
        onClearToTrash={handleClearToTrash}
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
              `Load More (${products.length} of ${data?.count || 0})`
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
