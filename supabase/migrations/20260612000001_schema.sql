-- ============================================================
-- BASTION LAW — FULL SCHEMA
-- ============================================================

-- ── Extensions ──────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- for fuzzy name search

-- ── Profiles (extends auth.users) ───────────────────────────
CREATE TABLE profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role          TEXT NOT NULL CHECK (role IN ('client', 'lawyer', 'owner')),
  full_name     TEXT NOT NULL,
  email         TEXT NOT NULL,
  phone         TEXT,
  cnic          TEXT,           -- Pakistani National ID
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Matters (law cases) ──────────────────────────────────────
CREATE TABLE matters (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  matter_ref      TEXT UNIQUE NOT NULL,  -- e.g. "BST-2026-001"
  title           TEXT NOT NULL,
  type            TEXT NOT NULL CHECK (type IN ('corporate', 'civil', 'criminal', 'family', 'property', 'other')),
  stage           TEXT NOT NULL DEFAULT 'intake' CHECK (stage IN ('intake', 'documentation', 'filing', 'hearing', 'judgment', 'closed')),
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'on_hold', 'closed')),
  client_id       UUID NOT NULL REFERENCES profiles(id),
  lead_lawyer_id  UUID NOT NULL REFERENCES profiles(id),
  cause_no        TEXT,          -- Pakistan court e.g. "1247/2026"
  court           TEXT,
  confidentiality TEXT NOT NULL DEFAULT 'standard' CHECK (confidentiality IN ('standard', 'privileged', 'sensitive')),
  description     TEXT,
  opened_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at       TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Matter Team (many lawyers per matter) ────────────────────
CREATE TABLE matter_lawyers (
  matter_id   UUID NOT NULL REFERENCES matters(id) ON DELETE CASCADE,
  lawyer_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role        TEXT NOT NULL DEFAULT 'associate' CHECK (role IN ('lead', 'associate', 'paralegal')),
  added_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (matter_id, lawyer_id)
);

-- ── Documents ────────────────────────────────────────────────
CREATE TABLE documents (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  matter_id      UUID NOT NULL REFERENCES matters(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  category       TEXT NOT NULL CHECK (category IN ('corporate', 'contracts', 'court', 'identity', 'other')),
  status         TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'uploading', 'under_review', 'verified')),
  requested_by   UUID REFERENCES profiles(id),
  due_date       DATE,
  file_url       TEXT,
  file_name      TEXT,
  file_size_kb   INTEGER,
  storage_path   TEXT,          -- Supabase storage bucket path
  requires_esign BOOLEAN NOT NULL DEFAULT FALSE,
  signed_at      TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Messages ─────────────────────────────────────────────────
CREATE TABLE messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  matter_id   UUID NOT NULL REFERENCES matters(id) ON DELETE CASCADE,
  sender_id   UUID NOT NULL REFERENCES profiles(id),
  body        TEXT NOT NULL,
  is_system   BOOLEAN NOT NULL DEFAULT FALSE,
  read_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Events (hearings, deadlines, filings) ────────────────────
CREATE TABLE events (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  matter_id        UUID NOT NULL REFERENCES matters(id) ON DELETE CASCADE,
  created_by       UUID REFERENCES profiles(id),
  type             TEXT NOT NULL CHECK (type IN ('hearing', 'deadline', 'filing', 'meeting', 'other')),
  title            TEXT NOT NULL,
  description      TEXT,
  event_date       DATE NOT NULL,
  event_time       TIME,
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  location         TEXT,
  cause_no         TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Appointments (client-lawyer bookings) ────────────────────
CREATE TABLE appointments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  matter_id        UUID REFERENCES matters(id) ON DELETE SET NULL,
  client_id        UUID NOT NULL REFERENCES profiles(id),
  lawyer_id        UUID NOT NULL REFERENCES profiles(id),
  status           TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'rejected', 'cancelled', 'completed')),
  type             TEXT NOT NULL DEFAULT 'video' CHECK (type IN ('video', 'in_person')),
  proposed_at      TIMESTAMPTZ NOT NULL,
  confirmed_at     TIMESTAMPTZ,
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  location         TEXT,
  agenda           TEXT,
  proposed_by      UUID REFERENCES profiles(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Invoices (created by owners only) ────────────────────────
CREATE TABLE invoices (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_ref    TEXT UNIQUE NOT NULL,   -- e.g. "INV-2026-001"
  client_id      UUID NOT NULL REFERENCES profiles(id),
  matter_id      UUID REFERENCES matters(id) ON DELETE SET NULL,
  status         TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'outstanding', 'paid', 'overdue', 'cancelled')),
  amount_paisas  BIGINT NOT NULL,        -- PKR in paisas to avoid float
  due_date       DATE NOT NULL,
  paid_at        TIMESTAMPTZ,
  payment_method TEXT CHECK (payment_method IN ('jazzcash', 'easypaisa', 'bank_transfer')),
  notes          TEXT,
  created_by     UUID REFERENCES profiles(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Invoice Line Items ────────────────────────────────────────
CREATE TABLE invoice_items (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id     UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description    TEXT NOT NULL,
  quantity       NUMERIC(10,2) NOT NULL DEFAULT 1,
  unit_paisas    BIGINT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Time Entries (billable hours logged by lawyers) ──────────
CREATE TABLE time_entries (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  matter_id   UUID NOT NULL REFERENCES matters(id) ON DELETE CASCADE,
  lawyer_id   UUID NOT NULL REFERENCES profiles(id),
  description TEXT NOT NULL,
  hours       NUMERIC(5,2) NOT NULL,
  entry_date  DATE NOT NULL,
  billable    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Private Notes (internal, never visible to clients) ───────
CREATE TABLE private_notes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  matter_id   UUID NOT NULL REFERENCES matters(id) ON DELETE CASCADE,
  author_id   UUID NOT NULL REFERENCES profiles(id),
  body        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Audit Trail ───────────────────────────────────────────────
CREATE TABLE audit_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  matter_id   UUID REFERENCES matters(id) ON DELETE SET NULL,
  actor_id    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  actor_type  TEXT NOT NULL CHECK (actor_type IN ('client', 'lawyer', 'owner', 'system')),
  action      TEXT NOT NULL,
  metadata    JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Notifications ─────────────────────────────────────────────
CREATE TABLE notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type        TEXT NOT NULL CHECK (type IN (
    'document_requested', 'message', 'hearing_reminder',
    'case_update', 'appointment_confirmed', 'appointment_cancelled',
    'invoice_sent', 'sla_breach'
  )),
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  matter_id   UUID REFERENCES matters(id) ON DELETE SET NULL,
  read_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── SLA Config (per firm) ────────────────────────────────────
CREATE TABLE sla_configs (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  response_hours        INTEGER NOT NULL DEFAULT 2,
  escalation_hours      INTEGER NOT NULL DEFAULT 4,
  escalation_target_id  UUID REFERENCES profiles(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_matters_client_id ON matters(client_id);
CREATE INDEX idx_matters_lead_lawyer_id ON matters(lead_lawyer_id);
CREATE INDEX idx_matter_lawyers_lawyer_id ON matter_lawyers(lawyer_id);
CREATE INDEX idx_documents_matter_id ON documents(matter_id);
CREATE INDEX idx_documents_status ON documents(status);
CREATE INDEX idx_messages_matter_id ON messages(matter_id);
CREATE INDEX idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX idx_events_matter_id ON events(matter_id);
CREATE INDEX idx_events_event_date ON events(event_date);
CREATE INDEX idx_appointments_client_id ON appointments(client_id);
CREATE INDEX idx_appointments_lawyer_id ON appointments(lawyer_id);
CREATE INDEX idx_appointments_status ON appointments(status);
CREATE INDEX idx_invoices_client_id ON invoices(client_id);
CREATE INDEX idx_time_entries_matter_id ON time_entries(matter_id);
CREATE INDEX idx_private_notes_matter_id ON private_notes(matter_id);
CREATE INDEX idx_audit_logs_matter_id ON audit_logs(matter_id);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_read_at ON notifications(read_at);
CREATE INDEX idx_profiles_role ON profiles(role);

-- ============================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================

-- Auto-create profile when user signs up
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, role, full_name, email, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'role', 'client'),
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email,
    NEW.raw_user_meta_data->>'phone'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- updated_at auto-stamp
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_profiles_updated_at      BEFORE UPDATE ON profiles      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_matters_updated_at       BEFORE UPDATE ON matters       FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_documents_updated_at     BEFORE UPDATE ON documents     FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_events_updated_at        BEFORE UPDATE ON events        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_appointments_updated_at  BEFORE UPDATE ON appointments  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_invoices_updated_at      BEFORE UPDATE ON invoices      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_private_notes_updated_at BEFORE UPDATE ON private_notes FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_sla_configs_updated_at   BEFORE UPDATE ON sla_configs   FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Helper: get current user's role (used in RLS policies)
CREATE OR REPLACE FUNCTION current_user_role()
RETURNS TEXT AS $$
  SELECT role FROM profiles WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper: check if lawyer is on a matter's team
CREATE OR REPLACE FUNCTION lawyer_on_matter(p_matter_id UUID, p_lawyer_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM matters m
    WHERE m.id = p_matter_id
    AND (
      m.lead_lawyer_id = p_lawyer_id
      OR EXISTS (
        SELECT 1 FROM matter_lawyers ml
        WHERE ml.matter_id = p_matter_id AND ml.lawyer_id = p_lawyer_id
      )
    )
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;
