import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  ArrowLeft,
  FileText,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Calendar,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import type { Report, WeeklySummary } from "@/hooks/useReports";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  CartesianGrid,
} from "recharts";

function useReport(id: string | undefined) {
  return useQuery({
    queryKey: ["report", id],
    queryFn: async () => {
      if (!id) throw new Error("No report ID");
      const { data, error } = await supabase
        .from("reports")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data as unknown as Report;
    },
    enabled: !!id,
  });
}

export default function ReportDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: report, isLoading, error } = useReport(id);

  if (isLoading) {
    return (
      <div className="space-y-6 pb-20 md:pb-0">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-lg" />
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="space-y-4 pb-20 md:pb-0">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/reports" className="gap-1.5">
            <ArrowLeft className="h-4 w-4" /> Back to Reports
          </Link>
        </Button>
        <p className="text-muted-foreground">Report not found.</p>
      </div>
    );
  }

  const summary = report.data as WeeklySummary;

  const chartData = (summary.daily_breakdown || []).map((d) => ({
    date: format(new Date(d.date), "MMM d"),
    "Products Added": d.products_added,
    Positives: d.positives,
  }));

  return (
    <div className="space-y-6 pb-20 md:pb-0">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <Button variant="ghost" size="sm" className="w-fit gap-1.5" asChild>
          <Link to="/reports">
            <ArrowLeft className="h-4 w-4" /> Back to Reports
          </Link>
        </Button>
        <div className="flex items-center gap-3">
          <FileText className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight capitalize">
              {report.report_type} Report
            </h1>
            <p className="text-muted-foreground text-sm flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              {format(new Date(report.period_start), "MMM d, yyyy")} –{" "}
              {format(new Date(report.period_end), "MMM d, yyyy")}
              <span className="text-muted-foreground/60 ml-2">
                Generated {format(new Date(report.created_at), "MMM d, yyyy 'at' HH:mm")}
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground font-medium">New Products</p>
            <p className="text-2xl font-bold mt-1">{summary.total_new_products}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground font-medium flex items-center gap-1">
              <TrendingUp className="h-3 w-3" /> Positive
            </p>
            <p className="text-2xl font-bold mt-1 text-green-600">{summary.positive_count}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground font-medium flex items-center gap-1">
              <TrendingDown className="h-3 w-3" /> Negative
            </p>
            <p className="text-2xl font-bold mt-1 text-destructive">{summary.negative_count}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground font-medium">Pending</p>
            <p className="text-2xl font-bold mt-1 text-amber-500">{summary.pending_count}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground font-medium">Win Rate</p>
            <p className="text-2xl font-bold mt-1">{summary.win_rate}%</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        {chartData.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="h-4 w-4" /> Daily Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="date" className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                    <RechartsTooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "0.5rem",
                      }}
                    />
                    <Bar dataKey="Products Added" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Positives" fill="hsl(var(--success, 142 71% 45%))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {summary.top_competitors && summary.top_competitors.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Top Competitors</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {summary.top_competitors.map((c) => (
                  <div key={c.competitor} className="flex items-center justify-between text-sm">
                    <span className="font-medium truncate">{c.competitor}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="tabular-nums text-[11px]">
                        {c.total} new
                      </Badge>
                      {c.positive > 0 && (
                        <Badge className="bg-green-100 text-green-700 tabular-nums text-[11px]">
                          +{c.positive}
                        </Badge>
                      )}
                      {c.negative > 0 && (
                        <Badge variant="destructive" className="tabular-nums text-[11px]">
                          -{c.negative}
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
