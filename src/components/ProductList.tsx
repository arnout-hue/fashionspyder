import { useState } from "react";
import { format } from "date-fns";
import {
  ExternalLink,
  Tag,
  MessageSquare,
  ArrowRight,
  ArrowLeft,
  Calendar,
  Check,
  RotateCcw,
  Users,
  ThumbsUp,
  ThumbsDown,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Product, Supplier } from "@/data/mockData";

interface ProductListProps {
  products: Product[];
  suppliers: Supplier[];
  type: "positive" | "negative";
  onUpdateProduct: (productId: string, updates: Partial<Product>) => void;
  onMoveProduct: (product: Product) => void;
  onBulkStatusChange: (productIds: string[], status: "positive" | "negative" | "pending") => void;
  onBulkAssignSupplier: (productIds: string[], supplierId: string) => void;
}

export const ProductList = ({
  products,
  suppliers,
  type,
  onUpdateProduct,
  onMoveProduct,
  onBulkStatusChange,
  onBulkAssignSupplier,
}: ProductListProps) => {
  const [expandedNotes, setExpandedNotes] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkSupplierId, setBulkSupplierId] = useState<string>("");

  const handleToggleSelect = (productId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    setSelectedIds(new Set(products.map((p) => p.id)));
  };

  const handleDeselectAll = () => {
    setSelectedIds(new Set());
  };

  const handleBulkAction = (status: "positive" | "negative" | "pending") => {
    onBulkStatusChange(Array.from(selectedIds), status);
    setSelectedIds(new Set());
  };

  const handleBulkAssign = () => {
    if (bulkSupplierId) {
      onBulkAssignSupplier(Array.from(selectedIds), bulkSupplierId);
      setSelectedIds(new Set());
      setBulkSupplierId("");
    }
  };

  const selectedCount = selectedIds.size;

  if (products.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center text-center">
        <div className="mb-4 rounded-full bg-muted p-4">
          {type === "positive" ? (
            <ArrowRight className="h-8 w-8 text-muted-foreground" />
          ) : (
            <ArrowLeft className="h-8 w-8 text-muted-foreground" />
          )}
        </div>
        <h3 className="mb-2 font-display text-lg font-semibold">No products yet</h3>
        <p className="text-sm text-muted-foreground">
          {type === "positive"
            ? "Swipe right on products to add them here"
            : "Swipe left on products to add them here"}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Bulk Actions Bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-4">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSelectAll}
            disabled={products.length === 0}
          >
            Select All
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDeselectAll}
            disabled={selectedCount === 0}
          >
            Deselect All
          </Button>
        </div>

        {selectedCount > 0 && (
          <>
            <div className="h-6 w-px bg-border" />
            <Badge variant="secondary" className="text-sm">
              {selectedCount} selected
            </Badge>
            <div className="h-6 w-px bg-border" />

            <div className="flex flex-wrap items-center gap-2">
              {/* Bulk Assign Supplier (Positive list only) */}
              {type === "positive" && (
                <div className="flex items-center gap-2">
                  <Select value={bulkSupplierId} onValueChange={setBulkSupplierId}>
                    <SelectTrigger className="h-8 w-[160px]">
                      <SelectValue placeholder="Select supplier..." />
                    </SelectTrigger>
                    <SelectContent>
                      {suppliers.map((supplier) => (
                        <SelectItem key={supplier.id} value={supplier.id}>
                          {supplier.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    disabled={!bulkSupplierId}
                    onClick={handleBulkAssign}
                    className="gap-1.5"
                  >
                    <Users className="h-4 w-4" />
                    Assign
                  </Button>
                </div>
              )}

              {/* Move to opposite list */}
              {type === "positive" ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                  onClick={() => handleBulkAction("negative")}
                >
                  <ThumbsDown className="h-4 w-4" />
                  Move to Negative
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 border-success text-success hover:bg-success hover:text-success-foreground"
                  onClick={() => handleBulkAction("positive")}
                >
                  <ThumbsUp className="h-4 w-4" />
                  Move to Positive
                </Button>
              )}

              {/* Move back to Undecided */}
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={() => handleBulkAction("pending")}
              >
                <RotateCcw className="h-4 w-4" />
                Back to Undecided
              </Button>
            </div>
          </>
        )}

        <div className="ml-auto text-sm text-muted-foreground">
          {products.length} product{products.length !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Product Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((product, index) => {
          const isSelected = selectedIds.has(product.id);
          const crawlDate = new Date(product.created_at);

          return (
            <Card
              key={product.id}
              className={`group animate-fade-in overflow-hidden transition-all hover:shadow-card cursor-pointer ${
                isSelected ? "ring-2 ring-primary ring-offset-2" : ""
              }`}
              style={{ animationDelay: `${index * 50}ms` }}
              onClick={() => handleToggleSelect(product.id)}
            >
              <div className="relative aspect-square overflow-hidden">
                <img
                  src={product.image_url || "/placeholder.svg"}
                  alt={product.name}
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />

                {/* Selection Checkbox */}
                <div
                  className={`absolute left-3 top-3 z-10 transition-opacity ${
                    isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                  }`}
                >
                  <div
                    className={`flex h-6 w-6 items-center justify-center rounded-md border-2 ${
                      isSelected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-white bg-white/80 backdrop-blur-sm"
                    }`}
                  >
                    {isSelected && <Check className="h-4 w-4" />}
                  </div>
                </div>

                <Badge
                  variant="secondary"
                  className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm"
                >
                  {product.competitor}
                </Badge>

                {product.is_sent && (
                  <Badge className="absolute bottom-3 right-3 bg-success">
                    Requested
                  </Badge>
                )}

                {/* Crawl Date Badge */}
                <div className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-md bg-black/50 px-2 py-1 text-xs text-white backdrop-blur-sm">
                  <Calendar className="h-3 w-3" />
                  <span>{format(crawlDate, "MMM d, yyyy")}</span>
                </div>
              </div>

              <CardContent className="p-4" onClick={(e) => e.stopPropagation()}>
                <div className="mb-3">
                  <h4 className="font-display text-lg font-semibold leading-tight">
                    {product.name}
                  </h4>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="font-semibold text-primary">{product.price}</span>
                    {product.sku && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Tag className="h-3 w-3" />
                        {product.sku}
                      </div>
                    )}
                  </div>
                </div>

                {type === "positive" && (
                  <div className="mb-3">
                    <Select
                      value={product.supplier_id || ""}
                      onValueChange={(value) =>
                        onUpdateProduct(product.id, { supplier_id: value || null })
                      }
                    >
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue placeholder="Assign supplier..." />
                      </SelectTrigger>
                      <SelectContent>
                        {suppliers.map((supplier) => (
                          <SelectItem key={supplier.id} value={supplier.id}>
                            {supplier.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {type === "positive" && (
                  <Collapsible
                    open={expandedNotes === product.id}
                    onOpenChange={(open) =>
                      setExpandedNotes(open ? product.id : null)
                    }
                  >
                    <CollapsibleTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mb-2 h-8 w-full justify-start gap-2 text-muted-foreground"
                      >
                        <MessageSquare className="h-4 w-4" />
                        {product.notes ? "Edit notes" : "Add notes"}
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <Textarea
                        placeholder="Add notes for the supplier..."
                        value={product.notes || ""}
                        onChange={(e) =>
                          onUpdateProduct(product.id, { notes: e.target.value })
                        }
                        className="mb-2 min-h-[80px] text-sm"
                      />
                    </CollapsibleContent>
                  </Collapsible>
                )}

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => onMoveProduct(product)}
                  >
                    {type === "positive" ? (
                      <>
                        <ArrowLeft className="mr-1.5 h-4 w-4" />
                        Move to Negative
                      </>
                    ) : (
                      <>
                        Move to Positive
                        <ArrowRight className="ml-1.5 h-4 w-4" />
                      </>
                    )}
                  </Button>
                  <Button variant="ghost" size="icon" className="h-9 w-9" asChild>
                    <a
                      href={product.product_url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default ProductList;