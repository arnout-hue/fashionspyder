import { useState } from "react";
import { format } from "date-fns";
import { ExternalLink, Tag, Calendar, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Product } from "@/data/mockData";

interface ProductGridProps {
  products: Product[];
  selectedIds: Set<string>;
  onToggleSelect: (productId: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
}

export const ProductGrid = ({
  products,
  selectedIds,
  onToggleSelect,
}: ProductGridProps) => {
  if (products.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center text-center">
        <p className="text-muted-foreground">No products to display</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {products.map((product, index) => {
        const isSelected = selectedIds.has(product.id);
        const crawlDate = new Date(product.created_at);

        return (
          <div
            key={product.id}
            className={`group relative animate-fade-in cursor-pointer overflow-hidden rounded-xl border-2 bg-card transition-all hover:shadow-card ${
              isSelected ? "border-primary ring-2 ring-primary/20" : "border-transparent"
            }`}
            style={{ animationDelay: `${index * 30}ms` }}
            onClick={() => onToggleSelect(product.id)}
          >
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

            {/* Competitor Badge */}
            <Badge
              variant="secondary"
              className="absolute right-3 top-3 z-10 bg-white/90 text-xs backdrop-blur-sm"
            >
              {product.competitor}
            </Badge>

            {/* Product Image */}
            <div className="relative aspect-[3/4] overflow-hidden">
              <img
                src={product.image_url || "/placeholder.svg"}
                alt={product.name}
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                draggable={false}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

              {/* Crawl Date Badge */}
              <div className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-md bg-black/50 px-2 py-1 text-xs text-white backdrop-blur-sm">
                <Calendar className="h-3 w-3" />
                <span>{format(crawlDate, "MMM d, yyyy")}</span>
              </div>

              {/* External Link Button */}
              <a
                href={product.product_url}
                target="_blank"
                rel="noopener noreferrer"
                className="absolute bottom-3 right-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-foreground shadow-sm backdrop-blur-sm transition-all hover:bg-white hover:scale-110"
                onClick={(e) => e.stopPropagation()}
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>

            {/* Product Info */}
            <div className="p-3">
              <h4 className="mb-1 line-clamp-2 text-sm font-medium leading-tight">
                {product.name}
              </h4>
              <div className="flex items-center justify-between">
                <span className="font-semibold text-primary">{product.price}</span>
                {product.sku && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Tag className="h-3 w-3" />
                    <span className="max-w-[60px] truncate">{product.sku}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ProductGrid;