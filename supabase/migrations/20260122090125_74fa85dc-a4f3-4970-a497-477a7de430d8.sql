-- 1. Fix crawl_jobs RLS Policies (Security)
-- Drop overly permissive policies on crawl_jobs
DROP POLICY IF EXISTS "Authenticated users can delete crawl jobs" ON public.crawl_jobs;
DROP POLICY IF EXISTS "Authenticated users can create crawl jobs" ON public.crawl_jobs;
DROP POLICY IF EXISTS "Authenticated users can view crawl jobs" ON public.crawl_jobs;
DROP POLICY IF EXISTS "Authenticated users can update crawl jobs" ON public.crawl_jobs;

-- Approved users can only read jobs
CREATE POLICY "Approved users can view crawl jobs" 
ON public.crawl_jobs FOR SELECT 
TO authenticated 
USING (is_approved(auth.uid()));

-- Editors can create jobs (for frontend-initiated crawls)
CREATE POLICY "Editors can create crawl jobs" 
ON public.crawl_jobs FOR INSERT 
TO authenticated 
WITH CHECK (is_approved(auth.uid()) AND (has_role(auth.uid(), 'editor'::app_role) OR has_role(auth.uid(), 'admin'::app_role)));

-- 2. Convert Price to Numeric
-- Clean and convert price from text to numeric
-- Handle various formats: €49.99, 49,99, $100, etc.
ALTER TABLE public.products 
ALTER COLUMN price TYPE numeric 
USING (
  CASE 
    WHEN price IS NULL OR price = '' THEN NULL
    ELSE REGEXP_REPLACE(
      REGEXP_REPLACE(price, '[^0-9.,]', '', 'g'),
      ',', '.', 'g'
    )::numeric
  END
);