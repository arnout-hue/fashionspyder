import { useState } from "react";
import { format } from "date-fns";
import {
  FileText,
  TrendingUp,
  TrendingDown,
  Plus,
  Loader2,
  Calendar,
  BarChart3,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useWeeklySummary,
  useReports,
  useGenerateReport,
  WeeklySummary,
  Report,
} from "@/hooks/useReports";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  CartesianGrid,
} from "recharts";

function SummaryCards({ summary }: { summary: WeeklySummary }) {
  return (
    <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
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
          <p className="text-xs text-muted-foreground font-medium">Win Rate</p>
          <p className="text-2xl font-bold mt-1">{summary.win_rate}%</p>
        </CardContent>
      </Card>
    </div>
  );
}

function DailyChart({ data }: { data: WeeklySummary["daily_breakdown"] }) {
  if (!data || data.length === 0) return null;

  const chartData = data.map((d) => ({
    date: format(new Date(d.date), "MMM d"),
    "Products Added": d.products_added,
    Positives: d.positives,
  }));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <BarChart3 className="h-4 w-4" />
          Daily Breakdown
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
              <Bar dataKey="Positives" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

function TopCompetitors({ data }: { data: WeeklySummary["top_competitors"] }) {
  if (!data || data.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Top Competitors This Period</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {data.slice(0, 8).map((c) => (
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
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function ReportHistory({ reports }: { reports: Report[] }) {
  if (reports.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          Report History
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {reports.map((r) => (
            <div
              key={r.id}
              className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
            >
              <div>
                <span className="font-medium capitalize">{r.report_type} Report</span>
                <span className="text-muted-foreground ml-2 text-xs">
                  {format(new Date(r.period_start), "MMM d")} –{" "}
                  {format(new Date(r.period_end), "MMM d, yyyy")}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="tabular-nums text-[11px]">
                  {(r.data as any)?.total_new_products || 0} products
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {format(new Date(r.created_at), "MMM d HH:mm")}
                </span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default function ReportsPage() {
  const [days, setDays] = useState(7);
  const { data: summary, isLoading: loadingSummary } = useWeeklySummary(days);
  const { data: reports = [], isLoading: loadingReports } = useReports();
  const generateReport = useGenerateReport();

  return (
    <div className="space-y-6 pb-20 md:pb-0">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <FileText className="h-6 w-6" />
            Reports
          </h1>
          <p className="text-muted-foreground">
            Automated summaries of competitor activity and sourcing velocity
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 rounded-lg border bg-muted/50 p-1">
            {[7, 14, 30].map((d) => (
              <Button
                key={d}
                variant={days === d ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setDays(d)}
                className="px-3"
              >
                {d}d
              </Button>
            ))}
          </div>
          <Button
            onClick={() => generateReport.mutate(days)}
            disabled={generateReport.isPending}
            size="sm"
            className="gap-1.5"
          >
            {generateReport.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Generate Report
          </Button>
        </div>
      </div>

      {loadingSummary ? (
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-lg" />
          ))}
        </div>
      ) : summary ? (
        <SummaryCards summary={summary} />
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        {summary && <DailyChart data={summary.daily_breakdown} />}
        {summary && <TopCompetitors data={summary.top_competitors} />}
      </div>

      {loadingReports ? (
        <Skeleton className="h-32 rounded-lg" />
      ) : (
        <ReportHistory reports={reports} />
      )}
    </div>
  );
}
