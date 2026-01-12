-- Phase 1: Create Role Enum
CREATE TYPE public.app_role AS ENUM ('admin', 'editor', 'viewer');

-- Phase 2: Create Profiles Table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  is_approved BOOLEAN DEFAULT false,
  approved_by UUID REFERENCES public.profiles(id),
  approved_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Phase 3: Create User Roles Table (separate for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  granted_by UUID REFERENCES public.profiles(id),
  granted_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Phase 4: Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Phase 5: Security Definer Functions (prevent RLS recursion)

-- Check if user has specific role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Check if user is approved
CREATE OR REPLACE FUNCTION public.is_approved(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_approved FROM public.profiles WHERE id = _user_id),
    false
  )
$$;

-- Check if current user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'admin')
$$;

-- Phase 6: Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Phase 7: Updated timestamp trigger for profiles
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Phase 8: RLS Policies for Profiles

-- Users can read their own profile
CREATE POLICY "Users can read own profile" ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid());

-- Admins can read all profiles
CREATE POLICY "Admins can read all profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (public.is_admin());

-- Users can update their own profile (name, avatar only)
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Admins can update any profile (for approval)
CREATE POLICY "Admins can update all profiles" ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.is_admin());

-- Phase 9: RLS Policies for User Roles

-- Users can read their own roles
CREATE POLICY "Users can read own roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Admins can read all roles
CREATE POLICY "Admins can read all roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (public.is_admin());

-- Only admins can insert roles
CREATE POLICY "Admins can insert roles" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

-- Only admins can update roles
CREATE POLICY "Admins can update roles" ON public.user_roles
  FOR UPDATE TO authenticated
  USING (public.is_admin());

-- Only admins can delete roles
CREATE POLICY "Admins can delete roles" ON public.user_roles
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- Phase 10: Update existing table policies to require approval

-- Products: Drop existing policies and create new ones
DROP POLICY IF EXISTS "Authenticated users can read products" ON public.products;
DROP POLICY IF EXISTS "Authenticated users can insert products" ON public.products;
DROP POLICY IF EXISTS "Authenticated users can update products" ON public.products;
DROP POLICY IF EXISTS "Authenticated users can delete products" ON public.products;

CREATE POLICY "Approved users can read products" ON public.products
  FOR SELECT TO authenticated
  USING (public.is_approved(auth.uid()));

CREATE POLICY "Editors can insert products" ON public.products
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_approved(auth.uid()) 
    AND (public.has_role(auth.uid(), 'editor') OR public.has_role(auth.uid(), 'admin'))
  );

CREATE POLICY "Editors can update products" ON public.products
  FOR UPDATE TO authenticated
  USING (
    public.is_approved(auth.uid()) 
    AND (public.has_role(auth.uid(), 'editor') OR public.has_role(auth.uid(), 'admin'))
  );

CREATE POLICY "Editors can delete products" ON public.products
  FOR DELETE TO authenticated
  USING (
    public.is_approved(auth.uid()) 
    AND (public.has_role(auth.uid(), 'editor') OR public.has_role(auth.uid(), 'admin'))
  );

-- Suppliers: Update policies
DROP POLICY IF EXISTS "Authenticated users can read suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Authenticated users can insert suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Authenticated users can update suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Authenticated users can delete suppliers" ON public.suppliers;

CREATE POLICY "Approved users can read suppliers" ON public.suppliers
  FOR SELECT TO authenticated
  USING (public.is_approved(auth.uid()));

CREATE POLICY "Editors can insert suppliers" ON public.suppliers
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_approved(auth.uid()) 
    AND (public.has_role(auth.uid(), 'editor') OR public.has_role(auth.uid(), 'admin'))
  );

CREATE POLICY "Editors can update suppliers" ON public.suppliers
  FOR UPDATE TO authenticated
  USING (
    public.is_approved(auth.uid()) 
    AND (public.has_role(auth.uid(), 'editor') OR public.has_role(auth.uid(), 'admin'))
  );

CREATE POLICY "Editors can delete suppliers" ON public.suppliers
  FOR DELETE TO authenticated
  USING (
    public.is_approved(auth.uid()) 
    AND (public.has_role(auth.uid(), 'editor') OR public.has_role(auth.uid(), 'admin'))
  );

-- Colleagues: Update policies
DROP POLICY IF EXISTS "Authenticated users can read colleagues" ON public.colleagues;
DROP POLICY IF EXISTS "Authenticated users can insert colleagues" ON public.colleagues;
DROP POLICY IF EXISTS "Authenticated users can update colleagues" ON public.colleagues;
DROP POLICY IF EXISTS "Authenticated users can delete colleagues" ON public.colleagues;

CREATE POLICY "Approved users can read colleagues" ON public.colleagues
  FOR SELECT TO authenticated
  USING (public.is_approved(auth.uid()));

CREATE POLICY "Editors can insert colleagues" ON public.colleagues
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_approved(auth.uid()) 
    AND (public.has_role(auth.uid(), 'editor') OR public.has_role(auth.uid(), 'admin'))
  );

CREATE POLICY "Editors can update colleagues" ON public.colleagues
  FOR UPDATE TO authenticated
  USING (
    public.is_approved(auth.uid()) 
    AND (public.has_role(auth.uid(), 'editor') OR public.has_role(auth.uid(), 'admin'))
  );

CREATE POLICY "Editors can delete colleagues" ON public.colleagues
  FOR DELETE TO authenticated
  USING (
    public.is_approved(auth.uid()) 
    AND (public.has_role(auth.uid(), 'editor') OR public.has_role(auth.uid(), 'admin'))
  );

-- Competitors: Update policies
DROP POLICY IF EXISTS "Authenticated users can read competitors" ON public.competitors;
DROP POLICY IF EXISTS "Authenticated users can insert competitors" ON public.competitors;
DROP POLICY IF EXISTS "Authenticated users can update competitors" ON public.competitors;
DROP POLICY IF EXISTS "Authenticated users can delete competitors" ON public.competitors;

CREATE POLICY "Approved users can read competitors" ON public.competitors
  FOR SELECT TO authenticated
  USING (public.is_approved(auth.uid()));

CREATE POLICY "Editors can insert competitors" ON public.competitors
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_approved(auth.uid()) 
    AND (public.has_role(auth.uid(), 'editor') OR public.has_role(auth.uid(), 'admin'))
  );

CREATE POLICY "Editors can update competitors" ON public.competitors
  FOR UPDATE TO authenticated
  USING (
    public.is_approved(auth.uid()) 
    AND (public.has_role(auth.uid(), 'editor') OR public.has_role(auth.uid(), 'admin'))
  );

CREATE POLICY "Editors can delete competitors" ON public.competitors
  FOR DELETE TO authenticated
  USING (
    public.is_approved(auth.uid()) 
    AND (public.has_role(auth.uid(), 'editor') OR public.has_role(auth.uid(), 'admin'))
  );

-- Crawl History: Update policies
DROP POLICY IF EXISTS "Authenticated users can view crawl history" ON public.crawl_history;
DROP POLICY IF EXISTS "Authenticated users can insert crawl history" ON public.crawl_history;

CREATE POLICY "Approved users can view crawl history" ON public.crawl_history
  FOR SELECT TO authenticated
  USING (public.is_approved(auth.uid()));

CREATE POLICY "Editors can insert crawl history" ON public.crawl_history
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_approved(auth.uid()) 
    AND (public.has_role(auth.uid(), 'editor') OR public.has_role(auth.uid(), 'admin'))
  );