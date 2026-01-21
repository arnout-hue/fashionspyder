-- Drop and recreate the products status check to include 'trash'
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_status_check;
ALTER TABLE public.products ADD CONSTRAINT products_status_check 
  CHECK (status IN ('pending', 'positive', 'negative', 'trash', 'requested'));

-- Drop and recreate the crawl_jobs status check to include 'processing'
ALTER TABLE public.crawl_jobs DROP CONSTRAINT IF EXISTS crawl_jobs_status_check;
ALTER TABLE public.crawl_jobs ADD CONSTRAINT crawl_jobs_status_check 
  CHECK (status IN ('pending', 'processing', 'completed', 'failed'));