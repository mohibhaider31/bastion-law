-- Add hourly billing rate to lawyer profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS hourly_rate_pkr NUMERIC(10,2);

-- Seed default rates for existing lawyer seed data
UPDATE profiles SET hourly_rate_pkr = 25000 WHERE email = 'ahmed@bastionlaw.pk';
UPDATE profiles SET hourly_rate_pkr = 20000 WHERE email = 'zara@bastionlaw.pk';
