// Agent-based competitor product scraper using Firecrawl's deep scrape with async job pattern
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

  try {
    const { competitor: competitorIdOrName, limit = 50 } = await req.json();
    console.log(`[Agent] Starting agent scrape for: ${competitorIdOrName}, limit: ${limit}`);

    const supabase = createClient(supabaseUrl, supabaseKey);

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
    console.log(`[Agent] Scrape URL: ${competitor.scrape_url}`);

    // Build the prompt for the agent
    const excludedCategoriesText = competitor.excluded_categories?.length > 0
      ? `IMPORTANT: Exclude any products that contain these words in their name or URL: ${competitor.excluded_categories.join(', ')}`
      : '';

    const agentPrompt = `You are scraping an e-commerce website to find new/recent products.
    
Starting from the page: ${competitor.scrape_url}

Your task:
1. Find all product listings on this page (this is usually a "new arrivals" or "nieuw" section)
2. For each product found, extract:
   - Product name (without the brand name suffix)
   - Price with currency symbol (e.g., €49.95)
   - Main product image URL (the primary product photo, not thumbnails or icons)
   - Product page URL

${excludedCategoriesText}

Focus on clothing items (dresses, tops, pants, skirts, jackets, etc.) and ignore accessories, bags, jewelry, shoes unless they are clearly main products.

Return up to ${limit} products, prioritizing the newest/most recently added items.`;

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

    console.log('[Agent] Starting Firecrawl deep scrape job...');

    // Retry logic with exponential backoff for timeouts
    const maxRetries = 3;
    let scrapeData: any = null;
    let lastError: string | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      console.log(`[Agent] Firecrawl attempt ${attempt}/${maxRetries}...`);
      
      // Increase wait time on retries to give JS more time to render
      const waitTime = 5000 + (attempt - 1) * 3000; // 5s, 8s, 11s
      
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
          timeout: 60000 + (attempt - 1) * 30000, // 60s, 90s, 120s timeout
        }),
      });

      if (deepScrapeResponse.ok) {
        scrapeData = await deepScrapeResponse.json();
        console.log('[Agent] Firecrawl response received');
        break; // Success, exit retry loop
      }

      const errorText = await deepScrapeResponse.text();
      lastError = `${deepScrapeResponse.status}: ${errorText.slice(0, 200)}`;
      console.warn(`[Agent] Attempt ${attempt} failed: ${lastError}`);

      // Only retry on timeout (408) or server errors (5xx)
      if (deepScrapeResponse.status !== 408 && deepScrapeResponse.status < 500) {
        console.error('[Agent] Non-retryable error, stopping');
        break;
      }

      // Wait before retry with exponential backoff
      if (attempt < maxRetries) {
        const backoffMs = Math.pow(2, attempt) * 1000; // 2s, 4s
        console.log(`[Agent] Waiting ${backoffMs}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, backoffMs));
      }
    }

    if (!scrapeData) {
      console.error('[Agent] All retries failed:', lastError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Firecrawl timed out after ${maxRetries} attempts. The site may be slow to load.`,
          details: lastError 
        }),
        { status: 504, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[Agent] Response keys:', Object.keys(scrapeData));

    // Extract products from the response
    const extractedData = scrapeData.data?.extract || scrapeData.extract;
    const products = extractedData?.products || [];
    const links = scrapeData.data?.links || scrapeData.links || [];

    console.log(`[Agent] Extracted ${products.length} products directly`);
    console.log(`[Agent] Found ${links.length} links on page`);

    // If direct extraction found products, use them
    if (products.length > 0) {
      // Insert products into database
      const productsToInsert = products
        .filter((p: any) => p.name && p.product_url)
        .map((p: any) => ({
          name: cleanProductName(p.name),
          price: p.price || null,
          image_url: cleanImageUrl(p.image_url, competitor!.scrape_url),
          product_url: p.product_url,
          competitor: competitor!.name,
        }));

      console.log(`[Agent] Prepared ${productsToInsert.length} products for insertion`);

      // Check for existing products
      const productUrls = productsToInsert.map((p: any) => p.product_url);
      const { data: existingProducts } = await supabase
        .from('products')
        .select('product_url')
        .in('product_url', productUrls);

      const existingUrls = new Set(existingProducts?.map((p: any) => p.product_url) || []);
      const newProducts = productsToInsert.filter((p: any) => !existingUrls.has(p.product_url));

      console.log(`[Agent] ${existingUrls.size} already exist, ${newProducts.length} are new`);

      // Insert new products
      let insertedCount = 0;
      if (newProducts.length > 0) {
        const { error: insertError, data: insertedData } = await supabase
          .from('products')
          .insert(newProducts)
          .select('id');

        if (insertError) {
          console.error('[Agent] Insert error:', insertError);
        } else {
          insertedCount = insertedData?.length || 0;
          console.log(`[Agent] Successfully inserted ${insertedCount} products`);
        }
      }

      // Update last_crawled_at
      await supabase
        .from('competitors')
        .update({ last_crawled_at: new Date().toISOString() })
        .eq('id', competitor.id);

      // Create crawl job record
      await supabase.from('crawl_jobs').insert({
        competitor_id: competitor.id,
        firecrawl_job_id: `sync-${Date.now()}`,
        status: 'completed',
        products_found: products.length,
        products_inserted: insertedCount,
        completed_at: new Date().toISOString(),
      });

      return new Response(
        JSON.stringify({
          success: true,
          data: {
            competitorName: competitor.name,
            totalUrlsFound: links.length,
            productUrlsFound: products.length,
            newProductUrls: newProducts.length,
            scrapedCount: insertedCount,
            skippedCount: existingUrls.size,
            errorsCount: 0,
            method: 'agent-extract',
          },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If no products extracted directly, we need to crawl individual product pages
    // Filter links to find potential product URLs
    console.log('[Agent] No direct extraction, filtering links for product URLs...');
    
    const productLinks = links.filter((url: string) => isLikelyProductUrl(url, competitor!.scrape_url));
    console.log(`[Agent] Found ${productLinks.length} potential product URLs from links`);

    // Check which URLs are new
    const { data: existingProducts } = await supabase
      .from('products')
      .select('product_url')
      .eq('competitor', competitor.name);

    const existingUrls = new Set(existingProducts?.map((p: any) => p.product_url) || []);
    const newProductLinks = productLinks.filter((url: string) => !existingUrls.has(url));
    
    console.log(`[Agent] ${newProductLinks.length} are new product URLs`);

    // Limit the number of products to scrape
    const urlsToScrape = newProductLinks.slice(0, Math.min(limit, 25));
    console.log(`[Agent] Will scrape ${urlsToScrape.length} products`);

    // Scrape each product page
    const scrapedProducts: any[] = [];
    const errors: string[] = [];

    for (const url of urlsToScrape) {
      try {
        const productData = await extractProductFromUrl(url, firecrawlApiKey);
        if (productData) {
          // Check exclusion categories
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
        console.error(`[Agent] Error scraping ${url}:`, err);
        errors.push(url);
      }

      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log(`[Agent] Scraped ${scrapedProducts.length} products, ${errors.length} errors`);

    // Insert products
    let insertedCount = 0;
    if (scrapedProducts.length > 0) {
      const { error: insertError, data: insertedData } = await supabase
        .from('products')
        .insert(scrapedProducts)
        .select('id');

      if (insertError) {
        console.error('[Agent] Insert error:', insertError);
      } else {
        insertedCount = insertedData?.length || 0;
      }
    }

    // Update last_crawled_at
    await supabase
      .from('competitors')
      .update({ last_crawled_at: new Date().toISOString() })
      .eq('id', competitor.id);

    // Create crawl job record
    await supabase.from('crawl_jobs').insert({
      competitor_id: competitor.id,
      firecrawl_job_id: `sync-${Date.now()}`,
      status: 'completed',
      products_found: urlsToScrape.length,
      products_inserted: insertedCount,
      completed_at: new Date().toISOString(),
    });

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          competitorName: competitor.name,
          totalUrlsFound: links.length,
          productUrlsFound: productLinks.length,
          newProductUrls: newProductLinks.length,
          scrapedCount: insertedCount,
          skippedCount: urlsToScrape.length - scrapedProducts.length,
          errorsCount: errors.length,
          method: 'agent-crawl',
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Agent] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Helper: Check if URL is likely a product page
function isLikelyProductUrl(url: string, baseUrl: string): boolean {
  try {
    const urlObj = new URL(url, baseUrl);
    const path = urlObj.pathname.toLowerCase();

    // Exclude non-product pages
    const excludePatterns = [
      '/cart', '/checkout', '/account', '/login', '/wishlist', '/register',
      '/search', '/filter', '/sort', '/page/', '/pagina/',
      '/info/', '/customer/', '/returns/', '/shipping/', '/privacy', '/terms',
      '/faq', '/contact', '/about', '/blog/', '/news/', '/brands/', '/stores/',
      '/collections/', '/category/', '/categorie/', '/c/', '/shop',
    ];

    for (const pattern of excludePatterns) {
      if (path.includes(pattern) || path === '/' || path.length < 10) {
        return false;
      }
    }

    // Product indicators
    const productIndicators = [
      '/products/', '/product/', '/p/', '/item/', '/artikel/',
      '/winkel/', // Dutch for shop - WooCommerce sites
    ];

    for (const indicator of productIndicators) {
      if (path.includes(indicator)) {
        return true;
      }
    }

    // Long slug with hypens = likely product
    const segments = path.split('/').filter(Boolean);
    const lastSegment = segments[segments.length - 1] || '';
    if (lastSegment.length > 20 && lastSegment.includes('-')) {
      return true;
    }

    // Numeric product ID patterns
    if (/\/\d{5,}-/.test(path) || /^\d{5,}/.test(lastSegment)) {
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

  // Handle double-domain URLs
  const doubleHttpMatch = cleaned.match(/https?:\/\/[^/]+?(https?:\/\/.+)/i);
  if (doubleHttpMatch) {
    cleaned = doubleHttpMatch[1];
  }

  // Handle protocol-relative URLs
  if (cleaned.startsWith('//')) {
    cleaned = 'https:' + cleaned;
  }

  // Handle relative URLs
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
    return cleaned;
  } catch {
    return null;
  }
}
