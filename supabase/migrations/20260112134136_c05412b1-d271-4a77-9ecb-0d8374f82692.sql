-- Create competitors table
CREATE TABLE public.competitors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  logo_url TEXT,
  scrape_url TEXT NOT NULL,
  notes TEXT,
  product_url_patterns TEXT[] DEFAULT '{}',
  excluded_categories TEXT[] DEFAULT ARRAY['accessories', 'bags', 'belts', 'earrings', 'jewelry', 'jewellery', 'sieraden', 'tassen', 'riemen', 'oorbellen', 'necklaces', 'bracelets', 'rings', 'watches', 'sunglasses', 'hats', 'scarves', 'shoes', 'boots', 'sneakers', 'sandals', 'heels'],
  is_active BOOLEAN DEFAULT true,
  last_crawled_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS (public read for now since no auth)
ALTER TABLE public.competitors ENABLE ROW LEVEL SECURITY;

-- Allow public read/write for now (no auth implemented)
CREATE POLICY "Allow public read access" ON public.competitors FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON public.competitors FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON public.competitors FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON public.competitors FOR DELETE USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_competitors_updated_at
  BEFORE UPDATE ON public.competitors
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert the competitors with their new arrivals URLs
INSERT INTO public.competitors (name, scrape_url, product_url_patterns) VALUES
  ('Olivia Kate', 'https://oliviakate.nl/collections/nieuw', ARRAY['/collections/', '/products/']),
  ('Most Wanted', 'https://most-wanted.com/collections/new', ARRAY['/collections/', '/products/']),
  ('Tess V', 'https://www.tessv.nl/new/', ARRAY['/product/', '/kleding/']),
  ('My Jewellery', 'https://www.my-jewellery.com/nl-nl/kleding/tops-t-shirts.html?sort=newest', ARRAY['/nl-nl/', '/producten/']),
  ('Loavies', 'https://www.loavies.com/nl/nieuw/?sort-by=Nieuw', ARRAY['/nl/', '.html']),
  ('Shoeby', 'https://www.shoeby.nl/dames', ARRAY['/dames/', '/product/']),
  ('Lola Liza', 'https://www.lolaliza.com/be-nl/kleding/1', ARRAY['/be-nl/', '/product/']),
  ('Pretty Wire', 'https://prettywire.fr/1106-nouveautes#googtrans(fr|nl)', ARRAY['/product/', '/nouveautes/']),
  ('Harper & Yve', 'https://www.harperandyve.com/shop/', ARRAY['/shop/', '/product/']),
  ('Les Jumelles', 'https://lesjumelles.be/nl/collections/newarrivals', ARRAY['/collections/', '/products/']),
  ('Loobe Shop', 'https://loobeshop.com/gb/4521-novedades', ARRAY['/novedades/', '/product/']),
  ('Most Wanted Luxury', 'https://www.mostwantedluxury.com/collections/nieuw', ARRAY['/collections/', '/products/']),
  ('Cotton Club', 'https://www.cottonclub.nl/nl-nl/shop/new-arrivals', ARRAY['/shop/', '/product/']),
  ('Memali', 'https://www.memali.nl/product-categorie/nieuw/', ARRAY['/product-categorie/', '/product/']),
  ('Lof Boutique', 'https://lofboutique.nl/product-categorie/kleding/', ARRAY['/product-categorie/', '/product/']),
  ('Hello Moon', 'https://www.hellomoon-shop.com/en/16-news', ARRAY['/news/', '/product/']),
  ('Lofty Manner', 'https://www.loftymanner.com/collections/dames?sort_by=created-descending&filter.v.availability=1', ARRAY['/collections/', '/products/']),
  ('Refined Department', 'https://refineddepartment.com/collections/all', ARRAY['/collections/', '/products/']);