import { useState } from "react";
import { LayoutGrid, Layers, ThumbsUp, ThumbsDown, FolderPlus, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { SwipeDeck } from "@/components/SwipeDeck";
import { ProductGrid } from "@/components/ProductGrid";
import { AddToCollectionDialog } from "@/components/AddToCollectionDialog";
import { Product } from "@/data/mockData";
import { exportToCSV, exportToExcel } from "@/lib/exportUtils";

type ViewMode = "swipe" | "grid";

interface DiscoverViewProps {
  products: Product[];
  onSwipeRight: (product: Product) => void;
  onSwipeLeft: (product: Product) => void;
  onBulkStatusChange: (productIds: string[], status: "positive" | "negative") => void;
}

export const DiscoverView = ({
  products,
  onSwipeRight,
  onSwipeLeft,
  onBulkStatusChange,
}: DiscoverViewProps) => {
  const [viewMode, setViewMode] = useState<ViewMode>("swipe");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [collectionDialogOpen, setCollectionDialogOpen] = useState(false);

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

  const handleBulkAction = (status: "positive" | "negative") => {
    onBulkStatusChange(Array.from(selectedIds), status);
    setSelectedIds(new Set());
  };

  const selectedCount = selectedIds.size;

  const handleExport = (format: 'csv' | 'excel', scope: 'selected' | 'all') => {
    const productsToExport = scope === 'selected' 
      ? products.filter(p => selectedIds.has(p.id))
      : products;
    const filename = `pending-products-${new Date().toISOString().split('T')[0]}`;
    if (format === 'csv') {
      exportToCSV(productsToExport, filename);
    } else {
      exportToExcel(productsToExport, filename);
    }
  };

  return (
    <div className="mx-auto max-w-6xl">
      {/* Header with View Toggle */}
      <div className="mb-4 md:mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold">Discover</h1>
          <p className="mt-1 text-muted-foreground">
            {viewMode === "swipe"
              ? "Swipe right to save, left to skip"
              : "Select products to assign status in bulk"}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <ToggleGroup
            type="single"
            value={viewMode}
            onValueChange={(value) => value && setViewMode(value as ViewMode)}
            className="bg-muted p-1 rounded-lg"
          >
            <ToggleGroupItem
              value="swipe"
              aria-label="Swipe view"
              className="gap-2 data-[state=on]:bg-background data-[state=on]:shadow-sm"
            >
              <Layers className="h-4 w-4" />
              <span className="hidden sm:inline">Swipe</span>
            </ToggleGroupItem>
            <ToggleGroupItem
              value="grid"
              aria-label="Grid view"
              className="gap-2 data-[state=on]:bg-background data-[state=on]:shadow-sm"
            >
              <LayoutGrid className="h-4 w-4" />
              <span className="hidden sm:inline">Grid</span>
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>

      {/* Grid View Bulk Actions - Sticky */}
      {viewMode === "grid" && (
        <div className="sticky top-16 z-20 -mx-4 mb-6 flex flex-wrap items-center gap-3 border-b bg-background/95 px-4 py-4 backdrop-blur-sm shadow-sm md:-mx-0 md:rounded-lg md:border md:bg-card/95">
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
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 border-success text-success hover:bg-success hover:text-success-foreground"
                  onClick={() => handleBulkAction("positive")}
                >
                  <ThumbsUp className="h-4 w-4" />
                  Add to Positive
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                  onClick={() => handleBulkAction("negative")}
                >
                  <ThumbsDown className="h-4 w-4" />
                  Add to Negative
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  className="gap-1.5"
                  onClick={() => setCollectionDialogOpen(true)}
                >
                  <FolderPlus className="h-4 w-4" />
                  Add to Collection
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="secondary" className="gap-1.5">
                      <Download className="h-4 w-4" />
                      Export
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-popover">
                    <DropdownMenuItem onClick={() => handleExport('csv', 'selected')}>
                      Export Selected (CSV)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleExport('excel', 'selected')}>
                      Export Selected (Excel)
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => handleExport('csv', 'all')}>
                      Export All (CSV)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleExport('excel', 'all')}>
                      Export All (Excel)
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </>
          )}

          <div className="ml-auto text-sm text-muted-foreground">
            {products.length} product{products.length !== 1 ? "s" : ""} pending
          </div>
        </div>
      )}

      {/* View Content */}
      {viewMode === "swipe" ? (
        <div className="mx-auto max-w-sm">
          <SwipeDeck
            products={products}
            onSwipeRight={onSwipeRight}
            onSwipeLeft={onSwipeLeft}
          />
        </div>
      ) : (
        <ProductGrid
          products={products}
          selectedIds={selectedIds}
          onToggleSelect={handleToggleSelect}
          onSelectAll={handleSelectAll}
          onDeselectAll={handleDeselectAll}
        />
      )}

      <AddToCollectionDialog
        open={collectionDialogOpen}
        onOpenChange={setCollectionDialogOpen}
        productIds={Array.from(selectedIds)}
        onSuccess={() => setSelectedIds(new Set())}
      />
    </div>
  );
};

export default DiscoverView;