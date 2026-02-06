import os
import sys
import json
from datetime import datetime
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import requests
from requests.auth import HTTPBasicAuth
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

# Force stdout to flush immediately
sys.stdout.reconfigure(line_buffering=True)

app = Flask(__name__, static_folder='dist')
CORS(app)

# Supabase setup
supabase_url = os.getenv('VITE_SUPABASE_URL')
supabase_key = os.getenv('VITE_SUPABASE_ANON_KEY')
supabase: Client = create_client(supabase_url, supabase_key)

# Confluent credentials
CONFLUENT_API_KEY = os.getenv('CONFLUENT_API_KEY')
CONFLUENT_API_SECRET = os.getenv('CONFLUENT_API_SECRET')
CONFLUENT_CLUSTER_ID = os.getenv('CONFLUENT_CLUSTER_ID')
CONFLUENT_ADMIN_URL = os.getenv('CONFLUENT_ADMIN_URL')  # REST Proxy endpoint
CONFLUENT_ENV_ID = os.getenv('CONFLUENT_ENV_ID')

@app.route('/api/sync-kafka-topics', methods=['POST'])
def sync_kafka_topics():
    """Sync Kafka topics from Confluent Cloud to Supabase"""
    print("=" * 80)
    print("SYNC REQUEST STARTED")
    print("=" * 80)

    try:
        # Get cluster info from request body or environment
        print("Step 1: Parsing request data...")
        print(f"Request Content-Type: {request.content_type}")
        print(f"Request data length: {len(request.data) if request.data else 0}")
        print(f"Request data (raw): {request.data[:500] if request.data else 'EMPTY'}")

        # Use force=True and silent=True to handle edge cases
        request_data = request.get_json(force=True, silent=True) or {}
        print(f"Parsed request data: {request_data}")

        cloud_provider = request_data.get('cloud_provider', 'Azure')  # Default to Azure
        cluster_id = request_data.get('cluster_id', CONFLUENT_CLUSTER_ID)
        cluster_name = request_data.get('cluster_name', f'{cloud_provider} DEV')
        admin_url = request_data.get('admin_url', CONFLUENT_ADMIN_URL)
        api_key = request_data.get('api_key', CONFLUENT_API_KEY)
        api_secret = request_data.get('api_secret', CONFLUENT_API_SECRET)

        print(f"Cloud Provider: {cloud_provider}")
        print(f"Cluster ID: {cluster_id}")
        print(f"Admin URL: {admin_url}")

        if not all([api_key, api_secret, admin_url, cluster_id]):
            return jsonify({
                'error': 'Missing Confluent credentials',
                'details': 'Please set CONFLUENT_API_KEY, CONFLUENT_API_SECRET, CONFLUENT_ADMIN_URL, and CONFLUENT_CLUSTER_ID in .env or provide in request'
            }), 500

        print("\nStep 2: Building Confluent API request...")
        # Fetch topics from Confluent Cloud REST Proxy
        # Use the REST Proxy endpoint, not the Cloud API
        url = f'{admin_url}/kafka/v3/clusters/{cluster_id}/topics'
        print(f"URL: {url}")

        # Configure proxy if set in environment
        proxies = {}
        http_proxy = os.getenv('HTTP_PROXY') or os.getenv('http_proxy')
        https_proxy = os.getenv('HTTPS_PROXY') or os.getenv('https_proxy')
        if http_proxy:
            proxies['http'] = http_proxy
            print(f"Using HTTP proxy: {http_proxy}")
        if https_proxy:
            proxies['https'] = https_proxy
            print(f"Using HTTPS proxy: {https_proxy}")

        print("\nStep 3: Calling Confluent API...")
        print(f"Making GET request to: {url}")

        response = requests.get(
            url,
            auth=HTTPBasicAuth(api_key, api_secret),
            proxies=proxies if proxies else None,
            timeout=30
        )

        print(f"\nStep 4: Got response!")

        print(f"Response status: {response.status_code}")
        print(f"Response headers: {dict(response.headers)}")
        print(f"Response text (first 500 chars): {response.text[:500]}")

        if response.status_code != 200:
            print(f"\nERROR: Got non-200 status code: {response.status_code}")
            return jsonify({
                'error': 'Failed to fetch topics from Confluent',
                'status': response.status_code,
                'details': response.text[:1000],
                'url': url,
                'response_headers': dict(response.headers)
            }), 500

        print("\nStep 5: Parsing JSON response...")
        # Try to parse JSON response
        try:
            topics_data = response.json()
            print(f"Successfully parsed JSON. Got {len(topics_data.get('data', []))} topics")
        except Exception as json_error:
            print(f"\nERROR: Failed to parse JSON: {str(json_error)}")
            print(f"Response text: {response.text}")
            return jsonify({
                'error': 'Sync failed',
                'details': f'Invalid JSON response from Confluent: {str(json_error)}. Response status: {response.status_code}. Response text: {response.text[:500]}',
                'url': url,
                'response_headers': dict(response.headers)
            }), 500

        topics = topics_data.get('data', [])

        synced_count = 0
        updated_count = 0
        failed_count = 0
        errors = []

        # Extract environment from cluster_name (e.g., "DEV Azure" -> "dev")
        cluster_environment = None
        cluster_name_upper = cluster_name.upper()
        if 'DEV' in cluster_name_upper:
            cluster_environment = 'dev'
        elif 'SIT' in cluster_name_upper:
            cluster_environment = 'sit'
        elif 'CAT' in cluster_name_upper:
            cluster_environment = 'cat'
        elif 'PROD' in cluster_name_upper or 'PRD' in cluster_name_upper:
            cluster_environment = 'prod'
        else:
            # Default to dev if we can't determine
            cluster_environment = 'dev'

        print(f"\n✅ Cluster Environment: {cluster_environment} (from cluster_name: {cluster_name})")

        for topic in topics:
            topic_name = topic.get('topic_name')

            if not topic_name:
                continue

            # Parse topic name for metadata
            parts = topic_name.split('.')
            domain = None
            subdomain = None
            dataset = None

            if len(parts) >= 4:
                domain = parts[1]
                subdomain = parts[2]
                dataset = '.'.join(parts[3:])
            elif len(parts) == 3:
                domain = parts[0]
                subdomain = parts[1]
                dataset = parts[2]
            elif len(parts) == 2:
                domain = parts[0]
                dataset = parts[1]

            # Check if topic exists in this cluster
            existing = supabase.table('topics').select('*').eq('name', topic_name).eq('cluster_id', cluster_id).execute()

            topic_data = {
                'name': topic_name,
                'environment': cluster_environment,  # Use cluster environment, not from topic name
                'domain': domain,
                'subdomain': subdomain,
                'dataset': dataset,
                'cloud_provider': cloud_provider,
                'cluster_id': cluster_id,
                'cluster_name': cluster_name,
                'partition_count': topic.get('partitions_count', 1),
                'replication_factor': topic.get('replication_factor', 3),
                'updated_at': datetime.utcnow().isoformat()
            }

            try:
                if existing.data and len(existing.data) > 0:
                    # Update existing topic
                    result = supabase.table('topics').update(topic_data).eq('name', topic_name).eq('cluster_id', cluster_id).execute()
                    updated_count += 1
                    print(f"✅ Updated: {topic_name}")
                else:
                    # Insert new topic
                    topic_data['created_at'] = datetime.utcnow().isoformat()
                    result = supabase.table('topics').insert(topic_data).execute()
                    synced_count += 1
                    print(f"✅ Inserted: {topic_name}")
            except Exception as e:
                error_msg = f'Failed to sync {topic_name}: {str(e)}'
                errors.append(error_msg)
                failed_count += 1
                print(f"❌ ERROR: {error_msg}")

        # After syncing topics, sync schema versions for each topic
        schema_synced = 0
        schema_registry_url = request_data.get('schema_registry_url')
        if schema_registry_url:
            for topic in topics:
                topic_name = topic.get('topic_name')
                if not topic_name:
                    continue

                try:
                    # Fetch schema for this topic (value schema)
                    schema_subject = f'{topic_name}-value'
                    schema_url = f'{schema_registry_url}/subjects/{schema_subject}/versions'

                    schema_response = requests.get(
                        schema_url,
                        auth=HTTPBasicAuth(api_key, api_secret),
                        proxies=proxies if proxies else None,
                        timeout=10
                    )

                    if schema_response.status_code == 200:
                        versions = schema_response.json()

                        # Get the topic ID from our database
                        topic_record = supabase.table('topics').select('id').eq('name', topic_name).eq('cluster_id', cluster_id).execute()
                        if not topic_record.data or len(topic_record.data) == 0:
                            continue

                        topic_id = topic_record.data[0]['id']

                        # Fetch details for each version
                        for version_num in versions:
                            version_url = f'{schema_registry_url}/subjects/{schema_subject}/versions/{version_num}'
                            version_response = requests.get(
                                version_url,
                                auth=HTTPBasicAuth(api_key, api_secret),
                                proxies=proxies if proxies else None,
                                timeout=10
                            )

                            if version_response.status_code == 200:
                                version_data = version_response.json()

                                # Check if this schema version already exists
                                existing_schema = supabase.table('schema_versions').select('*').eq('topic_id', topic_id).eq('version', version_num).execute()

                                if not existing_schema.data or len(existing_schema.data) == 0:
                                    # Insert new schema version
                                    supabase.table('schema_versions').insert({
                                        'topic_id': topic_id,
                                        'version': version_num,
                                        'schema_definition': version_data.get('schema'),
                                        'created_at': datetime.utcnow().isoformat()
                                    }).execute()
                                    schema_synced += 1
                except Exception as schema_error:
                    # Don't fail the whole sync if schema fetch fails
                    pass

        print("\n" + "=" * 80)
        print("SYNC COMPLETED")
        print("=" * 80)
        print(f"✅ New Topics: {synced_count}")
        print(f"🔄 Updated: {updated_count}")
        print(f"📊 Schemas: {schema_synced}")
        print(f"❌ Failed: {failed_count}")
        if errors:
            print(f"\n⚠️ Errors ({len(errors)}):")
            for error in errors[:10]:  # Show first 10 errors
                print(f"  • {error}")
            if len(errors) > 10:
                print(f"  ... and {len(errors) - 10} more errors")
        print("=" * 80)

        return jsonify({
            'success': True,
            'results': {
                'synced': synced_count,
                'updated': updated_count,
                'failed': failed_count,
                'schemas_synced': schema_synced,
                'errors': errors
            }
        })

    except Exception as e:
        import traceback
        error_traceback = traceback.format_exc()
        print("=" * 80)
        print("ERROR OCCURRED:")
        print(error_traceback)
        print("=" * 80)
        return jsonify({
            'error': 'Sync failed',
            'details': str(e),
            'traceback': error_traceback
        }), 500


@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.utcnow().isoformat(),
        'confluent_configured': bool(CONFLUENT_API_KEY and CONFLUENT_API_SECRET),
        'supabase_configured': bool(supabase_url and supabase_key)
    })


@app.route('/api/topics', methods=['GET'])
def get_topics():
    """Get all topics with 10000 limit"""
    try:
        response = supabase.table('topics').select('*').order('created_at', desc=True).limit(10000).execute()
        return jsonify(response.data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/alerts', methods=['GET'])
def get_alerts():
    """Get all alerts with 10000 limit"""
    try:
        response = supabase.table('alerts').select('*, topic:topics(id, name)').order('created_at', desc=True).limit(10000).execute()
        return jsonify(response.data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/alerts/unresolved', methods=['GET'])
def get_unresolved_alerts():
    """Get unresolved alerts"""
    try:
        response = supabase.table('alerts').select('*, topic:topics(id, name)').eq('resolved', False).order('created_at', desc=True).execute()
        return jsonify(response.data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/ingest-projects', methods=['GET'])
def get_ingest_projects():
    """Get all ingest projects with 10000 limit"""
    try:
        response = supabase.table('ingest_projects').select('*').order('created_at', desc=True).limit(10000).execute()
        return jsonify(response.data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/updates/today', methods=['GET'])
def get_today_updates():
    """Get today's updates"""
    try:
        today = datetime.utcnow().strftime('%Y-%m-%d')
        response = supabase.table('updates').select('*, topic:topics(id, name, status, environment)').eq('update_date', today).order('created_at', desc=True).execute()
        return jsonify(response.data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# Serve React app
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_react(path):
    """Serve the React app"""
    if path != "" and os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)
    else:
        return send_from_directory(app.static_folder, 'index.html')


if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
