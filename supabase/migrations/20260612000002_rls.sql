-- ============================================================
-- BASTION LAW — ROW LEVEL SECURITY POLICIES
-- ============================================================

-- Enable RLS on every table
ALTER TABLE profiles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE matters        ENABLE ROW LEVEL SECURITY;
ALTER TABLE matter_lawyers ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents      ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages       ENABLE ROW LEVEL SECURITY;
ALTER TABLE events         ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments   ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices       ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items  ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_entries   ENABLE ROW LEVEL SECURITY;
ALTER TABLE private_notes  ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs     ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications  ENABLE ROW LEVEL SECURITY;
ALTER TABLE sla_configs    ENABLE ROW LEVEL SECURITY;

-- ── PROFILES ─────────────────────────────────────────────────

-- Own profile (all roles)
CREATE POLICY "profiles: own read/update"
  ON profiles FOR ALL
  USING (id = auth.uid());

-- Lawyers can read client profiles on their matters
CREATE POLICY "profiles: lawyer reads matter clients"
  ON profiles FOR SELECT
  USING (
    current_user_role() = 'lawyer'
    AND role = 'client'
    AND EXISTS (
      SELECT 1 FROM matters m
      WHERE m.client_id = profiles.id
        AND lawyer_on_matter(m.id, auth.uid())
    )
  );

-- Lawyers can read other lawyers (for team display)
CREATE POLICY "profiles: lawyers read lawyers"
  ON profiles FOR SELECT
  USING (
    current_user_role() = 'lawyer'
    AND role = 'lawyer'
  );

-- Owners: full access to all profiles
CREATE POLICY "profiles: owner full access"
  ON profiles FOR ALL
  USING (current_user_role() = 'owner');

-- ── MATTERS ──────────────────────────────────────────────────

-- Clients see their own matters
CREATE POLICY "matters: client owns"
  ON matters FOR SELECT
  USING (
    current_user_role() = 'client'
    AND client_id = auth.uid()
  );

-- Lawyers see matters they're assigned to
CREATE POLICY "matters: lawyer assigned"
  ON matters FOR SELECT
  USING (
    current_user_role() = 'lawyer'
    AND lawyer_on_matter(id, auth.uid())
  );

-- Owners: full access
CREATE POLICY "matters: owner full access"
  ON matters FOR ALL
  USING (current_user_role() = 'owner');

-- Lawyers can update matters they're assigned to (stage, status)
CREATE POLICY "matters: lawyer update assigned"
  ON matters FOR UPDATE
  USING (
    current_user_role() = 'lawyer'
    AND lawyer_on_matter(id, auth.uid())
  );

-- ── MATTER_LAWYERS ────────────────────────────────────────────

CREATE POLICY "matter_lawyers: lawyer sees own"
  ON matter_lawyers FOR SELECT
  USING (
    current_user_role() IN ('lawyer', 'client')
    AND EXISTS (
      SELECT 1 FROM matters m WHERE m.id = matter_id
        AND (
          m.client_id = auth.uid()
          OR lawyer_on_matter(matter_id, auth.uid())
        )
    )
  );

CREATE POLICY "matter_lawyers: owner full access"
  ON matter_lawyers FOR ALL
  USING (current_user_role() = 'owner');

-- ── DOCUMENTS ────────────────────────────────────────────────

CREATE POLICY "documents: client on own matter"
  ON documents FOR SELECT
  USING (
    current_user_role() = 'client'
    AND EXISTS (
      SELECT 1 FROM matters m
      WHERE m.id = matter_id AND m.client_id = auth.uid()
    )
  );

CREATE POLICY "documents: client can upload"
  ON documents FOR UPDATE
  USING (
    current_user_role() = 'client'
    AND EXISTS (
      SELECT 1 FROM matters m
      WHERE m.id = matter_id AND m.client_id = auth.uid()
    )
    AND status IN ('requested', 'uploading')
  );

CREATE POLICY "documents: lawyer on assigned matter"
  ON documents FOR ALL
  USING (
    current_user_role() = 'lawyer'
    AND lawyer_on_matter(matter_id, auth.uid())
  );

CREATE POLICY "documents: owner full access"
  ON documents FOR ALL
  USING (current_user_role() = 'owner');

-- ── MESSAGES ─────────────────────────────────────────────────

CREATE POLICY "messages: client on own matter"
  ON messages FOR SELECT
  USING (
    current_user_role() = 'client'
    AND EXISTS (
      SELECT 1 FROM matters m
      WHERE m.id = matter_id AND m.client_id = auth.uid()
    )
  );

CREATE POLICY "messages: client can send"
  ON messages FOR INSERT
  WITH CHECK (
    current_user_role() = 'client'
    AND sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM matters m
      WHERE m.id = matter_id AND m.client_id = auth.uid()
    )
  );

CREATE POLICY "messages: lawyer on assigned matter"
  ON messages FOR ALL
  USING (
    current_user_role() = 'lawyer'
    AND lawyer_on_matter(matter_id, auth.uid())
  );

CREATE POLICY "messages: owner full access"
  ON messages FOR ALL
  USING (current_user_role() = 'owner');

-- ── EVENTS ───────────────────────────────────────────────────

CREATE POLICY "events: client on own matter"
  ON events FOR SELECT
  USING (
    current_user_role() = 'client'
    AND EXISTS (
      SELECT 1 FROM matters m
      WHERE m.id = matter_id AND m.client_id = auth.uid()
    )
  );

CREATE POLICY "events: lawyer on assigned matter"
  ON events FOR ALL
  USING (
    current_user_role() = 'lawyer'
    AND lawyer_on_matter(matter_id, auth.uid())
  );

CREATE POLICY "events: owner full access"
  ON events FOR ALL
  USING (current_user_role() = 'owner');

-- ── APPOINTMENTS ─────────────────────────────────────────────

CREATE POLICY "appointments: client owns"
  ON appointments FOR SELECT
  USING (
    current_user_role() = 'client'
    AND client_id = auth.uid()
  );

CREATE POLICY "appointments: client can book"
  ON appointments FOR INSERT
  WITH CHECK (
    current_user_role() = 'client'
    AND client_id = auth.uid()
  );

CREATE POLICY "appointments: client can cancel own"
  ON appointments FOR UPDATE
  USING (
    current_user_role() = 'client'
    AND client_id = auth.uid()
  );

CREATE POLICY "appointments: lawyer assigned"
  ON appointments FOR ALL
  USING (
    current_user_role() = 'lawyer'
    AND lawyer_id = auth.uid()
  );

CREATE POLICY "appointments: owner full access"
  ON appointments FOR ALL
  USING (current_user_role() = 'owner');

-- ── INVOICES ─────────────────────────────────────────────────

-- Clients can only read their own invoices (no write)
CREATE POLICY "invoices: client reads own"
  ON invoices FOR SELECT
  USING (
    current_user_role() = 'client'
    AND client_id = auth.uid()
    AND status NOT IN ('draft')  -- drafts not visible to client
  );

-- Lawyers cannot access invoices
-- Owners: full access
CREATE POLICY "invoices: owner full access"
  ON invoices FOR ALL
  USING (current_user_role() = 'owner');

-- ── INVOICE_ITEMS ─────────────────────────────────────────────

CREATE POLICY "invoice_items: client reads own"
  ON invoice_items FOR SELECT
  USING (
    current_user_role() = 'client'
    AND EXISTS (
      SELECT 1 FROM invoices i
      WHERE i.id = invoice_id
        AND i.client_id = auth.uid()
        AND i.status NOT IN ('draft')
    )
  );

CREATE POLICY "invoice_items: owner full access"
  ON invoice_items FOR ALL
  USING (current_user_role() = 'owner');

-- ── TIME_ENTRIES ──────────────────────────────────────────────

-- Lawyers can manage their own time entries
CREATE POLICY "time_entries: lawyer owns"
  ON time_entries FOR ALL
  USING (
    current_user_role() = 'lawyer'
    AND lawyer_id = auth.uid()
  );

-- Owners: full access
CREATE POLICY "time_entries: owner full access"
  ON time_entries FOR ALL
  USING (current_user_role() = 'owner');

-- ── PRIVATE_NOTES (never visible to clients) ──────────────────

CREATE POLICY "private_notes: lawyer on assigned matter"
  ON private_notes FOR ALL
  USING (
    current_user_role() = 'lawyer'
    AND lawyer_on_matter(matter_id, auth.uid())
  );

CREATE POLICY "private_notes: owner full access"
  ON private_notes FOR ALL
  USING (current_user_role() = 'owner');

-- ── AUDIT_LOGS ────────────────────────────────────────────────

-- Clients can read audit logs for their matters
CREATE POLICY "audit_logs: client on own matter"
  ON audit_logs FOR SELECT
  USING (
    current_user_role() = 'client'
    AND EXISTS (
      SELECT 1 FROM matters m
      WHERE m.id = matter_id AND m.client_id = auth.uid()
    )
  );

CREATE POLICY "audit_logs: lawyer on assigned matter"
  ON audit_logs FOR SELECT
  USING (
    current_user_role() = 'lawyer'
    AND lawyer_on_matter(matter_id, auth.uid())
  );

-- System/app can insert audit logs (service role bypasses RLS)
CREATE POLICY "audit_logs: owner full access"
  ON audit_logs FOR ALL
  USING (current_user_role() = 'owner');

-- ── NOTIFICATIONS ─────────────────────────────────────────────

-- Users only see their own notifications
CREATE POLICY "notifications: own"
  ON notifications FOR ALL
  USING (user_id = auth.uid());

-- ── SLA_CONFIGS ───────────────────────────────────────────────

-- Lawyers can read SLA config
CREATE POLICY "sla_configs: lawyer read"
  ON sla_configs FOR SELECT
  USING (current_user_role() IN ('lawyer', 'client'));

CREATE POLICY "sla_configs: owner full access"
  ON sla_configs FOR ALL
  USING (current_user_role() = 'owner');

-- ============================================================
-- REALTIME — enable for messages & notifications
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE appointments;
