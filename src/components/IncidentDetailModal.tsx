import { useState } from 'react';
import { X, AlertCircle, AlertTriangle, Info, Calendar, User, Tag, FileText, Clock, Plus, Send, Edit2, Save } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface IncidentDetailModalProps {
  incident: any;
  onClose: () => void;
  onResolve?: (id: string) => void;
  onUpdate?: () => void;
}

export default function IncidentDetailModal({ incident, onClose, onResolve, onUpdate }: IncidentDetailModalProps) {
  const [newNote, setNewNote] = useState('');
  const [addingNote, setAddingNote] = useState(false);
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editData, setEditData] = useState({
    date_identified: incident.date_identified ? new Date(incident.date_identified).toISOString().slice(0, 16) : '',
    description: incident.description || ''
  });
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'low':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-300';
    }
  };

  const getPriorityLabel = (priority: number | null) => {
    if (!priority) return 'Not Set';
    switch (priority) {
      case 1: return '1 - Critical';
      case 2: return '2 - High';
      case 3: return '3 - Medium';
      case 4: return '4 - Low';
      default: return priority.toString();
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <AlertCircle className="w-6 h-6 text-red-600" />;
      case 'high':
        return <AlertTriangle className="w-6 h-6 text-orange-600" />;
      case 'medium':
        return <AlertTriangle className="w-6 h-6 text-yellow-600" />;
      case 'low':
        return <Info className="w-6 h-6 text-blue-600" />;
      default:
        return <Info className="w-6 h-6 text-slate-600" />;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const activityLog = incident.activity_log || [];

  const handleAddNote = async () => {
    if (!newNote.trim()) return;

    setAddingNote(true);
    try {
      const updatedLog = [
        ...activityLog,
        {
          author: 'Current User',
          timestamp: new Date().toISOString(),
          note: newNote.trim()
        }
      ];

      const { error } = await supabase
        .from('alerts')
        .update({
          activity_log: updatedLog,
          last_updated: new Date().toISOString()
        })
        .eq('id', incident.id);

      if (error) throw error;

      setNewNote('');
      setShowNoteForm(false);
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Error adding note:', error);
      alert('Failed to add note. Please try again.');
    } finally {
      setAddingNote(false);
    }
  };

  const handleSaveEdit = async () => {
    setAddingNote(true);
    try {
      const updateData: any = {
        last_updated: new Date().toISOString()
      };

      if (editData.date_identified) {
        updateData.date_identified = new Date(editData.date_identified).toISOString();
      }

      if (editData.description.trim()) {
        updateData.description = editData.description.trim();
      }

      const { error } = await supabase
        .from('alerts')
        .update(updateData)
        .eq('id', incident.id);

      if (error) throw error;

      setIsEditMode(false);
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Error updating incident:', error);
      alert('Failed to update incident. Please try again.');
    } finally {
      setAddingNote(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className={`p-6 border-b-4 ${getSeverityColor(incident.severity)}`}>
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-4 flex-1">
              {getSeverityIcon(incident.severity)}
              <div>
                <h2 className="text-2xl font-bold text-slate-900">{incident.title}</h2>
                {incident.incident_number && (
                  <p className="text-slate-600 font-mono text-sm mt-1">{incident.incident_number}</p>
                )}
              </div>
            </div>
            <div className="flex items-center space-x-2">
              {!isEditMode ? (
                <button
                  onClick={() => setIsEditMode(true)}
                  className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                >
                  <Edit2 className="w-4 h-4" />
                  <span>Edit</span>
                </button>
              ) : (
                <button
                  onClick={handleSaveEdit}
                  disabled={addingNote}
                  className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{addingNote ? 'Saving...' : 'Save'}</span>
                </button>
              )}
              <button
                onClick={onClose}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-50 rounded-lg p-4">
              <div className="flex items-center space-x-2 mb-2">
                <AlertCircle className="w-4 h-4 text-slate-600" />
                <span className="text-sm font-medium text-slate-600">Severity</span>
              </div>
              <p className="text-lg font-semibold text-slate-900 capitalize">{incident.severity}</p>
            </div>

            <div className="bg-slate-50 rounded-lg p-4">
              <div className="flex items-center space-x-2 mb-2">
                <Tag className="w-4 h-4 text-slate-600" />
                <span className="text-sm font-medium text-slate-600">Priority</span>
              </div>
              <p className="text-lg font-semibold text-slate-900">{getPriorityLabel(incident.priority)}</p>
            </div>

            <div className="bg-slate-50 rounded-lg p-4">
              <div className="flex items-center space-x-2 mb-2">
                <Calendar className="w-4 h-4 text-slate-600" />
                <span className="text-sm font-medium text-slate-600">Date Identified</span>
              </div>
              {isEditMode ? (
                <input
                  type="datetime-local"
                  value={editData.date_identified}
                  onChange={(e) => setEditData({ ...editData, date_identified: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              ) : (
                <p className="text-sm font-semibold text-slate-900">
                  {incident.date_identified ? formatDate(incident.date_identified) : 'Not specified'}
                </p>
              )}
            </div>

            <div className="bg-slate-50 rounded-lg p-4">
              <div className="flex items-center space-x-2 mb-2">
                <Clock className="w-4 h-4 text-slate-600" />
                <span className="text-sm font-medium text-slate-600">Status</span>
              </div>
              <p className="text-lg font-semibold text-slate-900">
                {incident.resolved ? (
                  <span className="text-green-600">Resolved</span>
                ) : (
                  <span className="text-orange-600">Open</span>
                )}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {incident.v1_story && (
              <div>
                <h3 className="text-sm font-medium text-slate-600 mb-2">V1 Story</h3>
                <p className="text-slate-900 bg-slate-100 px-3 py-2 rounded font-mono text-sm">{incident.v1_story}</p>
              </div>
            )}
            {incident.story_type && (
              <div>
                <h3 className="text-sm font-medium text-slate-600 mb-2">Story Type</h3>
                <p className="text-slate-900 bg-slate-100 px-3 py-2 rounded">{incident.story_type}</p>
              </div>
            )}
          </div>

          {incident.business_service && (
            <div>
              <h3 className="text-sm font-medium text-slate-600 mb-2">Business Service</h3>
              <p className="text-slate-900 bg-blue-50 px-3 py-2 rounded border border-blue-200">
                {incident.business_service}
              </p>
            </div>
          )}

          {(incident.category || incident.subcategory) && (
            <div className="grid grid-cols-2 gap-4">
              {incident.category && (
                <div>
                  <h3 className="text-sm font-medium text-slate-600 mb-2">Category</h3>
                  <p className="text-slate-900 bg-slate-100 px-3 py-2 rounded">{incident.category}</p>
                </div>
              )}
              {incident.subcategory && (
                <div>
                  <h3 className="text-sm font-medium text-slate-600 mb-2">Subcategory</h3>
                  <p className="text-slate-900 bg-slate-100 px-3 py-2 rounded">{incident.subcategory}</p>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            {incident.team_assigned && (
              <div>
                <h3 className="text-sm font-medium text-slate-600 mb-2">Team Assigned</h3>
                <p className="text-slate-900 bg-slate-100 px-3 py-2 rounded">{incident.team_assigned}</p>
              </div>
            )}
            {incident.release_date && (
              <div>
                <h3 className="text-sm font-medium text-slate-600 mb-2">Release Date</h3>
                <p className="text-slate-900 bg-slate-100 px-3 py-2 rounded">
                  {new Date(incident.release_date).toLocaleDateString()}
                </p>
              </div>
            )}
          </div>

          {incident.assignment_group && (
            <div>
              <h3 className="text-sm font-medium text-slate-600 mb-2 flex items-center space-x-2">
                <User className="w-4 h-4" />
                <span>Assignment Group</span>
              </h3>
              <p className="text-slate-900 bg-slate-100 px-3 py-2 rounded">{incident.assignment_group}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            {incident.age !== null && incident.age !== undefined && (
              <div>
                <h3 className="text-sm font-medium text-slate-600 mb-2">Age (Days)</h3>
                <p className="text-slate-900 bg-slate-100 px-3 py-2 rounded font-semibold">{incident.age} days</p>
              </div>
            )}
            {incident.identified_by && (
              <div>
                <h3 className="text-sm font-medium text-slate-600 mb-2">Identified By</h3>
                <p className="text-slate-900 bg-slate-100 px-3 py-2 rounded">{incident.identified_by}</p>
              </div>
            )}
          </div>

          {incident.functional_impact && (
            <div>
              <h3 className="text-sm font-medium text-slate-600 mb-2">Functional Impact</h3>
              <div className="text-slate-900 bg-orange-50 px-4 py-3 rounded border border-orange-200">
                <p className="whitespace-pre-wrap">{incident.functional_impact}</p>
              </div>
            </div>
          )}

          {incident.topic?.name && (
            <div>
              <h3 className="text-sm font-medium text-slate-600 mb-2">Related Topic</h3>
              <p className="text-slate-900 bg-slate-100 px-3 py-2 rounded font-mono text-sm">
                {incident.topic.name}
              </p>
            </div>
          )}

          <div>
            <h3 className="text-sm font-medium text-slate-600 mb-2 flex items-center space-x-2">
              <FileText className="w-4 h-4" />
              <span>Description</span>
            </h3>
            {isEditMode ? (
              <textarea
                value={editData.description}
                onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={4}
                placeholder="Enter incident description..."
              />
            ) : (
              <div className="text-slate-900 bg-slate-50 px-4 py-3 rounded border border-slate-200">
                <p className="whitespace-pre-wrap">{incident.description || 'No description provided'}</p>
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-slate-600">Activity Log & Notes</h3>
              {!showNoteForm && (
                <button
                  onClick={() => setShowNoteForm(true)}
                  className="flex items-center space-x-2 px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Note</span>
                </button>
              )}
            </div>

            {showNoteForm && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-3">
                <label className="block text-sm font-medium text-slate-700 mb-2">Add a new note</label>
                <textarea
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="Enter your note here..."
                  disabled={addingNote}
                />
                <div className="flex justify-end space-x-2 mt-2">
                  <button
                    onClick={() => {
                      setShowNoteForm(false);
                      setNewNote('');
                    }}
                    className="px-3 py-1 text-slate-700 hover:bg-slate-200 rounded-lg transition-colors text-sm"
                    disabled={addingNote}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddNote}
                    className="flex items-center space-x-2 px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm disabled:opacity-50"
                    disabled={addingNote || !newNote.trim()}
                  >
                    <Send className="w-4 h-4" />
                    <span>{addingNote ? 'Saving...' : 'Save Note'}</span>
                  </button>
                </div>
              </div>
            )}

            {activityLog && activityLog.length > 0 ? (
              <div className="space-y-3">
                {activityLog.map((entry: any, index: number) => (
                  <div key={index} className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                    <div className="flex items-start justify-between mb-2">
                      <p className="text-sm font-medium text-slate-900">{entry.author || 'System'}</p>
                      <p className="text-xs text-slate-500">{entry.timestamp ? formatDate(entry.timestamp) : ''}</p>
                    </div>
                    <p className="text-sm text-slate-700 whitespace-pre-wrap">{entry.note || entry.message}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500 text-center py-4">No notes yet. Click "Add Note" to get started.</p>
            )}
          </div>

          {incident.resolved && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h3 className="text-sm font-medium text-green-900 mb-2">Resolution Details</h3>
              <div className="space-y-1 text-sm text-green-800">
                {incident.resolved_at && (
                  <p>Resolved: {formatDate(incident.resolved_at)}</p>
                )}
                {incident.resolved_by && (
                  <p>Resolved by: {incident.resolved_by}</p>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="p-6 bg-slate-50 border-t border-slate-200 flex justify-between">
          <button
            onClick={onClose}
            className="px-6 py-2 text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
          >
            Close
          </button>
          {!incident.resolved && onResolve && (
            <button
              onClick={() => {
                onResolve(incident.id);
                onClose();
              }}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              Mark as Resolved
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
