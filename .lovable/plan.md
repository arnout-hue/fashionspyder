
# Fix Plan: Tab Counter Accuracy and Crawl Logs Display

## Issue Summary

### Issue 1: Tab Counters Showing Wrong Numbers
The navigation badges (Discover, Positive, Negative) show incorrect counts. When you load more products in grid view, you see more items than the counter indicates.

**Root Cause**: The `useProductCounts` hook fetches rows to count them client-side, but Supabase has a default 1000-row limit. With 1,626+ products, the counts are truncated.

### Issue 2: Crawl Logs Not Updating
You see new products from today's crawl, but the Crawl Logs view doesn't show them.

**Root Cause**: After investigation, the logs DO exist in the database (32 logs for today's crawl). The issue is likely that the component isn't refreshing after crawls complete, or there's a display/filtering issue. I'll verify and ensure proper auto-refresh.

---

## Proposed Fixes

### Fix 1: Use Server-Side Counting for Navigation Badges

Instead of fetching rows and counting client-side, we'll use a database RPC function that counts directly in Postgres (no row limit issues).

**Changes:**
- Create a new `get_product_counts` Postgres function that groups and counts by status
- Update `useProductCounts` hook to call this RPC instead of fetching rows
- Optionally support competitor filtering

```text
+-------------------+     +----------------------+
| Navigation Badge  | --> | get_product_counts() |
| "Discover (554)"  |     | (Postgres RPC)       |
+-------------------+     +----------------------+
                                   |
                                   v
                          +------------------+
                          | SELECT status,   |
                          | COUNT(*) FROM    |
                          | products         |
                          | GROUP BY status  |
                          +------------------+
```

### Fix 2: Ensure Crawl Logs Refresh Properly

The logs exist in the database but may not be showing due to:
- Stale query cache not invalidating after crawl completes
- The "All Jobs" filter showing old data because newer jobs are at the bottom

**Changes:**
- Add query invalidation when navigating to the Logs tab
- Ensure the jobs dropdown shows newest jobs first (it already does, but we'll verify the select shows the latest by default)
- Add a more prominent "New logs available" indicator or auto-refresh

---

## Technical Details

### Database Migration: Create RPC for Product Counts

```sql
CREATE OR REPLACE FUNCTION get_product_counts(filter_competitor text DEFAULT NULL)
RETURNS TABLE (
  pending_count bigint,
  positive_count bigint,
  negative_count bigint,
  trash_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*) FILTER (WHERE status = 'pending') AS pending_count,
    COUNT(*) FILTER (WHERE status = 'positive') AS positive_count,
    COUNT(*) FILTER (WHERE status = 'negative') AS negative_count,
    COUNT(*) FILTER (WHERE status = 'trash') AS trash_count
  FROM products
  WHERE filter_competitor IS NULL 
     OR filter_competitor = 'All' 
     OR competitor = filter_competitor;
END;
$$;
```

### Hook Update: `useProductCounts`

```typescript
export function useProductCounts(competitor: string) {
  return useQuery({
    queryKey: ["productCounts", competitor],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_product_counts", {
        filter_competitor: competitor === "All" ? null : competitor,
      });
      
      if (error) throw error;
      
      return {
        pending: Number(data?.[0]?.pending_count || 0),
        positive: Number(data?.[0]?.positive_count || 0),
        negative: Number(data?.[0]?.negative_count || 0),
        trash: Number(data?.[0]?.trash_count || 0),
      };
    },
    staleTime: 10000,
  });
}
```

### Crawl Logs Component: Add Auto-Refresh

- Add real-time subscription or polling when the component is visible
- Ensure `fetchLogs()` is called on tab focus
- Show a toast/badge when new logs are available

---

## Files to Modify

| File | Change |
|------|--------|
| `src/hooks/useProducts.ts` | Update `useProductCounts` to use RPC |
| `src/components/CrawlLogs.tsx` | Add auto-refresh on mount/focus |
| Database migration | Create `get_product_counts` RPC |

---

## Expected Outcome

1. **Navigation badges** will show accurate counts regardless of how many products exist (1,626+ supported)
2. **Crawl Logs** will refresh automatically when you visit the tab, showing today's 32 new log entries
