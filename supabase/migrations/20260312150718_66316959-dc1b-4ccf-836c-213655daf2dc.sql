
-- Feature 6: Smart Duplicate Detection RPC
CREATE OR REPLACE FUNCTION get_duplicate_products(min_competitors integer DEFAULT 2, max_results integer DEFAULT 100)
RETURNS TABLE (
  normalized_name text,
  competitor_count bigint,
  product_count bigint,
  competitors text[],
  product_ids uuid[],
  product_names text[],
  prices numeric[],
  image_urls text[],
  product_urls text[]
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    lower(trim(regexp_replace(p.name, '\s+', ' ', 'g'))) AS normalized_name,
    COUNT(DISTINCT p.competitor)::bigint AS competitor_count,
    COUNT(*)::bigint AS product_count,
    array_agg(DISTINCT p.competitor) AS competitors,
    array_agg(p.id ORDER BY p.competitor) AS product_ids,
    array_agg(p.name ORDER BY p.competitor) AS product_names,
    array_agg(p.price ORDER BY p.competitor) AS prices,
    array_agg(p.image_url ORDER BY p.competitor) AS image_urls,
    array_agg(p.product_url ORDER BY p.competitor) AS product_urls
  FROM products p
  WHERE p.status IN ('pending', 'positive')
  GROUP BY lower(trim(regexp_replace(p.name, '\s+', ' ', 'g')))
  HAVING COUNT(DISTINCT p.competitor) >= min_competitors
  ORDER BY COUNT(DISTINCT p.competitor) DESC, COUNT(*) DESC
  LIMIT max_results;
END;
$$;

-- Feature 8: Product Comments table
CREATE TABLE public.product_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  user_id uuid NOT NULL,
  user_email text,
  content text NOT NULL,
  mentioned_user_ids uuid[] DEFAULT '{}',
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.product_comments ENABLE ROW LEVEL SECURITY;

-- RLS: Approved users can read comments
CREATE POLICY "Approved users can read comments"
ON public.product_comments FOR SELECT
TO authenticated
USING (is_approved(auth.uid()));

-- RLS: Editors can insert comments
CREATE POLICY "Editors can insert comments"
ON public.product_comments FOR INSERT
TO authenticated
WITH CHECK (
  is_approved(auth.uid()) 
  AND (has_role(auth.uid(), 'editor') OR has_role(auth.uid(), 'admin'))
  AND user_id = auth.uid()
);

-- RLS: Users can delete own comments, admins can delete any
CREATE POLICY "Users can delete own comments"
ON public.product_comments FOR DELETE
TO authenticated
USING (user_id = auth.uid() OR is_admin());

-- Feature 9: Reports table
CREATE TABLE public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_type text NOT NULL DEFAULT 'weekly',
  period_start timestamp with time zone NOT NULL,
  period_end timestamp with time zone NOT NULL,
  data jsonb NOT NULL DEFAULT '{}',
  created_at timestamp with time zone DEFAULT now(),
  created_by uuid
);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- RLS: Approved users can view reports
CREATE POLICY "Approved users can view reports"
ON public.reports FOR SELECT
TO authenticated
USING (is_approved(auth.uid()));

-- RLS: Editors can create reports
CREATE POLICY "Editors can create reports"
ON public.reports FOR INSERT
TO authenticated
WITH CHECK (
  is_approved(auth.uid()) 
  AND (has_role(auth.uid(), 'editor') OR has_role(auth.uid(), 'admin'))
);

-- RLS: Admins can delete reports
CREATE POLICY "Admins can delete reports"
ON public.reports FOR DELETE
TO authenticated
USING (is_admin());

-- Feature 9: Weekly summary RPC
CREATE OR REPLACE FUNCTION get_weekly_summary(days integer DEFAULT 7)
RETURNS TABLE (
  total_new_products bigint,
  positive_count bigint,
  negative_count bigint,
  pending_count bigint,
  win_rate numeric,
  top_competitors jsonb,
  daily_breakdown jsonb
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  WITH period_products AS (
    SELECT * FROM products WHERE created_at > now() - (days || ' days')::interval
  ),
  competitor_stats AS (
    SELECT 
      p.competitor,
      count(*) as total,
      count(*) filter (where p.status = 'positive') as pos,
      count(*) filter (where p.status = 'negative') as neg
    FROM period_products p
    GROUP BY p.competitor
    ORDER BY total DESC
    LIMIT 10
  ),
  daily AS (
    SELECT 
      date(p.created_at) as day,
      count(*) as products_added,
      count(*) filter (where p.status = 'positive') as positives
    FROM period_products p
    GROUP BY date(p.created_at)
    ORDER BY day
  )
  SELECT
    (SELECT count(*) FROM period_products)::bigint,
    (SELECT count(*) FROM period_products WHERE status = 'positive')::bigint,
    (SELECT count(*) FROM period_products WHERE status = 'negative')::bigint,
    (SELECT count(*) FROM period_products WHERE status = 'pending')::bigint,
    CASE 
      WHEN (SELECT count(*) FROM period_products WHERE status IN ('positive','negative')) > 0 
      THEN round((SELECT count(*) FROM period_products WHERE status = 'positive')::numeric / 
                  (SELECT count(*) FROM period_products WHERE status IN ('positive','negative'))::numeric * 100, 1)
      ELSE 0 
    END,
    (SELECT coalesce(jsonb_agg(jsonb_build_object('competitor', cs.competitor, 'total', cs.total, 'positive', cs.pos, 'negative', cs.neg)), '[]'::jsonb) FROM competitor_stats cs),
    (SELECT coalesce(jsonb_agg(jsonb_build_object('date', d.day, 'products_added', d.products_added, 'positives', d.positives)), '[]'::jsonb) FROM daily d);
END;
$$;
