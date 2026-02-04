import { useState, useEffect } from 'react';
import { Coffee, Plus, CheckCircle, Clock, AlertTriangle, MessageSquare, Upload, FolderKanban } from 'lucide-react';
import { Topic } from '../lib/supabase';
import { topicsService, updatesService, ingestProjectsService } from '../services/database';
import ProjectDetailModal from './ProjectDetailModal';
import IngestProjectsImport from './IngestProjectsImport';

export default function MorningStandup() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [todayUpdates, setTodayUpdates] = useState<any[]>([]);
  const [ingestProjects, setIngestProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<any | null>(null);
  const [showProjectImport, setShowProjectImport] = useState(false);
  const [updateForm, setUpdateForm] = useState({
    status_update: '',
    blockers: '',
    next_steps: ''
  });

  useEffect(() => {
    loadStandupData();
  }, []);

  const loadStandupData = async () => {
    try {
      setLoading(true);
      const [topicsData, updatesData, projectsData] = await Promise.all([
        topicsService.getByStatus('in_progress'),
        updatesService.getToday(),
        ingestProjectsService.getAll()
      ]);

      setTopics(topicsData);
      setTodayUpdates(updatesData);
      setIngestProjects(projectsData);
    } catch (error) {
      console.error('Error loading standup data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddUpdate = async (topicId: string) => {
    if (!updateForm.status_update && !updateForm.blockers && !updateForm.next_steps) {
      alert('Please fill in at least one field');
      return;
    }

    try {
      await updatesService.create({
        topic_id: topicId,
        update_date: new Date().toISOString().split('T')[0],
        status_update: updateForm.status_update || null,
        blockers: updateForm.blockers || null,
        next_steps: updateForm.next_steps || null,
        created_by: 'Current User'
      });

      setUpdateForm({ status_update: '', blockers: '', next_steps: '' });
      setSelectedTopic(null);
      loadStandupData();
    } catch (error) {
      alert('Error adding update');
    }
  };

  const getTopicUpdate = (topicId: string) => {
    return todayUpdates.find((u: any) => u.topic_id === topicId);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="bg-gradient-to-br from-amber-500 to-amber-600 p-3 rounded-lg">
            <Coffee className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-3xl font-bold text-slate-900">Morning Standup</h2>
            <p className="text-slate-500 mt-1">{today}</p>
          </div>
        </div>
        <button
          onClick={() => setShowProjectImport(true)}
          className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors shadow-md"
        >
          <Upload className="w-5 h-5" />
          <span>Upload Ingest Projects</span>
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center space-x-3">
            <FolderKanban className="w-5 h-5 text-green-600" />
            <div>
              <p className="text-sm text-slate-500">Ingest Projects</p>
              <p className="text-2xl font-bold text-slate-900">{ingestProjects.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center space-x-3">
            <Clock className="w-5 h-5 text-blue-600" />
            <div>
              <p className="text-sm text-slate-500">Topics In Progress</p>
              <p className="text-2xl font-bold text-slate-900">{topics.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center space-x-3">
            <MessageSquare className="w-5 h-5 text-green-600" />
            <div>
              <p className="text-sm text-slate-500">Updates Today</p>
              <p className="text-2xl font-bold text-slate-900">{todayUpdates.length}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-slate-900">Ingest Projects</h3>
          <button
            onClick={() => setShowProjectImport(true)}
            className="flex items-center space-x-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Add Projects</span>
          </button>
        </div>
        {ingestProjects.length === 0 ? (
          <div className="text-center py-12">
            <FolderKanban className="w-12 h-12 text-slate-400 mx-auto mb-3" />
            <p className="text-slate-500 mb-4">No ingest projects yet. Upload your project data to get started.</p>
            <button
              onClick={() => setShowProjectImport(true)}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              Upload Projects
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {ingestProjects.map((project) => (
              <button
                key={project.id}
                onClick={() => setSelectedProject(project)}
                className="w-full border-2 border-slate-200 rounded-lg p-4 hover:shadow-lg hover:border-green-300 transition-all text-left cursor-pointer bg-white"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h4 className="text-lg font-semibold text-slate-900">{project.title}</h4>
                      {project.environment && (
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded uppercase">
                          {project.environment}
                        </span>
                      )}
                      {project.status && (
                        <span className="text-xs text-slate-600 px-2 py-1 bg-slate-100 rounded">
                          {project.status}
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        {project.owner && (
                          <p className="text-slate-600 mb-1"><span className="font-medium">Owner:</span> {project.owner}</p>
                        )}
                        {project.prod_date && (
                          <p className="text-slate-600"><span className="font-medium">Prod Date:</span> {new Date(project.prod_date).toLocaleDateString()}</p>
                        )}
                      </div>
                      <div>
                        {project.status2 && (
                          <p className="text-slate-700 line-clamp-2">{project.status2}</p>
                        )}
                      </div>
                    </div>
                    {project.tasks && (
                      <div className="mt-2 p-2 bg-slate-50 rounded text-sm text-slate-700 line-clamp-2">
                        <span className="font-medium">Tasks:</span> {project.tasks}
                      </div>
                    )}
                    <p className="text-xs text-slate-500 mt-2">Click to view details, edit, and add notes →</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h3 className="text-xl font-bold text-slate-900 mb-4">Active Topics (In Progress)</h3>
        {topics.length === 0 ? (
          <p className="text-slate-500 text-center py-8">No topics currently marked as in progress. Check the Topics page to start tracking work.</p>
        ) : (
          <div className="space-y-4">
            {topics.map((topic) => {
              const update = getTopicUpdate(topic.id);
              const isExpanded = selectedTopic === topic.id;

              return (
                <div key={topic.id} className="border border-slate-200 rounded-lg overflow-hidden">
                  <div className="p-4 bg-slate-50">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h4 className="text-lg font-semibold text-slate-900">{topic.name}</h4>
                          {update ? (
                            <CheckCircle className="w-5 h-5 text-green-600" />
                          ) : (
                            <Clock className="w-5 h-5 text-slate-400" />
                          )}
                        </div>
                        {topic.description && (
                          <p className="text-sm text-slate-600 mb-2">{topic.description}</p>
                        )}
                        <div className="flex items-center space-x-3 text-xs text-slate-500">
                          {topic.environment && (
                            <span className="px-2 py-1 bg-slate-200 rounded">{topic.environment.toUpperCase()}</span>
                          )}
                          {topic.owner_team && <span>Team: {topic.owner_team}</span>}
                        </div>
                      </div>
                      <button
                        onClick={() => setSelectedTopic(isExpanded ? null : topic.id)}
                        className="flex items-center space-x-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                      >
                        <Plus className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-45' : ''}`} />
                        <span>{update ? 'View/Edit' : 'Add Update'}</span>
                      </button>
                    </div>

                    {update && !isExpanded && (
                      <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                        {update.status_update && (
                          <div className="mb-2">
                            <p className="text-xs font-medium text-green-900">Status:</p>
                            <p className="text-sm text-green-800">{update.status_update}</p>
                          </div>
                        )}
                        {update.blockers && (
                          <div className="mb-2">
                            <p className="text-xs font-medium text-red-900">Blockers:</p>
                            <p className="text-sm text-red-800">{update.blockers}</p>
                          </div>
                        )}
                        {update.next_steps && (
                          <div>
                            <p className="text-xs font-medium text-blue-900">Next Steps:</p>
                            <p className="text-sm text-blue-800">{update.next_steps}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {isExpanded && (
                    <div className="p-4 bg-white border-t border-slate-200">
                      <h5 className="font-medium text-slate-900 mb-3">
                        {update ? 'Today\'s Update' : 'Add Today\'s Update'}
                      </h5>
                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">
                            Status Update
                          </label>
                          <textarea
                            value={updateForm.status_update}
                            onChange={(e) => setUpdateForm({ ...updateForm, status_update: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            rows={2}
                            placeholder="What's the current status?"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">
                            Blockers
                          </label>
                          <textarea
                            value={updateForm.blockers}
                            onChange={(e) => setUpdateForm({ ...updateForm, blockers: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            rows={2}
                            placeholder="Any blockers or issues?"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">
                            Next Steps
                          </label>
                          <textarea
                            value={updateForm.next_steps}
                            onChange={(e) => setUpdateForm({ ...updateForm, next_steps: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            rows={2}
                            placeholder="What are the next steps?"
                          />
                        </div>
                        <div className="flex justify-end space-x-2">
                          <button
                            onClick={() => {
                              setSelectedTopic(null);
                              setUpdateForm({ status_update: '', blockers: '', next_steps: '' });
                            }}
                            className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleAddUpdate(topic.id)}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                          >
                            Save Update
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selectedProject && (
        <ProjectDetailModal
          project={selectedProject}
          onClose={() => setSelectedProject(null)}
          onUpdate={loadStandupData}
        />
      )}

      <IngestProjectsImport
        isOpen={showProjectImport}
        onClose={() => setShowProjectImport(false)}
        onImportComplete={loadStandupData}
      />
    </div>
  );
}
