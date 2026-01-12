// Competitor product scraper - v2
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
    
    // Exclude homepage and very short paths
    if (path === '/' || path === '/nl/' || path === '/nl' || path.length < 5) {
      return false;
    }
    
    // If custom patterns are defined, use them exclusively
    if (patterns && patterns.length > 0) {
      return patterns.some((pattern) => path.includes(pattern.toLowerCase()));
    }
    
    // List of known non-product path segments
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
    
    // Check if path contains any non-product segment
    const pathSegments = path.split('/').filter(Boolean);
    
    // Most category pages have 1-2 segments: /kleding/ or /kleding/jurken/
    // Product pages typically have a unique identifier
    const lastSegment = pathSegments[pathSegments.length - 1] || '';
    
    // Check if any segment is a known non-product segment
    for (const segment of pathSegments) {
      if (nonProductSegments.includes(segment)) {
        return false;
      }
    }
    
    // Product URLs typically contain:
    // 1. A numeric product ID: /29579330906-vesten-bruin/
    // 2. A "products" or "p" path: /products/my-product or /p/12345
    // 3. HTML extension: /product-name.html
    
    // Check for numeric ID pattern (5+ digits followed by dash and text)
    if (/^\d{5,}-/.test(lastSegment)) {
      return true;
    }
    
    // Check for products path
    if (pathSegments.includes('products') || pathSegments.includes('product') || pathSegments.includes('p')) {
      return true;
    }
    
    // Check for .html extension with product-like slug
    if (lastSegment.endsWith('.html') && lastSegment.length > 10) {
      return true;
    }
    
    // Check for item/artikel paths
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

    // Extract product info from metadata and markdown
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

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch competitor from database
    const { data: competitorData, error: competitorError } = await supabase
      .from('competitors')
      .select('*')
      .eq('id', competitor)
      .single();

    if (competitorError || !competitorData) {
      console.log('Competitor not found by ID, trying by name...');
      // Fallback to name-based lookup for backwards compatibility
      const { data: competitorByName, error: nameError } = await supabase
        .from('competitors')
        .select('*')
        .ilike('name', competitor)
        .single();

      if (nameError || !competitorByName) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: `Competitor not found: ${competitor}` 
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      Object.assign(competitorData || {}, competitorByName);
    }

    const competitorConfig: CompetitorConfig = competitorData;
    console.log(`[v3] Starting crawl for ${competitorConfig.name} at ${competitorConfig.scrape_url}`);

// Step 1: Scrape the listing page to extract product links
    console.log('Scraping listing page for product links...');
    const scrapeResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: competitorConfig.scrape_url,
        formats: ['links'],
        onlyMainContent: false,
      }),
    });

    if (!scrapeResponse.ok) {
      const errorData = await scrapeResponse.json();
      console.error('Scrape failed:', errorData);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to scrape competitor listing page' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const scrapeData = await scrapeResponse.json();
    const allUrls: string[] = scrapeData.data?.links || scrapeData.links || [];
    console.log(`Found ${allUrls.length} total URLs on listing page`);

    // Step 2: Filter to product URLs only
    const productUrls = allUrls.filter((url) =>
      isProductUrl(url, competitorConfig.scrape_url, competitorConfig.product_url_patterns)
    );
    console.log(`Found ${productUrls.length} product URLs`);

    // Step 3: Get existing product URLs to avoid duplicates
    const { data: existingProducts } = await supabase
      .from('products')
      .select('product_url')
      .eq('competitor', competitorConfig.name);

    const existingUrls = new Set(existingProducts?.map((p) => p.product_url) || []);
    const newProductUrls = productUrls.filter((url) => !existingUrls.has(url));
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
