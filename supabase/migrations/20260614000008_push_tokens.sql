-- Push tokens for Expo push notifications
CREATE TABLE IF NOT EXISTS push_tokens (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  token       text NOT NULL,
  platform    text NOT NULL CHECK (platform IN ('ios', 'android')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, token)
);

ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users manage own push tokens"
  ON push_tokens FOR ALL USING (user_id = auth.uid());

-- Owners/lawyers can read tokens for notification dispatch via service role only
-- (Edge Function uses service role key, so RLS doesn't apply there)
