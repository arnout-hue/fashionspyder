-- Create crawl_history table to persist crawl statistics
CREATE TABLE public.crawl_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  competitor_id UUID NOT NULL REFERENCES public.competitors(id) ON DELETE CASCADE,
  crawled_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'error', 'partial')),
  total_urls_found INTEGER NOT NULL DEFAULT 0,
  product_urls_found INTEGER NOT NULL DEFAULT 0,
  new_products_scraped INTEGER NOT NULL DEFAULT 0,
  skipped_count INTEGER NOT NULL DEFAULT 0,
  errors_count INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.crawl_history ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read and write crawl history
CREATE POLICY "Authenticated users can view crawl history"
ON public.crawl_history
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert crawl history"
ON public.crawl_history
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Create index for faster queries
CREATE INDEX idx_crawl_history_competitor ON public.crawl_history(competitor_id);
CREATE INDEX idx_crawl_history_crawled_at ON public.crawl_history(crawled_at DESC);