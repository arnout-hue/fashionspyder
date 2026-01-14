// Check status of agent-based crawl jobs
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  try {
    const { jobId, competitorId } = await req.json();
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    let query = supabase.from('crawl_jobs').select('*');

    if (jobId) {
      query = query.eq('id', jobId);
    } else if (competitorId) {
      query = query.eq('competitor_id', competitorId).order('created_at', { ascending: false }).limit(1);
    } else {
      return new Response(
        JSON.stringify({ success: false, error: 'jobId or competitorId required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data, error } = await query.single();

    if (error || !data) {
      return new Response(
        JSON.stringify({ success: false, error: 'Job not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          id: data.id,
          competitorId: data.competitor_id,
          firecrawlJobId: data.firecrawl_job_id,
          status: data.status,
          productsFound: data.products_found,
          productsInserted: data.products_inserted,
          errorMessage: data.error_message,
          createdAt: data.created_at,
          completedAt: data.completed_at,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[CheckJob] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
