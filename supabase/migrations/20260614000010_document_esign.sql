-- E-signature fields on documents
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS signed_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS signed_by    UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS signed_name  TEXT;

-- Extend status to include 'signed'
ALTER TABLE documents
  DROP CONSTRAINT IF EXISTS documents_status_check;

ALTER TABLE documents
  ADD CONSTRAINT documents_status_check
  CHECK (status IN ('requested', 'uploading', 'under_review', 'verified', 'rejected', 'signed'));
