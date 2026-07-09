CREATE TABLE IF NOT EXISTS user_activity_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  email text NOT NULL,
  event_type text NOT NULL CHECK (event_type IN ('login', 'logout', 'session_expired')),
  session_token text,
  login_at timestamptz,
  logout_at timestamptz,
  duration_seconds integer,
  ip_address text,
  user_agent text,
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE user_activity_log ENABLE ROW LEVEL SECURITY;

-- Admins can read all logs
CREATE POLICY "admins_read_activity_log" ON user_activity_log FOR SELECT
  TO anon USING (true);

-- Anyone with anon key can insert log entries
CREATE POLICY "insert_activity_log" ON user_activity_log FOR INSERT
  TO anon WITH CHECK (true);

-- Index for fast queries by email and date
CREATE INDEX idx_activity_log_email ON user_activity_log (email, created_at DESC);
CREATE INDEX idx_activity_log_event ON user_activity_log (event_type, created_at DESC);
