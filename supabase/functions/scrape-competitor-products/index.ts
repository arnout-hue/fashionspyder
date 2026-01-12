// Competitor product scraper - v2 with authentication
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
    // Firecrawl "links" can include relative URLs (e.g. "/nl/kleding/..."),
    // so always resolve against the competitor listing URL.
    const urlObj = new URL(url, baseUrl);
    const path = urlObj.pathname.toLowerCase();

    // Heuristic: some shops (e.g. Tess V / Shopware) use .html product pages.
    // If it looks like a product detail URL, treat it as product even when custom patterns are set.
    if (path.endsWith('.html') && /\/\d{5,}-[^/]+\.html$/.test(path)) {
      return true;
    }
    
    // Exclude homepage and very short paths
    if (path === '/' || path === '/nl/' || path === '/nl' || path.length < 5) {
      return false;
    }
    
    // If custom patterns are defined, use them
    if (patterns && patterns.length > 0) {
      const matchesPattern = patterns.some((pattern) => {
        const lowerPattern = pattern.toLowerCase();
        // Support regex patterns (starts with ^)
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
      
      if (!matchesPattern) return false;
    }
    
    // If custom patterns are specified and matched, skip non-product pattern checks
    // This allows specific patterns like /nl/kleding/ to work without being filtered
    if (patterns && patterns.length > 0) {
      // Only check for truly non-product paths (cart, account, etc.)
      const strictNonProductPatterns = [
        '/cart', '/checkout', '/account', '/login', '/wishlist',
        '/search', '/filter', '/sort', '/page/',
        '/giftcard', '/gift-card',
        '/info/', '/customer/', '/returns/', '/shipping/',
        '/privacy', '/terms', '/faq', '/contact', '/about',
        '/blog/', '/news/', '/magazine/', '/inspiratie/',
        '/levering/', '/bestellen/', '/retourneren/',
        '/cookiebeleid', '/privacyverklaring'
      ];
      
      for (const pattern of strictNonProductPatterns) {
        if (path.includes(pattern) || path.endsWith(pattern.slice(0, -1))) {
          return false;
        }
      }
      
      // Patterns matched and not strictly excluded - it's a product
      return true;
    }

    // List of known non-product path patterns (for auto-detection without custom patterns)
    const nonProductPatterns = [
      '/collections/', '/collection/', '/category/', '/categories/',
      '/nieuw/', '/new/', '/new-arrivals/', '/newarrivals/',
      '/shop/', '/kleding/', '/clothing/', '/dames/', '/heren/',
      '/cart', '/checkout', '/account', '/login', '/wishlist',
      '/search', '/filter', '/sort', '/page/',
      '/sale/', '/party/', '/back-in-stock/', '/bestsellers/',
      '/accessoires/', '/accessories/', '/schoenen/', '/shoes/', '/tassen/', '/bags/',
      '/giftcard', '/gift-card', '/campagnes/', '/campaigns/',
      '/trends/', '/lookbook/', '/brand/', '/brands/',
      '/info/', '/customer/', '/returns/', '/shipping/',
      '/privacy', '/terms', '/faq', '/contact', '/about',
      '/blog/', '/news/', '/magazine/', '/inspiratie/',
      '/selected/', '/petite/', '/tall/', '/gift-guide/',
      '/pre-order/', '/promo/', '/levering/', '/bestellen/', '/retourneren/',
      '/cookiebeleid', '/privacyverklaring'
    ];
    
    // Check if path matches any non-product pattern
    for (const pattern of nonProductPatterns) {
      if (path.includes(pattern) || path.endsWith(pattern.slice(0, -1))) {
        return false;
      }
    }

    // Exclude paths that end with just /collections/something (category pages)
    if (/\/collections\/[^/]+\/?$/.test(path) && !path.includes('/products/')) {
      return false;
    }

    // Product URLs typically contain:
    // 1. Shopify products path: /products/product-name
    if (path.includes('/products/') && !path.endsWith('/products/') && !path.endsWith('/products')) {
      return true;
    }

    // 2. A numeric product ID: /29579330906-vesten-bruin/
    const pathSegments = path.split('/').filter(Boolean);
    const lastSegment = pathSegments[pathSegments.length - 1] || '';

    if (/^\d{5,}-/.test(lastSegment)) {
      return true;
    }

    // 3. Product/p path segments
    if (pathSegments.includes('product') || pathSegments.includes('p')) {
      return true;
    }

    // 4. HTML extension with product-like slug
    if (lastSegment.endsWith('.html') && lastSegment.length > 10) {
      return true;
    }

    // 5. Item/artikel paths
    if (pathSegments.includes('item') || pathSegments.includes('artikel')) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Extracts a normalized "base product key" from a URL.
 * This is used to deduplicate size/color variants of the same product.
 * E.g., https://www.tessv.nl/lize-jurk-lila/264070-Lila-M.html → "264070"
 *       https://www.tessv.nl/lize-jurk-lila/264070-Lila-S.html → "264070"
 */
function getProductBaseKey(url: string): string {
  try {
    const urlObj = new URL(url);
    const path = urlObj.pathname.toLowerCase();

    // Shopware-style: /product-slug/123456-Color-Size.html → extract the numeric ID
    const shopwareMatch = path.match(/\/(\d{5,})-[^/]+\.html$/);
    if (shopwareMatch) {
      return shopwareMatch[1];
    }

    // Shopify-style: /products/product-handle → use the handle
    const shopifyMatch = path.match(/\/products\/([^/?#]+)/);
    if (shopifyMatch) {
      return shopifyMatch[1];
    }

    // Generic numeric ID in last segment: /29579330906-vesten-bruin/ → extract numeric prefix
    const segments = path.split('/').filter(Boolean);
    const lastSeg = segments[segments.length - 1] || '';
    const numericMatch = lastSeg.match(/^(\d{5,})/);
    if (numericMatch) {
      return numericMatch[1];
    }

    // Fallback: use the full URL as the key (no deduplication)
    return url;
  } catch {
    return url;
  }
}

function extractUrlsFromMarkdown(markdown: string): string[] {
  const urls: string[] = [];

  // Match markdown links: [text](url)
  const linkRe = /\((https?:\/\/[^)\s]+)\)/g;
  let m: RegExpExecArray | null;
  while ((m = linkRe.exec(markdown)) !== null) {
    urls.push(m[1]);
  }

  // Match any bare URLs
  const bareRe = /(https?:\/\/[^\s)\]}>"]+)/g;
  while ((m = bareRe.exec(markdown)) !== null) {
    urls.push(m[1]);
  }

  return Array.from(new Set(urls));
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
        formats: ['markdown', 'html'],
        onlyMainContent: false, // Get full page to find images
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Scrape API error:', response.status, errorText);
      return null;
    }

    const data = await response.json();
    const markdown = data.data?.markdown || data.markdown || '';
    const html = data.data?.html || data.html || '';
    const metadata = data.data?.metadata || data.metadata || {};

    // Extract product info from metadata and content
    const name = metadata.title || extractFromMarkdown(markdown, /^#\s+(.+)/m) || 'Unknown Product';
    const price = extractPrice(markdown) || extractPrice(html) || null;
    
    // Try multiple image extraction methods
    let image = null;
    
    // 1. OG Image from metadata (most reliable)
    if (metadata.ogImage && isValidImageUrl(metadata.ogImage)) {
      image = metadata.ogImage;
    }
    
    // 2. Try to find product image in JSON-LD schema
    if (!image) {
      image = extractImageFromJsonLd(html);
    }
    
    // 3. Look for product images in HTML (img tags with product-related classes/src)
    if (!image) {
      image = extractProductImage(html);
    }
    
    // 4. Fall back to markdown image extraction
    if (!image) {
      image = extractImage(markdown);
    }

    console.log(`Extracted: name="${cleanProductName(name)}", price="${price}", image="${image ? 'found' : 'not found'}"`);

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

function isValidImageUrl(url: string): boolean {
  if (!url) return false;
  const lower = url.toLowerCase();
  // Must be an actual image URL, not another HTML page
  return (
    (lower.includes('.jpg') || lower.includes('.jpeg') || lower.includes('.png') || 
     lower.includes('.webp') || lower.includes('.gif') || lower.includes('/image') ||
     lower.includes('cdn') || lower.includes('media')) &&
    !lower.endsWith('.html')
  );
}

function extractImageFromJsonLd(html: string): string | null {
  // Look for JSON-LD product schema
  const jsonLdMatch = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  if (jsonLdMatch) {
    for (const match of jsonLdMatch) {
      try {
        const jsonContent = match.replace(/<script[^>]*>|<\/script>/gi, '');
        const parsed = JSON.parse(jsonContent);
        
        // Handle array of schemas
        const schemas = Array.isArray(parsed) ? parsed : [parsed];
        for (const schema of schemas) {
          if (schema['@type'] === 'Product' && schema.image) {
            const img = Array.isArray(schema.image) ? schema.image[0] : schema.image;
            if (typeof img === 'string' && isValidImageUrl(img)) return img;
            if (img?.url && isValidImageUrl(img.url)) return img.url;
          }
        }
      } catch {
        // Invalid JSON, skip
      }
    }
  }
  return null;
}

function extractProductImage(html: string): string | null {
  // Look for common product image patterns in HTML
  const patterns = [
    // Look for large product images
    /<img[^>]*class=["'][^"']*(?:product|main|primary|hero|gallery)[^"']*["'][^>]*src=["']([^"']+)["']/gi,
    // Look for data-src (lazy loaded)
    /<img[^>]*data-src=["']([^"']+\.(?:jpg|jpeg|png|webp)[^"']*)["']/gi,
    // Look for srcset
    /<img[^>]*srcset=["']([^"'\s,]+)/gi,
    // Generic img with product in path
    /<img[^>]*src=["']([^"']*(?:product|media|image)[^"']*\.(?:jpg|jpeg|png|webp)[^"']*)["']/gi,
  ];
  
  for (const pattern of patterns) {
    const match = pattern.exec(html);
    if (match && match[1] && isValidImageUrl(match[1])) {
      let imageUrl = match[1];
      // Handle relative URLs
      if (imageUrl.startsWith('//')) {
        imageUrl = 'https:' + imageUrl;
      }
      return imageUrl;
    }
  }
  
  return null;
}

function extractFromMarkdown(markdown: string, pattern: RegExp): string | null {
  const match = markdown.match(pattern);
  return match ? match[1].trim() : null;
}

function extractPrice(markdown: string): string | null {
  // Match common price patterns like €29,95 or $29.95 or 29,95 EUR
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
  // Remove common suffixes like "| Brand Name" or "- Shop Name"
  return name.replace(/\s*[|\-–—]\s*[^|\-–—]+$/, '').trim();
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
    
    // Create client with user's auth token
    const authSupabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Verify user is authenticated
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

    const { competitor, limit = 50 } = await req.json();

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

    // Use service role for database operations
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
      // Fallback to name-based lookup for backwards compatibility
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
        JSON.stringify({ 
          success: false, 
          error: `Competitor not found: ${competitor}` 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[v4] Starting crawl for ${competitorConfig.name} at ${competitorConfig.scrape_url}`);

    // Step 1: Use Firecrawl MAP to discover ALL product URLs on the site
    // This handles pagination automatically and returns up to 5000 URLs
    const siteOrigin = new URL(competitorConfig.scrape_url).origin;
    console.log(`Mapping site ${siteOrigin} for all product URLs...`);
    
    let allUrls: string[] = [];
    
    const mapResponse = await fetch('https://api.firecrawl.dev/v1/map', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: siteOrigin,
        limit: 2000, // Get up to 2000 URLs
        includeSubdomains: false,
      }),
    });

    if (mapResponse.ok) {
      const mapData = await mapResponse.json();
      allUrls = mapData.links || mapData.data?.links || [];
      console.log(`Map discovered ${allUrls.length} URLs on site`);
    } else {
      console.log('Map failed, falling back to scrape...');
      
      // Fallback: Scrape the listing page directly
      const scrapeResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: competitorConfig.scrape_url,
          formats: ['links', 'markdown'],
          onlyMainContent: false,
          waitFor: 3000,
        }),
      });

      if (!scrapeResponse.ok) {
        const errorData = await scrapeResponse.json();
        console.error('Scrape failed:', errorData);
        return new Response(
          JSON.stringify({ success: false, error: 'Failed to discover products on competitor site' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const scrapeData = await scrapeResponse.json();
      const linkUrls: string[] = scrapeData.data?.links || scrapeData.links || [];
      const listingMarkdown: string = scrapeData.data?.markdown || scrapeData.markdown || '';
      const markdownUrls = listingMarkdown ? extractUrlsFromMarkdown(listingMarkdown) : [];
      allUrls = Array.from(new Set([...linkUrls, ...markdownUrls]));
    }
    
    console.log(`Found ${allUrls.length} total URLs`);

    // Step 2: Filter to product URLs only
    const productUrls = allUrls.filter((url) =>
      isProductUrl(url, competitorConfig.scrape_url, competitorConfig.product_url_patterns)
    );
    console.log(`Found ${productUrls.length} product URLs`);

    if (productUrls.length === 0) {
      const htmlLike = allUrls.filter((u) => u.toLowerCase().includes('.html')).length;
      console.log(`[debug] 0 product URLs. URLs with ".html": ${htmlLike}`);
      console.log('[debug] Sample URLs:', allUrls.slice(0, 25));
      console.log('[debug] Patterns:', competitorConfig.product_url_patterns);
    }

    // Step 2b: Deduplicate product URLs by base product key (ignore size/color variants)
    const seenBaseKeys = new Set<string>();
    const uniqueProductUrls: string[] = [];
    for (const url of productUrls) {
      const baseKey = getProductBaseKey(url);
      if (!seenBaseKeys.has(baseKey)) {
        seenBaseKeys.add(baseKey);
        uniqueProductUrls.push(url);
      }
    }
    console.log(`${uniqueProductUrls.length} unique products after deduplicating size variants`);

    // Step 3: Get existing product URLs to avoid duplicates
    const { data: existingProducts } = await supabase
      .from('products')
      .select('product_url')
      .eq('competitor', competitorConfig.name);

    // Build a set of existing base keys for comparison
    const existingBaseKeys = new Set(
      (existingProducts || []).map((p) => getProductBaseKey(p.product_url))
    );
    const newProductUrls = uniqueProductUrls.filter(
      (url) => !existingBaseKeys.has(getProductBaseKey(url))
    );
    console.log(`${newProductUrls.length} new product URLs to scrape`);

    // Step 4: Scrape new products (limited)
    const urlsToScrape = newProductUrls.slice(0, limit);
    const scrapedProducts: any[] = [];
    const skippedProducts: string[] = [];
    const errors: string[] = [];

    for (const url of urlsToScrape) {
      try {
        const productData = await scrapeProductPage(url, apiKey);
        
        if (productData && productData.name) {
          // Check if product should be excluded based on category filters
          if (shouldExcludeProduct(url, productData.name, competitorConfig.excluded_categories)) {
            console.log(`Excluded product (category filter): ${productData.name}`);
            skippedProducts.push(url);
            continue;
          }

          scrapedProducts.push({
            name: productData.name,
            price: productData.price || null,
            sku: productData.sku || null,
            image_url: productData.image_url || null,
            product_url: url,
            competitor: competitorConfig.name,
            status: 'pending',
          });
        }
        
        // Small delay to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`Error scraping ${url}:`, error);
        errors.push(url);
      }
    }

    console.log(`Scraped ${scrapedProducts.length} products successfully, skipped ${skippedProducts.length}`);

    // Step 5: Insert new products into database
    if (scrapedProducts.length > 0) {
      const { error: insertError } = await supabase
        .from('products')
        .upsert(scrapedProducts, { 
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
          scrapedCount: scrapedProducts.length,
          skippedCount: skippedProducts.length,
          errorsCount: errors.length,
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
