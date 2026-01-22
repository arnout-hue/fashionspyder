-- 1. Get high-level counts and financial value without fetching rows
CREATE OR REPLACE FUNCTION get_dashboard_stats()
RETURNS TABLE (
  total_products bigint,
  pending_count bigint,
  positive_count bigint,
  negative_count bigint,
  trash_count bigint,
  positive_value numeric,
  pending_value numeric
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT 
    count(*) as total_products,
    count(*) filter (where status = 'pending') as pending_count,
    count(*) filter (where status = 'positive') as positive_count,
    count(*) filter (where status = 'negative') as negative_count,
    count(*) filter (where status = 'trash') as trash_count,
    coalesce(sum(price) filter (where status = 'positive'), 0) as positive_value,
    coalesce(sum(price) filter (where status = 'pending'), 0) as pending_value
  FROM products;
$$;

-- 2. Get breakdown by competitor with win rates
CREATE OR REPLACE FUNCTION get_competitor_stats()
RETURNS TABLE (
  competitor text,
  total bigint,
  pending bigint,
  positive bigint,
  negative bigint,
  total_value numeric,
  win_rate numeric
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT 
    competitor,
    count(*) as total,
    count(*) filter (where status = 'pending') as pending,
    count(*) filter (where status = 'positive') as positive,
    count(*) filter (where status = 'negative') as negative,
    coalesce(sum(price), 0) as total_value,
    CASE 
      WHEN count(*) filter (where status in ('positive', 'negative')) > 0 THEN 
        round((count(*) filter (where status = 'positive')::numeric / 
               count(*) filter (where status in ('positive', 'negative'))::numeric) * 100, 1)
      ELSE 0 
    END as win_rate
  FROM products
  GROUP BY competitor
  ORDER BY total DESC;
$$;

-- 3. Get sourcing history (works immediately based on created_at)
CREATE OR REPLACE FUNCTION get_sourcing_history(days int DEFAULT 30)
RETURNS TABLE (
  date date,
  products_added bigint,
  competitor text
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT 
    date(created_at) as date,
    count(*) as products_added,
    competitor
  FROM products
  WHERE created_at > now() - (days || ' days')::interval
  GROUP BY date(created_at), competitor
  ORDER BY date(created_at);
$$;

-- 4. Get crawl performance over time
CREATE OR REPLACE FUNCTION get_crawl_performance(days int DEFAULT 30)
RETURNS TABLE (
  date date,
  competitor_name text,
  total_urls_found bigint,
  product_urls_found bigint,
  new_products_scraped bigint
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT 
    date(ch.crawled_at) as date,
    c.name as competitor_name,
    sum(ch.total_urls_found)::bigint as total_urls_found,
    sum(ch.product_urls_found)::bigint as product_urls_found,
    sum(ch.new_products_scraped)::bigint as new_products_scraped
  FROM crawl_history ch
  JOIN competitors c ON ch.competitor_id = c.id
  WHERE ch.crawled_at > now() - (days || ' days')::interval
  GROUP BY date(ch.crawled_at), c.name
  ORDER BY date(ch.crawled_at);
$$;