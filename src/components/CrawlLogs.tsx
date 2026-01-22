import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RefreshCw, ChevronDown, ChevronUp, Search, Filter, Package, XCircle, AlertTriangle, Info, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';

interface CrawlLog {
  id: string;
  job_id: string;
  competitor_id: string;
  log_type: 'info' | 'added' | 'filtered' | 'skipped' | 'error';
  message: string;
  product_name: string | null;
  product_url: string | null;
  product_price: string | null;
  filter_reason: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

interface CrawlJob {
  id: string;
  competitor_id: string;
  status: string;
  products_found: number;
  products_inserted: number;
  created_at: string;
  completed_at: string | null;
  competitors?: { name: string };
}

const logTypeConfig: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  info: { icon: Info, color: 'bg-blue-500/10 text-blue-600 border-blue-200', label: 'Info' },
  added: { icon: Package, color: 'bg-green-500/10 text-green-600 border-green-200', label: 'Added' },
  filtered: { icon: Filter, color: 'bg-orange-500/10 text-orange-600 border-orange-200', label: 'Filtered' },
  skipped: { icon: XCircle, color: 'bg-yellow-500/10 text-yellow-600 border-yellow-200', label: 'Skipped' },
  error: { icon: AlertTriangle, color: 'bg-red-500/10 text-red-600 border-red-200', label: 'Error' },
};

export function CrawlLogs() {
  const [logs, setLogs] = useState<CrawlLog[]>([]);
  const [jobs, setJobs] = useState<CrawlJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const fetchJobs = useCallback(async () => {
    const { data } = await supabase
      .from('crawl_jobs')
      .select('id, competitor_id, status, products_found, products_inserted, created_at, completed_at, competitors(name)')
      .order('created_at', { ascending: false })
      .limit(50);
    
    if (data) {
      setJobs(data as unknown as CrawlJob[]);
    }
  }, []);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    
    let query = supabase
      .from('crawl_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);
    
    if (selectedJob !== 'all') {
      query = query.eq('job_id', selectedJob);
    }
    
    if (selectedType !== 'all') {
      query = query.eq('log_type', selectedType);
    }
    
    if (searchQuery) {
      query = query.or(`message.ilike.%${searchQuery}%,product_name.ilike.%${searchQuery}%,product_url.ilike.%${searchQuery}%`);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('Error fetching logs:', error);
    } else {
      setLogs(data as CrawlLog[]);
    }
    
    setLoading(false);
  }, [selectedJob, selectedType, searchQuery]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const toggleRowExpanded = (id: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const getLogStats = () => {
    const stats = {
      added: logs.filter(l => l.log_type === 'added').length,
      filtered: logs.filter(l => l.log_type === 'filtered').length,
      skipped: logs.filter(l => l.log_type === 'skipped').length,
      errors: logs.filter(l => l.log_type === 'error').length,
    };
    return stats;
  };

  const stats = getLogStats();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Info className="h-5 w-5" />
              Crawl Logs
            </CardTitle>
            <CardDescription>
              Detailed logs showing why items were filtered, skipped, or added
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={fetchLogs} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats Summary */}
        <div className="grid grid-cols-4 gap-3">
          <div className="rounded-lg bg-green-500/10 p-3 text-center">
            <p className="text-xs text-green-600">Added</p>
            <p className="text-2xl font-bold text-green-600">{stats.added}</p>
          </div>
          <div className="rounded-lg bg-orange-500/10 p-3 text-center">
            <p className="text-xs text-orange-600">Filtered</p>
            <p className="text-2xl font-bold text-orange-600">{stats.filtered}</p>
          </div>
          <div className="rounded-lg bg-yellow-500/10 p-3 text-center">
            <p className="text-xs text-yellow-600">Skipped</p>
            <p className="text-2xl font-bold text-yellow-600">{stats.skipped}</p>
          </div>
          <div className="rounded-lg bg-red-500/10 p-3 text-center">
            <p className="text-xs text-red-600">Errors</p>
            <p className="text-2xl font-bold text-red-600">{stats.errors}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search logs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          
          <Select value={selectedJob} onValueChange={setSelectedJob}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Select job" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Jobs</SelectItem>
              {jobs.map(job => (
                <SelectItem key={job.id} value={job.id}>
                  {(job.competitors as any)?.name || 'Unknown'} - {format(new Date(job.created_at), 'MMM d, HH:mm')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Select value={selectedType} onValueChange={setSelectedType}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Log type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="added">Added</SelectItem>
              <SelectItem value="filtered">Filtered</SelectItem>
              <SelectItem value="skipped">Skipped</SelectItem>
              <SelectItem value="error">Errors</SelectItem>
              <SelectItem value="info">Info</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Logs Table */}
        <ScrollArea className="h-[500px] rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">Time</TableHead>
                <TableHead className="w-[80px]">Type</TableHead>
                <TableHead>Message</TableHead>
                <TableHead className="w-[200px]">Product</TableHead>
                <TableHead className="w-[40px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Loading logs...
                  </TableCell>
                </TableRow>
              ) : logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No logs found. Run a crawl to generate logs.
                  </TableCell>
                </TableRow>
              ) : (
                logs.map(log => {
                  const config = logTypeConfig[log.log_type] || logTypeConfig.info;
                  const Icon = config.icon;
                  const isExpanded = expandedRows.has(log.id);
                  const hasDetails = log.details && Object.keys(log.details).length > 0;
                  const hasFilterReason = !!log.filter_reason;
                  
                  return (
                    <Collapsible key={log.id} open={isExpanded} onOpenChange={() => toggleRowExpanded(log.id)}>
                      <TableRow className="group">
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {format(new Date(log.created_at), 'HH:mm:ss')}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`${config.color} text-xs`}>
                            <Icon className="h-3 w-3 mr-1" />
                            {config.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[300px]">
                          <span className="text-sm truncate block">{log.message}</span>
                          {hasFilterReason && (
                            <span className="text-xs text-muted-foreground block mt-0.5">
                              {log.filter_reason}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {log.product_name && (
                            <div className="text-sm">
                              <span className="block truncate max-w-[180px]" title={log.product_name}>
                                {log.product_name}
                              </span>
                              {log.product_price && (
                                <span className="text-xs text-muted-foreground">
                                  {log.product_price}
                                </span>
                              )}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {(hasDetails || log.product_url) && (
                            <CollapsibleTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-6 w-6">
                                {isExpanded ? (
                                  <ChevronUp className="h-4 w-4" />
                                ) : (
                                  <ChevronDown className="h-4 w-4" />
                                )}
                              </Button>
                            </CollapsibleTrigger>
                          )}
                        </TableCell>
                      </TableRow>
                      <CollapsibleContent asChild>
                        <TableRow className="bg-muted/30">
                          <TableCell colSpan={5} className="py-3">
                            <div className="space-y-2 text-sm">
                              {log.product_url && (
                                <div className="flex items-center gap-2">
                                  <span className="text-muted-foreground">URL:</span>
                                  <a 
                                    href={log.product_url} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-primary hover:underline flex items-center gap-1 truncate max-w-[500px]"
                                  >
                                    {log.product_url}
                                    <ExternalLink className="h-3 w-3 flex-shrink-0" />
                                  </a>
                                </div>
                              )}
                              {hasDetails && (
                                <div>
                                  <span className="text-muted-foreground">Details:</span>
                                  <pre className="mt-1 p-2 bg-muted rounded text-xs overflow-x-auto">
                                    {JSON.stringify(log.details, null, 2)}
                                  </pre>
                                </div>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      </CollapsibleContent>
                    </Collapsible>
                  );
                })
              )}
            </TableBody>
          </Table>
        </ScrollArea>

        <p className="text-xs text-muted-foreground text-center">
          Showing {logs.length} logs. Logs are retained for all crawl jobs.
        </p>
      </CardContent>
    </Card>
  );
}
