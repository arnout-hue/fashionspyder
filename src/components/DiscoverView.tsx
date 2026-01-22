import { useState } from "react";
import { LayoutGrid, Layers, ThumbsUp, ThumbsDown, FolderPlus, Download, Trash2 } from "lucide-react";
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
import { Product, ProductWithCollections } from "@/data/mockData";
import { exportToCSV, exportToExcel } from "@/lib/exportUtils";
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

type ViewMode = "swipe" | "grid";

interface DiscoverViewProps {
  products: ProductWithCollections[];
  onSwipeRight: (product: ProductWithCollections) => void;
  onSwipeLeft: (product: ProductWithCollections) => void;
  onBulkStatusChange: (productIds: string[], status: "positive" | "negative") => void;
  onClearToTrash: (productIds: string[]) => void;
}

export const DiscoverView = ({
  products,
  onSwipeRight,
  onSwipeLeft,
  onBulkStatusChange,
  onClearToTrash,
}: DiscoverViewProps) => {
  const [viewMode, setViewMode] = useState<ViewMode>("swipe");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [collectionDialogOpen, setCollectionDialogOpen] = useState(false);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [clearMode, setClearMode] = useState<"all" | "selected">("all");

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

  const handleRangeSelect = (productIds: string[]) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      productIds.forEach((id) => next.add(id));
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

  const handleClearConfirm = () => {
    if (clearMode === "all") {
      onClearToTrash(products.map(p => p.id));
    } else {
      onClearToTrash(Array.from(selectedIds));
      setSelectedIds(new Set());
    }
    setClearDialogOpen(false);
  };

  const openClearDialog = (mode: "all" | "selected") => {
    setClearMode(mode);
    setClearDialogOpen(true);
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
          {products.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-popover">
                <DropdownMenuItem 
                  onClick={() => openClearDialog("selected")}
                  disabled={selectedIds.size === 0}
                >
                  Clear Selected ({selectedIds.size})
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => openClearDialog("all")}>
                  Clear All ({products.length})
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
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
          onRangeSelect={handleRangeSelect}
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

      {/* Clear Confirmation Dialog */}
      <AlertDialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {clearMode === "all" ? "Clear all pending items?" : "Clear selected items?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will move {clearMode === "all" ? products.length : selectedIds.size} item
              {(clearMode === "all" ? products.length : selectedIds.size) !== 1 ? "s" : ""} to the trash. 
              You can restore them later from Settings → Trash.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClearConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {clearMode === "all" ? "Clear All" : "Clear Selected"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default DiscoverView;