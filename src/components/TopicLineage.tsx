import { useState, useEffect } from 'react';
import { GitBranch, Plus, Trash2 } from 'lucide-react';
import { topicsService, lineageService } from '../services/database';

export default function TopicLineage() {
  const [topics, setTopics] = useState<any[]>([]);
  const [lineages, setLineages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newLineage, setNewLineage] = useState({
    source_topic_id: '',
    target_topic_id: '',
    relationship_type: 'produces_to' as 'produces_to' | 'consumes_from' | 'transforms_to',
    description: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const topicsData = await topicsService.getAll();
      setTopics(topicsData);

      const lineagePromises = topicsData.map((topic: any) =>
        lineageService.getByTopicId(topic.id)
      );
      const lineagesData = await Promise.all(lineagePromises);
      const allLineages = lineagesData.flat();
      const uniqueLineages = Array.from(
        new Map(allLineages.map((l: any) => [l.id, l])).values()
      );
      setLineages(uniqueLineages);
    } catch (error) {
      console.error('Error loading lineage data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddLineage = async () => {
    if (!newLineage.source_topic_id || !newLineage.target_topic_id) {
      alert('Please select both source and target topics');
      return;
    }

    try {
      await lineageService.create({
        source_topic_id: newLineage.source_topic_id,
        target_topic_id: newLineage.target_topic_id,
        relationship_type: newLineage.relationship_type,
        description: newLineage.description || null
      });

      setNewLineage({
        source_topic_id: '',
        target_topic_id: '',
        relationship_type: 'produces_to',
        description: ''
      });
      setShowAddForm(false);
      loadData();
    } catch (error) {
      alert('Error creating lineage relationship');
    }
  };

  const handleDeleteLineage = async (id: string) => {
    if (!confirm('Are you sure you want to delete this relationship?')) return;

    try {
      await lineageService.delete(id);
      loadData();
    } catch (error) {
      alert('Error deleting lineage relationship');
    }
  };

  const getTopicName = (topicId: string) => {
    const topic = topics.find(t => t.id === topicId);
    return topic?.name || 'Unknown';
  };

  const getRelationshipLabel = (type: string) => {
    switch (type) {
      case 'produces_to':
        return 'Produces to';
      case 'consumes_from':
        return 'Consumes from';
      case 'transforms_to':
        return 'Transforms to';
      default:
        return type;
    }
  };

  const getRelationshipColor = (type: string) => {
    switch (type) {
      case 'produces_to':
        return 'border-blue-300 bg-blue-50';
      case 'consumes_from':
        return 'border-green-300 bg-green-50';
      case 'transforms_to':
        return 'border-purple-300 bg-purple-50';
      default:
        return 'border-slate-300 bg-slate-50';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">Cross-System Lineage</h2>
          <p className="text-slate-500 mt-1">Track data flow across Kafka topics and connected systems</p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center space-x-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors shadow-md"
        >
          <Plus className="w-5 h-5" />
          <span className="font-medium">Add Relationship</span>
        </button>
      </div>

      {showAddForm && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-bold text-slate-900 mb-4">Create Lineage Relationship</h3>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Source Topic</label>
                <select
                  value={newLineage.source_topic_id}
                  onChange={(e) => setNewLineage({ ...newLineage, source_topic_id: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select source topic</option>
                  {topics.map((topic: any) => (
                    <option key={topic.id} value={topic.id}>{topic.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Target Topic</label>
                <select
                  value={newLineage.target_topic_id}
                  onChange={(e) => setNewLineage({ ...newLineage, target_topic_id: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select target topic</option>
                  {topics.map((topic: any) => (
                    <option key={topic.id} value={topic.id}>{topic.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Relationship Type</label>
              <div className="grid grid-cols-3 gap-3">
                {(['produces_to', 'consumes_from', 'transforms_to'] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => setNewLineage({ ...newLineage, relationship_type: type })}
                    className={`px-4 py-3 rounded-lg border-2 transition-colors ${
                      newLineage.relationship_type === type
                        ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {getRelationshipLabel(type)}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Description</label>
              <textarea
                value={newLineage.description}
                onChange={(e) => setNewLineage({ ...newLineage, description: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={2}
                placeholder="Describe the relationship..."
              />
            </div>
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddLineage}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Create Relationship
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center space-x-3 mb-6">
          <GitBranch className="w-6 h-6 text-slate-700" />
          <h3 className="text-xl font-bold text-slate-900">Relationships ({lineages.length})</h3>
        </div>

        {lineages.length === 0 ? (
          <div className="text-center py-12">
            <GitBranch className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500">No lineage relationships defined yet</p>
            <p className="text-sm text-slate-400 mt-2">Add relationships to visualize data flow between topics</p>
          </div>
        ) : (
          <div className="space-y-3">
            {lineages.map((lineage: any) => (
              <div
                key={lineage.id}
                className={`p-4 rounded-lg border-2 ${getRelationshipColor(lineage.relationship_type)}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4 flex-1">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <span className="font-semibold text-slate-900">
                          {lineage.source_topic?.name || getTopicName(lineage.source_topic_id)}
                        </span>
                        <span className="text-slate-400">→</span>
                        <span className="px-3 py-1 bg-white border border-slate-300 rounded-full text-xs font-medium text-slate-700">
                          {getRelationshipLabel(lineage.relationship_type)}
                        </span>
                        <span className="text-slate-400">→</span>
                        <span className="font-semibold text-slate-900">
                          {lineage.target_topic?.name || getTopicName(lineage.target_topic_id)}
                        </span>
                      </div>
                      {lineage.description && (
                        <p className="text-sm text-slate-600 mt-2">{lineage.description}</p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteLineage(lineage.id)}
                    className="ml-4 p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-medium text-blue-900 mb-2">Understanding Relationships</h4>
        <ul className="space-y-1 text-sm text-blue-800">
          <li>• <strong>Produces to:</strong> Source topic data flows into target topic</li>
          <li>• <strong>Consumes from:</strong> Target topic reads data from source topic</li>
          <li>• <strong>Transforms to:</strong> Source topic data is transformed into target topic</li>
        </ul>
      </div>
    </div>
  );
}
