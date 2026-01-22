import { SupplierOverview } from "@/components/SupplierOverview";
import { useSuppliers } from "@/hooks/useSuppliers";
import { useProducts, useBulkUpdateStatus } from "@/hooks/useProducts";
import { useAppContext } from "@/components/AppLayout";
import { TableSkeleton } from "@/components/ProductSkeleton";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

export default function SuppliersPage() {
  const { selectedCompetitor } = useAppContext();
  const queryClient = useQueryClient();
  
  const { data: suppliers = [], isLoading: suppliersLoading } = useSuppliers();
  const { data: productsData, isLoading: productsLoading } = useProducts(
    ["positive", "requested"],
    selectedCompetitor,
    0
  );

  const products = productsData?.data || [];
  const isLoading = suppliersLoading || productsLoading;

  const handleSendRequest = async (supplierId: string) => {
    // Update products for this supplier to mark as sent/requested
    const supplierProducts = products.filter(
      (p) => p.supplier_id === supplierId && p.status === "positive" && !p.is_sent
    );
    
    if (supplierProducts.length === 0) {
      toast.error("No products to send");
      return;
    }

    const productIds = supplierProducts.map((p) => p.id);
    
    const { error } = await supabase
      .from("products")
      .update({ is_sent: true, status: "requested" })
      .in("id", productIds);

    if (error) {
      toast.error("Failed to mark products as sent");
      return;
    }

    queryClient.invalidateQueries({ queryKey: ["products"] });
    queryClient.invalidateQueries({ queryKey: ["productCounts"] });
    toast.success(`${productIds.length} products marked as sent`);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-3xl font-semibold">Suppliers Overview</h1>
          <p className="mt-2 text-muted-foreground">
            View products grouped by supplier
          </p>
        </div>
        <TableSkeleton rows={5} />
      </div>
    );
  }

  return (
    <SupplierOverview
      products={products}
      suppliers={suppliers}
      onSendRequest={handleSendRequest}
    />
  );
}
