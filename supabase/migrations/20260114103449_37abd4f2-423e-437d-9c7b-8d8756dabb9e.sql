-- Create crawl_jobs table for tracking async agent scraping jobs
CREATE TABLE public.crawl_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competitor_id UUID REFERENCES public.competitors(id) ON DELETE CASCADE,
  firecrawl_job_id TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
  products_found INTEGER DEFAULT 0,
  products_inserted INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE public.crawl_jobs ENABLE ROW LEVEL SECURITY;

-- RLS policies - allow all authenticated users to manage crawl jobs
CREATE POLICY "Authenticated users can view crawl jobs"
  ON public.crawl_jobs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create crawl jobs"
  ON public.crawl_jobs FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update crawl jobs"
  ON public.crawl_jobs FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete crawl jobs"
  ON public.crawl_jobs FOR DELETE
  TO authenticated
  USING (true);

-- Add trigger for updated_at
CREATE TRIGGER update_crawl_jobs_updated_at
  BEFORE UPDATE ON public.crawl_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add index for faster lookups
CREATE INDEX idx_crawl_jobs_competitor_id ON public.crawl_jobs(competitor_id);
CREATE INDEX idx_crawl_jobs_status ON public.crawl_jobs(status);
CREATE INDEX idx_crawl_jobs_firecrawl_job_id ON public.crawl_jobs(firecrawl_job_id);