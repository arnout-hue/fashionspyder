import { useState, useRef } from "react";
import { X, Heart, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SwipeCard } from "./SwipeCard";
import { Product } from "@/data/mockData";

interface SwipeDeckProps {
  products: Product[];
  onSwipeRight: (product: Product) => void;
  onSwipeLeft: (product: Product) => void;
}

export const SwipeDeck = ({ products, onSwipeRight, onSwipeLeft }: SwipeDeckProps) => {
  const [swipingId, setSwipingId] = useState<string | null>(null);
  const [lastSwiped, setLastSwiped] = useState<{ product: Product; direction: "left" | "right" } | null>(null);

  // Show up to 3 cards from the products array
  // The products array is already filtered to only pending products and updates when status changes
  const visibleProducts = products.slice(0, 3);

  const handleSwipe = (direction: "left" | "right", product?: Product) => {
    const targetProduct = product || products[0];
    if (!targetProduct || swipingId) return;

    setSwipingId(targetProduct.id);
    setLastSwiped({ product: targetProduct, direction });
    
    // Delay the actual state update to allow the animation to complete
    setTimeout(() => {
      if (direction === "right") {
        onSwipeRight(targetProduct);
      } else {
        onSwipeLeft(targetProduct);
      }
      setSwipingId(null);
    }, 300);
  };

  const handleUndo = () => {
    // Undo functionality would need to be implemented in the parent
    // For now, this is a placeholder
    if (!lastSwiped) return;
    setLastSwiped(null);
  };

  if (products.length === 0) {
    return (
      <div className="flex h-[500px] flex-col items-center justify-center text-center">
        <div className="mb-6 rounded-full bg-accent p-6">
          <Heart className="h-12 w-12 text-primary" />
        </div>
        <h3 className="mb-2 font-display text-2xl font-semibold">All caught up!</h3>
        <p className="text-muted-foreground">
          You've reviewed all products. Check back later for new arrivals.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center">
      {/* Card Stack */}
      <div className="relative h-[500px] w-full max-w-sm">
        <div className="card-stack relative h-full">
          {visibleProducts.map((product, index) => (
            <SwipeCard
              key={product.id}
              product={product}
              onSwipe={(dir) => handleSwipe(dir, product)}
              isTop={index === 0 && !swipingId}
              stackIndex={index}
            />
          ))}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="mt-8 flex items-center gap-6">
        <Button
          variant="outline"
          size="icon"
          className="h-14 w-14 rounded-full border-2 border-destructive text-destructive transition-all hover:bg-destructive hover:text-destructive-foreground"
          onClick={() => handleSwipe("left")}
          disabled={!!swipingId}
        >
          <X className="h-6 w-6" />
        </Button>

        <Button
          variant="outline"
          size="icon"
          className="h-10 w-10 rounded-full"
          onClick={handleUndo}
          disabled={!lastSwiped || !!swipingId}
        >
          <RotateCcw className="h-4 w-4" />
        </Button>

        <Button
          variant="outline"
          size="icon"
          className="h-14 w-14 rounded-full border-2 border-success text-success transition-all hover:bg-success hover:text-success-foreground"
          onClick={() => handleSwipe("right")}
          disabled={!!swipingId}
        >
          <Heart className="h-6 w-6" />
        </Button>
      </div>

      {/* Counter */}
      <p className="mt-4 text-sm text-muted-foreground">
        {products.length} product{products.length !== 1 ? "s" : ""} remaining
      </p>
    </div>
  );
};

export default SwipeDeck;
