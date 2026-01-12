-- Bootstrap first admin user
-- Create profile if not exists and mark as approved
INSERT INTO public.profiles (id, email, full_name, is_approved, approved_at)
SELECT id, email, COALESCE(raw_user_meta_data->>'full_name', split_part(email, '@', 1)), true, now()
FROM auth.users
WHERE email = 'arnout@fashionmusthaves.nl'
ON CONFLICT (id) DO UPDATE SET 
  is_approved = true,
  approved_at = now();

-- Grant admin role
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'
FROM auth.users
WHERE email = 'arnout@fashionmusthaves.nl'
ON CONFLICT (user_id, role) DO NOTHING;

-- Also grant editor role for full access
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'editor'
FROM auth.users
WHERE email = 'arnout@fashionmusthaves.nl'
ON CONFLICT (user_id, role) DO NOTHING;