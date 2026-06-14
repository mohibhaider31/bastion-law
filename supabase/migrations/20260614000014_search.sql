-- GIN indexes for full-text search
CREATE INDEX IF NOT EXISTS idx_messages_fts ON messages USING gin(to_tsvector('english', body));
CREATE INDEX IF NOT EXISTS idx_documents_fts ON documents USING gin(to_tsvector('english', name || ' ' || COALESCE(file_name, '') || ' ' || COALESCE(category, '')));
CREATE INDEX IF NOT EXISTS idx_tasks_fts ON tasks USING gin(to_tsvector('english', title || ' ' || COALESCE(description, '')));

-- Search function: finds messages, documents, and tasks across matters the user has access to
CREATE OR REPLACE FUNCTION search_matter_content(
  p_query text,
  p_user_id uuid,
  p_role text  -- 'client' | 'lawyer' | 'owner'
)
RETURNS TABLE (
  result_type   text,
  id            uuid,
  matter_id     uuid,
  matter_ref    text,
  title         text,
  snippet       text,
  created_at    timestamptz
)
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  -- Messages
  SELECT
    'message'::text,
    msg.id,
    msg.matter_id,
    m.matter_ref,
    s.full_name AS title,
    LEFT(msg.body, 200) AS snippet,
    msg.created_at
  FROM messages msg
  JOIN matters m ON m.id = msg.matter_id
  JOIN profiles s ON s.id = msg.sender_id
  WHERE to_tsvector('english', msg.body) @@ plainto_tsquery('english', p_query)
    AND (
      p_role = 'owner'
      OR (p_role = 'client' AND m.client_id = p_user_id)
      OR (p_role = 'lawyer' AND lawyer_on_matter(m.id, p_user_id))
    )

  UNION ALL

  -- Documents
  SELECT
    'document'::text,
    d.id,
    d.matter_id,
    m.matter_ref,
    d.name AS title,
    d.status AS snippet,
    d.created_at
  FROM documents d
  JOIN matters m ON m.id = d.matter_id
  WHERE to_tsvector('english', d.name || ' ' || COALESCE(d.file_name, '') || ' ' || COALESCE(d.category, '')) @@ plainto_tsquery('english', p_query)
    AND (
      p_role = 'owner'
      OR (p_role = 'client' AND m.client_id = p_user_id)
      OR (p_role = 'lawyer' AND lawyer_on_matter(m.id, p_user_id))
    )

  UNION ALL

  -- Tasks
  SELECT
    'task'::text,
    t.id,
    t.matter_id,
    m.matter_ref,
    t.title AS title,
    COALESCE(LEFT(t.description, 200), t.type) AS snippet,
    t.created_at
  FROM tasks t
  JOIN matters m ON m.id = t.matter_id
  WHERE to_tsvector('english', t.title || ' ' || COALESCE(t.description, '')) @@ plainto_tsquery('english', p_query)
    AND (
      p_role = 'owner'
      OR (p_role = 'client' AND m.client_id = p_user_id)
      OR (p_role = 'lawyer' AND lawyer_on_matter(m.id, p_user_id))
    )

  ORDER BY created_at DESC
  LIMIT 40;
$$;
