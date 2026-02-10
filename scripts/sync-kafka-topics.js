#!/usr/bin/env node

/**
 * Standalone Kafka Topic Sync Script
 *
 * This script fetches Kafka topics from Confluent Cloud and syncs them to Supabase.
 * It runs independently of the web application and can be scheduled as a cron job.
 *
 * Usage:
 *   node scripts/sync-kafka-topics.js
 *
 * Required Environment Variables:
 *   - SUPABASE_URL: Your Supabase project URL
 *   - SUPABASE_SERVICE_ROLE_KEY: Your Supabase service role key
 *   - CONFLUENT_ADMIN_URL: Confluent Cloud Admin API URL (e.g., https://pkc-xxxxx.us-east-1.aws.confluent.cloud)
 *   - CONFLUENT_CLUSTER_ID: Your Confluent cluster ID
 *   - CONFLUENT_API_KEY: Confluent Cloud API key
 *   - CONFLUENT_API_SECRET: Confluent Cloud API secret
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env') });

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CONFLUENT_ADMIN_URL = process.env.CONFLUENT_ADMIN_URL;
const CONFLUENT_CLUSTER_ID = process.env.CONFLUENT_CLUSTER_ID;
const CONFLUENT_API_KEY = process.env.CONFLUENT_API_KEY;
const CONFLUENT_API_SECRET = process.env.CONFLUENT_API_SECRET;

function validateConfig() {
  const missing = [];

  if (!SUPABASE_URL) missing.push('SUPABASE_URL or VITE_SUPABASE_URL');
  if (!SUPABASE_SERVICE_ROLE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY');
  if (!CONFLUENT_ADMIN_URL) missing.push('CONFLUENT_ADMIN_URL');
  if (!CONFLUENT_CLUSTER_ID) missing.push('CONFLUENT_CLUSTER_ID');
  if (!CONFLUENT_API_KEY) missing.push('CONFLUENT_API_KEY');
  if (!CONFLUENT_API_SECRET) missing.push('CONFLUENT_API_SECRET');

  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach(v => console.error(`   - ${v}`));
    process.exit(1);
  }
}

async function fetchKafkaTopics() {
  const authHeader = `Basic ${Buffer.from(`${CONFLUENT_API_KEY}:${CONFLUENT_API_SECRET}`).toString('base64')}`;

  const url = `${CONFLUENT_ADMIN_URL}/kafka/v3/clusters/${CONFLUENT_CLUSTER_ID}/topics`;

  console.log(`📡 Fetching topics from: ${url}`);

  const response = await fetch(url, {
    headers: {
      'Authorization': authHeader,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Confluent API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  return data.data || [];
}

async function syncTopicsToSupabase(topics) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const results = {
    synced: 0,
    updated: 0,
    failed: 0,
    errors: [],
  };

  for (const topic of topics) {
    try {
      const { data: existingTopic } = await supabase
        .from('topics')
        .select('id, partition_count, replication_factor')
        .eq('name', topic.topic_name)
        .maybeSingle();

      const retentionMs = topic.configs?.['retention.ms']
        ? parseInt(topic.configs['retention.ms'])
        : null;

      if (existingTopic) {
        await supabase
          .from('topics')
          .update({
            partition_count: topic.partitions_count || 0,
            replication_factor: topic.replication_factor || 0,
            retention_ms: retentionMs,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingTopic.id);

        console.log(`✓ Updated: ${topic.topic_name}`);
        results.updated++;
      } else {
        const { data: newTopic, error } = await supabase
          .from('topics')
          .insert({
            name: topic.topic_name,
            partition_count: topic.partitions_count || 0,
            replication_factor: topic.replication_factor || 0,
            retention_ms: retentionMs,
            status: 'in_progress',
          })
          .select()
          .single();

        if (error) throw error;

        const namingPattern = /^(dev|sit|cat|prod)\./;
        if (!namingPattern.test(topic.topic_name)) {
          await supabase.from('alerts').insert({
            topic_id: newTopic.id,
            alert_type: 'naming_violation',
            severity: 'medium',
            title: 'New topic detected with naming issues',
            description: `Topic "${topic.topic_name}" does not follow naming convention`,
          });
          console.log(`⚠️  Alert created for: ${topic.topic_name} (naming violation)`);
        }

        console.log(`✓ Created: ${topic.topic_name}`);
        results.synced++;
      }
    } catch (error) {
      console.error(`✗ Failed: ${topic.topic_name} - ${error.message}`);
      results.failed++;
      results.errors.push(`${topic.topic_name}: ${error.message}`);
    }
  }

  return results;
}

async function main() {
  console.log('🚀 Kafka Topic Sync Started');
  console.log('━'.repeat(50));

  try {
    validateConfig();

    console.log('✓ Configuration validated');

    const topics = await fetchKafkaTopics();
    console.log(`✓ Fetched ${topics.length} topics from Confluent`);
    console.log('━'.repeat(50));

    if (topics.length === 0) {
      console.log('⚠️  No topics found in Confluent cluster');
      return;
    }

    const results = await syncTopicsToSupabase(topics);

    console.log('━'.repeat(50));
    console.log('📊 Sync Results:');
    console.log(`   New topics synced: ${results.synced}`);
    console.log(`   Existing topics updated: ${results.updated}`);
    console.log(`   Failed: ${results.failed}`);

    if (results.errors.length > 0) {
      console.log('\n❌ Errors:');
      results.errors.forEach(err => console.log(`   - ${err}`));
    }

    console.log('━'.repeat(50));
    console.log('✅ Sync completed successfully');

  } catch (error) {
    console.error('━'.repeat(50));
    console.error('❌ Sync failed:', error.message);
    console.error('━'.repeat(50));
    process.exit(1);
  }
}

main();
