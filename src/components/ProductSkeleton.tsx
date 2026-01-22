import { Skeleton } from "@/components/ui/skeleton";

interface ProductSkeletonProps {
  count?: number;
}

export function ProductSkeleton({ count = 8 }: ProductSkeletonProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {Array(count)
        .fill(0)
        .map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="aspect-[3/4] w-full rounded-lg" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ))}
    </div>
  );
}

export function SwipeSkeleton() {
  return (
    <div className="flex flex-col items-center justify-center py-8">
      <Skeleton className="h-[400px] w-[300px] rounded-2xl md:h-[500px] md:w-[350px]" />
      <div className="mt-6 flex gap-4">
        <Skeleton className="h-14 w-14 rounded-full" />
        <Skeleton className="h-14 w-14 rounded-full" />
        <Skeleton className="h-14 w-14 rounded-full" />
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      <Skeleton className="h-10 w-full" />
      {Array(rows)
        .fill(0)
        .map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
    </div>
  );
}
