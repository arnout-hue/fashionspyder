import { useState } from "react";
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
  const [currentIndex, setCurrentIndex] = useState(0);
  const [lastSwiped, setLastSwiped] = useState<{ product: Product; direction: "left" | "right" } | null>(null);

  const visibleProducts = products.slice(currentIndex, currentIndex + 3);

  const handleSwipe = (direction: "left" | "right") => {
    const product = products[currentIndex];
    if (!product) return;

    setLastSwiped({ product, direction });
    
    if (direction === "right") {
      onSwipeRight(product);
    } else {
      onSwipeLeft(product);
    }

    setTimeout(() => {
      setCurrentIndex((prev) => prev + 1);
    }, 300);
  };

  const handleUndo = () => {
    if (!lastSwiped || currentIndex === 0) return;
    setCurrentIndex((prev) => prev - 1);
    setLastSwiped(null);
  };

  const remainingCount = products.length - currentIndex;

  if (remainingCount === 0) {
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
              onSwipe={handleSwipe}
              isTop={index === 0}
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
        >
          <X className="h-6 w-6" />
        </Button>

        <Button
          variant="outline"
          size="icon"
          className="h-10 w-10 rounded-full"
          onClick={handleUndo}
          disabled={!lastSwiped}
        >
          <RotateCcw className="h-4 w-4" />
        </Button>

        <Button
          variant="outline"
          size="icon"
          className="h-14 w-14 rounded-full border-2 border-success text-success transition-all hover:bg-success hover:text-success-foreground"
          onClick={() => handleSwipe("right")}
        >
          <Heart className="h-6 w-6" />
        </Button>
      </div>

      {/* Counter */}
      <p className="mt-4 text-sm text-muted-foreground">
        {remainingCount} product{remainingCount !== 1 ? "s" : ""} remaining
      </p>
    </div>
  );
};

export default SwipeDeck;