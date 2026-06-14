-- Disbursements / expenses logged against matters
CREATE TABLE IF NOT EXISTS expenses (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  matter_id     uuid NOT NULL REFERENCES matters(id) ON DELETE CASCADE,
  logged_by     uuid REFERENCES profiles(id) ON DELETE SET NULL,
  category      text NOT NULL CHECK (category IN ('filing_fee', 'courier', 'travel', 'printing', 'expert_fee', 'court_fee', 'miscellaneous')),
  description   text NOT NULL,
  amount_pkr    bigint NOT NULL CHECK (amount_pkr > 0),
  receipt_url   text,
  expense_date  date NOT NULL DEFAULT CURRENT_DATE,
  billable      boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

-- Lawyers can manage expenses on their matters
CREATE POLICY "lawyers manage expenses"
  ON expenses FOR ALL
  USING (lawyer_on_matter(expenses.matter_id, auth.uid()));

-- Clients can view billable expenses on their matters
CREATE POLICY "clients view billable expenses"
  ON expenses FOR SELECT
  USING (
    billable = true AND
    EXISTS (
      SELECT 1 FROM matters m
      WHERE m.id = expenses.matter_id AND m.client_id = auth.uid()
    )
  );
