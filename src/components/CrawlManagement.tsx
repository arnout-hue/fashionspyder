import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { firecrawlApi } from '@/lib/api/firecrawl';
import { supabase } from '@/integrations/supabase/client';
import { Globe, Loader2, Play, ExternalLink, Plus, Pencil, Trash2, Image as ImageIcon, Settings2, Zap, Save, BarChart3 } from 'lucide-react';

// URL validation helper
function isValidHttpUrl(url: string): boolean {
  try {
    const parsedUrl = new URL(url);
    return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:';
  } catch {
    return false;
  }
}

interface Competitor {
  id: string;
  name: string;
  logo_url: string | null;
  scrape_url: string;
  notes: string | null;
  product_url_patterns: string[];
  excluded_categories: string[];
  is_active: boolean;
  last_crawled_at: string | null;
  created_at: string;
  updated_at: string;
}

interface CrawlStatus {
  competitor: string;
  status: 'idle' | 'crawling' | 'success' | 'error';
  message?: string;
  results?: {
    totalUrlsFound: number;
    productUrlsFound: number;
    newProductUrls: number;
    scrapedCount: number;
    skippedCount: number;
    errorsCount: number;
  };
}

interface CrawlHistoryRecord {
  id: string;
  competitor_id: string;
  crawled_at: string;
  status: string;
  total_urls_found: number;
  product_urls_found: number;
  new_products_scraped: number;
  skipped_count: number;
  errors_count: number;
  error_message: string | null;
}

const DEFAULT_EXCLUDED_CATEGORIES = [
  // English terms
  'accessories', 'bags', 'belts', 'earrings', 'jewelry', 'jewellery', 
  'necklaces', 'bracelets', 'rings', 'watches', 'sunglasses', 'hats', 
  'scarves', 'shoes', 'boots', 'sneakers', 'sandals', 'heels', 'socks',
  'wallet', 'wallets', 'purse', 'clutch', 'backpack', 'hairclip', 'headband',
  // Dutch terms
  'sieraden', 'tassen', 'riemen', 'oorbellen', 'armbanden', 'armband',
  'kettingen', 'ketting', 'ringen', 'ring', 'horloges', 'horloge',
  'zonnebrillen', 'zonnebril', 'hoeden', 'hoed', 'sjaals', 'sjaal',
  'schoenen', 'laarzen', 'hakken', 'sandalen', 'sokken', 'portemonnee',
  'rugzak', 'haarclip', 'haarband', 'accessoire', 'accessoires',
  'oorbel', 'tas', 'riem', 'handtas', 'clutch', 'slippers'
];

export const CrawlManagement = () => {
  const { toast } = useToast();
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [crawlStatuses, setCrawlStatuses] = useState<Record<string, CrawlStatus>>({});
  const [crawlHistory, setCrawlHistory] = useState<Record<string, CrawlHistoryRecord>>({});
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingCompetitor, setEditingCompetitor] = useState<Competitor | null>(null);
  const [isBulkCrawling, setIsBulkCrawling] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0 });
  const [isEditingGlobalFilters, setIsEditingGlobalFilters] = useState(false);
  const [globalExcludedCategories, setGlobalExcludedCategories] = useState(DEFAULT_EXCLUDED_CATEGORIES.join(', '));
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    scrape_url: '',
    logo_url: '',
    notes: '',
    product_url_patterns: '',
    excluded_categories: DEFAULT_EXCLUDED_CATEGORIES.join(', '),
  });

  const fetchCrawlHistory = useCallback(async (competitorIds: string[]) => {
    if (competitorIds.length === 0) return;
    
    // Get the latest crawl for each competitor
    const { data, error } = await supabase
      .from('crawl_history')
      .select('*')
      .in('competitor_id', competitorIds)
      .order('crawled_at', { ascending: false });
    
    if (!error && data) {
      // Group by competitor_id and keep only the latest
      const latestByCompetitor: Record<string, CrawlHistoryRecord> = {};
      data.forEach((record: CrawlHistoryRecord) => {
        if (!latestByCompetitor[record.competitor_id]) {
          latestByCompetitor[record.competitor_id] = record;
        }
      });
      setCrawlHistory(latestByCompetitor);
    }
  }, []);

  const fetchCompetitors = useCallback(async () => {
    const { data, error } = await supabase
      .from('competitors')
      .select('*')
      .order('name');
    
    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to load competitors',
        variant: 'destructive',
      });
    } else {
      setCompetitors(data || []);
      // Fetch crawl history for all competitors
      if (data && data.length > 0) {
        await fetchCrawlHistory(data.map((c: Competitor) => c.id));
      }
    }
    setLoading(false);
  }, [toast, fetchCrawlHistory]);

  useEffect(() => {
    fetchCompetitors();
  }, [fetchCompetitors]);

  const resetForm = () => {
    setFormData({
      name: '',
      scrape_url: '',
      logo_url: '',
      notes: '',
      product_url_patterns: '',
      excluded_categories: DEFAULT_EXCLUDED_CATEGORIES.join(', '),
    });
  };

  const handleAddCompetitor = async () => {
    // Validate required fields
    if (!formData.name.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Competitor name is required',
        variant: 'destructive',
      });
      return;
    }

    // Validate scrape URL
    if (!formData.scrape_url.trim() || !isValidHttpUrl(formData.scrape_url)) {
      toast({
        title: 'Invalid URL',
        description: 'Scrape URL must be a valid HTTP/HTTPS URL',
        variant: 'destructive',
      });
      return;
    }

    // Validate logo URL if provided
    if (formData.logo_url.trim() && !isValidHttpUrl(formData.logo_url)) {
      toast({
        title: 'Invalid URL',
        description: 'Logo URL must be a valid HTTP/HTTPS URL',
        variant: 'destructive',
      });
      return;
    }

    const { error } = await supabase.from('competitors').insert({
      name: formData.name.trim().slice(0, 100),
      scrape_url: formData.scrape_url.trim().slice(0, 500),
      logo_url: formData.logo_url.trim().slice(0, 500) || null,
      notes: formData.notes.trim().slice(0, 1000) || null,
      product_url_patterns: formData.product_url_patterns.split(',').map(p => p.trim()).filter(Boolean),
      excluded_categories: formData.excluded_categories.split(',').map(c => c.trim()).filter(Boolean),
    });

    if (error) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Success',
        description: `${formData.name} has been added`,
      });
      setIsAddDialogOpen(false);
      resetForm();
      fetchCompetitors();
    }
  };

  const handleEditCompetitor = async () => {
    if (!editingCompetitor) return;

    // Validate required fields
    if (!formData.name.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Competitor name is required',
        variant: 'destructive',
      });
      return;
    }

    // Validate scrape URL
    if (!formData.scrape_url.trim() || !isValidHttpUrl(formData.scrape_url)) {
      toast({
        title: 'Invalid URL',
        description: 'Scrape URL must be a valid HTTP/HTTPS URL',
        variant: 'destructive',
      });
      return;
    }

    // Validate logo URL if provided
    if (formData.logo_url.trim() && !isValidHttpUrl(formData.logo_url)) {
      toast({
        title: 'Invalid URL',
        description: 'Logo URL must be a valid HTTP/HTTPS URL',
        variant: 'destructive',
      });
      return;
    }

    const { error } = await supabase
      .from('competitors')
      .update({
        name: formData.name.trim().slice(0, 100),
        scrape_url: formData.scrape_url.trim().slice(0, 500),
        logo_url: formData.logo_url.trim().slice(0, 500) || null,
        notes: formData.notes.trim().slice(0, 1000) || null,
        product_url_patterns: formData.product_url_patterns.split(',').map(p => p.trim()).filter(Boolean),
        excluded_categories: formData.excluded_categories.split(',').map(c => c.trim()).filter(Boolean),
      })
      .eq('id', editingCompetitor.id);

    if (error) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Success',
        description: `${formData.name} has been updated`,
      });
      setEditingCompetitor(null);
      resetForm();
      fetchCompetitors();
    }
  };

  const handleDeleteCompetitor = async (competitor: Competitor) => {
    const { error } = await supabase
      .from('competitors')
      .delete()
      .eq('id', competitor.id);

    if (error) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Deleted',
        description: `${competitor.name} has been removed`,
      });
      fetchCompetitors();
    }
  };

  const openEditDialog = (competitor: Competitor) => {
    setFormData({
      name: competitor.name,
      scrape_url: competitor.scrape_url,
      logo_url: competitor.logo_url || '',
      notes: competitor.notes || '',
      product_url_patterns: competitor.product_url_patterns?.join(', ') || '',
      excluded_categories: competitor.excluded_categories?.join(', ') || '',
    });
    setEditingCompetitor(competitor);
  };

  const saveCrawlHistory = async (
    competitorId: string,
    status: 'success' | 'error' | 'partial',
    results?: CrawlStatus['results'],
    errorMessage?: string
  ) => {
    const record = {
      competitor_id: competitorId,
      status,
      total_urls_found: results?.totalUrlsFound || 0,
      product_urls_found: results?.productUrlsFound || 0,
      new_products_scraped: results?.scrapedCount || 0,
      skipped_count: results?.skippedCount || 0,
      errors_count: results?.errorsCount || 0,
      error_message: errorMessage || null,
    };

    await supabase.from('crawl_history').insert(record);
  };

  const handleCrawl = async (competitor: Competitor) => {
    setCrawlStatuses((prev) => ({
      ...prev,
      [competitor.name]: { competitor: competitor.name, status: 'crawling' },
    }));

    try {
      const response = await firecrawlApi.scrapeCompetitor(competitor.id, 25);

      if (response.success && response.data) {
        setCrawlStatuses((prev) => ({
          ...prev,
          [competitor.name]: {
            competitor: competitor.name,
            status: 'success',
            message: `Found ${response.data.scrapedCount} new products`,
            results: response.data,
          },
        }));

        // Save to crawl history
        await saveCrawlHistory(competitor.id, 'success', response.data);

        // Update last_crawled_at
        await supabase
          .from('competitors')
          .update({ last_crawled_at: new Date().toISOString() })
          .eq('id', competitor.id);

        toast({
          title: 'Crawl Complete',
          description: `Successfully scraped ${response.data.scrapedCount} new products from ${competitor.name}`,
        });
        
        fetchCompetitors();
      } else {
        throw new Error(response.error || 'Failed to crawl');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to crawl';
      
      // Save error to crawl history
      await saveCrawlHistory(competitor.id, 'error', undefined, errorMessage);
      
      setCrawlStatuses((prev) => ({
        ...prev,
        [competitor.name]: {
          competitor: competitor.name,
          status: 'error',
          message: errorMessage,
        },
      }));

      toast({
        title: 'Crawl Failed',
        description: errorMessage,
        variant: 'destructive',
      });
    }
  };

  const handleBulkCrawl = async () => {
    const activeCompetitors = competitors.filter(c => c.is_active);
    if (activeCompetitors.length === 0) {
      toast({
        title: 'No competitors',
        description: 'No active competitors to crawl',
        variant: 'destructive',
      });
      return;
    }

    setIsBulkCrawling(true);
    setBulkProgress({ current: 0, total: activeCompetitors.length });

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < activeCompetitors.length; i++) {
      const competitor = activeCompetitors[i];
      setBulkProgress({ current: i + 1, total: activeCompetitors.length });
      
      setCrawlStatuses((prev) => ({
        ...prev,
        [competitor.name]: { competitor: competitor.name, status: 'crawling' },
      }));

      try {
        const response = await firecrawlApi.scrapeCompetitor(competitor.id, 25);

        if (response.success && response.data) {
          setCrawlStatuses((prev) => ({
            ...prev,
            [competitor.name]: {
              competitor: competitor.name,
              status: 'success',
              message: `Found ${response.data.scrapedCount} new products`,
              results: response.data,
            },
          }));
          
          // Save to crawl history
          await saveCrawlHistory(competitor.id, 'success', response.data);
          successCount++;
        } else {
          throw new Error(response.error || 'Failed to crawl');
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to crawl';
        
        // Save error to crawl history
        await saveCrawlHistory(competitor.id, 'error', undefined, errorMessage);
        
        setCrawlStatuses((prev) => ({
          ...prev,
          [competitor.name]: {
            competitor: competitor.name,
            status: 'error',
            message: errorMessage,
          },
        }));
        errorCount++;
      }

      // Wait 3 seconds between crawls to avoid rate limiting
      if (i < activeCompetitors.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }

    setIsBulkCrawling(false);
    fetchCompetitors();

    toast({
      title: 'Bulk Crawl Complete',
      description: `${successCount} succeeded, ${errorCount} failed`,
    });
  };

  const handleApplyGlobalFilters = async () => {
    const categories = globalExcludedCategories.split(',').map(c => c.trim()).filter(Boolean);
    
    // Update all competitors by their IDs
    const competitorIds = competitors.map(c => c.id);
    
    if (competitorIds.length === 0) {
      toast({
        title: 'No competitors',
        description: 'No competitors to update',
        variant: 'destructive',
      });
      return;
    }

    const { error } = await supabase
      .from('competitors')
      .update({ excluded_categories: categories })
      .in('id', competitorIds);

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to update category filters',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Success',
        description: `Applied category filters to all ${competitors.length} competitors`,
      });
      setIsEditingGlobalFilters(false);
      fetchCompetitors();
    }
  };

  const getStatusBadge = (status: CrawlStatus['status']) => {
    switch (status) {
      case 'crawling':
        return <Badge variant="secondary">Crawling...</Badge>;
      case 'success':
        return <Badge className="bg-green-500/10 text-green-500 hover:bg-green-500/20">Complete</Badge>;
      case 'error':
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="outline">Ready</Badge>;
    }
  };

  const CompetitorFormContent = () => (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name">Competitor Name *</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g. Loavies"
            maxLength={100}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="logo_url">Logo URL</Label>
          <Input
            id="logo_url"
            value={formData.logo_url}
            onChange={(e) => setFormData({ ...formData, logo_url: e.target.value })}
            placeholder="https://example.com/logo.png"
            maxLength={500}
          />
        </div>
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="scrape_url">New Arrivals URL *</Label>
        <Input
          id="scrape_url"
          value={formData.scrape_url}
          onChange={(e) => setFormData({ ...formData, scrape_url: e.target.value })}
          placeholder="https://example.com/collections/new"
          maxLength={500}
        />
        <p className="text-xs text-muted-foreground">
          Use the "new arrivals" or "nieuw" section URL for best results
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="product_url_patterns">Product URL Patterns (comma-separated)</Label>
        <Input
          id="product_url_patterns"
          value={formData.product_url_patterns}
          onChange={(e) => setFormData({ ...formData, product_url_patterns: e.target.value })}
          placeholder="/products/, /collections/"
          maxLength={500}
        />
        <p className="text-xs text-muted-foreground">
          URL patterns to identify product pages (e.g., /products/, /collections/)
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="excluded_categories">Excluded Categories (comma-separated)</Label>
        <Textarea
          id="excluded_categories"
          value={formData.excluded_categories}
          onChange={(e) => setFormData({ ...formData, excluded_categories: e.target.value })}
          placeholder="accessories, bags, belts, earrings..."
          rows={3}
          maxLength={2000}
        />
        <p className="text-xs text-muted-foreground">
          Products containing these words in their URL or name will be filtered out
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          placeholder="Any notes about this competitor..."
          rows={2}
          maxLength={1000}
        />
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Crawl Competitors</h2>
          <p className="text-muted-foreground">
            Manage competitors and scrape their new arrivals
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleBulkCrawl}
            disabled={isBulkCrawling || competitors.length === 0}
          >
            {isBulkCrawling ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Crawling {bulkProgress.current}/{bulkProgress.total}
              </>
            ) : (
              <>
                <Zap className="mr-2 h-4 w-4" />
                Crawl All
              </>
            )}
          </Button>
          
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => { resetForm(); setIsAddDialogOpen(true); }}>
                <Plus className="mr-2 h-4 w-4" />
                Add Competitor
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Add New Competitor</DialogTitle>
                <DialogDescription>
                  Add a new competitor to track their new arrivals
                </DialogDescription>
              </DialogHeader>
              <CompetitorFormContent />
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAddCompetitor} disabled={!formData.name || !formData.scrape_url}>
                  Add Competitor
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editingCompetitor} onOpenChange={(open) => !open && setEditingCompetitor(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Competitor</DialogTitle>
            <DialogDescription>
              Update competitor settings and URLs
            </DialogDescription>
          </DialogHeader>
          <CompetitorFormContent />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingCompetitor(null)}>
              Cancel
            </Button>
            <Button onClick={handleEditCompetitor} disabled={!formData.name || !formData.scrape_url}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {competitors.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Globe className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-medium">No competitors added</h3>
            <p className="mt-2 text-muted-foreground">
              Add your first competitor to start tracking their products
            </p>
            <Button className="mt-4" onClick={() => { resetForm(); setIsAddDialogOpen(true); }}>
              <Plus className="mr-2 h-4 w-4" />
              Add Competitor
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {competitors.map((competitor) => {
            const status = crawlStatuses[competitor.name];
            const historyRecord = crawlHistory[competitor.id];
            const isCrawling = status?.status === 'crawling';

            return (
              <Card key={competitor.id} className="relative overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {competitor.logo_url ? (
                        <img 
                          src={competitor.logo_url} 
                          alt={competitor.name}
                          className="h-8 w-8 rounded-md object-contain bg-background"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted">
                          <ImageIcon className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                      <CardTitle className="text-lg">{competitor.name}</CardTitle>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openEditDialog(competitor)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete {competitor.name}?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will remove the competitor from your list. Existing scraped products will not be deleted.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeleteCompetitor(competitor)}>
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                  <CardDescription className="flex items-center gap-1 mt-1">
                    <a
                      href={competitor.scrape_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs hover:underline flex items-center gap-1 truncate max-w-[200px]"
                    >
                      {competitor.scrape_url.replace('https://', '').replace('www.', '')}
                      <ExternalLink className="h-3 w-3 shrink-0" />
                    </a>
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-4">
                  {competitor.notes && (
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {competitor.notes}
                    </p>
                  )}

                  <div className="flex items-center gap-2">
                    {getStatusBadge(status?.status || (historyRecord ? 'success' : 'idle'))}
                    {competitor.last_crawled_at && (
                      <span className="text-xs text-muted-foreground">
                        Last: {new Date(competitor.last_crawled_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>

                  {isCrawling && (
                    <div className="space-y-2">
                      <Progress value={undefined} className="h-2" />
                      <p className="text-xs text-muted-foreground">
                        Mapping site and scraping products...
                      </p>
                    </div>
                  )}

                  {/* Show current crawl results OR persistent history */}
                  {(status?.results || historyRecord) && !isCrawling && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <BarChart3 className="h-3 w-3" />
                        <span>Last crawl stats</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-sm">
                        <div className="rounded-md bg-muted/50 p-2">
                          <p className="text-muted-foreground text-xs">Found</p>
                          <p className="font-semibold">
                            {status?.results?.productUrlsFound ?? historyRecord?.product_urls_found ?? 0}
                          </p>
                        </div>
                        <div className="rounded-md bg-green-500/10 p-2">
                          <p className="text-green-600 text-xs">Added</p>
                          <p className="font-semibold text-green-600">
                            +{status?.results?.scrapedCount ?? historyRecord?.new_products_scraped ?? 0}
                          </p>
                        </div>
                        <div className="rounded-md bg-orange-500/10 p-2">
                          <p className="text-orange-600 text-xs">Filtered</p>
                          <p className="font-semibold text-orange-600">
                            {status?.results?.skippedCount ?? historyRecord?.skipped_count ?? 0}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {(status?.status === 'error' || historyRecord?.status === 'error') && (
                    <p className="text-xs text-destructive">
                      {status?.message || historyRecord?.error_message}
                    </p>
                  )}

                  <Button
                    onClick={() => handleCrawl(competitor)}
                    disabled={isCrawling || isBulkCrawling}
                    className="w-full"
                    variant={status?.status === 'success' ? 'outline' : 'default'}
                  >
                    {isCrawling ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Crawling...
                      </>
                    ) : status?.status === 'success' ? (
                      <>
                        <Play className="mr-2 h-4 w-4" />
                        Crawl Again
                      </>
                    ) : (
                      <>
                        <Play className="mr-2 h-4 w-4" />
                        Start Crawl
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Settings2 className="h-5 w-5 text-muted-foreground" />
              <CardTitle>Global Category Filters</CardTitle>
            </div>
            {!isEditingGlobalFilters && (
              <Button variant="outline" size="sm" onClick={() => setIsEditingGlobalFilters(true)}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Products containing these keywords in their URL or name will be automatically filtered out during scraping.
          </p>
          
          {isEditingGlobalFilters ? (
            <div className="space-y-4">
              <Textarea
                value={globalExcludedCategories}
                onChange={(e) => setGlobalExcludedCategories(e.target.value)}
                placeholder="accessories, bags, belts, earrings..."
                rows={4}
                className="font-mono text-sm"
              />
              <div className="flex items-center gap-2">
                <Button onClick={handleApplyGlobalFilters}>
                  <Save className="mr-2 h-4 w-4" />
                  Apply to All Competitors
                </Button>
                <Button variant="outline" onClick={() => setIsEditingGlobalFilters(false)}>
                  Cancel
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                This will update the excluded categories for all {competitors.length} competitors.
              </p>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {DEFAULT_EXCLUDED_CATEGORIES.map((cat) => (
                <Badge key={cat} variant="secondary">{cat}</Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
