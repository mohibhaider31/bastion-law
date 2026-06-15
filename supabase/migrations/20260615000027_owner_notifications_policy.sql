-- Allow owner to read and insert all notifications (for the notifications management page)
CREATE POLICY "owner can manage all notifications"
  ON notifications FOR ALL
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'owner')
  WITH CHECK ((SELECT role FROM profiles WHERE id = auth.uid()) = 'owner');
