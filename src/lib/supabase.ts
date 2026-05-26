import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// Single client instance. The global.fetch override injects the X-Access-Token
// header on every request so RLS token-validation policies receive it.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
  },
  global: {
    fetch: (url, options = {}) => {
      const token = localStorage.getItem('access_token') || '';
      const headers = new Headers((options as RequestInit).headers);
      if (token) {
        headers.set('X-Access-Token', token);
      }
      return fetch(url, { ...options, headers });
    },
  },
});

export type Topic = {
  id: string;
  name: string;
  description: string | null;
  status: 'in_progress' | 'complete' | 'historical';
  environment: 'dev' | 'sit' | 'cat' | 'prod' | null;
  owner_team: string | null;
  naming_valid: boolean;
  naming_issues: string | null;
  domain: string | null;
  subdomain: string | null;
  dataset: string | null;
  cloud_provider: string | null;
  cluster_id: string | null;
  cluster_name: string | null;
  partition_count: number | null;
  replication_factor: number | null;
  retention_ms: number | null;
  icd_teams_url: string | null;
  icd_document_id: string | null;
  schema_registry_url: string | null;
  latest_schema: any;
  schema_version: number | null;
  schema_last_synced: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

export type SchemaVersion = {
  id: string;
  topic_id: string;
  version: number;
  schema_definition: any;
  changes_description: string | null;
  created_by: string | null;
  created_at: string;
};

export type PerformanceMetric = {
  id: string;
  topic_id: string;
  timestamp: string;
  consumer_lag: number | null;
  messages_per_second: number | null;
  bytes_per_second: number | null;
  error_rate: number | null;
  partition_metrics: any;
  notes: string | null;
};

export type TopicLineage = {
  id: string;
  source_topic_id: string;
  target_topic_id: string;
  relationship_type: 'produces_to' | 'consumes_from' | 'transforms_to';
  description: string | null;
  created_at: string;
};

export type Update = {
  id: string;
  topic_id: string;
  update_date: string;
  status_update: string | null;
  blockers: string | null;
  next_steps: string | null;
  created_by: string | null;
  created_at: string;
};

export type Alert = {
  id: string;
  topic_id: string | null;
  alert_type: 'naming_violation' | 'performance_degradation' | 'schema_issue' | 'manual';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string | null;
  resolved: boolean;
  resolved_at: string | null;
  resolved_by: string | null;
  created_at: string;
};
