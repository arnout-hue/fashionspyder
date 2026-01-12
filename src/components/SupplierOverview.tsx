import { useState } from "react";
import { Package, Send, CheckCircle2, Loader2, Mail } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Product, Supplier } from "@/data/mockData";
import { useToast } from "@/hooks/use-toast";
import { emailApi } from "@/lib/api/firecrawl";

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
  const [sendingSupplier, setSendingSupplier] = useState<string | null>(null);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [customMessage, setCustomMessage] = useState("");

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

  const openEmailDialog = (supplier: Supplier) => {
    const supplierProducts = getSupplierProducts(supplier.id);
    if (supplierProducts.length === 0) {
      toast({
        title: "No products to send",
        description: "Assign products to this supplier first.",
        variant: "destructive",
      });
      return;
    }
    setSelectedSupplier(supplier);
    setCustomMessage("");
    setEmailDialogOpen(true);
  };

  const handleSendEmail = async () => {
    if (!selectedSupplier) return;
    
    const supplierProducts = getSupplierProducts(selectedSupplier.id);
    setSendingSupplier(selectedSupplier.id);
    
    try {
      const response = await emailApi.sendSupplierEmail(
        selectedSupplier.id,
        selectedSupplier.email,
        selectedSupplier.name,
        supplierProducts.map(p => ({
          id: p.id,
          name: p.name,
          price: p.price,
          image_url: p.image_url,
          product_url: p.product_url,
          competitor: p.competitor,
          notes: p.notes,
        })),
        undefined,
        customMessage || undefined
      );

      if (response.success) {
        onSendRequest(selectedSupplier.id);
        toast({
          title: "Email sent!",
          description: `Product inquiry sent to ${selectedSupplier.name} for ${supplierProducts.length} item(s).`,
        });
        setEmailDialogOpen(false);
      } else {
        throw new Error(response.error || 'Failed to send email');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to send email';
      toast({
        title: "Error sending email",
        description: message,
        variant: "destructive",
      });
    } finally {
      setSendingSupplier(null);
    }
  };

  if (suppliers.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center text-center">
        <div className="mb-4 rounded-full bg-muted p-4">
          <Package className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="mb-2 font-display text-lg font-semibold">No suppliers configured</h3>
        <p className="text-sm text-muted-foreground">
          Add suppliers in Settings → Manage Suppliers to start sending requests
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-semibold">Supplier Overview</h2>
        <p className="text-muted-foreground">
          Review and send product inquiries to your suppliers via email
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {suppliers.map((supplier, index) => {
          const pendingProducts = getSupplierProducts(supplier.id);
          const sentProducts = getSentProducts(supplier.id);
          const isSending = sendingSupplier === supplier.id;

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
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Mail className="h-3 w-3" />
                  {supplier.email}
                </p>
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
                  <div className="flex items-center gap-1.5 text-green-600">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>{sentProducts.length} sent</span>
                  </div>
                </div>

                {/* Send Button */}
                <Button
                  onClick={() => openEmailDialog(supplier)}
                  disabled={pendingProducts.length === 0 || isSending}
                  className="w-full gap-2"
                >
                  {isSending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      Send Inquiry Email
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Email Dialog */}
      <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Product Inquiry</DialogTitle>
            <DialogDescription>
              Send an email to {selectedSupplier?.name} with {selectedSupplier && getSupplierProducts(selectedSupplier.id).length} product(s)
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium mb-2">Recipient</p>
              <p className="text-sm text-muted-foreground">{selectedSupplier?.email}</p>
            </div>
            
            <div>
              <p className="text-sm font-medium mb-2">Custom Message (optional)</p>
              <Textarea
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                placeholder="Add a personalized message to your inquiry..."
                rows={3}
              />
            </div>

            {selectedSupplier && (
              <div>
                <p className="text-sm font-medium mb-2">Products to include</p>
                <div className="flex flex-wrap gap-2">
                  {getSupplierProducts(selectedSupplier.id).slice(0, 5).map((p) => (
                    <img
                      key={p.id}
                      src={p.image_url || "/placeholder.svg"}
                      alt={p.name}
                      className="h-12 w-12 rounded border object-cover"
                      title={p.name}
                    />
                  ))}
                  {getSupplierProducts(selectedSupplier.id).length > 5 && (
                    <div className="flex h-12 w-12 items-center justify-center rounded border bg-muted text-xs">
                      +{getSupplierProducts(selectedSupplier.id).length - 5}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEmailDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSendEmail} disabled={sendingSupplier !== null}>
              {sendingSupplier ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Send Email
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SupplierOverview;