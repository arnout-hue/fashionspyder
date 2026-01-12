import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { firecrawlApi, COMPETITORS } from '@/lib/api/firecrawl';
import { Globe, Loader2, Play, CheckCircle2, XCircle, ExternalLink } from 'lucide-react';

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

export const CrawlManagement = () => {
  const { toast } = useToast();
  const [crawlStatuses, setCrawlStatuses] = useState<Record<string, CrawlStatus>>({});

  const handleCrawl = async (competitorName: string) => {
    setCrawlStatuses((prev) => ({
      ...prev,
      [competitorName]: { competitor: competitorName, status: 'crawling' },
    }));

    try {
      const response = await firecrawlApi.scrapeCompetitor(competitorName, 25);

      if (response.success && response.data) {
        setCrawlStatuses((prev) => ({
          ...prev,
          [competitorName]: {
            competitor: competitorName,
            status: 'success',
            message: `Found ${response.data.scrapedCount} new products`,
            results: response.data,
          },
        }));

        toast({
          title: 'Crawl Complete',
          description: `Successfully scraped ${response.data.scrapedCount} new products from ${competitorName}`,
        });
      } else {
        throw new Error(response.error || 'Failed to crawl');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to crawl';
      
      setCrawlStatuses((prev) => ({
        ...prev,
        [competitorName]: {
          competitor: competitorName,
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

  const getStatusIcon = (status: CrawlStatus['status']) => {
    switch (status) {
      case 'crawling':
        return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
      case 'success':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-destructive" />;
      default:
        return null;
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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Crawl Competitors</h2>
        <p className="text-muted-foreground">
          Automatically discover and scrape products from competitor websites
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {COMPETITORS.map((competitor) => {
          const status = crawlStatuses[competitor.name];
          const isCrawling = status?.status === 'crawling';

          return (
            <Card key={competitor.name} className="relative overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Globe className="h-5 w-5 text-muted-foreground" />
                    <CardTitle className="text-lg">{competitor.name}</CardTitle>
                  </div>
                  {getStatusBadge(status?.status || 'idle')}
                </div>
                <CardDescription className="flex items-center gap-1">
                  <a
                    href={competitor.baseUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs hover:underline flex items-center gap-1"
                  >
                    {competitor.baseUrl.replace('https://', '')}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
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
                  onClick={() => handleCrawl(competitor.name)}
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

      <Card>
        <CardHeader>
          <CardTitle>How It Works</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <div className="flex items-start gap-3">
            <Badge variant="outline" className="shrink-0">1</Badge>
            <p><strong>Map:</strong> Discovers all URLs on the competitor website</p>
          </div>
          <div className="flex items-start gap-3">
            <Badge variant="outline" className="shrink-0">2</Badge>
            <p><strong>Filter:</strong> Identifies product pages using URL patterns</p>
          </div>
          <div className="flex items-start gap-3">
            <Badge variant="outline" className="shrink-0">3</Badge>
            <p><strong>Dedupe:</strong> Skips products already in your database</p>
          </div>
          <div className="flex items-start gap-3">
            <Badge variant="outline" className="shrink-0">4</Badge>
            <p><strong>Scrape:</strong> Extracts name, price, SKU, and image from each product</p>
          </div>
          <div className="flex items-start gap-3">
            <Badge variant="outline" className="shrink-0">5</Badge>
            <p><strong>Save:</strong> New products appear in Discover with "pending" status</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
