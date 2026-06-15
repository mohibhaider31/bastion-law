-- Allow matters to be opened without a lawyer assigned (Lawyer TBA)
ALTER TABLE matters ALTER COLUMN lead_lawyer_id DROP NOT NULL;

-- Drop and recreate the index (nulls are fine in indexes)
DROP INDEX IF EXISTS idx_matters_lead_lawyer_id;
CREATE INDEX idx_matters_lead_lawyer_id ON matters(lead_lawyer_id) WHERE lead_lawyer_id IS NOT NULL;

-- View helper: unassigned matters for owner dashboard
CREATE OR REPLACE VIEW matters_tba AS
  SELECT m.id, m.matter_ref, m.title, m.type, m.stage, m.opened_at,
         p.full_name AS client_name, p.email AS client_email
  FROM matters m
  JOIN profiles p ON p.id = m.client_id
  WHERE m.lead_lawyer_id IS NULL
    AND m.status = 'active';
