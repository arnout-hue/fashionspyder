-- Drop existing overly permissive RLS policies for products table
DROP POLICY IF EXISTS "Allow public delete on products" ON public.products;
DROP POLICY IF EXISTS "Allow public insert on products" ON public.products;
DROP POLICY IF EXISTS "Allow public read on products" ON public.products;
DROP POLICY IF EXISTS "Allow public update on products" ON public.products;

-- Drop existing overly permissive RLS policies for suppliers table
DROP POLICY IF EXISTS "Allow public delete on suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Allow public insert on suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Allow public read on suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Allow public update on suppliers" ON public.suppliers;

-- Drop existing overly permissive RLS policies for competitors table
DROP POLICY IF EXISTS "Allow public delete access" ON public.competitors;
DROP POLICY IF EXISTS "Allow public insert access" ON public.competitors;
DROP POLICY IF EXISTS "Allow public read access" ON public.competitors;
DROP POLICY IF EXISTS "Allow public update access" ON public.competitors;

-- Create new RLS policies for products table - authenticated users only
CREATE POLICY "Authenticated users can read products" 
ON public.products 
FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert products" 
ON public.products 
FOR INSERT 
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update products" 
ON public.products 
FOR UPDATE 
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete products" 
ON public.products 
FOR DELETE 
TO authenticated
USING (true);

-- Create new RLS policies for suppliers table - authenticated users only
CREATE POLICY "Authenticated users can read suppliers" 
ON public.suppliers 
FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert suppliers" 
ON public.suppliers 
FOR INSERT 
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update suppliers" 
ON public.suppliers 
FOR UPDATE 
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete suppliers" 
ON public.suppliers 
FOR DELETE 
TO authenticated
USING (true);

-- Create new RLS policies for competitors table - authenticated users only
CREATE POLICY "Authenticated users can read competitors" 
ON public.competitors 
FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert competitors" 
ON public.competitors 
FOR INSERT 
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update competitors" 
ON public.competitors 
FOR UPDATE 
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete competitors" 
ON public.competitors 
FOR DELETE 
TO authenticated
USING (true);

-- Also allow service role to access tables (for edge functions)
CREATE POLICY "Service role can read products" 
ON public.products 
FOR SELECT 
TO service_role
USING (true);

CREATE POLICY "Service role can insert products" 
ON public.products 
FOR INSERT 
TO service_role
WITH CHECK (true);

CREATE POLICY "Service role can update products" 
ON public.products 
FOR UPDATE 
TO service_role
USING (true);

CREATE POLICY "Service role can delete products" 
ON public.products 
FOR DELETE 
TO service_role
USING (true);

CREATE POLICY "Service role can read competitors" 
ON public.competitors 
FOR SELECT 
TO service_role
USING (true);

CREATE POLICY "Service role can update competitors" 
ON public.competitors 
FOR UPDATE 
TO service_role
USING (true);