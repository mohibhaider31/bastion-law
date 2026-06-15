-- Allow owner to read all expenses and time entries for reports
CREATE POLICY "owner can read all expenses"
  ON expenses FOR SELECT
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'owner');

CREATE POLICY "owner can read all time entries"
  ON time_entries FOR SELECT
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'owner');
