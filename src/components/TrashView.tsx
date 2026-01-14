import { useState } from "react";
import { format } from "date-fns";
import {
  Trash2,
  RotateCcw,
  ThumbsUp,
  ThumbsDown,
  Layers,
  Calendar,
  Check,
  ExternalLink,
  AlertTriangle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ProductWithCollections } from "@/data/mockData";

interface TrashViewProps {
  products: ProductWithCollections[];
  onRestoreProducts: (productIds: string[], status: "pending" | "positive" | "negative") => void;
  onPermanentDelete: (productIds: string[]) => void;
}

export const TrashView = ({
  products,
  onRestoreProducts,
  onPermanentDelete,
}: TrashViewProps) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

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

  const handleRestore = (status: "pending" | "positive" | "negative") => {
    onRestoreProducts(Array.from(selectedIds), status);
    setSelectedIds(new Set());
  };

  const handlePermanentDelete = () => {
    onPermanentDelete(Array.from(selectedIds));
    setSelectedIds(new Set());
    setDeleteDialogOpen(false);
  };

  const selectedCount = selectedIds.size;

  if (products.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center text-center">
        <div className="mb-4 rounded-full bg-muted p-4">
          <Trash2 className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="mb-2 font-display text-lg font-semibold">Trash is empty</h3>
        <p className="text-sm text-muted-foreground">
          Items you clear from Discover, Positive, or Negative lists will appear here
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
              {/* Restore Options */}
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={() => handleRestore("pending")}
              >
                <Layers className="h-4 w-4" />
                Restore to Discover
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 border-success text-success hover:bg-success hover:text-success-foreground"
                onClick={() => handleRestore("positive")}
              >
                <ThumbsUp className="h-4 w-4" />
                Restore to Positive
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-white"
                onClick={() => handleRestore("negative")}
              >
                <ThumbsDown className="h-4 w-4" />
                Restore to Negative
              </Button>

              <div className="h-6 w-px bg-border" />

              {/* Permanent Delete */}
              <Button
                size="sm"
                variant="destructive"
                className="gap-1.5"
                onClick={() => setDeleteDialogOpen(true)}
              >
                <Trash2 className="h-4 w-4" />
                Delete Permanently
              </Button>
            </div>
          </>
        )}

        <div className="ml-auto text-sm text-muted-foreground">
          {products.length} item{products.length !== 1 ? "s" : ""} in trash
        </div>
      </div>

      {/* Product Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {products.map((product, index) => {
          const isSelected = selectedIds.has(product.id);
          const crawlDate = new Date(product.created_at);

          return (
            <Card
              key={product.id}
              className={`group animate-fade-in overflow-hidden transition-all hover:shadow-card cursor-pointer opacity-75 hover:opacity-100 ${
                isSelected ? "ring-2 ring-primary ring-offset-2 opacity-100" : ""
              }`}
              style={{ animationDelay: `${index * 50}ms` }}
              onClick={() => handleToggleSelect(product.id)}
            >
              <div className="relative aspect-square overflow-hidden">
                <img
                  src={product.image_url || "/placeholder.svg"}
                  alt={product.name}
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105 grayscale-[30%]"
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

                {/* Crawl Date Badge */}
                <div className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-md bg-black/50 px-2 py-1 text-xs text-white backdrop-blur-sm">
                  <Calendar className="h-3 w-3" />
                  <span>{format(crawlDate, "MMM d, yyyy")}</span>
                </div>
              </div>

              <CardContent className="p-4" onClick={(e) => e.stopPropagation()}>
                <div className="mb-3">
                  <h4 className="font-display text-lg font-semibold leading-tight line-clamp-2">
                    {product.name}
                  </h4>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="font-semibold text-muted-foreground">{product.price}</span>
                  </div>
                </div>

                <a
                  href={product.product_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ExternalLink className="h-4 w-4" />
                  View Product
                </a>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Permanent Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Delete Permanently?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {selectedCount} item{selectedCount !== 1 ? "s" : ""} from the database. 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handlePermanentDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default TrashView;
