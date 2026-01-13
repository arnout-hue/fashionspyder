-- Feature 11: Activity Log/Audit Trail
CREATE TABLE public.activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  user_email TEXT,
  action TEXT NOT NULL,
  action_category TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  entity_name TEXT,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for fast queries
CREATE INDEX idx_activity_log_created_at ON activity_log(created_at DESC);
CREATE INDEX idx_activity_log_user_id ON activity_log(user_id);
CREATE INDEX idx_activity_log_action_category ON activity_log(action_category);
CREATE INDEX idx_activity_log_entity ON activity_log(entity_type, entity_id);

-- RLS policies
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Approved users can view activity log"
  ON activity_log FOR SELECT
  USING (is_approved(auth.uid()));

CREATE POLICY "Authenticated users can insert activity log"
  ON activity_log FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Feature 6: Scheduled Crawl Automation
CREATE TABLE public.crawl_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL DEFAULT 'Nightly Crawl',
  cron_expression TEXT NOT NULL DEFAULT '0 3 * * *',
  is_enabled BOOLEAN DEFAULT true,
  max_products_per_competitor INTEGER DEFAULT 25,
  delay_between_competitors_seconds INTEGER DEFAULT 180,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Insert default schedule
INSERT INTO public.crawl_schedule (name, cron_expression, is_enabled)
VALUES ('Nightly Crawl', '0 3 * * *', true);

-- RLS policies for crawl_schedule
ALTER TABLE crawl_schedule ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Approved users can view schedule"
  ON crawl_schedule FOR SELECT
  USING (is_approved(auth.uid()));

CREATE POLICY "Admins can update schedule"
  ON crawl_schedule FOR UPDATE
  USING (is_admin());

-- Feature 7: Product Collections
CREATE TABLE public.collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#6366f1',
  icon TEXT DEFAULT 'folder',
  created_by UUID,
  is_shared BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.product_collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  collection_id UUID REFERENCES collections(id) ON DELETE CASCADE,
  added_by UUID,
  added_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(product_id, collection_id)
);

-- RLS policies for collections
ALTER TABLE collections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Approved users can view shared collections"
  ON collections FOR SELECT
  USING (is_approved(auth.uid()) AND (is_shared = true OR created_by = auth.uid()));

CREATE POLICY "Editors can create collections"
  ON collections FOR INSERT
  WITH CHECK (is_approved(auth.uid()) AND (has_role(auth.uid(), 'editor'::app_role) OR has_role(auth.uid(), 'admin'::app_role)));

CREATE POLICY "Owners and admins can update collections"
  ON collections FOR UPDATE
  USING (created_by = auth.uid() OR is_admin());

CREATE POLICY "Owners and admins can delete collections"
  ON collections FOR DELETE
  USING (created_by = auth.uid() OR is_admin());

-- RLS policies for product_collections
ALTER TABLE product_collections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Approved users can view product collections"
  ON product_collections FOR SELECT
  USING (is_approved(auth.uid()));

CREATE POLICY "Editors can insert product collections"
  ON product_collections FOR INSERT
  WITH CHECK (is_approved(auth.uid()) AND (has_role(auth.uid(), 'editor'::app_role) OR has_role(auth.uid(), 'admin'::app_role)));

CREATE POLICY "Editors can delete product collections"
  ON product_collections FOR DELETE
  USING (is_approved(auth.uid()) AND (has_role(auth.uid(), 'editor'::app_role) OR has_role(auth.uid(), 'admin'::app_role)));

-- Add trigger for updated_at on collections
CREATE TRIGGER update_collections_updated_at
  BEFORE UPDATE ON public.collections
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add trigger for updated_at on crawl_schedule
CREATE TRIGGER update_crawl_schedule_updated_at
  BEFORE UPDATE ON public.crawl_schedule
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();