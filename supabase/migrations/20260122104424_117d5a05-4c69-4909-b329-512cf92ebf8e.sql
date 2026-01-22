-- Create crawl_logs table to store detailed crawl events
CREATE TABLE public.crawl_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES public.crawl_jobs(id) ON DELETE CASCADE,
  competitor_id UUID REFERENCES public.competitors(id) ON DELETE CASCADE,
  log_type TEXT NOT NULL CHECK (log_type IN ('info', 'added', 'filtered', 'skipped', 'error')),
  message TEXT NOT NULL,
  product_name TEXT,
  product_url TEXT,
  product_price TEXT,
  filter_reason TEXT,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX idx_crawl_logs_job_id ON public.crawl_logs(job_id);
CREATE INDEX idx_crawl_logs_competitor_id ON public.crawl_logs(competitor_id);
CREATE INDEX idx_crawl_logs_log_type ON public.crawl_logs(log_type);
CREATE INDEX idx_crawl_logs_created_at ON public.crawl_logs(created_at DESC);

-- Enable RLS
ALTER TABLE public.crawl_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Approved users can view crawl logs"
  ON public.crawl_logs FOR SELECT
  USING (is_approved(auth.uid()));

CREATE POLICY "Service role can insert crawl logs"
  ON public.crawl_logs FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service role can delete crawl logs"
  ON public.crawl_logs FOR DELETE
  USING (true);