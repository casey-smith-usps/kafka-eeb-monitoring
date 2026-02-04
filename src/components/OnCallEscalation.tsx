import { useState, useEffect } from 'react';
import { Phone, Users, Calendar, Plus, Pencil, Trash2, Save, X, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface TeamMember {
  id: string;
  name: string;
  usps_email: string | null;
  afs_email: string | null;
  ace_id: string | null;
  cell_phone: string | null;
  level: string | null;
  sort_order: number;
}

interface Rotation {
  id: string;
  start_date: string;
  end_date: string;
  primary_name: string;
  secondary_name: string;
  tertiary_name: string;
  notes: string | null;
}

export default function OnCallEscalation() {
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [rotations, setRotations] = useState<Rotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingMember, setEditingMember] = useState<string | null>(null);
  const [editingRotation, setEditingRotation] = useState<string | null>(null);
  const [memberForm, setMemberForm] = useState<Partial<TeamMember>>({});
  const [rotationForm, setRotationForm] = useState<Partial<Rotation>>({});

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [membersData, rotationsData] = await Promise.all([
        supabase.from('oncall_team_members').select('*').order('sort_order'),
        supabase.from('oncall_rotation').select('*').order('start_date')
      ]);

      if (membersData.data) setTeamMembers(membersData.data);
      if (rotationsData.data) setRotations(rotationsData.data);
    } catch (error) {
      console.error('Error loading on-call data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEditMember = (member: TeamMember) => {
    setEditingMember(member.id);
    setMemberForm(member);
  };

  const handleSaveMember = async () => {
    if (!editingMember) return;

    try {
      const { error } = await supabase
        .from('oncall_team_members')
        .update(memberForm)
        .eq('id', editingMember);

      if (error) throw error;

      setEditingMember(null);
      setMemberForm({});
      loadData();
    } catch (error) {
      console.error('Error updating team member:', error);
      alert('Failed to update team member');
    }
  };

  const handleDeleteMember = async (id: string) => {
    if (!confirm('Are you sure you want to delete this team member?')) return;

    try {
      const { error } = await supabase
        .from('oncall_team_members')
        .delete()
        .eq('id', id);

      if (error) throw error;
      loadData();
    } catch (error) {
      console.error('Error deleting team member:', error);
      alert('Failed to delete team member');
    }
  };

  const handleEditRotation = (rotation: Rotation) => {
    setEditingRotation(rotation.id);
    setRotationForm(rotation);
  };

  const handleSaveRotation = async () => {
    if (!editingRotation) return;

    try {
      const { error } = await supabase
        .from('oncall_rotation')
        .update(rotationForm)
        .eq('id', editingRotation);

      if (error) throw error;

      setEditingRotation(null);
      setRotationForm({});
      loadData();
    } catch (error) {
      console.error('Error updating rotation:', error);
      alert('Failed to update rotation');
    }
  };

  const handleDeleteRotation = async (id: string) => {
    if (!confirm('Are you sure you want to delete this rotation entry?')) return;

    try {
      const { error} = await supabase
        .from('oncall_rotation')
        .delete()
        .eq('id', id);

      if (error) throw error;
      loadData();
    } catch (error) {
      console.error('Error deleting rotation:', error);
      alert('Failed to delete rotation');
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
      <div className="flex items-center space-x-3">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-3 rounded-lg">
          <Phone className="w-6 h-6 text-white" />
        </div>
        <div>
          <h2 className="text-3xl font-bold text-slate-900">EEB On-Call & Escalation</h2>
          <p className="text-slate-500 mt-1">Team contact information and rotation schedule</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Users className="w-5 h-5 text-blue-600" />
            <h3 className="text-xl font-bold text-slate-900">Team Members</h3>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Name</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">USPS Email</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">AFS Email</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">ACE ID</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Cell Phone</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Level</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {teamMembers.map((member) => (
                <tr key={member.id} className="border-b border-slate-100 hover:bg-slate-50">
                  {editingMember === member.id ? (
                    <>
                      <td className="py-3 px-4">
                        <input
                          type="text"
                          value={memberForm.name || ''}
                          onChange={(e) => setMemberForm({ ...memberForm, name: e.target.value })}
                          className="w-full px-2 py-1 border border-slate-300 rounded text-sm"
                        />
                      </td>
                      <td className="py-3 px-4">
                        <input
                          type="email"
                          value={memberForm.usps_email || ''}
                          onChange={(e) => setMemberForm({ ...memberForm, usps_email: e.target.value })}
                          className="w-full px-2 py-1 border border-slate-300 rounded text-sm"
                        />
                      </td>
                      <td className="py-3 px-4">
                        <input
                          type="email"
                          value={memberForm.afs_email || ''}
                          onChange={(e) => setMemberForm({ ...memberForm, afs_email: e.target.value })}
                          className="w-full px-2 py-1 border border-slate-300 rounded text-sm"
                        />
                      </td>
                      <td className="py-3 px-4">
                        <input
                          type="text"
                          value={memberForm.ace_id || ''}
                          onChange={(e) => setMemberForm({ ...memberForm, ace_id: e.target.value })}
                          className="w-full px-2 py-1 border border-slate-300 rounded text-sm"
                        />
                      </td>
                      <td className="py-3 px-4">
                        <input
                          type="tel"
                          value={memberForm.cell_phone || ''}
                          onChange={(e) => setMemberForm({ ...memberForm, cell_phone: e.target.value })}
                          className="w-full px-2 py-1 border border-slate-300 rounded text-sm"
                        />
                      </td>
                      <td className="py-3 px-4">
                        <input
                          type="text"
                          value={memberForm.level || ''}
                          onChange={(e) => setMemberForm({ ...memberForm, level: e.target.value })}
                          className="w-full px-2 py-1 border border-slate-300 rounded text-sm"
                        />
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex justify-end space-x-2">
                          <button
                            onClick={handleSaveMember}
                            className="p-1 text-green-600 hover:bg-green-50 rounded"
                          >
                            <Save className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              setEditingMember(null);
                              setMemberForm({});
                            }}
                            className="p-1 text-slate-600 hover:bg-slate-100 rounded"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="py-3 px-4 text-sm font-medium text-slate-900">{member.name}</td>
                      <td className="py-3 px-4 text-sm text-slate-600">{member.usps_email || '-'}</td>
                      <td className="py-3 px-4 text-sm text-slate-600">{member.afs_email || '-'}</td>
                      <td className="py-3 px-4 text-sm text-slate-600 font-mono">{member.ace_id || '-'}</td>
                      <td className="py-3 px-4 text-sm text-slate-600">{member.cell_phone || '-'}</td>
                      <td className="py-3 px-4 text-sm text-slate-600">
                        {member.level && (
                          <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded">
                            {member.level}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex justify-end space-x-2">
                          <button
                            onClick={() => handleEditMember(member)}
                            className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteMember(member.id)}
                            className="p-1 text-red-600 hover:bg-red-50 rounded"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Calendar className="w-5 h-5 text-blue-600" />
            <h3 className="text-xl font-bold text-slate-900">On-Call Rotation Schedule</h3>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Start Date</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">End Date</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Primary</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Secondary</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Tertiary (Lead)</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rotations.map((rotation) => (
                <tr key={rotation.id} className="border-b border-slate-100 hover:bg-slate-50">
                  {editingRotation === rotation.id ? (
                    <>
                      <td className="py-3 px-4">
                        <input
                          type="date"
                          value={rotationForm.start_date || ''}
                          onChange={(e) => setRotationForm({ ...rotationForm, start_date: e.target.value })}
                          className="w-full px-2 py-1 border border-slate-300 rounded text-sm"
                        />
                      </td>
                      <td className="py-3 px-4">
                        <input
                          type="date"
                          value={rotationForm.end_date || ''}
                          onChange={(e) => setRotationForm({ ...rotationForm, end_date: e.target.value })}
                          className="w-full px-2 py-1 border border-slate-300 rounded text-sm"
                        />
                      </td>
                      <td className="py-3 px-4">
                        <input
                          type="text"
                          value={rotationForm.primary_name || ''}
                          onChange={(e) => setRotationForm({ ...rotationForm, primary_name: e.target.value })}
                          className="w-full px-2 py-1 border border-slate-300 rounded text-sm"
                        />
                      </td>
                      <td className="py-3 px-4">
                        <input
                          type="text"
                          value={rotationForm.secondary_name || ''}
                          onChange={(e) => setRotationForm({ ...rotationForm, secondary_name: e.target.value })}
                          className="w-full px-2 py-1 border border-slate-300 rounded text-sm"
                        />
                      </td>
                      <td className="py-3 px-4">
                        <input
                          type="text"
                          value={rotationForm.tertiary_name || ''}
                          onChange={(e) => setRotationForm({ ...rotationForm, tertiary_name: e.target.value })}
                          className="w-full px-2 py-1 border border-slate-300 rounded text-sm"
                        />
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex justify-end space-x-2">
                          <button
                            onClick={handleSaveRotation}
                            className="p-1 text-green-600 hover:bg-green-50 rounded"
                          >
                            <Save className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              setEditingRotation(null);
                              setRotationForm({});
                            }}
                            className="p-1 text-slate-600 hover:bg-slate-100 rounded"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="py-3 px-4 text-sm text-slate-900">
                        {new Date(rotation.start_date).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4 text-sm text-slate-900">
                        {new Date(rotation.end_date).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4 text-sm font-medium text-slate-900">{rotation.primary_name}</td>
                      <td className="py-3 px-4 text-sm text-slate-700">{rotation.secondary_name}</td>
                      <td className="py-3 px-4 text-sm text-slate-700">{rotation.tertiary_name}</td>
                      <td className="py-3 px-4">
                        <div className="flex justify-end space-x-2">
                          <button
                            onClick={() => handleEditRotation(rotation)}
                            className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteRotation(rotation.id)}
                            className="p-1 text-red-600 hover:bg-red-50 rounded"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-gradient-to-br from-red-50 to-orange-50 rounded-xl shadow-sm border border-red-200 p-6">
        <div className="flex items-start space-x-3 mb-4">
          <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-1" />
          <div>
            <h3 className="text-xl font-bold text-red-900 mb-2">EEB On-Call Support Escalation Procedure</h3>
            <div className="text-sm text-red-800 space-y-4">
              <p className="font-medium">Take the following actions for EEB Critical alerts:</p>
              <ol className="list-decimal ml-5 space-y-2">
                <li>Initiate a High incident ticket and assign it to SDS Enterprise Event Broker</li>
                <li>Contact the on-call support staff by following the escalation procedure below</li>
                <li>The on-call support staff will investigate the alert and either upgrade the ticket to Critical and request ESM to create a bridge call or resolve the ticket if no action is needed</li>
              </ol>

              <div className="mt-6">
                <h4 className="font-bold mb-3">On-Call Escalation Procedure (EEB – EIR 9372.00)</h4>
                <ol className="list-decimal ml-5 space-y-3">
                  <li><strong>Utilize Everbridge list for On Call schedule</strong> (Primary, Secondary, back-up). Call each up to 3 times consecutively, leave a message, wait 5 minutes. Then move to step 2.</li>
                  <li><strong>Call the Project lead</strong> up to 3 times consecutively, leave a voicemail, wait 5 minutes. Then move to step 3.
                    <ul className="list-disc ml-5 mt-2 space-y-1">
                      <li>Casey Smith Mobile: 816.308.8564</li>
                      <li>Ashly Mathew Mobile: 919-633-9847</li>
                    </ul>
                  </li>
                  <li><strong>Call Observability team members</strong> up to 3 times consecutively and leave a voicemail, wait 5 minutes. Then move to step 4.
                    <ul className="list-disc ml-5 mt-2 space-y-1">
                      <li>Jeff Kuang: 919-408-1323</li>
                      <li>Jingyu Huang: 510.528.9666</li>
                      <li>Shawn Finn: 716.821.0803</li>
                    </ul>
                  </li>
                  <li><strong>Call Postal Manager</strong> up to 3 times, leave a voicemail, wait 5 minutes
                    <ul className="list-disc ml-5 mt-2 space-y-1">
                      <li>Peermohamed Kajakamaludeen Mobile: 919.412.7034</li>
                      <li>Jason Rodgers Mobile: 708.295.0410</li>
                      <li>Shirley B Hargett Mobile: 919.455.5922</li>
                      <li>Paul Geske Mobile: 919.523.6782</li>
                    </ul>
                  </li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
