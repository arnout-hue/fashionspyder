// Competitor product scraper - v6 with LLM-based JSON extraction
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

interface ExtractedProduct {
  name: string;
  price: string | null;
  image_url: string | null;
}

// Phase 2: Improved product URL detection with stricter checks
function isProductUrl(url: string, baseUrl: string, patterns: string[] | null): boolean {
  try {
    const urlObj = new URL(url, baseUrl);
    const path = urlObj.pathname.toLowerCase();
    const fullUrl = urlObj.href.toLowerCase();

    // Exclude homepage and very short paths
    if (path === '/' || path === '/nl/' || path === '/nl' || path.length < 5) {
      return false;
    }

    // STRICT: Exclude utility/info pages
    const strictNonProductPatterns = [
      '/cart', '/checkout', '/account', '/login', '/wishlist', '/register',
      '/search', '/filter', '/sort', '/page/', '/pagina/',
      '/giftcard', '/gift-card', '/cadeaubon',
      '/info/', '/customer/', '/returns/', '/shipping/', '/verzending/',
      '/privacy', '/terms', '/faq', '/contact', '/about', '/over-ons',
      '/blog/', '/news/', '/magazine/', '/inspiratie/', '/lookbook/',
      '/levering/', '/bestellen/', '/retourneren/', '/ruilen/',
      '/cookiebeleid', '/privacyverklaring', '/algemene-voorwaarden',
      '/customer-care', '/customer-service', '/klantenservice',
      '/brands/', '/brand/', '/merken/', '/merk/',
      '/stores/', '/store/', '/winkels/', '/winkel/',
      '/size-guide', '/maattabel', '/sizeguide',
      '/affiliate', '/ambassador', '/partner',
      '.pdf', '/pdf/', '/downloads/'
    ];

    for (const pattern of strictNonProductPatterns) {
      if (path.includes(pattern) || path.endsWith(pattern.replace('/', ''))) {
        return false;
      }
    }

    // STRICT: Exclude category pages that have numeric IDs like /20-tops/ or /en/20-tops-and-t-shirts
    // These are PrestaShop category patterns
    const categoryNumericPattern = /\/\d{1,3}-[^/]+\/?$/;
    if (categoryNumericPattern.test(path)) {
      return false;
    }

    // STRICT: Exclude pure category/collection pages
    const categoryPatterns = [
      /\/collections\/[^/]+\/?$/,
      /\/category\/[^/]+\/?$/,
      /\/categorie\/[^/]+\/?$/,
      /\/categories\/[^/]+\/?$/,
      /\/c\/[^/]+\/?$/,
      /\/shop\/?$/,
      /\/nieuw\/?$/,
      /\/new\/?$/,
      /\/sale\/?$/,
      /\/kleding\/?$/,
      /\/clothing\/?$/,
      /\/accessoires\/?$/,
      /\/accessories\/?$/,
    ];

    for (const pattern of categoryPatterns) {
      if (pattern.test(path)) {
        return false;
      }
    }

    // If custom patterns are defined, use them
    if (patterns && patterns.length > 0) {
      const matchesPattern = patterns.some((pattern) => {
        const lowerPattern = pattern.toLowerCase();
        if (lowerPattern.startsWith('^')) {
          try {
            const regex = new RegExp(lowerPattern);
            return regex.test(path);
          } catch {
            return path.includes(lowerPattern);
          }
        }
        return path.includes(lowerPattern);
      });

      // Custom patterns matched - it's likely a product
      if (matchesPattern) {
        return true;
      }
    }

    // Product URL indicators (positive matches)
    
    // 1. Shopify: /products/product-handle
    if (path.includes('/products/') && !path.endsWith('/products/') && !path.endsWith('/products')) {
      return true;
    }

    // 2. Shopware/PrestaShop: /123456-product-name.html with 5+ digit ID
    if (/\/\d{5,}-[^/]+\.html$/.test(path)) {
      return true;
    }

    // 3. Generic .html with long slug (likely product detail)
    const pathSegments = path.split('/').filter(Boolean);
    const lastSegment = pathSegments[pathSegments.length - 1] || '';
    if (lastSegment.endsWith('.html') && lastSegment.length > 15) {
      return true;
    }

    // 4. Numeric product ID prefix: /29579330906-vesten-bruin/
    if (/^\d{5,}-/.test(lastSegment)) {
      return true;
    }

    // 5. /product/ or /p/ path segments
    if (pathSegments.includes('product') || (pathSegments.includes('p') && pathSegments.length > 2)) {
      return true;
    }

    // 6. /item/ or /artikel/ paths
    if (pathSegments.includes('item') || pathSegments.includes('artikel')) {
      return true;
    }

    // 7. WooCommerce-style: /product-category/.../product-name where last segment is long
    if (lastSegment.length > 20 && !lastSegment.includes('-category') && pathSegments.length >= 3) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

// Phase 6: Enhanced deduplication with color/variant handling
function getProductBaseKey(url: string): string {
  try {
    const urlObj = new URL(url);
    let path = urlObj.pathname.toLowerCase();

    // Strip query parameters first
    // But extract the base product if variant info is in query
    
    // Shopware-style: /product-slug/123456-Color-Size.html → extract numeric ID
    const shopwareMatch = path.match(/\/(\d{5,})-[^/]+\.html$/);
    if (shopwareMatch) {
      return shopwareMatch[1];
    }

    // Shopify-style: /products/product-handle → use the handle
    const shopifyMatch = path.match(/\/products\/([^/?#]+)/);
    if (shopifyMatch) {
      return shopifyMatch[1];
    }

    // Generic numeric ID in last segment
    const segments = path.split('/').filter(Boolean);
    const lastSeg = segments[segments.length - 1] || '';
    const numericMatch = lastSeg.match(/^(\d{5,})/);
    if (numericMatch) {
      return numericMatch[1];
    }

    // Remove common variant suffixes from path
    path = path
      .replace(/-(?:xs|s|m|l|xl|xxl|xxxl|one-size)(?:\.html)?$/i, '')
      .replace(/-(?:small|medium|large|extra-large)(?:\.html)?$/i, '')
      .replace(/-\d{2,3}(?:\.html)?$/i, '') // Size numbers like -36, -42
      .replace(/\?.*$/, ''); // Remove query string

    return path;
  } catch {
    return url;
  }
}

function shouldExcludeProduct(url: string, name: string, excludedCategories: string[]): boolean {
  if (!excludedCategories || excludedCategories.length === 0) return false;
  const searchText = `${url} ${name}`.toLowerCase();
  return excludedCategories.some((cat) => searchText.includes(cat.toLowerCase()));
}

function shouldExcludeUrl(url: string, excludedCategories: string[]): boolean {
  if (!excludedCategories || excludedCategories.length === 0) return false;
  const urlLower = url.toLowerCase();
  return excludedCategories.some((cat) => urlLower.includes(cat.toLowerCase()));
}

// Phase 5: Robust image URL validation and cleaning
function cleanImageUrl(imageUrl: string | null | undefined, baseUrl: string): string | null {
  if (!imageUrl || typeof imageUrl !== 'string') return null;

  let cleaned = imageUrl.trim();

  // Handle malformed double-domain URLs like "https://site.comhttps://cdn.site.com/..."
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

  // Validate it's actually a URL
  try {
    const urlObj = new URL(cleaned);
    
    // Must be http(s)
    if (!urlObj.protocol.startsWith('http')) {
      return null;
    }

    // Check for image indicators
    const lower = cleaned.toLowerCase();
    const isImage = 
      lower.includes('.jpg') || 
      lower.includes('.jpeg') || 
      lower.includes('.png') || 
      lower.includes('.webp') || 
      lower.includes('.gif') ||
      lower.includes('/image') ||
      lower.includes('/media') ||
      lower.includes('/cdn') ||
      lower.includes('cloudinary') ||
      lower.includes('shopify') ||
      lower.includes('imgix');

    // Exclude obvious non-product images
    const isNonProduct = 
      lower.includes('logo') ||
      lower.includes('icon') ||
      lower.includes('favicon') ||
      lower.includes('placeholder') ||
      lower.includes('spinner') ||
      lower.includes('loading') ||
      lower.includes('banner') && !lower.includes('product') ||
      lower.includes('/flags/') ||
      lower.includes('/payment/') ||
      lower.includes('/social/');

    if (isNonProduct) {
      return null;
    }

    // Must end with image extension OR contain image/media path
    if (!isImage && !lower.endsWith('.html')) {
      return null;
    }

    return cleaned;
  } catch {
    return null;
  }
}

function cleanProductName(name: string): string {
  if (!name) return 'Unknown Product';
  return name
    .replace(/\s*[|\-–—]\s*[^|\-–—]+$/, '') // Remove brand suffix
    .replace(/^\s+|\s+$/g, '') // Trim
    .replace(/\s+/g, ' '); // Normalize spaces
}

// Phase 3: Scrape and extract product data using Firecrawl's scrape with LLM extraction
async function extractProductWithLLM(url: string, apiKey: string): Promise<ExtractedProduct | null> {
  console.log(`[LLM Extract] ${url}`);

  try {
    // Use scrape endpoint with extract format for synchronous LLM extraction
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
          prompt: 'Extract the product information. Get the product name (without brand suffix), the price with currency, and the main product image URL.',
          schema: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Product name' },
              price: { type: 'string', description: 'Price with currency (e.g., €49.95)' },
              image_url: { type: 'string', description: 'Main product image URL' },
            },
            required: ['name'],
          },
        },
        onlyMainContent: true,
        waitFor: 2000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[LLM Extract] API error for ${url}:`, response.status, errorText.slice(0, 300));
      return null;
    }

    const data = await response.json();
    console.log(`[LLM Extract] Response for ${url}:`, JSON.stringify(data).slice(0, 400));
    
    // The extract is in data.data.extract or data.extract
    const extracted = data.data?.extract || data.extract;
    
    if (!extracted || !extracted.name) {
      console.log(`[LLM Extract] No product name found for ${url}`);
      return null;
    }

    console.log(`[LLM Extract] Success: name="${extracted.name}", price="${extracted.price || 'N/A'}"`);

    return {
      name: extracted.name,
      price: extracted.price || null,
      image_url: extracted.image_url || null,
    };
  } catch (error) {
    console.error(`[LLM Extract] Error for ${url}:`, error);
    return null;
  }
}

// Phase 4: Batch processing with chunks
async function extractProductsBatch(
  urls: string[], 
  apiKey: string, 
  baseUrl: string,
  excludedCategories: string[]
): Promise<{ products: any[]; skipped: string[]; errors: string[] }> {
  const products: any[] = [];
  const skipped: string[] = [];
  const errors: string[] = [];

  // Process in sequential batches to avoid rate limits
  const BATCH_SIZE = 5; // Conservative batch size
  const DELAY_BETWEEN_REQUESTS = 1000; // 1 second delay

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];

    try {
      const extracted = await extractProductWithLLM(url, apiKey);

      if (extracted && extracted.name) {
        // Check exclusion
        if (shouldExcludeProduct(url, extracted.name, excludedCategories)) {
          console.log(`[Excluded] ${extracted.name} (category filter)`);
          skipped.push(url);
          continue;
        }

        // Clean and validate image URL
        const cleanedImage = cleanImageUrl(extracted.image_url, baseUrl);

        products.push({
          name: cleanProductName(extracted.name),
          price: extracted.price,
          image_url: cleanedImage,
          product_url: url,
        });
      } else {
        errors.push(url);
      }
    } catch (error) {
      console.error(`[Error] Failed to extract ${url}:`, error);
      errors.push(url);
    }

    // Add delay between requests to avoid rate limiting
    if (i < urls.length - 1) {
      await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_REQUESTS));
    }
  }

  return { products, skipped, errors };
}

// Phase 1: Target scrape_url directly for URL discovery
async function discoverProductUrls(
  scrapeUrl: string, 
  apiKey: string, 
  patterns: string[] | null
): Promise<string[]> {
  console.log(`[Discovery] Scraping listing page: ${scrapeUrl}`);

  const allUrls: string[] = [];

  // First, try to get links directly from the listing page (new arrivals, etc.)
  try {
    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: scrapeUrl,
        formats: ['links'],
        onlyMainContent: false,
        waitFor: 3000, // Wait for JS rendering
      }),
    });

    if (response.ok) {
      const data = await response.json();
      const links = data.data?.links || data.links || [];
      console.log(`[Discovery] Found ${links.length} links on listing page`);
      allUrls.push(...links);
    } else {
      console.log(`[Discovery] Listing page scrape failed with status ${response.status}`);
    }
  } catch (error) {
    console.error('[Discovery] Error scraping listing page:', error);
  }

  // If we got fewer than 10 product URLs from the listing, also try mapping the section
  const productUrlsFromListing = allUrls.filter(url => isProductUrl(url, scrapeUrl, patterns));
  
  if (productUrlsFromListing.length < 10) {
    console.log(`[Discovery] Only ${productUrlsFromListing.length} products from listing, trying map...`);
    
    try {
      // Map only with search for "new" or the path from scrape_url
      const scrapeUrlPath = new URL(scrapeUrl).pathname;
      const searchTerm = scrapeUrlPath.includes('new') || scrapeUrlPath.includes('nieuw') 
        ? 'new' 
        : undefined;

      const mapResponse = await fetch('https://api.firecrawl.dev/v1/map', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: scrapeUrl, // Map FROM the scrape_url, not site origin
          search: searchTerm,
          limit: 500,
          includeSubdomains: false,
        }),
      });

      if (mapResponse.ok) {
        const mapData = await mapResponse.json();
        const mapLinks = mapData.links || mapData.data?.links || [];
        console.log(`[Discovery] Map found ${mapLinks.length} additional URLs`);
        allUrls.push(...mapLinks);
      }
    } catch (error) {
      console.error('[Discovery] Map error:', error);
    }
  }

  // Deduplicate
  return Array.from(new Set(allUrls));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authentication check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      console.log('Missing or invalid Authorization header');
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const authSupabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await authSupabase.auth.getClaims(token);

    if (claimsError || !claimsData?.claims) {
      console.log('Authentication failed:', claimsError?.message);
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Authenticated user:', claimsData.claims.sub);

    const { competitor, limit = 25 } = await req.json();

    if (!competitor) {
      return new Response(
        JSON.stringify({ success: false, error: 'Competitor ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Firecrawl connector not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch competitor from database
    let competitorConfig: CompetitorConfig | null = null;

    const { data: competitorData, error: competitorError } = await supabase
      .from('competitors')
      .select('*')
      .eq('id', competitor)
      .single();

    if (!competitorError && competitorData) {
      competitorConfig = competitorData;
    } else {
      console.log('Competitor not found by ID, trying by name...');
      const { data: competitorByName, error: nameError } = await supabase
        .from('competitors')
        .select('*')
        .ilike('name', competitor)
        .single();

      if (!nameError && competitorByName) {
        competitorConfig = competitorByName;
      }
    }

    if (!competitorConfig) {
      return new Response(
        JSON.stringify({ success: false, error: `Competitor not found: ${competitor}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[v6] Starting crawl for ${competitorConfig.name} at ${competitorConfig.scrape_url}`);

    // Phase 1: Discover product URLs from the listing page
    const allUrls = await discoverProductUrls(
      competitorConfig.scrape_url,
      apiKey,
      competitorConfig.product_url_patterns
    );

    console.log(`[Discovery] Total URLs found: ${allUrls.length}`);

    // Phase 2: Filter to product URLs only
    const productUrls = allUrls.filter((url) =>
      isProductUrl(url, competitorConfig.scrape_url, competitorConfig.product_url_patterns)
    );
    console.log(`[Filter] ${productUrls.length} product URLs identified`);

    if (productUrls.length === 0) {
      console.log('[Debug] Sample URLs:', allUrls.slice(0, 15));
      console.log('[Debug] Patterns:', competitorConfig.product_url_patterns);
    }

    // Phase 6: Deduplicate by base product key
    const seenBaseKeys = new Set<string>();
    const uniqueProductUrls: string[] = [];
    for (const url of productUrls) {
      const baseKey = getProductBaseKey(url);
      if (!seenBaseKeys.has(baseKey)) {
        seenBaseKeys.add(baseKey);
        uniqueProductUrls.push(url);
      }
    }
    console.log(`[Dedup] ${uniqueProductUrls.length} unique products after variant deduplication`);

    // Get existing products to avoid re-scraping
    const { data: existingProducts } = await supabase
      .from('products')
      .select('product_url')
      .eq('competitor', competitorConfig.name);

    const existingBaseKeys = new Set(
      (existingProducts || []).map((p) => getProductBaseKey(p.product_url))
    );
    const newProductUrls = uniqueProductUrls.filter(
      (url: string) => !existingBaseKeys.has(getProductBaseKey(url))
    );
    console.log(`[New] ${newProductUrls.length} new product URLs to scrape`);

    // Pre-filter by excluded categories
    const filteredNewUrls = newProductUrls.filter(
      (url: string) => !shouldExcludeUrl(url, competitorConfig.excluded_categories)
    );
    console.log(`[PreFilter] ${filteredNewUrls.length} URLs after category exclusion`);

    // Phase 3 & 4: Extract products using LLM-based JSON extraction
    const urlsToScrape = filteredNewUrls.slice(0, limit);

    let extractionResult = { products: [] as any[], skipped: [] as string[], errors: [] as string[] };

    if (urlsToScrape.length > 0) {
      console.log(`[Extract] Processing ${urlsToScrape.length} products with LLM extraction...`);

      extractionResult = await extractProductsBatch(
        urlsToScrape,
        apiKey,
        competitorConfig.scrape_url,
        competitorConfig.excluded_categories
      );

      // Add competitor info to products
      extractionResult.products = extractionResult.products.map((p) => ({
        ...p,
        competitor: competitorConfig.name,
        status: 'pending',
        sku: null,
      }));
    }

    console.log(`[Result] ${extractionResult.products.length} products extracted, ${extractionResult.skipped.length} skipped, ${extractionResult.errors.length} errors`);

    // Insert products into database
    if (extractionResult.products.length > 0) {
      const { error: insertError } = await supabase
        .from('products')
        .upsert(extractionResult.products, {
          onConflict: 'product_url',
          ignoreDuplicates: true
        });

      if (insertError) {
        console.error('Insert error:', insertError);
        return new Response(
          JSON.stringify({ success: false, error: 'Failed to save products to database' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Update last_crawled_at
    await supabase
      .from('competitors')
      .update({ last_crawled_at: new Date().toISOString() })
      .eq('id', competitorConfig.id);

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          competitor: competitorConfig.name,
          totalUrlsFound: allUrls.length,
          productUrlsFound: productUrls.length,
          uniqueProductsFound: uniqueProductUrls.length,
          newProductUrls: newProductUrls.length,
          scrapedCount: extractionResult.products.length,
          skippedCount: extractionResult.skipped.length,
          errorsCount: extractionResult.errors.length,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in scrape-competitor-products:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to scrape';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
