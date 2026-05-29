INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role
FROM auth.users
WHERE lower(email) = lower('Robert.stutzman.01@outlook.com')
ON CONFLICT (user_id, role) DO NOTHING;