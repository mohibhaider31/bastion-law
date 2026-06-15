-- Add rejected and signed to document status constraint
ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_status_check;
ALTER TABLE documents ADD CONSTRAINT documents_status_check
  CHECK (status IN ('requested', 'uploading', 'under_review', 'verified', 'uploaded', 'rejected', 'signed'));
