-- ============================================================
-- BASTION LAW — CLIENT APP RESTRUCTURE
-- Multi-case navigation, per-case action items, chat attachments,
-- and a firm-level (non-case) support conversation.
-- ============================================================

-- ── 1. Chat attachments ──────────────────────────────────────
ALTER TABLE messages ADD COLUMN IF NOT EXISTS attachment_url     TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS attachment_name    TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS attachment_type    TEXT;     -- mime type
ALTER TABLE messages ADD COLUMN IF NOT EXISTS attachment_size_kb INTEGER;

-- ── 2. Firm (org) chat support ───────────────────────────────
-- A firm thread is a direct line between a client and the firm (owner),
-- independent of any case. Such messages have matter_id = NULL and
-- carry client_id to identify whose thread they belong to.
ALTER TABLE messages ALTER COLUMN matter_id DROP NOT NULL;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES profiles(id);

CREATE INDEX IF NOT EXISTS idx_messages_client_id ON messages(client_id);

-- Client can read their own firm thread (matter-less messages addressed to them)
CREATE POLICY "messages: client reads own firm thread"
  ON messages FOR SELECT
  USING (
    current_user_role() = 'client'
    AND matter_id IS NULL
    AND client_id = auth.uid()
  );

-- Client can send into their own firm thread
CREATE POLICY "messages: client sends firm thread"
  ON messages FOR INSERT
  WITH CHECK (
    current_user_role() = 'client'
    AND matter_id IS NULL
    AND client_id = auth.uid()
    AND sender_id = auth.uid()
  );
-- (Owners already have full access to messages via the existing owner policy.)

-- ── 3. Action items (tasks) ──────────────────────────────────
-- Lawyers and owners push action items at clients (and at each other).
-- type links the action to its purpose; related_* point at the doc/invoice.
CREATE TABLE tasks (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  matter_id           UUID REFERENCES matters(id) ON DELETE CASCADE,   -- NULL = firm-level action
  client_id           UUID NOT NULL REFERENCES profiles(id),
  created_by          UUID REFERENCES profiles(id),
  assigned_to         TEXT NOT NULL DEFAULT 'client' CHECK (assigned_to IN ('client', 'lawyer')),
  type                TEXT NOT NULL DEFAULT 'general' CHECK (type IN ('document', 'payment', 'signature', 'review', 'meeting', 'general')),
  title               TEXT NOT NULL,
  description         TEXT,
  status              TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'done', 'cancelled')),
  priority            TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high')),
  due_date            DATE,
  related_document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
  related_invoice_id  UUID REFERENCES invoices(id) ON DELETE SET NULL,
  completed_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tasks_client_id ON tasks(client_id);
CREATE INDEX idx_tasks_matter_id ON tasks(matter_id);
CREATE INDEX idx_tasks_status    ON tasks(status);

CREATE TRIGGER trg_tasks_updated_at BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- Clients read action items addressed to them
CREATE POLICY "tasks: client reads own"
  ON tasks FOR SELECT
  USING (
    current_user_role() = 'client'
    AND client_id = auth.uid()
  );

-- Clients can update (complete) their own client-assigned actions
CREATE POLICY "tasks: client completes own"
  ON tasks FOR UPDATE
  USING (
    current_user_role() = 'client'
    AND client_id = auth.uid()
    AND assigned_to = 'client'
  );

-- Lawyers manage action items on matters they're assigned to
CREATE POLICY "tasks: lawyer on assigned matter"
  ON tasks FOR ALL
  USING (
    current_user_role() = 'lawyer'
    AND matter_id IS NOT NULL
    AND lawyer_on_matter(matter_id, auth.uid())
  );

-- Owners: full access (incl. firm-level / billing actions)
CREATE POLICY "tasks: owner full access"
  ON tasks FOR ALL
  USING (current_user_role() = 'owner');

-- ── 4. Realtime ──────────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE tasks;
