import { useState, useEffect } from 'react';
import { Coffee, Upload, FolderKanban, Plus } from 'lucide-react';
import { ingestProjectsService } from '../services/database';
import ProjectDetailModal from './ProjectDetailModal';
import IngestProjectsImport from './IngestProjectsImport';

export default function MorningStandup() {
  const [ingestProjects, setIngestProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState<any | null>(null);
  const [showProjectImport, setShowProjectImport] = useState(false);

  useEffect(() => {
    loadStandupData();
  }, []);

  const loadStandupData = async () => {
    try {
      setLoading(true);
      const projectsData = await ingestProjectsService.getAll();
      setIngestProjects(projectsData);
    } catch (error) {
      console.error('Error loading standup data:', error);
    } finally {
      setLoading(false);
    }
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

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center space-x-3">
          <FolderKanban className="w-6 h-6 text-green-600" />
          <div>
            <p className="text-sm text-slate-500">Total Ingest Projects</p>
            <p className="text-3xl font-bold text-slate-900">{ingestProjects.length}</p>
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

