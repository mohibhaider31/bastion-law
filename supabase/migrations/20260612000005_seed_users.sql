-- Fix existing auth.users rows so GoTrue can authenticate them.
-- Sets all required fields (instance_id, raw_app_meta_data, re-hashed password).
-- Uses UPDATE so existing FK references (invoices etc.) are preserved.

UPDATE auth.users SET
  instance_id       = '00000000-0000-0000-0000-000000000000',
  aud               = 'authenticated',
  role              = 'authenticated',
  encrypted_password = extensions.crypt('Bastion123!', extensions.gen_salt('bf')),
  email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
  raw_app_meta_data = '{"provider":"email","providers":["email"]}',
  raw_user_meta_data = '{"role":"owner","full_name":"Ahmed Raza","phone":"+92-21-111-222-333"}',
  confirmation_token = COALESCE(confirmation_token, ''),
  recovery_token     = COALESCE(recovery_token, ''),
  updated_at        = NOW()
WHERE email = 'ahmed@bastionlaw.pk';

UPDATE auth.users SET
  instance_id       = '00000000-0000-0000-0000-000000000000',
  aud               = 'authenticated',
  role              = 'authenticated',
  encrypted_password = extensions.crypt('Bastion123!', extensions.gen_salt('bf')),
  email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
  raw_app_meta_data = '{"provider":"email","providers":["email"]}',
  raw_user_meta_data = '{"role":"lawyer","full_name":"Zara Hussain","phone":"+92-300-111-2222"}',
  confirmation_token = COALESCE(confirmation_token, ''),
  recovery_token     = COALESCE(recovery_token, ''),
  updated_at        = NOW()
WHERE email = 'zara@bastionlaw.pk';

UPDATE auth.users SET
  instance_id       = '00000000-0000-0000-0000-000000000000',
  aud               = 'authenticated',
  role              = 'authenticated',
  encrypted_password = extensions.crypt('Bastion123!', extensions.gen_salt('bf')),
  email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
  raw_app_meta_data = '{"provider":"email","providers":["email"]}',
  raw_user_meta_data = '{"role":"lawyer","full_name":"Faisal Qureshi","phone":"+92-300-333-4444"}',
  confirmation_token = COALESCE(confirmation_token, ''),
  recovery_token     = COALESCE(recovery_token, ''),
  updated_at        = NOW()
WHERE email = 'faisal@bastionlaw.pk';

UPDATE auth.users SET
  instance_id       = '00000000-0000-0000-0000-000000000000',
  aud               = 'authenticated',
  role              = 'authenticated',
  encrypted_password = extensions.crypt('Bastion123!', extensions.gen_salt('bf')),
  email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
  raw_app_meta_data = '{"provider":"email","providers":["email"]}',
  raw_user_meta_data = '{"role":"client","full_name":"Tariq Enterprises Ltd","phone":"+92-21-555-6666"}',
  confirmation_token = COALESCE(confirmation_token, ''),
  recovery_token     = COALESCE(recovery_token, ''),
  updated_at        = NOW()
WHERE email = 'client1@example.pk';

UPDATE auth.users SET
  instance_id       = '00000000-0000-0000-0000-000000000000',
  aud               = 'authenticated',
  role              = 'authenticated',
  encrypted_password = extensions.crypt('Bastion123!', extensions.gen_salt('bf')),
  email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
  raw_app_meta_data = '{"provider":"email","providers":["email"]}',
  raw_user_meta_data = '{"role":"client","full_name":"Sana Mirza","phone":"+92-333-777-8888"}',
  confirmation_token = COALESCE(confirmation_token, ''),
  recovery_token     = COALESCE(recovery_token, ''),
  updated_at        = NOW()
WHERE email = 'client2@example.pk';

-- Ensure profiles have correct roles
INSERT INTO public.profiles (id, email, full_name, role, phone)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'ahmed@bastionlaw.pk',  'Ahmed Raza',           'owner',  '+92-21-111-222-333'),
  ('00000000-0000-0000-0000-000000000002', 'zara@bastionlaw.pk',   'Zara Hussain',          'lawyer', '+92-300-111-2222'),
  ('00000000-0000-0000-0000-000000000003', 'faisal@bastionlaw.pk', 'Faisal Qureshi',        'lawyer', '+92-300-333-4444'),
  ('00000000-0000-0000-0000-000000000004', 'client1@example.pk',  'Tariq Enterprises Ltd', 'client', '+92-21-555-6666'),
  ('00000000-0000-0000-0000-000000000005', 'client2@example.pk',  'Sana Mirza',            'client', '+92-333-777-8888')
ON CONFLICT (id) DO UPDATE SET
  role      = EXCLUDED.role,
  full_name = EXCLUDED.full_name,
  phone     = EXCLUDED.phone,
  email     = EXCLUDED.email;
