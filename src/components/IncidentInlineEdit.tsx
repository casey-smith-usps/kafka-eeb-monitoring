import { useState } from 'react';
import { Edit2, Save, X, Calendar, FileText } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface IncidentInlineEditProps {
  incident: any;
  onUpdate: () => void;
}

export default function IncidentInlineEdit({ incident, onUpdate }: IncidentInlineEditProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editData, setEditData] = useState({
    date_identified: incident.date_identified ? new Date(incident.date_identified).toISOString().slice(0, 16) : '',
    notes: incident.activity_log?.[0]?.note || ''
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      const updateData: any = {
        last_updated: new Date().toISOString()
      };

      // Update date_identified if provided
      if (editData.date_identified) {
        updateData.date_identified = new Date(editData.date_identified).toISOString();
      }

      // Update activity_log if notes provided
      if (editData.notes.trim()) {
        const existingLog = incident.activity_log || [];
        const newEntry = {
          author: 'User',
          timestamp: new Date().toISOString(),
          note: editData.notes.trim()
        };

        // If there's no existing log, create new one; otherwise append
        if (existingLog.length === 0) {
          updateData.activity_log = [newEntry];
        } else {
          // Update the first note if it exists, otherwise add new
          updateData.activity_log = [newEntry, ...existingLog.slice(1)];
        }
      }

      const { error } = await supabase
        .from('alerts')
        .update(updateData)
        .eq('id', incident.id);

      if (error) throw error;

      setIsEditing(false);
      onUpdate();
    } catch (error) {
      console.error('Error updating incident:', error);
      alert('Failed to update incident. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditData({
      date_identified: incident.date_identified ? new Date(incident.date_identified).toISOString().slice(0, 16) : '',
      notes: incident.activity_log?.[0]?.note || ''
    });
    setIsEditing(false);
  };

  if (!isEditing) {
    return (
      <tr className="hover:bg-slate-50 cursor-pointer" onClick={() => setIsEditing(true)}>
        <td className="px-4 py-3 font-mono text-sm">{incident.incident_number || '-'}</td>
        <td className="px-4 py-3">
          <div className="flex items-start space-x-2">
            <div className="flex-1">
              <p className="font-medium text-slate-900">{incident.title}</p>
              {incident.description && (
                <p className="text-sm text-slate-600 mt-1">{incident.description.substring(0, 100)}...</p>
              )}
            </div>
          </div>
        </td>
        <td className="px-4 py-3">
          <span className={`px-2 py-1 rounded text-xs font-medium ${
            incident.severity === 'critical' ? 'bg-red-100 text-red-800' :
            incident.severity === 'high' ? 'bg-orange-100 text-orange-800' :
            incident.severity === 'medium' ? 'bg-yellow-100 text-yellow-800' :
            'bg-blue-100 text-blue-800'
          }`}>
            {incident.severity}
          </span>
        </td>
        <td className="px-4 py-3 text-sm">
          {incident.date_identified ? (
            <span className="text-slate-900">{new Date(incident.date_identified).toLocaleDateString()}</span>
          ) : (
            <span className="text-red-600 font-semibold">Not Set</span>
          )}
        </td>
        <td className="px-4 py-3 text-sm">
          {incident.activity_log?.length > 0 ? (
            <span className="text-green-700">Has notes</span>
          ) : (
            <span className="text-slate-400">No notes</span>
          )}
        </td>
        <td className="px-4 py-3">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsEditing(true);
            }}
            className="text-blue-600 hover:text-blue-800"
          >
            <Edit2 className="w-4 h-4" />
          </button>
        </td>
      </tr>
    );
  }

  return (
    <tr className="bg-blue-50">
      <td className="px-4 py-3 font-mono text-sm">{incident.incident_number || '-'}</td>
      <td className="px-4 py-3" colSpan={3}>
        <div className="space-y-3">
          <div>
            <label className="flex items-center space-x-2 text-sm font-medium text-slate-700 mb-1">
              <Calendar className="w-4 h-4" />
              <span>Date Identified</span>
            </label>
            <input
              type="datetime-local"
              value={editData.date_identified}
              onChange={(e) => setEditData({ ...editData, date_identified: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="flex items-center space-x-2 text-sm font-medium text-slate-700 mb-1">
              <FileText className="w-4 h-4" />
              <span>Notes</span>
            </label>
            <textarea
              value={editData.notes}
              onChange={(e) => setEditData({ ...editData, notes: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={4}
              placeholder="Add notes about this incident..."
            />
          </div>
        </div>
      </td>
      <td className="px-4 py-3" colSpan={2}>
        <div className="flex items-center space-x-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center space-x-1 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Saving...' : 'Save'}</span>
          </button>
          <button
            onClick={handleCancel}
            disabled={saving}
            className="flex items-center space-x-1 px-3 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 disabled:opacity-50 text-sm"
          >
            <X className="w-4 h-4" />
            <span>Cancel</span>
          </button>
        </div>
      </td>
    </tr>
  );
}
