import React, { useState, useEffect } from 'react';
import { Users, Shield, Eye, Edit3, Ban, CheckCircle, X, UserPlus, Mail, Copy, Clock } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  role: 'admin' | 'editor' | 'viewer';
  status: 'active' | 'pending' | 'disabled';
  access_token: string | null;
  created_at: string;
  updated_at: string;
}

interface AccessRequest {
  id: string;
  email: string;
  full_name: string;
  reason: string | null;
  status: 'pending' | 'approved' | 'rejected';
  requested_at: string;
}

export const UserManagement: React.FC = () => {
  const { isAdmin, userProfile } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [accessRequests, setAccessRequests] = useState<AccessRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'users' | 'requests'>('requests');
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [newUser, setNewUser] = useState({ email: '', fullName: '', role: 'viewer' as 'admin' | 'editor' | 'viewer' });
  const [emailInstructions, setEmailInstructions] = useState<{ show: boolean; user: UserProfile | null }>({ show: false, user: null });

  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
      fetchAccessRequests();
    }
  }, [isAdmin]);

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch users');
    }
  };

  const fetchAccessRequests = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('access_requests')
        .select('*')
        .eq('status', 'pending')
        .order('requested_at', { ascending: false });

      if (error) throw error;
      setAccessRequests(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch access requests');
    } finally {
      setLoading(false);
    }
  };

  const generateAccessToken = () => {
    return `eeb_${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}${Date.now().toString(36)}`;
  };

  const approveAccessRequest = async (request: AccessRequest, role: 'admin' | 'editor' | 'viewer') => {
    try {
      const accessToken = generateAccessToken();

      const { error: insertError } = await supabase
        .from('user_profiles')
        .insert([{
          email: request.email,
          full_name: request.full_name,
          role,
          status: 'active',
          access_token: accessToken,
        }]);

      if (insertError) throw insertError;

      const { error: updateError } = await supabase
        .from('access_requests')
        .update({
          status: 'approved',
          reviewed_at: new Date().toISOString(),
          reviewed_by: userProfile?.id,
        })
        .eq('id', request.id);

      if (updateError) throw updateError;

      setSuccessMessage(`Access approved for ${request.email}. Copy their access link to send them.`);
      setTimeout(() => setSuccessMessage(null), 5000);
      fetchAccessRequests();
      fetchUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve request');
      setTimeout(() => setError(null), 3000);
    }
  };

  const rejectAccessRequest = async (requestId: string) => {
    try {
      const { error } = await supabase
        .from('access_requests')
        .update({
          status: 'rejected',
          reviewed_at: new Date().toISOString(),
          reviewed_by: userProfile?.id,
        })
        .eq('id', requestId);

      if (error) throw error;

      setSuccessMessage('Access request rejected');
      setTimeout(() => setSuccessMessage(null), 3000);
      fetchAccessRequests();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject request');
      setTimeout(() => setError(null), 3000);
    }
  };

  const addUserDirectly = async () => {
    if (!newUser.email || !newUser.fullName) {
      setError('Email and full name are required');
      setTimeout(() => setError(null), 3000);
      return;
    }

    try {
      const accessToken = generateAccessToken();

      const { error: insertError } = await supabase
        .from('user_profiles')
        .insert([{
          email: newUser.email,
          full_name: newUser.fullName,
          role: newUser.role,
          status: 'active',
          access_token: accessToken,
        }]);

      if (insertError) {
        if (insertError.message.includes('duplicate') || insertError.message.includes('unique')) {
          setError('A user with this email already exists');
        } else {
          throw insertError;
        }
        return;
      }

      setSuccessMessage(`User ${newUser.email} added successfully! Copy their access link.`);
      setTimeout(() => setSuccessMessage(null), 5000);
      setShowAddUserModal(false);
      setNewUser({ email: '', fullName: '', role: 'viewer' });
      fetchUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add user');
      setTimeout(() => setError(null), 3000);
    }
  };

  const copyAccessLink = async (user: UserProfile) => {
    if (!user.access_token) return;

    const accessLink = `${window.location.origin}?token=${user.access_token}`;
    await navigator.clipboard.writeText(accessLink);
    setCopiedToken(user.id);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const showEmailInstructions = (user: UserProfile) => {
    setEmailInstructions({ show: true, user });
  };

  const copyEmailTemplate = async () => {
    if (!emailInstructions.user?.access_token) return;

    const accessLink = `${window.location.origin}?token=${emailInstructions.user.access_token}`;
    const emailTemplate = `Subject: Your Access to Kafka EEB Monitoring Dashboard

Hello ${emailInstructions.user.full_name || emailInstructions.user.email},

You have been granted access to the Kafka EEB Monitoring Dashboard with ${emailInstructions.user.role} privileges.

To access the dashboard:

1. Click this link: ${accessLink}

2. Or go to ${window.location.origin} and enter this access token:
   ${emailInstructions.user.access_token}

IMPORTANT: Please save this token securely. You'll need it to log in each time you access the dashboard from a new browser.

Role: ${emailInstructions.user.role.charAt(0).toUpperCase() + emailInstructions.user.role.slice(1)}
- Admin: Full access to manage users and all data
- Editor: Can create, edit, and delete topics and incidents
- Viewer: Read-only access to view all information

If you have any questions or need assistance, please contact your administrator.

Best regards,
Kafka EEB Monitoring Team`;

    await navigator.clipboard.writeText(emailTemplate);
    setSuccessMessage('Email template copied to clipboard!');
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const updateUserRole = async (userId: string, newRole: 'admin' | 'editor' | 'viewer') => {
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ role: newRole })
        .eq('id', userId);

      if (error) throw error;

      setSuccessMessage(`User role updated to ${newRole}`);
      setTimeout(() => setSuccessMessage(null), 3000);
      fetchUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update role');
      setTimeout(() => setError(null), 3000);
    }
  };

  const updateUserStatus = async (userId: string, newStatus: 'active' | 'disabled') => {
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ status: newStatus })
        .eq('id', userId);

      if (error) throw error;

      setSuccessMessage(`User status updated to ${newStatus}`);
      setTimeout(() => setSuccessMessage(null), 3000);
      fetchUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status');
      setTimeout(() => setError(null), 3000);
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin':
        return <Shield className="w-4 h-4 text-red-500" />;
      case 'editor':
        return <Edit3 className="w-4 h-4 text-blue-500" />;
      case 'viewer':
        return <Eye className="w-4 h-4 text-gray-500" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      active: 'bg-green-100 text-green-800',
      pending: 'bg-yellow-100 text-yellow-800',
      disabled: 'bg-red-100 text-red-800',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status as keyof typeof styles]}`}>
        {status}
      </span>
    );
  };

  if (!isAdmin) {
    return (
      <div className="p-8 text-center">
        <Ban className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h2>
        <p className="text-gray-600">You do not have permission to access user management.</p>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="w-6 h-6" />
            User Management
          </h1>
          <p className="text-gray-600 mt-1">Approve access requests and manage user roles</p>
        </div>
        <button
          onClick={() => setShowAddUserModal(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors font-medium"
        >
          <UserPlus className="w-5 h-5" />
          Add User Directly
        </button>
      </div>

      <div className="mb-6 border-b border-gray-200">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab('requests')}
            className={`pb-3 px-2 font-medium text-sm transition-colors relative ${
              activeTab === 'requests'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Access Requests
            {accessRequests.length > 0 && (
              <span className="ml-2 bg-red-500 text-white text-xs rounded-full px-2 py-0.5">
                {accessRequests.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`pb-3 px-2 font-medium text-sm transition-colors ${
              activeTab === 'users'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Active Users
          </button>
        </div>
      </div>

      {successMessage && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-green-600" />
          <span className="text-green-800">{successMessage}</span>
          <button onClick={() => setSuccessMessage(null)} className="ml-auto">
            <X className="w-5 h-5 text-green-600" />
          </button>
        </div>
      )}

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
          <Ban className="w-5 h-5 text-red-600" />
          <span className="text-red-800">{error}</span>
          <button onClick={() => setError(null)} className="ml-auto">
            <X className="w-5 h-5 text-red-600" />
          </button>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-600 mt-4">Loading...</p>
        </div>
      ) : activeTab === 'requests' ? (
        <div>
          {accessRequests.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg">
              <Clock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No pending access requests</p>
            </div>
          ) : (
            <div className="space-y-4">
              {accessRequests.map((request) => (
                <div key={request.id} className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                          <UserPlus className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">{request.full_name}</h3>
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Mail className="w-4 h-4" />
                            {request.email}
                          </div>
                        </div>
                      </div>
                      {request.reason && (
                        <p className="text-sm text-gray-600 mt-3 pl-13">
                          <span className="font-medium">Reason:</span> {request.reason}
                        </p>
                      )}
                      <p className="text-xs text-gray-500 mt-2 pl-13">
                        Requested {new Date(request.requested_at).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex gap-2 ml-4">
                      <div className="flex flex-col gap-2">
                        <button
                          onClick={() => approveAccessRequest(request, 'viewer')}
                          className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg transition-colors flex items-center gap-2"
                        >
                          <CheckCircle className="w-4 h-4" />
                          Approve as Viewer
                        </button>
                        <button
                          onClick={() => approveAccessRequest(request, 'editor')}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors flex items-center gap-2"
                        >
                          <CheckCircle className="w-4 h-4" />
                          Approve as Editor
                        </button>
                        <button
                          onClick={() => approveAccessRequest(request, 'admin')}
                          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg transition-colors flex items-center gap-2"
                        >
                          <CheckCircle className="w-4 h-4" />
                          Approve as Admin
                        </button>
                      </div>
                      <button
                        onClick={() => rejectAccessRequest(request.id)}
                        className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm rounded-lg transition-colors flex items-center gap-2"
                      >
                        <X className="w-4 h-4" />
                        Reject
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Access Link
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{user.full_name || 'N/A'}</div>
                      <div className="text-sm text-gray-500">{user.email}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      {getRoleIcon(user.role)}
                      <select
                        value={user.role}
                        onChange={(e) => updateUserRole(user.id, e.target.value as any)}
                        disabled={user.id === userProfile?.id}
                        className="text-sm border border-gray-300 rounded px-2 py-1 disabled:bg-gray-100"
                      >
                        <option value="admin">Admin</option>
                        <option value="editor">Editor</option>
                        <option value="viewer">Viewer</option>
                      </select>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getStatusBadge(user.status)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {user.access_token && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => copyAccessLink(user)}
                          className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
                        >
                          <Copy className="w-4 h-4" />
                          {copiedToken === user.id ? 'Copied!' : 'Copy Link'}
                        </button>
                        <button
                          onClick={() => showEmailInstructions(user)}
                          className="text-sm text-green-600 hover:text-green-800 flex items-center gap-1"
                        >
                          <Mail className="w-4 h-4" />
                          Email
                        </button>
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {user.id !== userProfile?.id && (
                      <select
                        value={user.status}
                        onChange={(e) => updateUserStatus(user.id, e.target.value as any)}
                        className="border border-gray-300 rounded px-2 py-1"
                      >
                        <option value="active">Active</option>
                        <option value="disabled">Disabled</option>
                      </select>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showAddUserModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">Add User Directly</h2>
              <button
                onClick={() => {
                  setShowAddUserModal(false);
                  setNewUser({ email: '', fullName: '', role: 'viewer' });
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="user@company.com"
                />
              </div>

              <div>
                <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name
                </label>
                <input
                  id="fullName"
                  type="text"
                  value={newUser.fullName}
                  onChange={(e) => setNewUser({ ...newUser, fullName: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="John Doe"
                />
              </div>

              <div>
                <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-1">
                  Role
                </label>
                <select
                  id="role"
                  value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="viewer">Viewer - Read-only access</option>
                  <option value="editor">Editor - Can edit data</option>
                  <option value="admin">Admin - Full access</option>
                </select>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
                <p className="font-medium mb-1">After adding:</p>
                <p>An access link will be generated. Copy it from the Active Users tab and send it to the user.</p>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => {
                    setShowAddUserModal(false);
                    setNewUser({ email: '', fullName: '', role: 'viewer' });
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={addUserDirectly}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
                >
                  Add User
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {emailInstructions.show && emailInstructions.user && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <Mail className="w-6 h-6 text-green-600" />
                Email Instructions for {emailInstructions.user.full_name || emailInstructions.user.email}
              </h2>
              <button
                onClick={() => setEmailInstructions({ show: false, user: null })}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800 mb-2">
                  Copy the template below and send it via your email client (Outlook, Gmail, etc.)
                </p>
              </div>

              <div className="bg-gray-50 border border-gray-300 rounded-lg p-4 text-sm font-mono whitespace-pre-wrap">
{`Subject: Your Access to Kafka EEB Monitoring Dashboard

Hello ${emailInstructions.user.full_name || emailInstructions.user.email},

You have been granted access to the Kafka EEB Monitoring Dashboard with ${emailInstructions.user.role} privileges.

To access the dashboard:

1. Click this link: ${window.location.origin}?token=${emailInstructions.user.access_token}

2. Or go to ${window.location.origin} and enter this access token:
   ${emailInstructions.user.access_token}

IMPORTANT: Please save this token securely. You'll need it to log in each time you access the dashboard from a new browser.

Role: ${emailInstructions.user.role.charAt(0).toUpperCase() + emailInstructions.user.role.slice(1)}
- Admin: Full access to manage users and all data
- Editor: Can create, edit, and delete topics and incidents
- Viewer: Read-only access to view all information

If you have any questions or need assistance, please contact your administrator.

Best regards,
Kafka EEB Monitoring Team`}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setEmailInstructions({ show: false, user: null })}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={copyEmailTemplate}
                  className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors font-medium flex items-center justify-center gap-2"
                >
                  <Copy className="w-4 h-4" />
                  Copy Email Template
                </button>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
                <p className="font-medium mb-1">Quick Steps:</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Click "Copy Email Template" above</li>
                  <li>Open your email client (Outlook, Gmail, etc.)</li>
                  <li>Create a new email to {emailInstructions.user.email}</li>
                  <li>Paste the template (Ctrl+V or Cmd+V)</li>
                  <li>Send the email</li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
