import { useState, useEffect } from 'react';
import { X, AlertTriangle, CheckCircle, Lightbulb } from 'lucide-react';
import { Topic } from '../lib/supabase';
import { topicsService } from '../services/database';
import { validateTopicName, getRecommendations, suggestCorrection } from '../utils/namingValidator';

interface TopicModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  topic?: Topic | null;
}

export default function TopicModal({ isOpen, onClose, onSave, topic }: TopicModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    status: 'in_progress' as 'in_progress' | 'complete' | 'historical',
    environment: '' as '' | 'dev' | 'sit' | 'cat' | 'prod',
    owner_team: '',
    partition_count: '',
    replication_factor: '',
    retention_ms: '',
    icd_teams_url: '',
    schema_registry_url: ''
  });
  const [saving, setSaving] = useState(false);
  const [nameValidation, setNameValidation] = useState({ isValid: true, issues: [] as string[] });
  const [recommendations, setRecommendations] = useState<string[]>([]);

  useEffect(() => {
    if (topic) {
      setFormData({
        name: topic.name,
        description: topic.description || '',
        status: topic.status,
        environment: topic.environment || '',
        owner_team: topic.owner_team || '',
        partition_count: topic.partition_count?.toString() || '',
        replication_factor: topic.replication_factor?.toString() || '',
        retention_ms: topic.retention_ms?.toString() || '',
        icd_teams_url: topic.icd_teams_url || '',
        schema_registry_url: topic.schema_registry_url || ''
      });
    } else {
      setFormData({
        name: '',
        description: '',
        status: 'in_progress',
        environment: '',
        owner_team: '',
        partition_count: '',
        replication_factor: '',
        retention_ms: '',
        icd_teams_url: '',
        schema_registry_url: ''
      });
    }
  }, [topic, isOpen]);

  useEffect(() => {
    if (formData.name) {
      const validation = validateTopicName(formData.name);
      setNameValidation(validation);
      setRecommendations(getRecommendations(formData.name));
    } else {
      setNameValidation({ isValid: true, issues: [] });
      setRecommendations([]);
    }
  }, [formData.name]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const data: any = {
        name: formData.name,
        description: formData.description || null,
        status: formData.status,
        environment: formData.environment || null,
        owner_team: formData.owner_team || null,
        partition_count: formData.partition_count ? parseInt(formData.partition_count) : null,
        replication_factor: formData.replication_factor ? parseInt(formData.replication_factor) : null,
        retention_ms: formData.retention_ms ? parseInt(formData.retention_ms) : null,
        icd_teams_url: formData.icd_teams_url || null,
        schema_registry_url: formData.schema_registry_url || null
      };

      if (topic) {
        await topicsService.update(topic.id, data);
      } else {
        await topicsService.create(data);
      }

      onSave();
      onClose();
    } catch (error) {
      console.error('Error saving topic:', error);
      alert('Failed to save topic. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const applySuggestion = () => {
    const corrected = suggestCorrection(formData.name);
    setFormData({ ...formData, name: corrected });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-slate-900">
            {topic ? 'Edit Topic' : 'Add New Topic'}
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Topic Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 ${
                nameValidation.isValid
                  ? 'border-slate-300 focus:ring-blue-500'
                  : 'border-red-300 focus:ring-red-500'
              }`}
              placeholder="e.g., prod.payments.transactions.v1"
              required
            />
            {!nameValidation.isValid && (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-start space-x-2">
                  <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-red-900 mb-1">Naming Issues:</p>
                    <ul className="text-sm text-red-700 space-y-1">
                      {nameValidation.issues.map((issue, idx) => (
                        <li key={idx}>• {issue}</li>
                      ))}
                    </ul>
                    <button
                      type="button"
                      onClick={applySuggestion}
                      className="mt-2 text-sm text-red-700 hover:text-red-900 font-medium underline"
                    >
                      Apply auto-correction
                    </button>
                  </div>
                </div>
              </div>
            )}
            {nameValidation.isValid && formData.name && (
              <div className="mt-2 flex items-center space-x-2 text-green-700">
                <CheckCircle className="w-4 h-4" />
                <span className="text-sm">Valid naming convention</span>
              </div>
            )}
            {recommendations.length > 0 && (
              <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start space-x-2">
                  <Lightbulb className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-blue-900 mb-1">Recommendations:</p>
                    <ul className="text-sm text-blue-700 space-y-1">
                      {recommendations.map((rec, idx) => (
                        <li key={idx}>• {rec}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
              placeholder="Describe the purpose and content of this topic"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Status *
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="in_progress">In Progress</option>
                <option value="complete">Complete</option>
                <option value="historical">Historical</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Environment
              </label>
              <select
                value={formData.environment}
                onChange={(e) => setFormData({ ...formData, environment: e.target.value as any })}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select environment</option>
                <option value="dev">DEV</option>
                <option value="sit">SIT</option>
                <option value="cat">CAT</option>
                <option value="prod">PROD</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Owner Team
            </label>
            <input
              type="text"
              value={formData.owner_team}
              onChange={(e) => setFormData({ ...formData, owner_team: e.target.value })}
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., Data Engineering, Platform Team"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Partitions
              </label>
              <input
                type="number"
                value={formData.partition_count}
                onChange={(e) => setFormData({ ...formData, partition_count: e.target.value })}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="12"
                min="1"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Replication
              </label>
              <input
                type="number"
                value={formData.replication_factor}
                onChange={(e) => setFormData({ ...formData, replication_factor: e.target.value })}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="3"
                min="1"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Retention (ms)
              </label>
              <input
                type="number"
                value={formData.retention_ms}
                onChange={(e) => setFormData({ ...formData, retention_ms: e.target.value })}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="604800000"
                min="1"
              />
            </div>
          </div>

          {/* ICD and Schema Section - Shown for PROD topics */}
          {formData.environment === 'prod' && (
            <div className="border-t border-slate-200 pt-6 space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-900 mb-2">PROD Topic Documentation</h4>
                <p className="text-sm text-blue-700">
                  Link the ICD (Interface Control Document) and Schema Registry for this production topic
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  ICD Microsoft Teams URL (Optional)
                </label>
                <input
                  type="url"
                  value={formData.icd_teams_url}
                  onChange={(e) => setFormData({ ...formData, icd_teams_url: e.target.value })}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="https://teams.microsoft.com/l/file/..."
                />
                <p className="text-xs text-slate-500 mt-1">
                  Direct link to the ICD document in Microsoft Teams
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Schema Registry URL (Optional)
                </label>
                <input
                  type="url"
                  value={formData.schema_registry_url}
                  onChange={(e) => setFormData({ ...formData, schema_registry_url: e.target.value })}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="https://psrc-xxxxx.region.provider.confluent.cloud/subjects/..."
                />
                <p className="text-xs text-slate-500 mt-1">
                  Link to schema definition in Confluent Schema Registry
                </p>
              </div>
            </div>
          )}

          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || (!topic && !nameValidation.isValid)}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
            >
              {saving ? 'Saving...' : topic ? 'Update Topic' : 'Create Topic'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
