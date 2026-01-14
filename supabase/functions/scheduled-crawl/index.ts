// Scheduled crawl - runs all active competitors using the agent scrape endpoint
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CompetitorConfig {
  id: string;
  name: string;
  scrape_url: string;
  is_active: boolean;
}

interface AgentScrapeResult {
  success: boolean;
  productsAdded?: number;
  productsSkipped?: number;
  error?: string;
  jobId?: string;
}

async function scrapeCompetitorWithAgent(
  competitor: CompetitorConfig,
  supabaseUrl: string,
  supabaseServiceKey: string,
  limit: number = 25
): Promise<AgentScrapeResult> {
  console.log(`Starting agent scrape for ${competitor.name}`);

  try {
    const agentUrl = `${supabaseUrl}/functions/v1/agent-scrape-competitor`;
    
    const response = await fetch(agentUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        competitor: competitor.name, 
        limit 
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Agent scrape failed for ${competitor.name}:`, response.status, errorText);
      return { 
        success: false, 
        error: `HTTP ${response.status}: ${errorText.substring(0, 200)}` 
      };
    }

    const result = await response.json();
    
    if (!result.success) {
      return { 
        success: false, 
        error: result.error || 'Unknown agent error' 
      };
    }

    console.log(`Agent scrape completed for ${competitor.name}: ${result.productsAdded || 0} products added`);
    
    return {
      success: true,
      productsAdded: result.productsAdded || 0,
      productsSkipped: result.productsSkipped || 0,
      jobId: result.jobId,
    };
  } catch (error) {
    console.error(`Error in agent scrape for ${competitor.name}:`, error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('=== Scheduled Crawl Started (Agent Mode) ===');
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

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch schedule settings
    const { data: scheduleData } = await supabase
      .from('crawl_schedule')
      .select('*')
      .single();

    const maxProductsPerCompetitor = scheduleData?.max_products_per_competitor || 25;
    const delayBetweenCompetitorsMs = (scheduleData?.delay_between_competitors_seconds || 180) * 1000;

    // Fetch all active competitors
    const { data: competitors, error: fetchError } = await supabase
      .from('competitors')
      .select('id, name, scrape_url, is_active')
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
    console.log(`Settings: ${maxProductsPerCompetitor} products/competitor, ${delayBetweenCompetitorsMs/1000}s delay`);

    const results: { 
      competitor: string; 
      success: boolean; 
      productsAdded: number; 
      error?: string 
    }[] = [];

    for (let i = 0; i < competitors.length; i++) {
      const competitor = competitors[i];
      console.log(`\n[${i + 1}/${competitors.length}] Crawling ${competitor.name}...`);
      
      const result = await scrapeCompetitorWithAgent(
        competitor,
        supabaseUrl,
        supabaseServiceKey,
        maxProductsPerCompetitor
      );

      // Record in crawl_history
      await supabase.from('crawl_history').insert({
        competitor_id: competitor.id,
        status: result.success ? 'success' : 'error',
        new_products_scraped: result.productsAdded || 0,
        skipped_count: result.productsSkipped || 0,
        error_message: result.error || null,
      });

      results.push({
        competitor: competitor.name,
        success: result.success,
        productsAdded: result.productsAdded || 0,
        error: result.error,
      });

      // Wait between competitors (except for the last one)
      if (i < competitors.length - 1) {
        console.log(`Waiting ${delayBetweenCompetitorsMs/1000}s before next competitor...`);
        await new Promise((resolve) => setTimeout(resolve, delayBetweenCompetitorsMs));
      }
    }

    // Update schedule last_run_at
    if (scheduleData) {
      await supabase
        .from('crawl_schedule')
        .update({ last_run_at: new Date().toISOString() })
        .eq('id', scheduleData.id);
    }

    const totalProducts = results.reduce((sum, r) => sum + r.productsAdded, 0);
    const successCount = results.filter(r => r.success).length;

    console.log('\n=== Scheduled Crawl Complete (Agent Mode) ===');
    console.log(`Total: ${successCount}/${competitors.length} competitors successful`);
    console.log(`Products added: ${totalProducts}`);

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          competitorsProcessed: competitors.length,
          successCount,
          totalProducts,
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
