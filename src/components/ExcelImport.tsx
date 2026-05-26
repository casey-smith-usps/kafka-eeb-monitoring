import { useState } from 'react';
import { Upload, Download, X, CheckCircle, AlertCircle, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';
import { topicsService } from '../services/database';

interface ExcelImportProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: () => void;
}

interface ImportRow {
  name: string;
  description?: string;
  status?: 'in_progress' | 'complete' | 'historical';
  environment?: 'dev' | 'sit' | 'cat' | 'prod';
  owner_team?: string;
  partition_count?: number;
  replication_factor?: number;
  retention_ms?: number;
}

export default function ExcelImport({ isOpen, onClose, onImportComplete }: ExcelImportProps) {
  const [importing, setImporting] = useState(false);
  const [importResults, setImportResults] = useState<{
    success: number;
    failed: number;
    errors: string[];
  } | null>(null);
  const [previewData, setPreviewData] = useState<ImportRow[]>([]);

  const downloadTemplate = () => {
    const template = [
      {
        name: 'prod.payments.transactions.v1',
        description: 'Payment transaction events',
        status: 'in_progress',
        environment: 'prod',
        owner_team: 'Data Engineering',
        partition_count: 12,
        replication_factor: 3,
        retention_ms: 604800000
      },
      {
        name: 'dev.analytics.user_events.v2',
        description: 'User analytics events',
        status: 'complete',
        environment: 'dev',
        owner_team: 'Analytics Team',
        partition_count: 6,
        replication_factor: 2,
        retention_ms: 259200000
      }
    ];

    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Topics');
    XLSX.writeFile(wb, 'kafka_topics_template.xlsx');
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet) as any[];

        const parsedData: ImportRow[] = jsonData.map((row: any) => ({
          name: row.name || row.Name || row.topic_name || row['Topic Name'] || '',
          description: row.description || row.Description || '',
          status: (row.status || row.Status || 'in_progress').toLowerCase() as any,
          environment: (row.environment || row.Environment || '').toLowerCase() as any,
          owner_team: row.owner_team || row['Owner Team'] || row.team || '',
          partition_count: parseInt(row.partition_count || row['Partition Count'] || row.partitions || '0'),
          replication_factor: parseInt(row.replication_factor || row['Replication Factor'] || '0'),
          retention_ms: parseInt(row.retention_ms || row['Retention (ms)'] || row.retention || '0')
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
      errors: [] as string[]
    };

    for (const row of previewData) {
      try {
        if (!row.name) {
          results.failed++;
          results.errors.push('Row missing topic name - skipped');
          continue;
        }

        await topicsService.create({
          name: row.name,
          description: row.description || null,
          status: row.status || 'in_progress',
          environment: row.environment || null,
          owner_team: row.owner_team || null,
          partition_count: row.partition_count || null,
          replication_factor: row.replication_factor || null,
          retention_ms: row.retention_ms || null
        });
        results.success++;
      } catch (error: any) {
        results.failed++;
        results.errors.push(`${row.name}: ${error.message || 'Unknown error'}`);
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
            <FileSpreadsheet className="w-6 h-6 text-blue-600" />
            <h2 className="text-2xl font-bold text-slate-900">Import Topics from Excel</h2>
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
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-semibold text-blue-900 mb-2">Instructions</h3>
                <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                  <li>Download the template Excel file to see the required format</li>
                  <li>Fill in your topic data using the same column headers</li>
                  <li>Upload the completed Excel file</li>
                  <li>Review the preview and click Import</li>
                </ol>
              </div>

              <div className="flex items-center space-x-4">
                <button
                  onClick={downloadTemplate}
                  className="flex items-center space-x-2 px-6 py-3 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors border border-slate-300"
                >
                  <Download className="w-5 h-5" />
                  <span className="font-medium">Download Template</span>
                </button>

                <label className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors cursor-pointer shadow-md">
                  <Upload className="w-5 h-5" />
                  <span className="font-medium">Upload Excel File</span>
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>

              {previewData.length > 0 && (
                <>
                  <div className="border border-slate-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-slate-900">
                        Preview ({previewData.length} topics)
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
                            <th className="px-3 py-2 text-left font-medium text-slate-700">Topic Name</th>
                            <th className="px-3 py-2 text-left font-medium text-slate-700">Environment</th>
                            <th className="px-3 py-2 text-left font-medium text-slate-700">Status</th>
                            <th className="px-3 py-2 text-left font-medium text-slate-700">Team</th>
                            <th className="px-3 py-2 text-left font-medium text-slate-700">Partitions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {previewData.map((row, idx) => (
                            <tr key={idx} className={!row.name ? 'bg-red-50' : ''}>
                              <td className="px-3 py-2">{row.name || <span className="text-red-600">Missing</span>}</td>
                              <td className="px-3 py-2">{row.environment?.toUpperCase() || '-'}</td>
                              <td className="px-3 py-2">{row.status || 'in_progress'}</td>
                              <td className="px-3 py-2">{row.owner_team || '-'}</td>
                              <td className="px-3 py-2">{row.partition_count || '-'}</td>
                            </tr>
                          ))}
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
                      className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                    >
                      {importing ? 'Importing...' : `Import ${previewData.length} Topics`}
                    </button>
                  </div>
                </>
              )}
            </>
          )}

          {importResults && (
            <div className="space-y-4">
              <div className="flex items-center justify-center space-x-4">
                {importResults.success > 0 && (
                  <div className="flex items-center space-x-2 text-green-700">
                    <CheckCircle className="w-8 h-8" />
                    <div>
                      <p className="text-2xl font-bold">{importResults.success}</p>
                      <p className="text-sm">Imported</p>
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
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
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
