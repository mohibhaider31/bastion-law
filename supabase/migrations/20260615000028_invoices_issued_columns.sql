-- Add issued_by and issued_at columns to invoices
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS issued_by  uuid REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS issued_at  timestamptz NOT NULL DEFAULT now();

-- Back-fill issued_at from created_at for existing rows
UPDATE invoices SET issued_at = created_at WHERE issued_at = now();
