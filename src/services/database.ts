import { supabase, Topic, SchemaVersion, PerformanceMetric, TopicLineage, Update, Alert } from '../lib/supabase';
import { validateTopicName } from '../utils/namingValidator';

export const topicsService = {
  async getAll() {
    const { data, error } = await supabase
      .from('topics')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data as Topic[];
  },

  async getByStatus(status: string) {
    const { data, error } = await supabase
      .from('topics')
      .select('*')
      .eq('status', status)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data as Topic[];
  },

  async getById(id: string) {
    const { data, error } = await supabase
      .from('topics')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data as Topic | null;
  },

  async getByName(name: string) {
    const { data, error } = await supabase
      .from('topics')
      .select('*')
      .eq('name', name)
      .maybeSingle();

    if (error) throw error;
    return data as Topic | null;
  },

  async create(topic: Partial<Topic>) {
    const validation = validateTopicName(topic.name || '');

    const { data, error } = await supabase
      .from('topics')
      .insert({
        ...topic,
        naming_valid: validation.isValid,
        naming_issues: validation.issues.length > 0 ? validation.issues.join('; ') : null,
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    if (!validation.isValid) {
      await alertsService.create({
        topic_id: data.id,
        alert_type: 'naming_violation',
        severity: 'medium',
        title: 'Naming Convention Violation',
        description: validation.issues.join('; ')
      });
    }

    return data as Topic;
  },

  async update(id: string, updates: Partial<Topic>) {
    if (updates.name) {
      const validation = validateTopicName(updates.name);
      updates.naming_valid = validation.isValid;
      updates.naming_issues = validation.issues.length > 0 ? validation.issues.join('; ') : null;
    }

    const { data, error } = await supabase
      .from('topics')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as Topic;
  },

  async delete(id: string) {
    const { error } = await supabase
      .from('topics')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  async archive(id: string) {
    return this.update(id, {
      status: 'historical',
      archived_at: new Date().toISOString()
    });
  }
};

export const schemaVersionsService = {
  async getByTopicId(topicId: string) {
    const { data, error } = await supabase
      .from('schema_versions')
      .select('*')
      .eq('topic_id', topicId)
      .order('version', { ascending: false });

    if (error) throw error;
    return data as SchemaVersion[];
  },

  async create(schemaVersion: Partial<SchemaVersion>) {
    const { data, error } = await supabase
      .from('schema_versions')
      .insert(schemaVersion)
      .select()
      .single();

    if (error) throw error;
    return data as SchemaVersion;
  },

  async getLatestVersion(topicId: string) {
    const { data, error } = await supabase
      .from('schema_versions')
      .select('*')
      .eq('topic_id', topicId)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return data as SchemaVersion | null;
  }
};

export const performanceMetricsService = {
  async getByTopicId(topicId: string, limit = 100) {
    const { data, error } = await supabase
      .from('performance_metrics')
      .select('*')
      .eq('topic_id', topicId)
      .order('timestamp', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data as PerformanceMetric[];
  },

  async create(metric: Partial<PerformanceMetric>) {
    const { data, error } = await supabase
      .from('performance_metrics')
      .insert(metric)
      .select()
      .single();

    if (error) throw error;

    if (metric.consumer_lag && metric.consumer_lag > 10000) {
      await alertsService.create({
        topic_id: metric.topic_id,
        alert_type: 'performance_degradation',
        severity: 'high',
        title: 'High Consumer Lag Detected',
        description: `Consumer lag is ${metric.consumer_lag} messages`
      });
    }

    return data as PerformanceMetric;
  },

  async getLatest(topicId: string) {
    const { data, error } = await supabase
      .from('performance_metrics')
      .select('*')
      .eq('topic_id', topicId)
      .order('timestamp', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return data as PerformanceMetric | null;
  }
};

export const lineageService = {
  async getByTopicId(topicId: string) {
    const { data, error } = await supabase
      .from('topic_lineage')
      .select(`
        *,
        source_topic:topics!topic_lineage_source_topic_id_fkey(id, name),
        target_topic:topics!topic_lineage_target_topic_id_fkey(id, name)
      `)
      .or(`source_topic_id.eq.${topicId},target_topic_id.eq.${topicId}`);

    if (error) throw error;
    return data;
  },

  async create(lineage: Partial<TopicLineage>) {
    const { data, error } = await supabase
      .from('topic_lineage')
      .insert(lineage)
      .select()
      .single();

    if (error) throw error;
    return data as TopicLineage;
  },

  async delete(id: string) {
    const { error } = await supabase
      .from('topic_lineage')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }
};

export const updatesService = {
  async getByTopicId(topicId: string) {
    const { data, error } = await supabase
      .from('updates')
      .select('*')
      .eq('topic_id', topicId)
      .order('update_date', { ascending: false });

    if (error) throw error;
    return data as Update[];
  },

  async getToday() {
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await supabase
      .from('updates')
      .select(`
        *,
        topic:topics(id, name, status, environment)
      `)
      .eq('update_date', today)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  async create(update: Partial<Update>) {
    const { data, error } = await supabase
      .from('updates')
      .insert(update)
      .select()
      .single();

    if (error) throw error;
    return data as Update;
  }
};

export const alertsService = {
  async getAll() {
    const { data, error } = await supabase
      .from('alerts')
      .select(`
        *,
        topic:topics(id, name)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  async getUnresolved() {
    const { data, error } = await supabase
      .from('alerts')
      .select(`
        *,
        topic:topics(id, name)
      `)
      .eq('resolved', false)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  async getByTopicId(topicId: string) {
    const { data, error } = await supabase
      .from('alerts')
      .select('*')
      .eq('topic_id', topicId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data as Alert[];
  },

  async create(alert: Partial<Alert>) {
    const { data, error } = await supabase
      .from('alerts')
      .insert(alert)
      .select()
      .single();

    if (error) throw error;
    return data as Alert;
  },

  async resolve(id: string, resolvedBy: string) {
    const { data, error } = await supabase
      .from('alerts')
      .update({
        resolved: true,
        resolved_at: new Date().toISOString(),
        resolved_by: resolvedBy
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as Alert;
  }
};

export const topicNotesService = {
  async getByTopicId(topicId: string) {
    const { data, error } = await supabase
      .from('topic_notes')
      .select('*')
      .eq('topic_id', topicId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  async create(note: { topic_id: string; note: string; created_by?: string }) {
    const { data, error } = await supabase
      .from('topic_notes')
      .insert(note)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async update(id: string, note: string) {
    const { data, error } = await supabase
      .from('topic_notes')
      .update({ note, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async delete(id: string) {
    const { error } = await supabase
      .from('topic_notes')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }
};

export const documentsService = {
  async getAll() {
    const { data, error } = await supabase
      .from('onboarding_documents')
      .select('*')
      .order('uploaded_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  async getByCategory(category: string) {
    const { data, error } = await supabase
      .from('onboarding_documents')
      .select('*')
      .eq('category', category)
      .order('uploaded_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  async create(document: {
    title: string;
    description?: string;
    file_name: string;
    file_type: string;
    file_url: string;
    file_size: number;
    category?: string;
    uploaded_by?: string;
    tags?: string[];
  }) {
    const { data, error } = await supabase
      .from('onboarding_documents')
      .insert({
        ...document,
        tags: document.tags ? JSON.stringify(document.tags) : '[]'
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async update(id: string, updates: Partial<{
    title: string;
    description: string;
    category: string;
    tags: string[];
  }>) {
    const updateData: any = { ...updates };
    if (updates.tags) {
      updateData.tags = JSON.stringify(updates.tags);
    }

    const { data, error } = await supabase
      .from('onboarding_documents')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async delete(id: string) {
    const { error } = await supabase
      .from('onboarding_documents')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  async searchByTags(tags: string[]) {
    const { data, error } = await supabase
      .from('onboarding_documents')
      .select('*')
      .contains('tags', tags)
      .order('uploaded_at', { ascending: false });

    if (error) throw error;
    return data;
  }
};

export const ingestProjectsService = {
  async getAll() {
    const { data, error } = await supabase
      .from('ingest_projects')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  async getById(id: string) {
    const { data, error } = await supabase
      .from('ingest_projects')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async create(project: any) {
    const { data, error } = await supabase
      .from('ingest_projects')
      .insert({
        ...project,
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async update(id: string, updates: any) {
    const { data, error } = await supabase
      .from('ingest_projects')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async delete(id: string) {
    const { error } = await supabase
      .from('ingest_projects')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  async bulkCreate(projects: any[]) {
    const { data, error } = await supabase
      .from('ingest_projects')
      .insert(projects.map(p => ({
        ...p,
        updated_at: new Date().toISOString()
      })))
      .select();

    if (error) throw error;
    return data;
  }
};
