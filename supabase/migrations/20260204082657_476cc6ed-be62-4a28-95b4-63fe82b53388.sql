-- Create RPC function for accurate product counts (bypasses row limit)
CREATE OR REPLACE FUNCTION get_product_counts(filter_competitor text DEFAULT NULL)
RETURNS TABLE (
  pending_count bigint,
  positive_count bigint,
  negative_count bigint,
  trash_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*) FILTER (WHERE status = 'pending') AS pending_count,
    COUNT(*) FILTER (WHERE status = 'positive') AS positive_count,
    COUNT(*) FILTER (WHERE status = 'negative') AS negative_count,
    COUNT(*) FILTER (WHERE status = 'trash') AS trash_count
  FROM products
  WHERE filter_competitor IS NULL 
     OR filter_competitor = 'All' 
     OR competitor = filter_competitor;
END;
$$;