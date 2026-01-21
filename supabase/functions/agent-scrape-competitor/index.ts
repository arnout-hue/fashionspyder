// Agent-based competitor product scraper using Firecrawl with async "Fire and Forget" pattern
// Returns immediately with jobId, processes in background using EdgeRuntime.waitUntil()
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CompetitorConfig {
  id: string;
  name: string;
  scrape_url: string;
  excluded_categories: string[];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const firecrawlApiKey = Deno.env.get('FIRECRAWL_API_KEY');

  if (!firecrawlApiKey) {
    console.error('FIRECRAWL_API_KEY not configured');
    return new Response(
      JSON.stringify({ success: false, error: 'Firecrawl not configured' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { competitor: competitorIdOrName, limit = 50 } = await req.json();
    console.log(`[Agent] Received request for: ${competitorIdOrName}, limit: ${limit}`);

    // Find competitor
    let competitor: CompetitorConfig | null = null;
    
    const { data: byId } = await supabase
      .from('competitors')
      .select('id, name, scrape_url, excluded_categories')
      .eq('id', competitorIdOrName)
      .single();
    
    if (byId) {
      competitor = byId;
    } else {
      const { data: byName } = await supabase
        .from('competitors')
        .select('id, name, scrape_url, excluded_categories')
        .ilike('name', competitorIdOrName)
        .single();
      competitor = byName;
    }

    if (!competitor) {
      console.error(`[Agent] Competitor not found: ${competitorIdOrName}`);
      return new Response(
        JSON.stringify({ success: false, error: `Competitor not found: ${competitorIdOrName}` }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Agent] Found competitor: ${competitor.name} (${competitor.id})`);

    // Create a pending job record
    const { data: job, error: jobError } = await supabase
      .from('crawl_jobs')
      .insert({
        competitor_id: competitor.id,
        firecrawl_job_id: `async-${Date.now()}`,
        status: 'pending',
        products_found: 0,
        products_inserted: 0,
      })
      .select()
      .single();

    if (jobError || !job) {
      console.error('[Agent] Failed to create job:', jobError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to create crawl job' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Agent] Created job ${job.id}, returning 202 immediately`);

    // Return immediately with job ID
    const response = new Response(
      JSON.stringify({
        success: true,
        jobId: job.id,
        competitorName: competitor.name,
        message: 'Crawl job started. Poll for status using the job ID.',
      }),
      { status: 202, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

    // Process the crawl in the background
    // @ts-ignore - EdgeRuntime.waitUntil is available in Supabase Edge Functions
    EdgeRuntime.waitUntil(processCrawlJob(job.id, competitor, limit, firecrawlApiKey, supabase));

    return response;

  } catch (error) {
    console.error('[Agent] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Background processing function
async function processCrawlJob(
  jobId: string,
  competitor: CompetitorConfig,
  limit: number,
  firecrawlApiKey: string,
  supabase: any
) {
  console.log(`[Agent] Background: Starting job ${jobId} for ${competitor.name}`);

  try {
    // Update status to processing
    await supabase
      .from('crawl_jobs')
      .update({ status: 'processing', updated_at: new Date().toISOString() })
      .eq('id', jobId);

    console.log(`[Agent] Background: Scrape URL: ${competitor.scrape_url}`);

    // Build the prompt for the agent
    const excludedCategoriesText = competitor.excluded_categories?.length > 0
      ? `IMPORTANT: Exclude any products that contain these words in their name or URL: ${competitor.excluded_categories.join(', ')}`
      : '';

    const agentPrompt = `You are scraping an e-commerce website to find new/recent products.

Starting from the page: ${competitor.scrape_url}

Your task:
1. Find all product listings on this page
2. For each product found, extract:
   - Product name (without the brand name suffix)
   - Price with currency symbol (e.g., €49.95)
   - Main product image URL - IMPORTANT: This must be the actual image file URL (ending in .jpg, .png, .webp etc), NOT the product page URL
   - Product page URL

CRITICAL for image_url:
- Look for <img> tags within product cards
- The image URL typically contains '/cdn/', '/images/', '/media/', or '/assets/'
- It should NOT be the same as the product_url
- If you cannot find a proper image URL, leave it empty rather than using the product page URL

${excludedCategoriesText}

Focus on clothing items and ignore accessories, bags, jewelry, shoes unless clearly main products.

Return up to ${limit} products, prioritizing the newest items.`;

    // Define the JSON schema for product extraction
    const productSchema = {
      type: 'object',
      properties: {
        products: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Product name without brand suffix' },
              price: { type: 'string', description: 'Price with currency symbol (e.g., €49.95)' },
              image_url: { type: 'string', description: 'Main product image URL' },
              product_url: { type: 'string', description: 'Full URL to the product page' },
            },
            required: ['name', 'product_url'],
          },
        },
      },
      required: ['products'],
    };

    console.log('[Agent] Background: Starting Firecrawl deep scrape job...');

    // Retry logic with exponential backoff for timeouts
    const maxRetries = 3;
    let scrapeData: any = null;
    let lastError: string | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      console.log(`[Agent] Background: Firecrawl attempt ${attempt}/${maxRetries}...`);
      
      const waitTime = 5000 + (attempt - 1) * 3000;
      
      const deepScrapeResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${firecrawlApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: competitor.scrape_url,
          formats: ['extract', 'links'],
          extract: {
            prompt: agentPrompt,
            schema: productSchema,
          },
          onlyMainContent: false,
          waitFor: waitTime,
          timeout: 60000 + (attempt - 1) * 30000,
        }),
      });

      if (deepScrapeResponse.ok) {
        scrapeData = await deepScrapeResponse.json();
        console.log('[Agent] Background: Firecrawl response received');
        break;
      }

      const errorText = await deepScrapeResponse.text();
      lastError = `${deepScrapeResponse.status}: ${errorText.slice(0, 200)}`;
      console.warn(`[Agent] Background: Attempt ${attempt} failed: ${lastError}`);

      if (deepScrapeResponse.status !== 408 && deepScrapeResponse.status < 500) {
        console.error('[Agent] Background: Non-retryable error, stopping');
        break;
      }

      if (attempt < maxRetries) {
        const backoffMs = Math.pow(2, attempt) * 1000;
        console.log(`[Agent] Background: Waiting ${backoffMs}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, backoffMs));
      }
    }

    if (!scrapeData) {
      console.error('[Agent] Background: All retries failed:', lastError);
      await supabase
        .from('crawl_jobs')
        .update({
          status: 'failed',
          error_message: `Firecrawl timed out after ${maxRetries} attempts. ${lastError}`,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', jobId);
      return;
    }

    console.log('[Agent] Background: Response keys:', Object.keys(scrapeData));

    // Extract products from the response
    const extractedData = scrapeData.data?.extract || scrapeData.extract;
    const products = extractedData?.products || [];
    const links = scrapeData.data?.links || scrapeData.links || [];

    console.log(`[Agent] Background: Extracted ${products.length} products directly`);
    console.log(`[Agent] Background: Found ${links.length} links on page`);

    const MIN_PRODUCTS_FOR_SUCCESS = 3;
    const isDirectExtractionSuccessful = products.length >= MIN_PRODUCTS_FOR_SUCCESS;

    let insertedCount = 0;
    let method = 'agent-extract';

    if (isDirectExtractionSuccessful) {
      console.log(`[Agent] Background: Direct extraction successful with ${products.length} products`);
      
      const productsToInsert = products
        .filter((p: any) => p.name && p.product_url)
        .map((p: any) => ({
          name: cleanProductName(p.name),
          price: p.price || null,
          image_url: cleanImageUrl(p.image_url, competitor.scrape_url),
          product_url: normalizeProductUrl(p.product_url),
          competitor: competitor.name,
        }));

      console.log(`[Agent] Background: Prepared ${productsToInsert.length} products for insertion`);

      const productUrls = productsToInsert.map((p: any) => p.product_url);
      const { data: existingProducts } = await supabase
        .from('products')
        .select('product_url')
        .eq('competitor', competitor.name);

      const existingUrls = new Set(
        existingProducts?.map((p: any) => normalizeProductUrl(p.product_url)) || []
      );
      const newProducts = productsToInsert.filter((p: any) => 
        !existingUrls.has(normalizeProductUrl(p.product_url))
      );

      console.log(`[Agent] Background: ${existingUrls.size} already exist, ${newProducts.length} are new`);

      if (newProducts.length > 0) {
        const { error: insertError, data: insertedData } = await supabase
          .from('products')
          .insert(newProducts)
          .select('id');

        if (insertError) {
          console.error('[Agent] Background: Insert error:', insertError);
        } else {
          insertedCount = insertedData?.length || 0;
          console.log(`[Agent] Background: Successfully inserted ${insertedCount} products`);
        }
      }

      // Update job as completed
      await supabase
        .from('crawl_jobs')
        .update({
          status: 'completed',
          products_found: products.length,
          products_inserted: insertedCount,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', jobId);

    } else {
      // Fallback: crawl individual product pages
      console.log(`[Agent] Background: Direct extraction yielded only ${products.length} items. Triggering fallback...`);
      method = 'agent-crawl';

      const productLinks = links.filter((url: string) => isLikelyProductUrl(url, competitor.scrape_url));
      console.log(`[Agent] Background: Found ${productLinks.length} potential product URLs from links`);

      const { data: existingProducts } = await supabase
        .from('products')
        .select('product_url')
        .eq('competitor', competitor.name);

      const existingUrls = new Set(
        existingProducts?.map((p: any) => normalizeProductUrl(p.product_url)) || []
      );
      const newProductLinks = productLinks.filter((url: string) => 
        !existingUrls.has(normalizeProductUrl(url))
      );
      
      console.log(`[Agent] Background: ${newProductLinks.length} are new product URLs`);

      const urlsToScrape = newProductLinks.slice(0, Math.min(limit, 25));
      console.log(`[Agent] Background: Will scrape ${urlsToScrape.length} products`);

      const scrapedProducts: any[] = [];
      const errors: string[] = [];

      for (const url of urlsToScrape) {
        try {
          const productData = await extractProductFromUrl(url, firecrawlApiKey);
          if (productData) {
            const shouldExclude = competitor.excluded_categories?.some((cat: string) => 
              url.toLowerCase().includes(cat.toLowerCase()) ||
              productData.name?.toLowerCase().includes(cat.toLowerCase())
            );

            if (!shouldExclude) {
              scrapedProducts.push({
                name: cleanProductName(productData.name),
                price: productData.price || null,
                image_url: cleanImageUrl(productData.image_url, competitor.scrape_url),
                product_url: url,
                competitor: competitor.name,
              });
            }
          }
        } catch (err) {
          console.error(`[Agent] Background: Error scraping ${url}:`, err);
          errors.push(url);
        }

        await new Promise(resolve => setTimeout(resolve, 500));
      }

      console.log(`[Agent] Background: Scraped ${scrapedProducts.length} products, ${errors.length} errors`);

      if (scrapedProducts.length > 0) {
        const { error: insertError, data: insertedData } = await supabase
          .from('products')
          .insert(scrapedProducts)
          .select('id');

        if (insertError) {
          console.error('[Agent] Background: Insert error:', insertError);
        } else {
          insertedCount = insertedData?.length || 0;
        }
      }

      // Update job as completed
      await supabase
        .from('crawl_jobs')
        .update({
          status: 'completed',
          products_found: urlsToScrape.length,
          products_inserted: insertedCount,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', jobId);
    }

    // Update last_crawled_at on competitor
    await supabase
      .from('competitors')
      .update({ last_crawled_at: new Date().toISOString() })
      .eq('id', competitor.id);

    console.log(`[Agent] Background: Job ${jobId} completed. Inserted ${insertedCount} products via ${method}`);

  } catch (error) {
    console.error('[Agent] Background: Fatal error:', error);
    await supabase
      .from('crawl_jobs')
      .update({
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Unknown error',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId);
  }
}

// Helper: Normalize product URL for deduplication (strip query params)
function normalizeProductUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.origin + urlObj.pathname;
  } catch {
    return url;
  }
}

// Helper: Check if URL is likely a product page
function isLikelyProductUrl(url: string, baseUrl: string): boolean {
  try {
    const urlObj = new URL(url, baseUrl);
    const path = urlObj.pathname.toLowerCase();

    const strongIndicators = [
      '/products/',
      '/product/',
      '/item/',
      '/p/',
      '/dp/',
      '/artikel/',
      '/winkel/',
    ];

    for (const indicator of strongIndicators) {
      if (path.includes(indicator)) {
        return true;
      }
    }

    if (/\/\d{5,}[.-]/.test(path) || /\/\d{5,}\.html/.test(path)) {
      return true;
    }

    const excludePatterns = [
      '/cart', '/checkout', '/account', '/login', '/wishlist', '/register',
      '/search', '/filter', '/sort', '/page/', '/pagina/',
      '/info/', '/customer/', '/returns/', '/shipping/', '/privacy', '/terms',
      '/faq', '/contact', '/about', '/blog/', '/news/', '/brands/', '/stores/',
    ];

    for (const pattern of excludePatterns) {
      if (path.includes(pattern)) {
        return false;
      }
    }

    if (path === '/' || path.length < 10) {
      return false;
    }

    const segments = path.split('/').filter(Boolean);
    const lastSegment = segments[segments.length - 1] || '';

    if (segments.length >= 2 && lastSegment.length > 15 && lastSegment.includes('-')) {
      return true;
    }

    if (lastSegment.endsWith('.html') && segments.length >= 3) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

// Helper: Extract product from a single URL
async function extractProductFromUrl(url: string, apiKey: string): Promise<{ name: string; price?: string; image_url?: string } | null> {
  try {
    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        formats: ['extract'],
        extract: {
          prompt: 'Extract the product name (without brand suffix), price with currency, and main product image URL.',
          schema: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              price: { type: 'string' },
              image_url: { type: 'string' },
            },
            required: ['name'],
          },
        },
        onlyMainContent: true,
        waitFor: 2000,
      }),
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const extracted = data.data?.extract || data.extract;
    
    if (!extracted?.name) {
      return null;
    }

    return extracted;
  } catch {
    return null;
  }
}

// Helper: Clean product name
function cleanProductName(name: string): string {
  if (!name) return 'Unknown Product';
  return name
    .replace(/\s*[|\-–—]\s*[^|\-–—]+$/, '')
    .replace(/^\s+|\s+$/g, '')
    .replace(/\s+/g, ' ');
}

// Helper: Clean image URL
function cleanImageUrl(imageUrl: string | null | undefined, baseUrl: string): string | null {
  if (!imageUrl || typeof imageUrl !== 'string') return null;

  let cleaned = imageUrl.trim();

  if (cleaned.endsWith('.html') || 
      cleaned.includes('/shop/') || 
      cleaned.includes('/products/') ||
      cleaned.includes('/product/') ||
      cleaned.includes('/collections/')) {
    console.log(`[Agent] Rejected non-image URL: ${cleaned.slice(0, 80)}...`);
    return null;
  }

  const doubleHttpMatch = cleaned.match(/https?:\/\/[^/]+?(https?:\/\/.+)/i);
  if (doubleHttpMatch) {
    cleaned = doubleHttpMatch[1];
  }

  if (cleaned.startsWith('//')) {
    cleaned = 'https:' + cleaned;
  }

  if (cleaned.startsWith('/') && !cleaned.startsWith('//')) {
    try {
      const base = new URL(baseUrl);
      cleaned = base.origin + cleaned;
    } catch {
      return null;
    }
  }

  try {
    const urlObj = new URL(cleaned);
    if (!urlObj.protocol.startsWith('http')) return null;
    
    const path = urlObj.pathname.toLowerCase();
    const hasImageExtension = /\.(jpg|jpeg|png|gif|webp|avif|svg)(\?|$)/i.test(cleaned);
    const hasImageIndicator = path.includes('/image') || path.includes('/img') || 
                              path.includes('/photo') || path.includes('/cdn') ||
                              path.includes('media') || path.includes('assets') ||
                              path.includes('static');
    
    if (!hasImageExtension && !hasImageIndicator) {
      console.log(`[Agent] URL doesn't look like an image: ${cleaned.slice(0, 80)}...`);
      return null;
    }
    
    return cleaned;
  } catch {
    return null;
  }
}
