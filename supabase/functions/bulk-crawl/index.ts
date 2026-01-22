import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CrawlResult {
  competitor: string;
  competitorId: string;
  success: boolean;
  jobId?: string;
  error?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('Bulk crawl function invoked');

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration');
    }

    // Create admin client with service role key
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    // Parse optional parameters
    let limit = 50;
    try {
      const body = await req.json();
      if (body.limit && typeof body.limit === 'number') {
        limit = Math.min(body.limit, 100); // Max 100 products per competitor
      }
    } catch {
      // No body or invalid JSON, use defaults
    }

    // 1. Fetch active competitors
    const { data: competitors, error: competitorsError } = await supabaseClient
      .from('competitors')
      .select('id, name, scrape_url')
      .eq('is_active', true)
      .order('name');

    if (competitorsError) {
      console.error('Failed to fetch competitors:', competitorsError);
      throw new Error(`Failed to fetch competitors: ${competitorsError.message}`);
    }

    if (!competitors || competitors.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'No active competitors found',
        results: [] 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Found ${competitors.length} active competitors`);

    const results: CrawlResult[] = [];

    // 2. Trigger crawls for each competitor
    for (const competitor of competitors) {
      console.log(`Starting crawl for ${competitor.name} (${competitor.id})`);
      
      try {
        // Invoke the agent-scrape-competitor function
        const { data, error: invokeError } = await supabaseClient.functions.invoke('agent-scrape-competitor', {
          body: { 
            competitorId: competitor.id,
            limit 
          }
        });

        if (invokeError) {
          console.error(`Failed to start crawl for ${competitor.name}:`, invokeError);
          results.push({
            competitor: competitor.name,
            competitorId: competitor.id,
            success: false,
            error: invokeError.message || 'Failed to invoke scrape function'
          });
        } else {
          console.log(`Successfully started crawl for ${competitor.name}, jobId: ${data?.jobId}`);
          results.push({
            competitor: competitor.name,
            competitorId: competitor.id,
            success: true,
            jobId: data?.jobId
          });
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        console.error(`Exception starting crawl for ${competitor.name}:`, errorMessage);
        results.push({
          competitor: competitor.name,
          competitorId: competitor.id,
          success: false,
          error: errorMessage
        });
      }

      // Small delay between function invocations to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    console.log(`Bulk crawl complete: ${successCount} started, ${failCount} failed`);

    return new Response(JSON.stringify({ 
      success: true, 
      message: `Started crawl jobs for ${successCount} of ${competitors.length} competitors`,
      successCount,
      failCount,
      results 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Bulk crawl error:', errorMessage);
    
    return new Response(JSON.stringify({ 
      success: false, 
      error: errorMessage 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});