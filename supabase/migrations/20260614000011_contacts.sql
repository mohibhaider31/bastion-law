-- Contacts: opposing counsel, judges, witnesses, experts linked to matters
CREATE TABLE IF NOT EXISTS contacts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  matter_id   uuid NOT NULL REFERENCES matters(id) ON DELETE CASCADE,
  name        text NOT NULL,
  role        text NOT NULL CHECK (role IN ('opposing_counsel', 'judge', 'witness', 'expert', 'other')),
  firm        text,
  email       text,
  phone       text,
  notes       text,
  added_by    uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

-- Lawyers can manage contacts for matters they're assigned to
CREATE POLICY "lawyers manage contacts"
  ON contacts FOR ALL
  USING (lawyer_on_matter(contacts.matter_id, auth.uid()));

-- Clients can view contacts for their own matters
CREATE POLICY "clients view their matter contacts"
  ON contacts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM matters m
      WHERE m.id = contacts.matter_id AND m.client_id = auth.uid()
    )
  );

-- Owner (service role) can do anything — covered by service role bypass
