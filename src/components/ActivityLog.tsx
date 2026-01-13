import { useState, useEffect, useCallback } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Activity,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Filter,
  Package,
  Users,
  Globe,
  Mail,
  UserCheck,
  Layers,
  Loader2,
} from 'lucide-react';
import { ActivityLogEntry } from '@/hooks/useActivityLog';
import { exportToCSV } from '@/lib/exportUtils';

const ITEMS_PER_PAGE = 50;

const categoryIcons: Record<string, React.ReactNode> = {
  product: <Package className="h-4 w-4" />,
  supplier: <Users className="h-4 w-4" />,
  competitor: <Globe className="h-4 w-4" />,
  colleague: <Users className="h-4 w-4" />,
  user: <UserCheck className="h-4 w-4" />,
  crawl: <Globe className="h-4 w-4" />,
  email: <Mail className="h-4 w-4" />,
  collection: <Layers className="h-4 w-4" />,
};

const categoryColors: Record<string, string> = {
  product: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  supplier: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  competitor: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  colleague: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  user: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  crawl: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  email: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200',
  collection: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
};

export const ActivityLog = () => {
  const [logs, setLogs] = useState<ActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const fetchLogs = useCallback(async () => {
    setLoading(true);

    let query = supabase
      .from('activity_log')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE - 1);

    if (categoryFilter !== 'all') {
      query = query.eq('action_category', categoryFilter);
    }

    if (searchQuery) {
      query = query.or(
        `action.ilike.%${searchQuery}%,entity_name.ilike.%${searchQuery}%,user_email.ilike.%${searchQuery}%`
      );
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching activity logs:', error);
    } else {
      setLogs((data as ActivityLogEntry[]) || []);
      setTotalCount(count || 0);
    }

    setLoading(false);
  }, [page, categoryFilter, searchQuery]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const toggleRowExpanded = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleExport = () => {
    const exportData = logs.map((log) => ({
      id: log.id,
      name: log.action,
      competitor: log.action_category,
      price: '',
      product_url: '',
      status: log.entity_type || '',
      supplier_id: log.entity_id || '',
      supplier_name: log.entity_name || '',
      notes: JSON.stringify(log.details),
      created_at: log.created_at,
      updated_at: log.created_at,
    }));
    exportToCSV(exportData as any, 'activity-log');
  };

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold">Activity Log</h1>
        <p className="mt-2 text-muted-foreground">
          Track all actions and changes made in the system
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Recent Activity
              </CardTitle>
              <CardDescription>
                {totalCount} total entries
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={handleExport} className="gap-2">
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="mb-6 flex flex-col gap-4 sm:flex-row">
            <div className="relative flex-1">
              <Input
                placeholder="Search actions, users, or entities..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(0);
                }}
                className="pr-10"
              />
              <Filter className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            </div>
            <Select
              value={categoryFilter}
              onValueChange={(value) => {
                setCategoryFilter(value);
                setPage(0);
              }}
            >
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Filter by category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="product">Product</SelectItem>
                <SelectItem value="supplier">Supplier</SelectItem>
                <SelectItem value="competitor">Competitor</SelectItem>
                <SelectItem value="colleague">Colleague</SelectItem>
                <SelectItem value="user">User</SelectItem>
                <SelectItem value="crawl">Crawl</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="collection">Collection</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          {loading ? (
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : logs.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center text-center">
              <Activity className="mb-4 h-12 w-12 text-muted-foreground/50" />
              <h3 className="font-semibold">No activity found</h3>
              <p className="text-sm text-muted-foreground">
                {searchQuery || categoryFilter !== 'all'
                  ? 'Try adjusting your filters'
                  : 'Activity will appear here as users make changes'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[180px]">Time</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Entity</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <Collapsible
                      key={log.id}
                      open={expandedRows.has(log.id)}
                      onOpenChange={() => toggleRowExpanded(log.id)}
                      asChild
                    >
                      <>
                        <TableRow className="group">
                          <TableCell>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="cursor-help text-sm">
                                  {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                {format(new Date(log.created_at), 'PPpp')}
                              </TooltipContent>
                            </Tooltip>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm">{log.user_email || 'System'}</span>
                          </TableCell>
                          <TableCell>
                            <span className="font-medium">{log.action}</span>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="secondary"
                              className={`gap-1 ${categoryColors[log.action_category] || ''}`}
                            >
                              {categoryIcons[log.action_category]}
                              {log.action_category}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {log.entity_name ? (
                              <span className="text-sm text-muted-foreground">
                                {log.entity_name}
                              </span>
                            ) : (
                              <span className="text-sm text-muted-foreground/50">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {Object.keys(log.details || {}).length > 0 && (
                              <CollapsibleTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <ChevronDown
                                    className={`h-4 w-4 transition-transform ${
                                      expandedRows.has(log.id) ? 'rotate-180' : ''
                                    }`}
                                  />
                                </Button>
                              </CollapsibleTrigger>
                            )}
                          </TableCell>
                        </TableRow>
                        <CollapsibleContent asChild>
                          <TableRow className="bg-muted/50">
                            <TableCell colSpan={6} className="p-4">
                              <pre className="text-xs text-muted-foreground overflow-x-auto">
                                {JSON.stringify(log.details, null, 2)}
                              </pre>
                            </TableCell>
                          </TableRow>
                        </CollapsibleContent>
                      </>
                    </Collapsible>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Showing {page * ITEMS_PER_PAGE + 1} to{' '}
                {Math.min((page + 1) * ITEMS_PER_PAGE, totalCount)} of {totalCount}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm">
                  Page {page + 1} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ActivityLog;
