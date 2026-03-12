

# Plan: Fix Build Error + Implement Features 6, 8, 9

## Build Error Fix (Quick)

Line 57 in `CrawlLogs.tsx` uses `NodeJS.Timeout` which isn't available in the browser TypeScript environment. Change to `ReturnType<typeof setInterval>`.

---

## Feature 6: Smart Duplicate Detection

Identify products that appear across multiple competitors (same or very similar name/URL).

**Database changes:**
- Create a `get_duplicate_products` RPC function that groups products by normalized name and returns groups with 2+ matches across different competitors

**UI changes:**
- Add a "Duplicates" section/tab on the Analytics or Discover page
- Show grouped cards: product name, list of competitors carrying it, price comparison
- Allow dismissing false positives

---

## Feature 8: Team Collaboration

Add comments and @mentions on products for team-based sourcing decisions.

**Database changes:**
- Create `product_comments` table (id, product_id, user_id, content, mentioned_users[], created_at)
- RLS: approved users can read, editors+ can insert, own comments can be deleted

**UI changes:**
- Add a comment panel/drawer on product detail views
- Support @mention with autocomplete from profiles table
- Show comment count badge on product cards
- Notification via existing email function when mentioned

---

## Feature 9: Automated Reports

Generate periodic summaries of competitor activity and sourcing velocity.

**Database changes:**
- Create `reports` table (id, report_type, period_start, period_end, data jsonb, created_at, created_by)
- Create `get_weekly_summary` RPC that aggregates: new products by competitor, win rates, top sourced items, price trends

**Edge function:**
- `generate-report` function that calls the RPC, formats the data, and optionally emails the team using Resend

**UI changes:**
- Add a "Reports" page accessible from navigation
- Show latest report with key metrics: new products this week, top competitors, sourcing velocity change
- "Generate Report" button for on-demand creation
- Option to schedule weekly email reports

---

## Files to Create/Modify

| File | Change |
|------|--------|
| `src/components/CrawlLogs.tsx` | Fix `NodeJS.Timeout` → `ReturnType<typeof setInterval>` |
| Database migration | `get_duplicate_products` RPC, `product_comments` table, `reports` table, `get_weekly_summary` RPC |
| `src/components/DuplicateDetection.tsx` | New component showing duplicate product groups |
| `src/components/ProductComments.tsx` | Comment panel with @mentions |
| `src/hooks/useComments.ts` | Hook for CRUD on product_comments |
| `src/pages/ReportsPage.tsx` | Reports dashboard |
| `src/components/ReportSummary.tsx` | Report display component |
| `supabase/functions/generate-report/index.ts` | Edge function for report generation |
| `src/App.tsx` | Add /reports route |
| `src/components/Navigation.tsx` | Add Reports nav link |

---

## Implementation Order

1. Fix build error (CrawlLogs.tsx)
2. Smart Duplicate Detection (DB + UI)
3. Team Collaboration / Comments (DB + UI)
4. Automated Reports (DB + Edge Function + UI)

