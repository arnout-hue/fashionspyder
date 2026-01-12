import { useState } from "react";
import { format } from "date-fns";
import { motion, useMotionValue, useTransform, PanInfo } from "framer-motion";
import { ExternalLink, Tag, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Product } from "@/data/mockData";

interface SwipeCardProps {
  product: Product;
  onSwipe: (direction: "left" | "right") => void;
  isTop: boolean;
}

export const SwipeCard = ({ product, onSwipe, isTop }: SwipeCardProps) => {
  const [exitDirection, setExitDirection] = useState<"left" | "right" | null>(null);
  
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-15, 15]);
  const opacity = useTransform(x, [-200, -100, 0, 100, 200], [0.5, 1, 1, 1, 0.5]);
  
  const likeOpacity = useTransform(x, [0, 100], [0, 1]);
  const nopeOpacity = useTransform(x, [-100, 0], [1, 0]);

  const crawlDate = new Date(product.created_at);

  const handleDragEnd = (_: any, info: PanInfo) => {
    const threshold = 100;
    if (info.offset.x > threshold) {
      setExitDirection("right");
      onSwipe("right");
    } else if (info.offset.x < -threshold) {
      setExitDirection("left");
      onSwipe("left");
    }
  };

  return (
    <motion.div
      className={`absolute w-full cursor-grab active:cursor-grabbing ${isTop ? "" : "pointer-events-none"}`}
      style={{ x, rotate, opacity }}
      drag={isTop ? "x" : false}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.9}
      onDragEnd={handleDragEnd}
      animate={
        exitDirection === "right"
          ? { x: 500, rotate: 20, opacity: 0 }
          : exitDirection === "left"
          ? { x: -500, rotate: -20, opacity: 0 }
          : {}
      }
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
    >
      <div className="relative overflow-hidden rounded-2xl bg-card shadow-elevated">
        {/* Like/Nope overlays */}
        <motion.div
          className="absolute top-8 right-8 z-10 rotate-12 rounded-lg border-4 border-success px-4 py-2"
          style={{ opacity: likeOpacity }}
        >
          <span className="text-2xl font-bold text-success">LIKE</span>
        </motion.div>
        <motion.div
          className="absolute top-8 left-8 z-10 -rotate-12 rounded-lg border-4 border-destructive px-4 py-2"
          style={{ opacity: nopeOpacity }}
        >
          <span className="text-2xl font-bold text-destructive">NOPE</span>
        </motion.div>

        {/* Product Image */}
        <div className="relative aspect-[3/4] overflow-hidden">
          <img
            src={product.image_url || "/placeholder.svg"}
            alt={product.name}
            className="h-full w-full object-cover"
            draggable={false}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          
          {/* Competitor Badge */}
          <Badge 
            variant="secondary" 
            className="absolute top-4 left-4 bg-white/90 text-foreground backdrop-blur-sm"
          >
            {product.competitor}
          </Badge>

          {/* Crawl Date Badge */}
          <div className="absolute top-4 right-4 flex items-center gap-1.5 rounded-md bg-black/50 px-2.5 py-1.5 text-sm text-white backdrop-blur-sm">
            <Calendar className="h-4 w-4" />
            <span>{format(crawlDate, "MMM d, yyyy")}</span>
          </div>
        </div>

        {/* Product Info */}
        <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
          <h3 className="mb-2 font-display text-2xl font-semibold leading-tight">
            {product.name}
          </h3>
          
          <div className="flex items-center justify-between">
            <span className="text-xl font-semibold">{product.price}</span>
            
            <div className="flex items-center gap-3">
              {product.sku && (
                <div className="flex items-center gap-1.5 text-sm opacity-80">
                  <Tag className="h-4 w-4" />
                  <span>{product.sku}</span>
                </div>
              )}
              
              <a
                href={product.product_url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full bg-white/20 p-2 backdrop-blur-sm transition-colors hover:bg-white/30"
                onClick={(e) => e.stopPropagation()}
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default SwipeCard;