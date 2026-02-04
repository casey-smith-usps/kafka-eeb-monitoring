import os
import json
from datetime import datetime
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import requests
from requests.auth import HTTPBasicAuth
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

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
CONFLUENT_ENV_ID = os.getenv('CONFLUENT_ENV_ID')

@app.route('/api/sync-kafka-topics', methods=['POST'])
def sync_kafka_topics():
    """Sync Kafka topics from Confluent Cloud to Supabase"""
    try:
        if not all([CONFLUENT_API_KEY, CONFLUENT_API_SECRET, CONFLUENT_CLUSTER_ID]):
            return jsonify({
                'error': 'Missing Confluent credentials',
                'details': 'Please set CONFLUENT_API_KEY, CONFLUENT_API_SECRET, and CONFLUENT_CLUSTER_ID in .env'
            }), 500

        # Fetch topics from Confluent Cloud
        url = f'https://api.confluent.cloud/kafka/v3/clusters/{CONFLUENT_CLUSTER_ID}/topics'

        response = requests.get(
            url,
            auth=HTTPBasicAuth(CONFLUENT_API_KEY, CONFLUENT_API_SECRET),
            headers={'Content-Type': 'application/json'}
        )

        if response.status_code != 200:
            return jsonify({
                'error': 'Failed to fetch topics from Confluent',
                'status': response.status_code,
                'details': response.text
            }), 500

        topics_data = response.json()
        topics = topics_data.get('data', [])

        synced_count = 0
        errors = []

        for topic in topics:
            topic_name = topic.get('topic_name')

            if not topic_name:
                continue

            # Parse topic name for metadata
            parts = topic_name.split('.')
            environment = None
            domain = None
            subdomain = None
            dataset = None

            if len(parts) >= 4:
                environment = parts[0]
                domain = parts[1]
                subdomain = parts[2]
                dataset = '.'.join(parts[3:])

            # Check if topic exists
            existing = supabase.table('topics').select('*').eq('name', topic_name).execute()

            topic_data = {
                'name': topic_name,
                'environment': environment,
                'domain': domain,
                'subdomain': subdomain,
                'dataset': dataset,
                'is_internal': topic.get('is_internal', False),
                'partitions_count': topic.get('partitions_count', 1),
                'replication_factor': topic.get('replication_factor', 3),
                'updated_at': datetime.utcnow().isoformat()
            }

            try:
                if existing.data and len(existing.data) > 0:
                    # Update existing topic
                    supabase.table('topics').update(topic_data).eq('name', topic_name).execute()
                else:
                    # Insert new topic
                    topic_data['created_at'] = datetime.utcnow().isoformat()
                    supabase.table('topics').insert(topic_data).execute()

                synced_count += 1
            except Exception as e:
                errors.append(f'Failed to sync {topic_name}: {str(e)}')

        return jsonify({
            'success': True,
            'synced_count': synced_count,
            'total_topics': len(topics),
            'errors': errors if errors else None
        })

    except Exception as e:
        return jsonify({
            'error': 'Sync failed',
            'details': str(e)
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
