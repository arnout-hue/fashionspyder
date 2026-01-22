import { useState, useEffect } from "react";
import { ProductList } from "@/components/ProductList";
import { ProductSkeleton } from "@/components/ProductSkeleton";
import { useAppContext } from "@/components/AppLayout";
import {
  useProducts,
  useBulkUpdateStatus,
  useBulkAssignSupplier,
  useUpdateProduct,
} from "@/hooks/useProducts";
import { useSuppliers } from "@/hooks/useSuppliers";
import { useColleagues } from "@/hooks/useColleagues";
import { ProductWithCollections } from "@/data/mockData";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

export default function NegativeListPage() {
  const { selectedCompetitor } = useAppContext();
  const [page, setPage] = useState(0);
  const [allProducts, setAllProducts] = useState<ProductWithCollections[]>([]);

  const { data, isLoading, isFetching } = useProducts(
    "negative",
    selectedCompetitor,
    page
  );
  const { data: suppliers = [] } = useSuppliers();
  const { data: colleagues = [] } = useColleagues();

  const bulkUpdateStatus = useBulkUpdateStatus();
  const bulkAssignSupplier = useBulkAssignSupplier();
  const updateProduct = useUpdateProduct();

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

  const handleBulkStatusChange = (
    productIds: string[],
    status: "positive" | "negative" | "pending"
  ) => {
    bulkUpdateStatus.mutate({
      productIds,
      status,
      clearSupplier: status === "pending",
    });
    // Optimistically remove from local state
    setAllProducts((prev) => prev.filter((p) => !productIds.includes(p.id)));
  };

  const handleBulkAssignSupplier = (
    productIds: string[],
    supplierId: string
  ) => {
    bulkAssignSupplier.mutate({ productIds, supplierId });
    // Optimistically update local state
    setAllProducts((prev) =>
      prev.map((p) =>
        productIds.includes(p.id) ? { ...p, supplier_id: supplierId } : p
      )
    );
  };

  const handleUpdateProduct = (
    productId: string,
    updates: Record<string, unknown>
  ) => {
    updateProduct.mutate({ productId, updates });
    // Optimistically update local state
    setAllProducts((prev) =>
      prev.map((p) => (p.id === productId ? { ...p, ...updates } : p))
    );
  };

  const handleMoveProduct = (product: ProductWithCollections) => {
    bulkUpdateStatus.mutate({
      productIds: [product.id],
      status: "positive",
      clearSupplier: false,
    });
    // Optimistically remove from local state
    setAllProducts((prev) => prev.filter((p) => p.id !== product.id));
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

  const handleLoadMore = () => {
    setPage((p) => p + 1);
  };

  const hasMore = data?.hasMore ?? false;

  if (isLoading && allProducts.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-3xl font-semibold">Negative List</h1>
          <p className="mt-2 text-muted-foreground">
            Products you've skipped — move back if you change your mind
          </p>
        </div>
        <ProductSkeleton count={12} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold">Negative List</h1>
        <p className="mt-2 text-muted-foreground">
          Products you've skipped — move back if you change your mind
          {allProducts.length > 0 && ` (${allProducts.length} products)`}
        </p>
      </div>
      <ProductList
        products={allProducts}
        suppliers={suppliers}
        colleagues={colleagues}
        type="negative"
        onUpdateProduct={handleUpdateProduct}
        onMoveProduct={handleMoveProduct}
        onBulkStatusChange={handleBulkStatusChange}
        onBulkAssignSupplier={handleBulkAssignSupplier}
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
              `Load More (${allProducts.length} of ${data?.count || 0})`
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
