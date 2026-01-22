import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface CompetitorWinRate {
  competitor: string;
  win_rate: number;
  positive: number;
  negative: number;
}

interface WinRateChartProps {
  data: CompetitorWinRate[];
  isLoading: boolean;
}

// Color interpolation from red to green based on win rate
function getWinRateColor(rate: number): string {
  if (rate >= 70) return "hsl(142, 76%, 36%)"; // Green
  if (rate >= 50) return "hsl(48, 96%, 53%)"; // Yellow
  if (rate >= 30) return "hsl(25, 95%, 53%)"; // Orange
  return "hsl(0, 84%, 60%)"; // Red
}

export function WinRateChart({ data, isLoading }: WinRateChartProps) {
  // Filter out competitors with no decisions and sort by win rate
  const filteredData = data
    .filter((c) => c.positive + c.negative > 0)
    .sort((a, b) => b.win_rate - a.win_rate)
    .slice(0, 10);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Win Rate by Competitor</CardTitle>
        <CardDescription>Percentage of products marked positive</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-[300px] w-full" />
        ) : filteredData.length === 0 ? (
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            No decision data yet - start swiping to see win rates
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={filteredData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                type="number" 
                domain={[0, 100]} 
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => `${value}%`}
              />
              <YAxis
                type="category"
                dataKey="competitor"
                tick={{ fontSize: 11 }}
                width={100}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--background))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "6px",
                }}
                formatter={(value: number) => [`${value}%`, "Win Rate"]}
              />
              <Bar 
                dataKey="win_rate" 
                name="Win Rate"
                radius={[0, 4, 4, 0]}
              >
                {filteredData.map((entry, index) => (
                  <Cell key={index} fill={getWinRateColor(entry.win_rate)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
