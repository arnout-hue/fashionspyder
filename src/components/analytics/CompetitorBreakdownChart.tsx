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
  Legend,
} from "recharts";

interface CompetitorData {
  competitor: string;
  pending: number;
  positive: number;
  negative: number;
  total: number;
}

interface CompetitorBreakdownChartProps {
  data: CompetitorData[];
  isLoading: boolean;
}

export function CompetitorBreakdownChart({ data, isLoading }: CompetitorBreakdownChartProps) {
  // Take top 10 competitors by total
  const sortedData = [...data]
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Products by Competitor</CardTitle>
        <CardDescription>Distribution of products across top competitors</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-[300px] w-full" />
        ) : sortedData.length === 0 ? (
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            No competitor data available
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={sortedData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis type="number" tick={{ fontSize: 12 }} />
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
              />
              <Legend />
              <Bar 
                dataKey="pending" 
                stackId="a" 
                fill="hsl(var(--muted-foreground))" 
                name="Pending"
                radius={[0, 0, 0, 0]}
              />
              <Bar 
                dataKey="positive" 
                stackId="a" 
                fill="hsl(142, 76%, 36%)" 
                name="Positive"
              />
              <Bar 
                dataKey="negative" 
                stackId="a" 
                fill="hsl(0, 84%, 60%)" 
                name="Negative"
                radius={[0, 4, 4, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
