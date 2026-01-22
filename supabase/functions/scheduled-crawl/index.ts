// Scheduled crawl - triggers all active competitors using fire-and-forget pattern
// IMPORTANT: This function returns quickly (~5-10s) by triggering background jobs
// Each agent-scrape-competitor call returns immediately with a 202 and processes in background
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

interface TriggerResult {
  competitor: string;
  competitorId: string;
  jobStarted: boolean;
  jobId?: string;
  error?: string;
}

// Fire-and-forget: triggers the agent scrape and returns immediately
// The agent-scrape-competitor function returns 202 and processes in background
async function triggerAgentScrape(
  competitor: CompetitorConfig,
  supabaseUrl: string,
  supabaseServiceKey: string,
  limit: number = 25
): Promise<TriggerResult> {
  console.log(`Triggering agent scrape for ${competitor.name}`);

  try {
    const agentUrl = `${supabaseUrl}/functions/v1/agent-scrape-competitor`;
    
    const response = await fetch(agentUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        competitorId: competitor.id,
        limit 
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Failed to trigger scrape for ${competitor.name}:`, response.status, errorText);
      return { 
        competitor: competitor.name,
        competitorId: competitor.id,
        jobStarted: false, 
        error: `HTTP ${response.status}: ${errorText.substring(0, 200)}` 
      };
    }

    const result = await response.json();
    
    // agent-scrape-competitor returns { success: true, jobId: ... } immediately
    console.log(`Job triggered for ${competitor.name}: jobId=${result.jobId}`);
    
    return {
      competitor: competitor.name,
      competitorId: competitor.id,
      jobStarted: result.success !== false,
      jobId: result.jobId,
      error: result.error,
    };
  } catch (error) {
    console.error(`Error triggering scrape for ${competitor.name}:`, error);
    return { 
      competitor: competitor.name,
      competitorId: competitor.id,
      jobStarted: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log('=== Scheduled Crawl Started (Fire-and-Forget Mode) ===');
  console.log('Time:', new Date().toISOString());

  try {
    // Verify this is a scheduled call (check for cron secret or service role)
    const authHeader = req.headers.get('Authorization');
    const cronSecret = Deno.env.get('CRON_SECRET');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    // Use exact string comparison for security - do NOT use .includes()
    const expectedServiceAuth = serviceRoleKey ? `Bearer ${serviceRoleKey}` : null;
    const expectedCronAuth = cronSecret ? `Bearer ${cronSecret}` : null;
    
    const isServiceRole = expectedServiceAuth && authHeader === expectedServiceAuth;
    const isValidCron = expectedCronAuth && authHeader === expectedCronAuth;
    
    // Only allow service role key or cron secret - NOT the publicly-known anon key
    if (!isServiceRole && !isValidCron) {
      console.log('Unauthorized scheduled crawl attempt - invalid or missing credentials');
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
    
    // Rate limit buffer: small delay between API calls to avoid overwhelming Firecrawl
    // This is NOT the old 180s delay - it's just 500ms to space out job triggers
    const rateLimitBufferMs = 500;

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

    if (competitors.length === 0) {
      console.log('No active competitors found');
      return new Response(
        JSON.stringify({ success: true, message: 'No active competitors to crawl', results: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${competitors.length} active competitors to trigger`);
    console.log(`Settings: ${maxProductsPerCompetitor} products/competitor, ${rateLimitBufferMs}ms rate limit buffer`);

    const results: TriggerResult[] = [];

    // Fire-and-forget loop: trigger all jobs rapidly
    // Each agent-scrape-competitor returns 202 immediately and processes in background
    for (let i = 0; i < competitors.length; i++) {
      const competitor = competitors[i];
      console.log(`[${i + 1}/${competitors.length}] Triggering ${competitor.name}...`);
      
      const result = await triggerAgentScrape(
        competitor,
        supabaseUrl,
        supabaseServiceKey,
        maxProductsPerCompetitor
      );

      results.push(result);

      // Small delay between triggers to avoid rate limiting (500ms, not 180s!)
      if (i < competitors.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, rateLimitBufferMs));
      }
    }

    // Update schedule last_run_at
    if (scheduleData) {
      await supabase
        .from('crawl_schedule')
        .update({ last_run_at: new Date().toISOString() })
        .eq('id', scheduleData.id);
    }

    const successCount = results.filter(r => r.jobStarted).length;
    const failCount = results.filter(r => !r.jobStarted).length;
    const elapsedMs = Date.now() - startTime;

    console.log('\n=== Scheduled Crawl Complete (Fire-and-Forget Mode) ===');
    console.log(`Jobs triggered: ${successCount}/${competitors.length} successful`);
    console.log(`Failed to trigger: ${failCount}`);
    console.log(`Total time: ${elapsedMs}ms`);
    console.log('Note: Actual scraping continues in background via EdgeRuntime.waitUntil()');

    return new Response(
      JSON.stringify({
        success: true,
        message: `Triggered ${successCount} crawl jobs in ${elapsedMs}ms. Processing continues in background.`,
        data: {
          competitorsTriggered: competitors.length,
          successCount,
          failCount,
          elapsedMs,
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
