import { useState, useEffect } from 'react';
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
import { Globe, Loader2, Play, CheckCircle2, XCircle, ExternalLink, Plus, Pencil, Trash2, Image as ImageIcon, Settings2 } from 'lucide-react';

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
    errorsCount: number;
  };
}

const DEFAULT_EXCLUDED_CATEGORIES = [
  'accessories', 'bags', 'belts', 'earrings', 'jewelry', 'jewellery', 
  'sieraden', 'tassen', 'riemen', 'oorbellen', 'necklaces', 'bracelets', 
  'rings', 'watches', 'sunglasses', 'hats', 'scarves', 'shoes', 'boots', 
  'sneakers', 'sandals', 'heels'
];

export const CrawlManagement = () => {
  const { toast } = useToast();
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [crawlStatuses, setCrawlStatuses] = useState<Record<string, CrawlStatus>>({});
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingCompetitor, setEditingCompetitor] = useState<Competitor | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    scrape_url: '',
    logo_url: '',
    notes: '',
    product_url_patterns: '',
    excluded_categories: DEFAULT_EXCLUDED_CATEGORIES.join(', '),
  });

  useEffect(() => {
    fetchCompetitors();
  }, []);

  const fetchCompetitors = async () => {
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
    }
    setLoading(false);
  };

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
    const { error } = await supabase.from('competitors').insert({
      name: formData.name,
      scrape_url: formData.scrape_url,
      logo_url: formData.logo_url || null,
      notes: formData.notes || null,
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

    const { error } = await supabase
      .from('competitors')
      .update({
        name: formData.name,
        scrape_url: formData.scrape_url,
        logo_url: formData.logo_url || null,
        notes: formData.notes || null,
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
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="logo_url">Logo URL</Label>
          <Input
            id="logo_url"
            value={formData.logo_url}
            onChange={(e) => setFormData({ ...formData, logo_url: e.target.value })}
            placeholder="https://example.com/logo.png"
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
                    {getStatusBadge(status?.status || 'idle')}
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

                  {status?.results && (
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="rounded-md bg-muted/50 p-2">
                        <p className="text-muted-foreground text-xs">URLs Found</p>
                        <p className="font-semibold">{status.results.totalUrlsFound}</p>
                      </div>
                      <div className="rounded-md bg-muted/50 p-2">
                        <p className="text-muted-foreground text-xs">Products</p>
                        <p className="font-semibold">{status.results.productUrlsFound}</p>
                      </div>
                      <div className="rounded-md bg-muted/50 p-2">
                        <p className="text-muted-foreground text-xs">New</p>
                        <p className="font-semibold">{status.results.newProductUrls}</p>
                      </div>
                      <div className="rounded-md bg-muted/50 p-2">
                        <p className="text-muted-foreground text-xs">Scraped</p>
                        <p className="font-semibold text-green-500">
                          {status.results.scrapedCount}
                        </p>
                      </div>
                    </div>
                  )}

                  {status?.status === 'error' && (
                    <p className="text-xs text-destructive">{status.message}</p>
                  )}

                  <Button
                    onClick={() => handleCrawl(competitor)}
                    disabled={isCrawling}
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
          <div className="flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Category Filters</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            Each competitor can have its own excluded categories. Products containing these words in their URL or name will be automatically filtered out during scraping.
          </p>
          <div className="flex flex-wrap gap-2">
            {DEFAULT_EXCLUDED_CATEGORIES.slice(0, 10).map((cat) => (
              <Badge key={cat} variant="secondary">{cat}</Badge>
            ))}
            <Badge variant="outline">+{DEFAULT_EXCLUDED_CATEGORIES.length - 10} more</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
