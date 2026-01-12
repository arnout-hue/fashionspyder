// Scheduled crawl - runs all active competitors with delays between each
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CompetitorConfig {
  id: string;
  name: string;
  scrape_url: string;
  logo_url: string | null;
  product_url_patterns: string[];
  excluded_categories: string[];
}

function isProductUrl(url: string, baseUrl: string, patterns: string[] | null): boolean {
  try {
    const urlObj = new URL(url);
    const path = urlObj.pathname.toLowerCase();
    
    if (path === '/' || path === '/nl/' || path === '/nl' || path.length < 5) {
      return false;
    }
    
    if (patterns && patterns.length > 0) {
      return patterns.some((pattern) => path.includes(pattern.toLowerCase()));
    }
    
    const nonProductSegments = [
      'collections', 'collection', 'category', 'categories',
      'nieuw', 'new', 'new-arrivals', 'newarrivals',
      'shop', 'kleding', 'clothing', 'dames', 'heren',
      'cart', 'checkout', 'account', 'login', 'wishlist',
      'search', 'filter', 'sort', 'page',
      'sale', 'party', 'back-in-stock', 'bestsellers',
      'accessoires', 'accessories', 'schoenen', 'shoes', 'tassen', 'bags',
      'giftcard', 'gift-card', 'campagnes', 'campaigns',
      'trends', 'lookbook', 'brand', 'brands',
      'info', 'customer', 'returns', 'shipping',
      'privacy', 'terms', 'faq', 'contact', 'about',
      'blog', 'news', 'magazine', 'inspiratie'
    ];
    
    const pathSegments = path.split('/').filter(Boolean);
    const lastSegment = pathSegments[pathSegments.length - 1] || '';
    
    for (const segment of pathSegments) {
      if (nonProductSegments.includes(segment)) {
        return false;
      }
    }
    
    if (/^\d{5,}-/.test(lastSegment)) {
      return true;
    }
    
    if (pathSegments.includes('products') || pathSegments.includes('product') || pathSegments.includes('p')) {
      return true;
    }
    
    if (lastSegment.endsWith('.html') && lastSegment.length > 10) {
      return true;
    }
    
    if (pathSegments.includes('item') || pathSegments.includes('artikel')) {
      return true;
    }
    
    return false;
  } catch {
    return false;
  }
}

function shouldExcludeProduct(url: string, name: string, excludedCategories: string[]): boolean {
  if (!excludedCategories || excludedCategories.length === 0) return false;
  const searchText = `${url} ${name}`.toLowerCase();
  return excludedCategories.some((cat) => searchText.includes(cat.toLowerCase()));
}

async function scrapeProductPage(url: string, apiKey: string): Promise<any> {
  console.log('Scraping product page:', url);
  
  try {
    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        formats: ['markdown'],
        onlyMainContent: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Scrape API error:', response.status, errorText);
      return null;
    }

    const data = await response.json();
    const markdown = data.data?.markdown || data.markdown || '';
    const metadata = data.data?.metadata || data.metadata || {};

    const name = metadata.title || extractFromMarkdown(markdown, /^#\s+(.+)/m) || 'Unknown Product';
    const price = extractPrice(markdown) || null;
    const image = metadata.ogImage || extractImage(markdown) || null;

    return {
      name: cleanProductName(name),
      price,
      image_url: image,
      sku: null,
    };
  } catch (error) {
    console.error('Error in scrapeProductPage:', error);
    return null;
  }
}

function extractFromMarkdown(markdown: string, pattern: RegExp): string | null {
  const match = markdown.match(pattern);
  return match ? match[1].trim() : null;
}

function extractPrice(markdown: string): string | null {
  const pricePatterns = [
    /[€$£]\s*\d+[.,]\d{2}/,
    /\d+[.,]\d{2}\s*[€$£]/,
    /\d+[.,]\d{2}\s*(EUR|USD|GBP)/i,
  ];
  
  for (const pattern of pricePatterns) {
    const match = markdown.match(pattern);
    if (match) return match[0].trim();
  }
  return null;
}

function extractImage(markdown: string): string | null {
  const imgMatch = markdown.match(/!\[.*?\]\((https?:\/\/[^\s)]+)/);
  return imgMatch ? imgMatch[1] : null;
}

function cleanProductName(name: string): string {
  return name.replace(/\s*[|\-–—]\s*[^|\-–—]+$/, '').trim();
}

async function crawlCompetitor(
  competitor: CompetitorConfig,
  apiKey: string,
  supabase: any,
  limit: number = 25
): Promise<{ success: boolean; scrapedCount: number; error?: string }> {
  console.log(`Starting crawl for ${competitor.name} at ${competitor.scrape_url}`);

  try {
    // Scrape listing page for product links
    const scrapeResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: competitor.scrape_url,
        formats: ['links'],
        onlyMainContent: false,
      }),
    });

    if (!scrapeResponse.ok) {
      const errorData = await scrapeResponse.json();
      console.error('Scrape failed:', errorData);
      return { success: false, scrapedCount: 0, error: 'Failed to scrape listing page' };
    }

    const scrapeData = await scrapeResponse.json();
    const allUrls: string[] = scrapeData.data?.links || scrapeData.links || [];
    console.log(`Found ${allUrls.length} total URLs on listing page`);

    // Filter to product URLs only
    const productUrls = allUrls.filter((url) =>
      isProductUrl(url, competitor.scrape_url, competitor.product_url_patterns)
    );
    console.log(`Found ${productUrls.length} product URLs`);

    // Get existing product URLs to avoid duplicates
    const { data: existingProducts } = await supabase
      .from('products')
      .select('product_url')
      .eq('competitor', competitor.name);

    const existingUrls = new Set(existingProducts?.map((p: any) => p.product_url) || []);
    const newProductUrls = productUrls.filter((url) => !existingUrls.has(url));
    console.log(`${newProductUrls.length} new product URLs to scrape`);

    // Scrape new products (limited)
    const urlsToScrape = newProductUrls.slice(0, limit);
    const scrapedProducts: any[] = [];

    for (const url of urlsToScrape) {
      try {
        const productData = await scrapeProductPage(url, apiKey);
        
        if (productData && productData.name) {
          if (shouldExcludeProduct(url, productData.name, competitor.excluded_categories)) {
            console.log(`Excluded product (category filter): ${productData.name}`);
            continue;
          }

          scrapedProducts.push({
            name: productData.name,
            price: productData.price || null,
            sku: productData.sku || null,
            image_url: productData.image_url || null,
            product_url: url,
            competitor: competitor.name,
            status: 'pending',
          });
        }
        
        // Small delay to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`Error scraping ${url}:`, error);
      }
    }

    console.log(`Scraped ${scrapedProducts.length} products for ${competitor.name}`);

    // Insert new products
    if (scrapedProducts.length > 0) {
      const { error: insertError } = await supabase
        .from('products')
        .upsert(scrapedProducts, { 
          onConflict: 'product_url',
          ignoreDuplicates: true 
        });

      if (insertError) {
        console.error('Insert error:', insertError);
        return { success: false, scrapedCount: 0, error: 'Failed to save products' };
      }
    }

    // Update last_crawled_at
    await supabase
      .from('competitors')
      .update({ last_crawled_at: new Date().toISOString() })
      .eq('id', competitor.id);

    return { success: true, scrapedCount: scrapedProducts.length };
  } catch (error) {
    console.error(`Error crawling ${competitor.name}:`, error);
    return { success: false, scrapedCount: 0, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('=== Scheduled Crawl Started ===');
  console.log('Time:', new Date().toISOString());

  try {
    // Verify this is a scheduled call (check for cron secret or service role)
    const authHeader = req.headers.get('Authorization');
    const cronSecret = Deno.env.get('CRON_SECRET');
    
    // Allow calls with service role key or matching cron secret
    const isServiceRole = authHeader?.includes(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '');
    const isValidCron = cronSecret && authHeader === `Bearer ${cronSecret}`;
    const isAnonWithSecret = authHeader?.includes(Deno.env.get('SUPABASE_ANON_KEY') || '');
    
    // For scheduled jobs from pg_cron, we accept the anon key
    if (!isServiceRole && !isValidCron && !isAnonWithSecret) {
      console.log('Unauthorized scheduled crawl attempt');
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Firecrawl connector not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch all active competitors
    const { data: competitors, error: fetchError } = await supabase
      .from('competitors')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (fetchError || !competitors) {
      console.error('Failed to fetch competitors:', fetchError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to fetch competitors' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${competitors.length} active competitors to crawl`);

    const results: { competitor: string; success: boolean; scrapedCount: number; error?: string }[] = [];
    const DELAY_BETWEEN_COMPETITORS_MS = 5 * 60 * 1000; // 5 minutes between each competitor

    for (let i = 0; i < competitors.length; i++) {
      const competitor = competitors[i];
      console.log(`\n[${i + 1}/${competitors.length}] Crawling ${competitor.name}...`);
      
      const result = await crawlCompetitor(competitor, apiKey, supabase, 25);
      results.push({
        competitor: competitor.name,
        success: result.success,
        scrapedCount: result.scrapedCount,
        error: result.error,
      });

      // Wait between competitors (except for the last one)
      if (i < competitors.length - 1) {
        console.log(`Waiting 5 minutes before next competitor...`);
        await new Promise((resolve) => setTimeout(resolve, DELAY_BETWEEN_COMPETITORS_MS));
      }
    }

    const totalScraped = results.reduce((sum, r) => sum + r.scrapedCount, 0);
    const successCount = results.filter(r => r.success).length;

    console.log('\n=== Scheduled Crawl Complete ===');
    console.log(`Total: ${successCount}/${competitors.length} competitors successful`);
    console.log(`Products scraped: ${totalScraped}`);

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          competitorsProcessed: competitors.length,
          successCount,
          totalScraped,
          results,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in scheduled-crawl:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to run scheduled crawl';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
