import React, { useState, useEffect } from 'react';
import { Database, Search, Plus, Filter, Tag, AlertCircle, CheckCircle, Archive, FileText, Clock, User, CreditCard as Edit, Trash2, X, GitBranch } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface SchemaRecord {
  id: string;
  schema_name: string;
  schema_version: string;
  schema_type: string;
  topic_id: string | null;
  data_domain: string;
  business_owner: string | null;
  technical_owner: string | null;
  description: string | null;
  schema_definition: any;
  tags: string[];
  compliance_tags: string[];
  status: 'draft' | 'active' | 'deprecated' | 'archived';
  sop_reference: string | null;
  created_at: string;
  updated_at: string;
  deprecated_at: string | null;
  deprecated_reason: string | null;
}

interface SchemaField {
  id: string;
  schema_id: string;
  field_name: string;
  field_path: string | null;
  data_type: string;
  is_required: boolean;
  is_pii: boolean;
  is_encrypted: boolean;
  field_description: string | null;
  business_glossary_term: string | null;
  sample_values: string[];
  validation_rules: string | null;
  default_value: string | null;
  field_order: number | null;
}

export const SchemaRegistry: React.FC = () => {
  const { userProfile } = useAuth();
  const canEdit = userProfile?.role === 'admin' || userProfile?.role === 'editor';

  const [schemas, setSchemas] = useState<SchemaRecord[]>([]);
  const [filteredSchemas, setFilteredSchemas] = useState<SchemaRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDomain, setSelectedDomain] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedSchema, setSelectedSchema] = useState<SchemaRecord | null>(null);
  const [schemaFields, setSchemaFields] = useState<SchemaField[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchSchemas();
  }, []);

  useEffect(() => {
    filterSchemas();
  }, [searchTerm, selectedDomain, selectedStatus, schemas]);

  const fetchSchemas = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('schema_registry')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSchemas(data || []);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to fetch schemas');
      setTimeout(() => setErrorMessage(null), 3000);
    } finally {
      setLoading(false);
    }
  };

  const fetchSchemaFields = async (schemaId: string) => {
    try {
      const { data, error } = await supabase
        .from('schema_fields')
        .select('*')
        .eq('schema_id', schemaId)
        .order('field_order', { ascending: true });

      if (error) throw error;
      setSchemaFields(data || []);
    } catch (err) {
      console.error('Error fetching schema fields:', err);
    }
  };

  const filterSchemas = () => {
    let filtered = [...schemas];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(s =>
        s.schema_name.toLowerCase().includes(term) ||
        s.description?.toLowerCase().includes(term) ||
        s.data_domain.toLowerCase().includes(term) ||
        s.tags.some(tag => tag.toLowerCase().includes(term))
      );
    }

    if (selectedDomain !== 'all') {
      filtered = filtered.filter(s => s.data_domain === selectedDomain);
    }

    if (selectedStatus !== 'all') {
      filtered = filtered.filter(s => s.status === selectedStatus);
    }

    setFilteredSchemas(filtered);
  };

  const domains = Array.from(new Set(schemas.map(s => s.data_domain))).sort();

  const getStatusBadge = (status: string) => {
    const styles = {
      draft: 'bg-gray-100 text-gray-800 border-gray-300',
      active: 'bg-green-100 text-green-800 border-green-300',
      deprecated: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      archived: 'bg-red-100 text-red-800 border-red-300',
    };
    const icons = {
      draft: <FileText className="w-3 h-3" />,
      active: <CheckCircle className="w-3 h-3" />,
      deprecated: <AlertCircle className="w-3 h-3" />,
      archived: <Archive className="w-3 h-3" />,
    };
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${styles[status as keyof typeof styles]}`}>
        {icons[status as keyof typeof icons]}
        {status}
      </span>
    );
  };

  const viewSchemaDetails = (schema: SchemaRecord) => {
    setSelectedSchema(schema);
    fetchSchemaFields(schema.id);
  };

  const closeModal = () => {
    setSelectedSchema(null);
    setSchemaFields([]);
  };

  const stats = {
    total: schemas.length,
    active: schemas.filter(s => s.status === 'active').length,
    deprecated: schemas.filter(s => s.status === 'deprecated').length,
    piiFields: schemaFields.filter(f => f.is_pii).length,
  };

  return (
    <div className="p-8">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Database className="w-6 h-6 text-blue-600" />
            Schema Registry & Metadata Catalog
          </h1>
          {canEdit && (
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              <Plus className="w-5 h-5" />
              Register Schema
            </button>
          )}
        </div>
        <p className="text-gray-600">Central catalog of all data schemas, metadata, and compliance information</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Schemas</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <Database className="w-8 h-8 text-blue-500" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-green-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Active</p>
              <p className="text-2xl font-bold text-gray-900">{stats.active}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-yellow-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Deprecated</p>
              <p className="text-2xl font-bold text-gray-900">{stats.deprecated}</p>
            </div>
            <AlertCircle className="w-8 h-8 text-yellow-500" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-purple-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Data Domains</p>
              <p className="text-2xl font-bold text-gray-900">{domains.length}</p>
            </div>
            <GitBranch className="w-8 h-8 text-purple-500" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow mb-6 p-4">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[250px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search schemas by name, description, domain, or tags..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <select
              value={selectedDomain}
              onChange={(e) => setSelectedDomain(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Domains</option>
              {domains.map(domain => (
                <option key={domain} value={domain}>{domain}</option>
              ))}
            </select>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="draft">Draft</option>
              <option value="deprecated">Deprecated</option>
              <option value="archived">Archived</option>
            </select>
          </div>
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

      {errorMessage && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <span className="text-red-800">{errorMessage}</span>
          <button onClick={() => setErrorMessage(null)} className="ml-auto">
            <X className="w-5 h-5 text-red-600" />
          </button>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-600 mt-4">Loading schemas...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSchemas.map((schema) => (
            <div
              key={schema.id}
              onClick={() => viewSchemaDetails(schema)}
              className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow p-5 cursor-pointer border border-gray-200"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 mb-1">{schema.schema_name}</h3>
                  <p className="text-xs text-gray-500">v{schema.schema_version} • {schema.schema_type}</p>
                </div>
                {getStatusBadge(schema.status)}
              </div>

              <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                {schema.description || 'No description provided'}
              </p>

              <div className="flex items-center gap-2 text-xs text-gray-500 mb-3">
                <Tag className="w-3 h-3" />
                <span className="font-medium">{schema.data_domain}</span>
              </div>

              {schema.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {schema.tags.slice(0, 3).map((tag, idx) => (
                    <span key={idx} className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded">
                      {tag}
                    </span>
                  ))}
                  {schema.tags.length > 3 && (
                    <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">
                      +{schema.tags.length - 3}
                    </span>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between text-xs text-gray-500 pt-3 border-t border-gray-100">
                <div className="flex items-center gap-1">
                  <User className="w-3 h-3" />
                  <span>{schema.technical_owner || 'Unassigned'}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span>{new Date(schema.updated_at).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && filteredSchemas.length === 0 && (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <Database className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">No schemas found matching your filters</p>
        </div>
      )}

      {selectedSchema && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">{selectedSchema.schema_name}</h2>
                <p className="text-sm text-gray-600">Version {selectedSchema.schema_version} • {selectedSchema.schema_type}</p>
              </div>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  {getStatusBadge(selectedSchema.status)}
                  <span className="px-3 py-1 bg-purple-100 text-purple-800 text-xs font-medium rounded-full">
                    {selectedSchema.data_domain}
                  </span>
                </div>
                {selectedSchema.description && (
                  <p className="text-gray-700">{selectedSchema.description}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-xs text-gray-500 mb-1">Business Owner</p>
                  <p className="text-sm font-medium text-gray-900">{selectedSchema.business_owner || 'Not assigned'}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-xs text-gray-500 mb-1">Technical Owner</p>
                  <p className="text-sm font-medium text-gray-900">{selectedSchema.technical_owner || 'Not assigned'}</p>
                </div>
              </div>

              {selectedSchema.sop_reference && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="w-4 h-4 text-blue-600" />
                    <p className="text-sm font-medium text-blue-900">SOP Reference</p>
                  </div>
                  <p className="text-sm text-blue-800">{selectedSchema.sop_reference}</p>
                </div>
              )}

              {(selectedSchema.tags.length > 0 || selectedSchema.compliance_tags.length > 0) && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-2">Tags & Compliance</h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedSchema.tags.map((tag, idx) => (
                      <span key={idx} className="px-3 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                        {tag}
                      </span>
                    ))}
                    {selectedSchema.compliance_tags.map((tag, idx) => (
                      <span key={idx} className="px-3 py-1 bg-red-100 text-red-800 text-xs rounded-full font-medium">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {schemaFields.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Schema Fields ({schemaFields.length})</h3>
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Field Name</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Data Type</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Required</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Flags</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {schemaFields.map((field) => (
                          <tr key={field.id} className="hover:bg-gray-50">
                            <td className="px-4 py-2 text-sm font-medium text-gray-900">{field.field_name}</td>
                            <td className="px-4 py-2 text-sm text-gray-600">{field.data_type}</td>
                            <td className="px-4 py-2 text-sm">
                              {field.is_required ? (
                                <span className="text-red-600 font-medium">Yes</span>
                              ) : (
                                <span className="text-gray-400">No</span>
                              )}
                            </td>
                            <td className="px-4 py-2 text-sm">
                              <div className="flex gap-1">
                                {field.is_pii && (
                                  <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded">PII</span>
                                )}
                                {field.is_encrypted && (
                                  <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded">Encrypted</span>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="text-xs text-gray-500 pt-4 border-t border-gray-200">
                <p>Created: {new Date(selectedSchema.created_at).toLocaleString()}</p>
                <p>Last Updated: {new Date(selectedSchema.updated_at).toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
