import { useState, useEffect, useCallback } from 'react';
import { format, formatDistanceToNow, addDays } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useActivityLog } from '@/hooks/useActivityLog';
import { useToast } from '@/hooks/use-toast';
import { firecrawlApi } from '@/lib/api/firecrawl';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Clock,
  Play,
  Calendar,
  Settings2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  RefreshCw,
  Zap,
} from 'lucide-react';

interface CrawlSchedule {
  id: string;
  name: string;
  cron_expression: string;
  is_enabled: boolean;
  max_products_per_competitor: number;
  delay_between_competitors_seconds: number;
  last_run_at: string | null;
  next_run_at: string | null;
  created_at: string;
  updated_at: string;
}

interface CrawlHistoryRecord {
  id: string;
  competitor_id: string;
  competitor_name?: string;
  crawled_at: string;
  status: string;
  total_urls_found: number;
  product_urls_found: number;
  new_products_scraped: number;
  skipped_count: number;
  errors_count: number;
  error_message: string | null;
}

const scheduleOptions = [
  { value: '0 3 * * *', label: '3:00 AM daily' },
  { value: '0 6 * * *', label: '6:00 AM daily' },
  { value: '0 12 * * *', label: '12:00 PM daily' },
  { value: '0 3 * * 1', label: 'Weekly (Monday 3:00 AM)' },
  { value: '0 3 * * 1,4', label: 'Twice weekly (Mon & Thu 3:00 AM)' },
];

export const ScheduleAutomation = () => {
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const { logActivity } = useActivityLog();
  const [schedule, setSchedule] = useState<CrawlSchedule | null>(null);
  const [history, setHistory] = useState<CrawlHistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [runningNow, setRunningNow] = useState(false);

  // Form state
  const [isEnabled, setIsEnabled] = useState(true);
  const [cronExpression, setCronExpression] = useState('0 3 * * *');
  const [maxProducts, setMaxProducts] = useState(25);
  const [delaySeconds, setDelaySeconds] = useState(180);

  const fetchSchedule = useCallback(async () => {
    const { data, error } = await supabase
      .from('crawl_schedule')
      .select('*')
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching schedule:', error);
    } else if (data) {
      setSchedule(data);
      setIsEnabled(data.is_enabled);
      setCronExpression(data.cron_expression);
      setMaxProducts(data.max_products_per_competitor);
      setDelaySeconds(data.delay_between_competitors_seconds);
    }
  }, []);

  const fetchHistory = useCallback(async () => {
    // Fetch recent crawl history with competitor names
    const { data: historyData, error: historyError } = await supabase
      .from('crawl_history')
      .select('*')
      .order('crawled_at', { ascending: false })
      .limit(20);

    if (historyError) {
      console.error('Error fetching history:', historyError);
      return;
    }

    // Get competitor names
    const competitorIds = [...new Set(historyData?.map((h: CrawlHistoryRecord) => h.competitor_id) || [])];
    const { data: competitorsData } = await supabase
      .from('competitors')
      .select('id, name')
      .in('id', competitorIds);

    const competitorMap = new Map(competitorsData?.map((c: { id: string; name: string }) => [c.id, c.name]));

    setHistory(
      historyData?.map((h: CrawlHistoryRecord) => ({
        ...h,
        competitor_name: competitorMap.get(h.competitor_id) || 'Unknown',
      })) || []
    );

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchSchedule();
    fetchHistory();
  }, [fetchSchedule, fetchHistory]);

  const handleSaveSettings = async () => {
    if (!schedule) return;

    setSaving(true);

    const { error } = await supabase
      .from('crawl_schedule')
      .update({
        is_enabled: isEnabled,
        cron_expression: cronExpression,
        max_products_per_competitor: maxProducts,
        delay_between_competitors_seconds: delaySeconds,
      })
      .eq('id', schedule.id);

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to save settings',
        variant: 'destructive',
      });
    } else {
      await logActivity(
        'Updated crawl schedule',
        'crawl',
        undefined,
        undefined,
        undefined,
        { is_enabled: isEnabled, cron_expression: cronExpression }
      );
      toast({
        title: 'Settings saved',
        description: 'Crawl automation settings have been updated',
      });
      fetchSchedule();
    }

    setSaving(false);
  };

  const handleRunNow = async () => {
    if (!schedule) return;
    
    setRunningNow(true);
    toast({
      title: 'Starting bulk crawl...',
      description: 'Triggering crawl jobs for all active competitors',
    });
    
    try {
      // Use the bulk-crawl edge function instead of browser-side loop
      // This delegates orchestration to the server and avoids timeout issues
      const { data, error } = await supabase.functions.invoke('bulk-crawl', {
        body: { 
          limit: schedule.max_products_per_competitor || 25 
        }
      });

      if (error) {
        throw new Error(error.message || 'Failed to invoke bulk-crawl');
      }

      const successCount = data?.successCount || 0;
      const failCount = data?.failCount || 0;
      const totalCompetitors = data?.results?.length || 0;

      // Update last_run_at
      await supabase
        .from('crawl_schedule')
        .update({ last_run_at: new Date().toISOString() })
        .eq('id', schedule.id);

      toast({
        title: 'Crawl jobs triggered',
        description: `Started ${successCount} jobs for ${totalCompetitors} competitors. Check history for progress.`,
      });

      logActivity(
        'Manual bulk crawl triggered',
        'crawl',
        undefined,
        undefined,
        undefined,
        { successCount, failCount, totalCompetitors }
      );

      await fetchSchedule();
      await fetchHistory();
    } catch (error) {
      console.error('Error running bulk crawl:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to start bulk crawl',
        variant: 'destructive',
      });
    } finally {
      setRunningNow(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return (
          <Badge variant="default" className="gap-1 bg-green-600">
            <CheckCircle2 className="h-3 w-3" />
            Success
          </Badge>
        );
      case 'error':
        return (
          <Badge variant="destructive" className="gap-1">
            <XCircle className="h-3 w-3" />
            Error
          </Badge>
        );
      case 'partial':
        return (
          <Badge variant="secondary" className="gap-1 bg-yellow-600 text-white">
            <AlertCircle className="h-3 w-3" />
            Partial
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getNextRunTime = () => {
    if (!schedule?.is_enabled) return 'Disabled';

    // Parse cron expression to get next run
    const cronParts = schedule.cron_expression.split(' ');
    const hour = parseInt(cronParts[1]);
    const minute = parseInt(cronParts[0]);

    const now = new Date();
    let nextRun = new Date();
    nextRun.setHours(hour, minute, 0, 0);

    if (nextRun <= now) {
      nextRun = addDays(nextRun, 1);
    }

    return formatDistanceToNow(nextRun, { addSuffix: true });
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Schedule Status Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Automation Schedule
              </CardTitle>
              <CardDescription>
                Configure when and how automated crawls run
              </CardDescription>
            </div>
            <Badge
              variant={isEnabled ? 'default' : 'secondary'}
              className={isEnabled ? 'bg-green-600' : ''}
            >
              {isEnabled ? 'Active' : 'Paused'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Status Overview */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg border p-4">
              <p className="text-sm text-muted-foreground">Next Run</p>
              <p className="mt-1 font-semibold">{getNextRunTime()}</p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-sm text-muted-foreground">Last Run</p>
              <p className="mt-1 font-semibold">
                {schedule?.last_run_at
                  ? formatDistanceToNow(new Date(schedule.last_run_at), { addSuffix: true })
                  : 'Never'}
              </p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-sm text-muted-foreground">Schedule</p>
              <p className="mt-1 font-semibold">
                {scheduleOptions.find((o) => o.value === cronExpression)?.label || cronExpression}
              </p>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex gap-3">
            <Button
              onClick={handleRunNow}
              disabled={runningNow}
              className="gap-2"
            >
              {runningNow ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  Run Now
                </>
              )}
            </Button>
            <Button variant="outline" onClick={fetchHistory} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Settings Card */}
      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings2 className="h-5 w-5" />
              Schedule Settings
            </CardTitle>
            <CardDescription>
              Configure automation parameters (admin only)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <Label htmlFor="enabled">Enable Automation</Label>
                <p className="text-sm text-muted-foreground">
                  Run crawls automatically on schedule
                </p>
              </div>
              <Switch
                id="enabled"
                checked={isEnabled}
                onCheckedChange={setIsEnabled}
              />
            </div>

            <div className="space-y-2">
              <Label>Schedule Time</Label>
              <Select value={cronExpression} onValueChange={setCronExpression}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {scheduleOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between">
                  <Label>Max Products per Competitor</Label>
                  <span className="text-sm font-medium">{maxProducts}</span>
                </div>
                <Slider
                  value={[maxProducts]}
                  onValueChange={([value]) => setMaxProducts(value)}
                  min={5}
                  max={100}
                  step={5}
                  className="mt-2"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Limit how many new products to scrape per competitor
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <Label>Rate Limit Buffer</Label>
                  <span className="text-sm font-medium">{delaySeconds}s</span>
                </div>
                <Slider
                  value={[delaySeconds]}
                  onValueChange={([value]) => setDelaySeconds(value)}
                  min={1}
                  max={10}
                  step={1}
                  className="mt-2"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Delay between triggering jobs (for API rate limiting). Jobs run in parallel.
                </p>
              </div>
            </div>

            <Button onClick={handleSaveSettings} disabled={saving} className="w-full gap-2">
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Zap className="h-4 w-4" />
              )}
              Save Settings
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Execution History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Recent Crawl History
          </CardTitle>
          <CardDescription>Last 20 crawl executions</CardDescription>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <div className="flex h-32 items-center justify-center text-muted-foreground">
              No crawl history yet
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Competitor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">URLs Found</TableHead>
                    <TableHead className="text-right">Products</TableHead>
                    <TableHead className="text-right">New</TableHead>
                    <TableHead className="text-right">Errors</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell className="whitespace-nowrap">
                        <span className="text-sm">
                          {format(new Date(record.crawled_at), 'MMM d, HH:mm')}
                        </span>
                      </TableCell>
                      <TableCell className="font-medium">
                        {record.competitor_name}
                      </TableCell>
                      <TableCell>{getStatusBadge(record.status)}</TableCell>
                      <TableCell className="text-right">{record.total_urls_found}</TableCell>
                      <TableCell className="text-right">{record.product_urls_found}</TableCell>
                      <TableCell className="text-right font-medium text-green-600">
                        +{record.new_products_scraped}
                      </TableCell>
                      <TableCell className="text-right">
                        {record.errors_count > 0 ? (
                          <span className="text-destructive">{record.errors_count}</span>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ScheduleAutomation;
