import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

export interface WeeklySummary {
  total_new_products: number;
  positive_count: number;
  negative_count: number;
  pending_count: number;
  win_rate: number;
  top_competitors: { competitor: string; total: number; positive: number; negative: number }[];
  daily_breakdown: { date: string; products_added: number; positives: number }[];
}

export interface Report {
  id: string;
  report_type: string;
  period_start: string;
  period_end: string;
  data: WeeklySummary;
  created_at: string;
  created_by: string | null;
}

export function useWeeklySummary(days = 7) {
  return useQuery({
    queryKey: ["weeklySummary", days],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_weekly_summary", { days } as any);
      if (error) throw error;
      const row = (data as any[])?.[0];
      if (!row) return null;
      return {
        total_new_products: Number(row.total_new_products),
        positive_count: Number(row.positive_count),
        negative_count: Number(row.negative_count),
        pending_count: Number(row.pending_count),
        win_rate: Number(row.win_rate),
        top_competitors: row.top_competitors || [],
        daily_breakdown: row.daily_breakdown || [],
      } as WeeklySummary;
    },
  });
}

export function useReports() {
  return useQuery({
    queryKey: ["reports"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reports" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data as any[]) as Report[];
    },
  });
}

export function useGenerateReport() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (days: number = 7) => {
      const { data, error } = await supabase.rpc("get_weekly_summary", { days } as any);
      if (error) throw error;

      const row = (data as any[])?.[0];
      if (!row) throw new Error("No data");

      const now = new Date();
      const periodStart = new Date(now.getTime() - days * 86400000);

      const { error: insertError } = await supabase.from("reports" as any).insert({
        report_type: "weekly",
        period_start: periodStart.toISOString(),
        period_end: now.toISOString(),
        data: {
          total_new_products: Number(row.total_new_products),
          positive_count: Number(row.positive_count),
          negative_count: Number(row.negative_count),
          pending_count: Number(row.pending_count),
          win_rate: Number(row.win_rate),
          top_competitors: row.top_competitors,
          daily_breakdown: row.daily_breakdown,
        },
        created_by: user?.id,
      } as any);

      if (insertError) throw insertError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reports"] });
      toast.success("Report generated successfully");
    },
    onError: () => toast.error("Failed to generate report"),
  });
}
