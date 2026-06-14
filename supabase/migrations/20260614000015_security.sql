-- ── 1. Append-only audit_logs ────────────────────────────────────────────────
-- Revoke UPDATE and DELETE from all roles — logs are immutable once written
REVOKE UPDATE, DELETE ON audit_logs FROM authenticated, anon;

-- Drop any RLS policies that might allow update/delete on audit_logs
DROP POLICY IF EXISTS "lawyers insert audit" ON audit_logs;
DROP POLICY IF EXISTS "users insert audit" ON audit_logs;

-- Only allow INSERT (users can insert their own entries); reads scoped to matter team
CREATE POLICY "insert own audit entries"
  ON audit_logs FOR INSERT
  WITH CHECK (actor_id = auth.uid());

CREATE POLICY "read audit logs by matter team"
  ON audit_logs FOR SELECT
  USING (
    lawyer_on_matter(matter_id, auth.uid())
    OR EXISTS (SELECT 1 FROM matters m WHERE m.id = matter_id AND m.client_id = auth.uid())
  );

-- ── 2. Rate limiting: max 30 messages per user per 60 seconds ─────────────────
CREATE OR REPLACE FUNCTION check_message_rate_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  recent_count int;
BEGIN
  SELECT COUNT(*) INTO recent_count
  FROM messages
  WHERE sender_id = NEW.sender_id
    AND created_at > NOW() - INTERVAL '60 seconds';

  IF recent_count >= 30 THEN
    RAISE EXCEPTION 'Rate limit exceeded: max 30 messages per minute';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_message_rate_limit ON messages;
CREATE TRIGGER trg_message_rate_limit
  BEFORE INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION check_message_rate_limit();

-- ── 3. Rate limiting: max 10 document uploads per user per minute ─────────────
CREATE OR REPLACE FUNCTION check_document_rate_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  recent_count int;
BEGIN
  SELECT COUNT(*) INTO recent_count
  FROM documents
  WHERE requested_by = NEW.requested_by
    AND created_at > NOW() - INTERVAL '60 seconds';

  IF recent_count >= 10 THEN
    RAISE EXCEPTION 'Rate limit exceeded: max 10 document requests per minute';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_document_rate_limit ON documents;
CREATE TRIGGER trg_document_rate_limit
  BEFORE INSERT ON documents
  FOR EACH ROW EXECUTE FUNCTION check_document_rate_limit();
