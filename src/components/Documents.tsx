import { useState, useEffect } from 'react';
import { FileText, Upload, Download, Trash2, Plus, Search, Filter, X } from 'lucide-react';
import { documentsService } from '../services/database';

export default function Documents() {
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [uploadForm, setUploadForm] = useState({
    title: '',
    description: '',
    file_url: '',
    file_name: '',
    file_type: '',
    category: 'General' as 'GCP' | 'Azure' | 'General',
    tags: ''
  });

  useEffect(() => {
    loadDocuments();
  }, [categoryFilter]);

  const loadDocuments = async () => {
    try {
      setLoading(true);
      const data = categoryFilter === 'All'
        ? await documentsService.getAll()
        : await documentsService.getByCategory(categoryFilter);
      setDocuments(data);
    } catch (error) {
      console.error('Error loading documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async () => {
    if (!uploadForm.title || !uploadForm.file_url) {
      alert('Please provide a title and file URL');
      return;
    }

    try {
      await documentsService.create({
        title: uploadForm.title,
        description: uploadForm.description,
        file_url: uploadForm.file_url,
        file_name: uploadForm.file_name || uploadForm.title,
        file_type: uploadForm.file_type || 'unknown',
        category: uploadForm.category,
        file_size: 0,
        tags: uploadForm.tags ? uploadForm.tags.split(',').map(t => t.trim()) : []
      });

      setUploadForm({
        title: '',
        description: '',
        file_url: '',
        file_name: '',
        file_type: '',
        category: 'General',
        tags: ''
      });
      setShowUploadForm(false);
      loadDocuments();
    } catch (error) {
      console.error('Error uploading document:', error);
      alert('Failed to upload document');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this document?')) return;

    try {
      await documentsService.delete(id);
      loadDocuments();
    } catch (error) {
      console.error('Error deleting document:', error);
      alert('Failed to delete document');
    }
  };

  const filteredDocuments = documents.filter(doc =>
    doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    doc.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getCategoryIcon = (category: string) => {
    return <FileText className="w-5 h-5" />;
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'GCP':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'Azure':
        return 'bg-cyan-100 text-cyan-800 border-cyan-300';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-300';
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
          <h2 className="text-3xl font-bold text-slate-900">EEB Onboarding Documents</h2>
          <p className="text-slate-500 mt-1">Manage onboarding documents for GCP and Azure</p>
        </div>
        <button
          onClick={() => setShowUploadForm(!showUploadForm)}
          className="flex items-center space-x-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors shadow-md"
        >
          <Plus className="w-5 h-5" />
          <span className="font-medium">Upload Document</span>
        </button>
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search documents..."
            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center space-x-2">
          <Filter className="w-5 h-5 text-slate-600" />
          {['All', 'GCP', 'Azure', 'General'].map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-4 py-2 rounded-lg transition-colors ${
                categoryFilter === cat
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {showUploadForm && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-slate-900">Upload New Document</h3>
            <button
              onClick={() => setShowUploadForm(false)}
              className="text-slate-400 hover:text-slate-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Document Title *</label>
                <input
                  type="text"
                  value={uploadForm.title}
                  onChange={(e) => setUploadForm({ ...uploadForm, title: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., GCP Onboarding Guide"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Category</label>
                <select
                  value={uploadForm.category}
                  onChange={(e) => setUploadForm({ ...uploadForm, category: e.target.value as any })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="General">General</option>
                  <option value="GCP">GCP</option>
                  <option value="Azure">Azure</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Description</label>
              <textarea
                value={uploadForm.description}
                onChange={(e) => setUploadForm({ ...uploadForm, description: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
                placeholder="Brief description of the document..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">File URL *</label>
              <input
                type="url"
                value={uploadForm.file_url}
                onChange={(e) => setUploadForm({ ...uploadForm, file_url: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="https://example.com/document.docx or upload to cloud storage"
              />
              <p className="text-xs text-slate-500 mt-1">
                Upload your file to OneDrive, Google Drive, or SharePoint and paste the link here
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">File Name</label>
                <input
                  type="text"
                  value={uploadForm.file_name}
                  onChange={(e) => setUploadForm({ ...uploadForm, file_name: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="document.docx"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">File Type</label>
                <select
                  value={uploadForm.file_type}
                  onChange={(e) => setUploadForm({ ...uploadForm, file_type: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select type</option>
                  <option value="application/vnd.openxmlformats-officedocument.wordprocessingml.document">Word (.docx)</option>
                  <option value="application/msword">Word (.doc)</option>
                  <option value="application/vnd.openxmlformats-officedocument.presentationml.presentation">PowerPoint (.pptx)</option>
                  <option value="application/vnd.ms-powerpoint">PowerPoint (.ppt)</option>
                  <option value="application/pdf">PDF (.pdf)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Tags (comma-separated)</label>
              <input
                type="text"
                value={uploadForm.tags}
                onChange={(e) => setUploadForm({ ...uploadForm, tags: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="onboarding, setup, cloud, kafka"
              />
            </div>

            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setShowUploadForm(false)}
                className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleUpload}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Upload Document
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredDocuments.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500">No documents found</p>
          </div>
        ) : (
          filteredDocuments.map((doc) => (
            <div
              key={doc.id}
              className="bg-white rounded-xl border-2 border-slate-200 p-6 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-start justify-between mb-3">
                {getCategoryIcon(doc.category)}
                <span className={`px-2 py-1 rounded text-xs font-medium border ${getCategoryColor(doc.category)}`}>
                  {doc.category}
                </span>
              </div>

              <h3 className="text-lg font-bold text-slate-900 mb-2">{doc.title}</h3>

              {doc.description && (
                <p className="text-sm text-slate-600 mb-4 line-clamp-2">{doc.description}</p>
              )}

              <div className="text-xs text-slate-500 mb-4">
                <p>Uploaded: {new Date(doc.uploaded_at).toLocaleDateString()}</p>
                {doc.file_name && <p>File: {doc.file_name}</p>}
              </div>

              {doc.tags && JSON.parse(doc.tags).length > 0 && (
                <div className="flex flex-wrap gap-1 mb-4">
                  {JSON.parse(doc.tags).map((tag: string, idx: number) => (
                    <span
                      key={idx}
                      className="px-2 py-1 bg-slate-100 text-slate-700 text-xs rounded"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}

              <div className="flex items-center space-x-2">
                <a
                  href={doc.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center space-x-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                >
                  <Download className="w-4 h-4" />
                  <span>Download</span>
                </a>
                <button
                  onClick={() => handleDelete(doc.id)}
                  className="px-3 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
