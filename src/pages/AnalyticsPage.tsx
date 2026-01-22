import { useState } from "react";
import { DollarSign, CheckCircle, Archive, TrendingUp, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/analytics/StatCard";
import { SourcingVelocityChart } from "@/components/analytics/SourcingVelocityChart";
import { CompetitorBreakdownChart } from "@/components/analytics/CompetitorBreakdownChart";
import { WinRateChart } from "@/components/analytics/WinRateChart";
import {
  useAnalyticsSummary,
  useCompetitorAnalytics,
  useSourcingHistory,
  aggregateSourcingByDate,
} from "@/hooks/useAnalytics";

type DateRange = 7 | 30 | 90;

export default function AnalyticsPage() {
  const [dateRange, setDateRange] = useState<DateRange>(30);

  const { data: summary, isLoading: loadingSummary } = useAnalyticsSummary();
  const { data: competitors, isLoading: loadingCompetitors } = useCompetitorAnalytics();
  const { data: history, isLoading: loadingHistory } = useSourcingHistory(dateRange);

  // Format currency
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("nl-NL", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);

  // Calculate win rate
  const winRate = summary
    ? summary.positive_count + summary.negative_count > 0
      ? Math.round(
          (summary.positive_count /
            (summary.positive_count + summary.negative_count)) *
            100
        )
      : 0
    : 0;

  // Aggregate sourcing history for chart
  const chartData = history ? aggregateSourcingByDate(history) : [];

  return (
    <div className="space-y-6 pb-20 md:pb-0">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <BarChart3 className="h-6 w-6" />
            Analytics
          </h1>
          <p className="text-muted-foreground">
            Performance metrics and sourcing intelligence
          </p>
        </div>

        {/* Date Range Selector */}
        <div className="flex gap-1 rounded-lg border bg-muted/50 p-1">
          {([7, 30, 90] as DateRange[]).map((days) => (
            <Button
              key={days}
              variant={dateRange === days ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setDateRange(days)}
              className="px-3"
            >
              {days}d
            </Button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Pipeline Value"
          value={formatCurrency(summary?.positive_value || 0)}
          description="Total value of positive items"
          icon={<DollarSign className="h-4 w-4" />}
          isLoading={loadingSummary}
        />
        <StatCard
          title="Positive Items"
          value={String(summary?.positive_count || 0)}
          description="Products selected for sourcing"
          icon={<CheckCircle className="h-4 w-4" />}
          isLoading={loadingSummary}
        />
        <StatCard
          title="Pending Queue"
          value={String(summary?.pending_count || 0)}
          description="Awaiting review"
          icon={<Archive className="h-4 w-4" />}
          isLoading={loadingSummary}
        />
        <StatCard
          title="Win Rate"
          value={`${winRate}%`}
          description={`${summary?.positive_count || 0} of ${
            (summary?.positive_count || 0) + (summary?.negative_count || 0)
          } decisions`}
          icon={<TrendingUp className="h-4 w-4" />}
          isLoading={loadingSummary}
        />
      </div>

      {/* Sourcing Velocity Chart */}
      <SourcingVelocityChart
        data={chartData}
        isLoading={loadingHistory}
        days={dateRange}
      />

      {/* Two Column Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <CompetitorBreakdownChart
          data={
            competitors?.map((c) => ({
              competitor: c.competitor,
              pending: Number(c.pending),
              positive: Number(c.positive),
              negative: Number(c.negative),
              total: Number(c.total),
            })) || []
          }
          isLoading={loadingCompetitors}
        />
        <WinRateChart
          data={
            competitors?.map((c) => ({
              competitor: c.competitor,
              win_rate: Number(c.win_rate),
              positive: Number(c.positive),
              negative: Number(c.negative),
            })) || []
          }
          isLoading={loadingCompetitors}
        />
      </div>
    </div>
  );
}
