import { useState } from 'react';
import { Upload, X, CheckCircle, AlertCircle, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';
import { ingestProjectsService } from '../services/database';

interface IngestProjectsImportProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: () => void;
}

export default function IngestProjectsImport({ isOpen, onClose, onImportComplete }: IngestProjectsImportProps) {
  const [importing, setImporting] = useState(false);
  const [importResults, setImportResults] = useState<{
    success: number;
    failed: number;
    updated: number;
    created: number;
    errors: string[];
  } | null>(null);
  const [previewData, setPreviewData] = useState<any[]>([]);

  const parseExcelDate = (value: any): string | null => {
    try {
      if (!value) return null;

      if (typeof value === 'number') {
        const date = XLSX.SSF.parse_date_code(value);
        return new Date(date.y, date.m - 1, date.d).toISOString().split('T')[0];
      }

      if (typeof value === 'string') {
        const parsed = new Date(value);
        if (!isNaN(parsed.getTime())) {
          return parsed.toISOString().split('T')[0];
        }
      }

      return null;
    } catch (error) {
      console.error('Error parsing date:', value, error);
      return null;
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, { raw: false }) as any[];

        const parsedData = jsonData.map((row: any) => ({
          title: row['Title'] || '',
          status: row['Status'] || row['Status2'] || '',
          prod_date: parseExcelDate(row['Prod Date']),
          owner: row['Owner'] || '',
          status2: row['Status2'] || '',
          tasks: row['Tasks'] || '',
          environment: null,
          notes: []
        }));

        setPreviewData(parsedData);
      } catch (error) {
        alert('Error parsing Excel file. Please check the format and try again.');
        console.error('Excel parsing error:', error);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleImport = async () => {
    setImporting(true);
    const results = {
      success: 0,
      failed: 0,
      updated: 0,
      created: 0,
      errors: [] as string[]
    };

    for (const row of previewData) {
      try {
        if (!row.title) {
          results.failed++;
          results.errors.push('Row missing title - skipped');
          continue;
        }

        const result = await ingestProjectsService.upsertByTitle(row);
        results.success++;
        if (result.isNew) {
          results.created++;
        } else {
          results.updated++;
        }
      } catch (error: any) {
        results.failed++;
        results.errors.push(`${row.title}: ${error.message || 'Unknown error'}`);
      }
    }

    setImportResults(results);
    setImporting(false);

    if (results.success > 0) {
      setTimeout(() => {
        onImportComplete();
      }, 2000);
    }
  };

  const handleReset = () => {
    setPreviewData([]);
    setImportResults(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <FileSpreadsheet className="w-6 h-6 text-green-600" />
            <h2 className="text-2xl font-bold text-slate-900">Import Ingest Projects from Excel</h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {!importResults && (
            <>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h3 className="font-semibold text-green-900 mb-2">Instructions</h3>
                <ol className="text-sm text-green-800 space-y-1 list-decimal list-inside">
                  <li>Prepare your Excel file with columns: Title, Status, Prod Date, Owner, Status2, Tasks</li>
                  <li>Upload the Excel file</li>
                  <li>Review the preview and click Import</li>
                  <li>Projects with matching titles will be updated, new ones will be created</li>
                  <li>You can edit environments, dates, and add notes after import</li>
                </ol>
              </div>

              <label className="flex items-center justify-center space-x-2 px-6 py-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors cursor-pointer shadow-md">
                <Upload className="w-5 h-5" />
                <span className="font-medium">Upload Ingest Projects Excel File</span>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>

              {previewData.length > 0 && (
                <>
                  <div className="border border-slate-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-slate-900">
                        Preview ({previewData.length} projects)
                      </h3>
                      <button
                        onClick={handleReset}
                        className="text-sm text-slate-600 hover:text-slate-900"
                      >
                        Clear
                      </button>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50">
                          <tr>
                            <th className="px-3 py-2 text-left font-medium text-slate-700">Title</th>
                            <th className="px-3 py-2 text-left font-medium text-slate-700">Status</th>
                            <th className="px-3 py-2 text-left font-medium text-slate-700">Owner</th>
                            <th className="px-3 py-2 text-left font-medium text-slate-700">Prod Date</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {previewData.slice(0, 10).map((row, idx) => (
                            <tr key={idx} className={!row.title ? 'bg-red-50' : ''}>
                              <td className="px-3 py-2">{row.title || <span className="text-red-600">Missing</span>}</td>
                              <td className="px-3 py-2">{row.status || '-'}</td>
                              <td className="px-3 py-2">{row.owner || '-'}</td>
                              <td className="px-3 py-2 text-xs">{row.prod_date ? new Date(row.prod_date).toLocaleDateString() : '-'}</td>
                            </tr>
                          ))}
                          {previewData.length > 10 && (
                            <tr>
                              <td colSpan={4} className="px-3 py-2 text-center text-slate-500 text-sm">
                                ... and {previewData.length - 10} more
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="flex justify-end space-x-3">
                    <button
                      onClick={handleReset}
                      className="px-6 py-3 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors font-medium"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleImport}
                      disabled={importing}
                      className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                    >
                      {importing ? 'Importing...' : `Import ${previewData.length} Projects`}
                    </button>
                  </div>
                </>
              )}
            </>
          )}

          {importResults && (
            <div className="space-y-4">
              <div className="flex items-center justify-center space-x-6">
                {importResults.created > 0 && (
                  <div className="flex items-center space-x-2 text-green-700">
                    <CheckCircle className="w-8 h-8" />
                    <div>
                      <p className="text-2xl font-bold">{importResults.created}</p>
                      <p className="text-sm">Created</p>
                    </div>
                  </div>
                )}
                {importResults.updated > 0 && (
                  <div className="flex items-center space-x-2 text-blue-700">
                    <CheckCircle className="w-8 h-8" />
                    <div>
                      <p className="text-2xl font-bold">{importResults.updated}</p>
                      <p className="text-sm">Updated</p>
                    </div>
                  </div>
                )}
                {importResults.failed > 0 && (
                  <div className="flex items-center space-x-2 text-red-700">
                    <AlertCircle className="w-8 h-8" />
                    <div>
                      <p className="text-2xl font-bold">{importResults.failed}</p>
                      <p className="text-sm">Failed</p>
                    </div>
                  </div>
                )}
              </div>

              {importResults.errors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <h4 className="font-semibold text-red-900 mb-2">Errors</h4>
                  <ul className="text-sm text-red-800 space-y-1 max-h-40 overflow-y-auto">
                    {importResults.errors.map((error, idx) => (
                      <li key={idx}>• {error}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex justify-end">
                <button
                  onClick={() => {
                    handleReset();
                    onClose();
                  }}
                  className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
