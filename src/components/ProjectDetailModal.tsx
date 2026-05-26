import { useState, useEffect } from 'react';
import { X, Save, Plus, Send, Calendar } from 'lucide-react';
import { ingestProjectsService } from '../services/database';

interface ProjectDetailModalProps {
  project: any;
  onClose: () => void;
  onUpdate: () => void;
}

export default function ProjectDetailModal({ project, onClose, onUpdate }: ProjectDetailModalProps) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState(project);
  const [newNote, setNewNote] = useState('');
  const [addingNote, setAddingNote] = useState(false);
  const [showNoteForm, setShowNoteForm] = useState(false);

  useEffect(() => {
    setFormData(project);
  }, [project]);

  const environments = ['dev', 'sit', 'cat', 'prod'];

  const handleSave = async () => {
    setSaving(true);
    try {
      await ingestProjectsService.update(project.id, formData);
      setEditing(false);
      onUpdate();
    } catch (error) {
      console.error('Error updating project:', error);
      alert('Failed to save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) return;

    setAddingNote(true);
    try {
      const notes = formData.notes || [];
      const updatedNotes = [
        ...notes,
        {
          author: 'Current User',
          timestamp: new Date().toISOString(),
          note: newNote.trim()
        }
      ];

      await ingestProjectsService.update(project.id, {
        notes: updatedNotes
      });

      setNewNote('');
      setShowNoteForm(false);
      setFormData({ ...formData, notes: updatedNotes });
      onUpdate();
    } catch (error) {
      console.error('Error adding note:', error);
      alert('Failed to add note. Please try again.');
    } finally {
      setAddingNote(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Not set';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const notes = formData.notes || [];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-slate-200 bg-gradient-to-r from-green-50 to-blue-50">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">{project.title}</h2>
              {formData.owner && (
                <p className="text-slate-600 mt-1">Owner: {formData.owner}</p>
              )}
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {editing ? (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Title</label>
                  <input
                    type="text"
                    value={formData.title || ''}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Owner</label>
                  <input
                    type="text"
                    value={formData.owner || ''}
                    onChange={(e) => setFormData({ ...formData, owner: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                  <input
                    type="text"
                    value={formData.status || ''}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="On Hold, In Progress, Complete, etc."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Current Environment</label>
                  <select
                    value={formData.environment || ''}
                    onChange={(e) => setFormData({ ...formData, environment: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Not set</option>
                    {environments.map(env => (
                      <option key={env} value={env}>{env.toUpperCase()}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Prod Date</label>
                  <input
                    type="date"
                    value={formData.prod_date || ''}
                    onChange={(e) => setFormData({ ...formData, prod_date: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Status 2</label>
                  <textarea
                    value={formData.status2 || ''}
                    onChange={(e) => setFormData({ ...formData, status2: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={3}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tasks</label>
                  <textarea
                    value={formData.tasks || ''}
                    onChange={(e) => setFormData({ ...formData, tasks: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={3}
                  />
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-slate-900 mb-3">Environment Timeline</h3>
                <div className="grid grid-cols-2 gap-4">
                  {environments.map(env => (
                    <div key={env} className="space-y-2">
                      <h4 className="text-sm font-medium text-slate-700 uppercase">{env}</h4>
                      <div>
                        <label className="block text-xs text-slate-600 mb-1">Completed Date</label>
                        <input
                          type="date"
                          value={formData[`${env}_completed_date`] || ''}
                          onChange={(e) => setFormData({ ...formData, [`${env}_completed_date`]: e.target.value })}
                          className="w-full px-2 py-1 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-600 mb-1">Projected Date</label>
                        <input
                          type="date"
                          value={formData[`${env}_projected_date`] || ''}
                          onChange={(e) => setFormData({ ...formData, [`${env}_projected_date`]: e.target.value })}
                          className="w-full px-2 py-1 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 rounded-lg p-4">
                  <div className="text-sm font-medium text-slate-600 mb-1">Status</div>
                  <p className="text-slate-900">{formData.status || 'Not set'}</p>
                </div>

                <div className="bg-slate-50 rounded-lg p-4">
                  <div className="text-sm font-medium text-slate-600 mb-1">Current Environment</div>
                  <p className="text-slate-900 uppercase font-semibold">{formData.environment || 'Not set'}</p>
                </div>

                <div className="bg-slate-50 rounded-lg p-4">
                  <div className="text-sm font-medium text-slate-600 mb-1">Prod Date</div>
                  <p className="text-slate-900">{formatDate(formData.prod_date)}</p>
                </div>

                <div className="bg-slate-50 rounded-lg p-4">
                  <div className="text-sm font-medium text-slate-600 mb-1">Owner</div>
                  <p className="text-slate-900">{formData.owner || 'Not assigned'}</p>
                </div>
              </div>

              {formData.status2 && (
                <div>
                  <h3 className="text-sm font-medium text-slate-600 mb-2">Status Details</h3>
                  <div className="bg-blue-50 px-4 py-3 rounded border border-blue-200">
                    <p className="text-slate-900 whitespace-pre-wrap">{formData.status2}</p>
                  </div>
                </div>
              )}

              {formData.tasks && (
                <div>
                  <h3 className="text-sm font-medium text-slate-600 mb-2">Tasks</h3>
                  <div className="bg-slate-50 px-4 py-3 rounded border border-slate-200">
                    <p className="text-slate-900 whitespace-pre-wrap">{formData.tasks}</p>
                  </div>
                </div>
              )}

              <div>
                <h3 className="text-lg font-semibold text-slate-900 mb-3 flex items-center space-x-2">
                  <Calendar className="w-5 h-5" />
                  <span>Environment Timeline</span>
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  {environments.map(env => (
                    <div key={env} className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                      <h4 className="text-sm font-semibold text-slate-700 uppercase mb-2">{env}</h4>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-slate-600">Completed:</span>
                          <span className="text-green-700 font-medium">{formatDate(formData[`${env}_completed_date`])}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-600">Projected:</span>
                          <span className="text-blue-700 font-medium">{formatDate(formData[`${env}_projected_date`])}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-slate-900">Notes</h3>
              {!editing && !showNoteForm && (
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

            {notes.length > 0 ? (
              <div className="space-y-3">
                {notes.map((note: any, index: number) => (
                  <div key={index} className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                    <div className="flex items-start justify-between mb-2">
                      <p className="text-sm font-medium text-slate-900">{note.author || 'System'}</p>
                      <p className="text-xs text-slate-500">
                        {note.timestamp ? new Date(note.timestamp).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        }) : ''}
                      </p>
                    </div>
                    <p className="text-sm text-slate-700 whitespace-pre-wrap">{note.note}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500 text-center py-4">No notes yet. Click "Add Note" to get started.</p>
            )}
          </div>
        </div>

        <div className="p-6 bg-slate-50 border-t border-slate-200 flex justify-between">
          <button
            onClick={onClose}
            className="px-6 py-2 text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
          >
            Close
          </button>
          {editing ? (
            <div className="flex space-x-2">
              <button
                onClick={() => {
                  setEditing(false);
                  setFormData(project);
                }}
                className="px-6 py-2 text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center space-x-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                <Save className="w-5 h-5" />
                <span>{saving ? 'Saving...' : 'Save Changes'}</span>
              </button>
            </div>
          ) : (
            <button
              onClick={() => setEditing(true)}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Edit Project
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
