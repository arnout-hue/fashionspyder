import { Package, Send, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Product, Supplier } from "@/data/mockData";
import { useToast } from "@/hooks/use-toast";

interface SupplierOverviewProps {
  suppliers: Supplier[];
  products: Product[];
  onSendRequest: (supplierId: string) => void;
}

export const SupplierOverview = ({
  suppliers,
  products,
  onSendRequest,
}: SupplierOverviewProps) => {
  const { toast } = useToast();

  const getSupplierProducts = (supplierId: string) => {
    return products.filter(
      (p) => p.supplier_id === supplierId && p.status === "positive" && !p.is_sent
    );
  };

  const getSentProducts = (supplierId: string) => {
    return products.filter(
      (p) => p.supplier_id === supplierId && p.is_sent
    );
  };

  const handleSendRequest = (supplier: Supplier) => {
    const supplierProducts = getSupplierProducts(supplier.id);
    if (supplierProducts.length === 0) {
      toast({
        title: "No products to send",
        description: "Assign products to this supplier first.",
        variant: "destructive",
      });
      return;
    }

    onSendRequest(supplier.id);
    toast({
      title: "Request sent!",
      description: `Sample request sent to ${supplier.name} for ${supplierProducts.length} item(s).`,
    });
  };

  if (suppliers.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center text-center">
        <div className="mb-4 rounded-full bg-muted p-4">
          <Package className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="mb-2 font-display text-lg font-semibold">No suppliers configured</h3>
        <p className="text-sm text-muted-foreground">
          Add suppliers in the Settings tab to start sending requests
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-semibold">Supplier Overview</h2>
        <p className="text-muted-foreground">
          Review and send sample requests to your suppliers
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {suppliers.map((supplier, index) => {
          const pendingProducts = getSupplierProducts(supplier.id);
          const sentProducts = getSentProducts(supplier.id);

          return (
            <Card
              key={supplier.id}
              className="animate-fade-in overflow-hidden transition-shadow hover:shadow-card"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <CardTitle className="font-display text-lg">
                    {supplier.name}
                  </CardTitle>
                  {pendingProducts.length > 0 && (
                    <Badge className="bg-primary">
                      {pendingProducts.length} item{pendingProducts.length !== 1 ? "s" : ""}
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">{supplier.email}</p>
              </CardHeader>

              <CardContent>
                {/* Product Preview */}
                {pendingProducts.length > 0 && (
                  <div className="mb-4">
                    <div className="flex -space-x-2 overflow-hidden">
                      {pendingProducts.slice(0, 4).map((product) => (
                        <img
                          key={product.id}
                          src={product.image_url || "/placeholder.svg"}
                          alt={product.name}
                          className="h-12 w-12 rounded-lg border-2 border-background object-cover"
                        />
                      ))}
                      {pendingProducts.length > 4 && (
                        <div className="flex h-12 w-12 items-center justify-center rounded-lg border-2 border-background bg-muted text-sm font-medium">
                          +{pendingProducts.length - 4}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Stats */}
                <div className="mb-4 flex gap-4 text-sm">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Package className="h-4 w-4" />
                    <span>{pendingProducts.length} pending</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-success">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>{sentProducts.length} sent</span>
                  </div>
                </div>

                {/* Send Button */}
                <Button
                  onClick={() => handleSendRequest(supplier)}
                  disabled={pendingProducts.length === 0}
                  className="w-full gap-2"
                >
                  <Send className="h-4 w-4" />
                  Send Sample Request
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default SupplierOverview;