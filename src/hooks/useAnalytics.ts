import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Types for RPC return values
interface DashboardStats {
  total_products: number;
  pending_count: number;
  positive_count: number;
  negative_count: number;
  trash_count: number;
  positive_value: number;
  pending_value: number;
}

interface CompetitorStats {
  competitor: string;
  total: number;
  pending: number;
  positive: number;
  negative: number;
  total_value: number;
  win_rate: number;
}

interface SourcingHistoryEntry {
  date: string;
  products_added: number;
  competitor: string;
}

interface CrawlPerformanceEntry {
  date: string;
  competitor_name: string;
  total_urls_found: number;
  product_urls_found: number;
  new_products_scraped: number;
}

// Hook for summary stats (fast, single row)
export function useAnalyticsSummary() {
  return useQuery({
    queryKey: ["analytics", "summary"],
    queryFn: async (): Promise<DashboardStats> => {
      const { data, error } = await supabase.rpc("get_dashboard_stats");
      if (error) throw error;
      // RPC returns an array, take first row
      const stats = Array.isArray(data) ? data[0] : data;
      return stats as DashboardStats;
    },
    staleTime: 30000, // 30 seconds
  });
}

// Hook for competitor breakdown
export function useCompetitorAnalytics() {
  return useQuery({
    queryKey: ["analytics", "competitors"],
    queryFn: async (): Promise<CompetitorStats[]> => {
      const { data, error } = await supabase.rpc("get_competitor_stats");
      if (error) throw error;
      return (data as CompetitorStats[]) || [];
    },
    staleTime: 30000,
  });
}

// Hook for sourcing velocity (products discovered over time)
export function useSourcingHistory(days: number = 30) {
  return useQuery({
    queryKey: ["analytics", "history", days],
    queryFn: async (): Promise<SourcingHistoryEntry[]> => {
      const { data, error } = await supabase.rpc("get_sourcing_history", { days });
      if (error) throw error;
      return (data as SourcingHistoryEntry[]) || [];
    },
    staleTime: 60000, // 1 minute
  });
}

// Hook for crawl performance
export function useCrawlPerformance(days: number = 30) {
  return useQuery({
    queryKey: ["analytics", "crawl", days],
    queryFn: async (): Promise<CrawlPerformanceEntry[]> => {
      const { data, error } = await supabase.rpc("get_crawl_performance", { days });
      if (error) throw error;
      return (data as CrawlPerformanceEntry[]) || [];
    },
    staleTime: 60000,
  });
}

// Aggregate sourcing history by date for area chart
export function aggregateSourcingByDate(history: SourcingHistoryEntry[]) {
  const dateMap = new Map<string, Record<string, number>>();
  const allCompetitors = new Set<string>();

  history.forEach((entry) => {
    allCompetitors.add(entry.competitor);
    if (!dateMap.has(entry.date)) {
      dateMap.set(entry.date, {});
    }
    dateMap.get(entry.date)![entry.competitor] = entry.products_added;
  });

  // Convert to array format for Recharts
  return Array.from(dateMap.entries())
    .map(([date, competitors]) => ({
      date,
      ...competitors,
      total: Object.values(competitors).reduce((sum, val) => sum + val, 0),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
