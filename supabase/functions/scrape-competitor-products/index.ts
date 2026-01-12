import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CompetitorConfig {
  name: string;
  baseUrl: string;
  productPatterns: RegExp[];
}

const COMPETITORS: CompetitorConfig[] = [
  {
    name: 'Loavies',
    baseUrl: 'https://loavies.com/nl',
    productPatterns: [/\/nl\/[a-z-]+-\d+\.html/i, /\/nl\/p-/i],
  },
  {
    name: 'My Jewellery',
    baseUrl: 'https://www.my-jewellery.com/nl',
    productPatterns: [/\/nl\/[a-z-]+-[a-z0-9]+$/i, /\/producten\//i],
  },
  {
    name: 'Tess V',
    baseUrl: 'https://www.tessv.nl',
    productPatterns: [/\/product\//i, /\/kleding\//i, /\/accessoires\//i],
  },
  {
    name: 'Most Wanted',
    baseUrl: 'https://www.mostwanted.nl',
    productPatterns: [/\/product\//i, /\/kleding\//i],
  },
  {
    name: 'Olivia Kate',
    baseUrl: 'https://oliviakate.nl',
    productPatterns: [/\/product\//i, /\/kleding\//i, /\/sieraden\//i],
  },
];

function isProductUrl(url: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(url));
}

async function scrapeProductPage(url: string, apiKey: string): Promise<any> {
  console.log('Scraping product page:', url);
  
  const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url,
      formats: [
        { 
          type: 'json', 
          schema: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Product name/title' },
              price: { type: 'string', description: 'Product price including currency symbol' },
              sku: { type: 'string', description: 'Product SKU, EAN, or article number' },
              image_url: { type: 'string', description: 'Main product image URL' },
            },
            required: ['name'],
          },
        },
      ],
      onlyMainContent: true,
    }),
  });

  if (!response.ok) {
    console.error('Failed to scrape product:', url);
    return null;
  }

  const data = await response.json();
  return data.data?.json || data.json || null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { competitor, limit = 50 } = await req.json();

    if (!competitor) {
      return new Response(
        JSON.stringify({ success: false, error: 'Competitor name is required' }),
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

    const competitorConfig = COMPETITORS.find(
      (c) => c.name.toLowerCase() === competitor.toLowerCase()
    );

    if (!competitorConfig) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Unknown competitor: ${competitor}. Available: ${COMPETITORS.map(c => c.name).join(', ')}` 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Starting crawl for ${competitorConfig.name} at ${competitorConfig.baseUrl}`);

    // Step 1: Map the site to find all URLs
    const mapResponse = await fetch('https://api.firecrawl.dev/v1/map', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: competitorConfig.baseUrl,
        limit: 1000,
        includeSubdomains: false,
      }),
    });

    if (!mapResponse.ok) {
      const errorData = await mapResponse.json();
      console.error('Map failed:', errorData);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to map competitor site' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const mapData = await mapResponse.json();
    const allUrls: string[] = mapData.links || [];
    console.log(`Found ${allUrls.length} total URLs`);

    // Step 2: Filter to product URLs only
    const productUrls = allUrls.filter((url) =>
      isProductUrl(url, competitorConfig.productPatterns)
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
    const errors: string[] = [];

    for (const url of urlsToScrape) {
      try {
        const productData = await scrapeProductPage(url, apiKey);
        
        if (productData && productData.name) {
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

    console.log(`Scraped ${scrapedProducts.length} products successfully`);

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

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          competitor: competitorConfig.name,
          totalUrlsFound: allUrls.length,
          productUrlsFound: productUrls.length,
          newProductUrls: newProductUrls.length,
          scrapedCount: scrapedProducts.length,
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
