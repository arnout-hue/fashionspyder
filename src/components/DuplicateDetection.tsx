import { useState } from "react";
import { Copy, ExternalLink, ChevronDown, ChevronUp, Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useDuplicateProducts, DuplicateGroup } from "@/hooks/useDuplicates";

function DuplicateCard({ group }: { group: DuplicateGroup }) {
  const [expanded, setExpanded] = useState(false);

  const minPrice = group.prices.filter(Boolean).length > 0
    ? Math.min(...group.prices.filter((p): p is number => p !== null))
    : null;
  const maxPrice = group.prices.filter(Boolean).length > 0
    ? Math.max(...group.prices.filter((p): p is number => p !== null))
    : null;

  const formatPrice = (p: number | null) =>
    p !== null
      ? new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(p)
      : "—";

  return (
    <Card className="overflow-hidden">
      <div
        className="flex items-start gap-4 p-4 cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        {/* Thumbnail */}
        <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-md bg-muted">
          {group.image_urls[0] ? (
            <img
              src={group.image_urls[0]}
              alt={group.normalized_name}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted-foreground">
              <Copy className="h-6 w-6" />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm leading-tight truncate capitalize">
            {group.normalized_name}
          </p>
          <div className="flex flex-wrap gap-1 mt-1.5">
            {group.competitors.map((c) => (
              <Badge key={c} variant="secondary" className="text-[11px]">
                {c}
              </Badge>
            ))}
          </div>
          {minPrice !== null && (
            <p className="text-xs text-muted-foreground mt-1">
              {minPrice === maxPrice
                ? formatPrice(minPrice)
                : `${formatPrice(minPrice)} – ${formatPrice(maxPrice)}`}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="tabular-nums">
            {group.competitor_count} shops
          </Badge>
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </div>

      {expanded && (
        <CardContent className="border-t bg-muted/30 px-4 py-3">
          <div className="space-y-2">
            {group.product_ids.map((id, i) => (
              <div key={id} className="flex items-center gap-3 text-sm">
                <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded bg-background border">
                  {group.image_urls[i] ? (
                    <img
                      src={group.image_urls[i]!}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="h-full w-full bg-muted" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-xs">{group.product_names[i]}</p>
                  <p className="text-xs text-muted-foreground">
                    {group.competitors[i] || "Unknown"} · {formatPrice(group.prices[i])}
                  </p>
                </div>
                <a
                  href={group.product_urls[i]}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

export function DuplicateDetection() {
  const [search, setSearch] = useState("");
  const { data: duplicates, isLoading } = useDuplicateProducts(2);

  const filtered = duplicates?.filter((d) =>
    d.normalized_name.toLowerCase().includes(search.toLowerCase())
  ) || [];

  return (
    <div className="space-y-6 pb-20 md:pb-0">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Copy className="h-6 w-6" />
          Duplicate Detection
        </h1>
        <p className="text-muted-foreground">
          Products appearing across multiple competitors
        </p>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search duplicates..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-lg" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Copy className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No duplicate products found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {filtered.length} product{filtered.length !== 1 ? "s" : ""} found across multiple competitors
          </p>
          {filtered.map((group) => (
            <DuplicateCard key={group.normalized_name} group={group} />
          ))}
        </div>
      )}
    </div>
  );
}
