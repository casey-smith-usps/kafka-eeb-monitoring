/*
  # AI Usage Tracking and Cost Monitoring

  1. New Tables
    - `ai_usage_log`
      - `id` (uuid, primary key)
      - `user_id` (text, references user_profiles)
      - `endpoint_name` (text)
      - `prompt_tokens` (integer)
      - `completion_tokens` (integer)
      - `total_tokens` (integer)
      - `estimated_cost` (numeric)
      - `request_type` (text) - e.g., 'chat', 'incident_analysis', 'topic_suggestion'
      - `success` (boolean)
      - `error_message` (text, nullable)
      - `created_at` (timestamp)

  2. Views
    - `ai_usage_daily_summary` - Daily usage and cost aggregation
    - `ai_usage_by_user` - Per-user usage statistics

  3. Security
    - Enable RLS on `ai_usage_log` table
    - Admins can view all usage
    - Users can view their own usage
*/

-- Create AI usage tracking table
CREATE TABLE IF NOT EXISTS ai_usage_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text,
  endpoint_name text NOT NULL DEFAULT 'databricks-ai',
  prompt_tokens integer NOT NULL DEFAULT 0,
  completion_tokens integer NOT NULL DEFAULT 0,
  total_tokens integer NOT NULL DEFAULT 0,
  estimated_cost numeric(10,4) NOT NULL DEFAULT 0.0,
  request_type text,
  success boolean NOT NULL DEFAULT true,
  error_message text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE ai_usage_log ENABLE ROW LEVEL SECURITY;

-- Admins can view all usage
CREATE POLICY "Admins can view all AI usage"
  ON ai_usage_log FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.access_token = current_setting('request.headers', true)::json->>'x-access-token'
      AND user_profiles.role = 'admin'
    )
  );

-- Users can view their own usage
CREATE POLICY "Users can view own AI usage"
  ON ai_usage_log FOR SELECT
  TO authenticated
  USING (
    user_id IN (
      SELECT id::text FROM user_profiles
      WHERE access_token = current_setting('request.headers', true)::json->>'x-access-token'
    )
  );

-- Allow anon to insert (edge function logs usage)
CREATE POLICY "Allow anon to insert AI usage logs"
  ON ai_usage_log FOR INSERT
  TO anon
  WITH CHECK (true);

-- Create daily summary view
CREATE OR REPLACE VIEW ai_usage_daily_summary AS
SELECT
  DATE(created_at) as usage_date,
  COUNT(*) as total_requests,
  COUNT(*) FILTER (WHERE success = true) as successful_requests,
  COUNT(*) FILTER (WHERE success = false) as failed_requests,
  SUM(prompt_tokens) as total_prompt_tokens,
  SUM(completion_tokens) as total_completion_tokens,
  SUM(total_tokens) as total_tokens,
  SUM(estimated_cost) as daily_cost,
  AVG(total_tokens) as avg_tokens_per_request
FROM ai_usage_log
GROUP BY DATE(created_at)
ORDER BY usage_date DESC;

-- Create per-user summary view
CREATE OR REPLACE VIEW ai_usage_by_user AS
SELECT
  ail.user_id,
  up.email,
  up.full_name,
  COUNT(*) as total_requests,
  SUM(ail.total_tokens) as total_tokens,
  SUM(ail.estimated_cost) as total_cost,
  MAX(ail.created_at) as last_used
FROM ai_usage_log ail
LEFT JOIN user_profiles up ON up.id::text = ail.user_id
GROUP BY ail.user_id, up.email, up.full_name
ORDER BY total_cost DESC;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_ai_usage_log_created_at ON ai_usage_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_log_user_id ON ai_usage_log(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_log_success ON ai_usage_log(success);
