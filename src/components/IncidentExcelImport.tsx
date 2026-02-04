import { useState } from 'react';
import { Upload, X, CheckCircle, AlertCircle, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';
import { alertsService } from '../services/database';

interface IncidentExcelImportProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: () => void;
}

export default function IncidentExcelImport({ isOpen, onClose, onImportComplete }: IncidentExcelImportProps) {
  const [importing, setImporting] = useState(false);
  const [importResults, setImportResults] = useState<{
    success: number;
    failed: number;
    errors: string[];
  } | null>(null);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [debugInfo, setDebugInfo] = useState<string>('');

  const parseExcelDate = (value: any): string | null => {
    try {
      if (!value) return null;

      // Handle Excel serial date number
      if (typeof value === 'number') {
        const date = new Date((value - 25569) * 86400 * 1000);
        if (!isNaN(date.getTime())) {
          return date.toISOString();
        }
      }

      // Handle string dates like "5/9/2025", "3/25/2025", "6/16/2025"
      if (typeof value === 'string') {
        const trimmed = value.trim();

        // Try M/D/YYYY format
        const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (slashMatch) {
          const [, month, day, year] = slashMatch;
          const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
          if (!isNaN(date.getTime())) {
            return date.toISOString();
          }
        }

        // Try direct parse
        const parsed = new Date(trimmed);
        if (!isNaN(parsed.getTime())) {
          return parsed.toISOString();
        }
      }

      // Handle Date objects
      if (value instanceof Date && !isNaN(value.getTime())) {
        return value.toISOString();
      }

      return null;
    } catch (error) {
      console.error('Error parsing date:', value, error);
      return null;
    }
  };

  const getPriority = (row: any): number => {
    const priorityStr = String(row['Priority'] || '').trim();
    const match = priorityStr.match(/^(\d+)/);
    return match ? parseInt(match[1]) : 3;
  };

  const getSeverity = (priority: number): string => {
    switch (priority) {
      case 1: return 'critical';
      case 2: return 'high';
      case 3: return 'medium';
      case 4: return 'low';
      default: return 'medium';
    }
  };

  const getStatusFromString = (status: string): boolean => {
    const statusLower = (status || '').toLowerCase();
    return statusLower === 'closed' || statusLower === 'resolved';
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array', cellDates: false, cellText: false });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, { raw: false, defval: '' }) as any[];

        // Debug: Show all column names
        if (jsonData.length > 0) {
          const columnNames = Object.keys(jsonData[0]);
          setDebugInfo(`Found ${columnNames.length} columns: ${columnNames.join(', ')}`);
          console.log('=== EXCEL IMPORT DEBUG ===');
          console.log('Columns found:', columnNames);
          console.log('First row sample:', jsonData[0]);
        }

        const parsedData = jsonData.map((row: any, rowIndex: number) => {
          const priority = getPriority(row);

          // YOUR EXACT COLUMN NAME: "Date Identified"
          const dateValue = row['Date Identified'];
          const dateIdentified = parseExcelDate(dateValue);

          // YOUR EXACT COLUMN NAME: "Comments"
          const commentsText = row['Comments'] || '';
          const functionalImpactText = row['Functional Impact'] || '';

          // Combine Comments and Functional Impact as notes
          const allNotes: string[] = [];

          if (commentsText.trim()) {
            allNotes.push(`Comments:\n${commentsText.trim()}`);
          }

          if (functionalImpactText.trim()) {
            allNotes.push(`Functional Impact:\n${functionalImpactText.trim()}`);
          }

          const activityLog = allNotes.length > 0 ? [{
            author: row['Identified By'] || 'System',
            timestamp: dateIdentified || new Date().toISOString(),
            note: allNotes.join('\n\n')
          }] : [];

          // Debug first 3 rows
          if (rowIndex < 3) {
            console.log(`Row ${rowIndex}:`, {
              inc: row['INC#'],
              dateValue,
              dateIdentified,
              commentsLength: commentsText.length,
              notesCount: allNotes.length
            });
          }

          return {
            incident_number: row['INC#'] || '',
            title: row['Story/INC Name'] || '',
            priority,
            severity: getSeverity(priority),
            business_service: 'Enterprise Event Broker',
            category: row['Category'] || 'Application',
            subcategory: row['Story/INC Name'] || '',
            assignment_group: 'SDS Enterprise Event Broker',
            description: functionalImpactText || commentsText || '',
            created_at: dateIdentified || new Date().toISOString(),
            date_identified: dateIdentified,
            resolved: getStatusFromString(row['Status']),
            v1_story: row['V1 Story'] || null,
            story_type: row['Story Type'] || null,
            team_assigned: row['Team Assigned'] || null,
            release_date: parseExcelDate(row['Release Date']),
            functional_impact: functionalImpactText || null,
            age: row['Age'] ? parseInt(String(row['Age']).replace(/\D/g, '')) : null,
            identified_by: row['Identified By'] || null,
            activity_log: activityLog
          };
        });

        console.log('=== PARSED DATA SAMPLE ===');
        console.log('First parsed record:', parsedData[0]);
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
        if (!row.incident_number) {
          results.failed++;
          results.errors.push('Row missing incident number - skipped');
          continue;
        }

        await alertsService.create({
          incident_number: row.incident_number,
          title: `${row.incident_number}: ${row.title}`,
          priority: row.priority,
          severity: row.severity,
          business_service: row.business_service,
          category: row.category,
          subcategory: row.subcategory,
          assignment_group: row.assignment_group,
          description: row.description,
          alert_type: 'manual',
          resolved: row.resolved,
          created_at: row.created_at,
          date_identified: row.date_identified,
          v1_story: row.v1_story,
          story_type: row.story_type,
          team_assigned: row.team_assigned,
          release_date: row.release_date,
          functional_impact: row.functional_impact,
          age: row.age,
          identified_by: row.identified_by,
          activity_log: row.activity_log
        });
        results.success++;
      } catch (error: any) {
        results.failed++;
        results.errors.push(`${row.incident_number}: ${error.message || 'Unknown error'}`);
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
    setDebugInfo('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <FileSpreadsheet className="w-6 h-6 text-red-600" />
            <h2 className="text-2xl font-bold text-slate-900">Import Incidents from Excel</h2>
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
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <h3 className="font-semibold text-red-900 mb-2">Instructions</h3>
                <ol className="text-sm text-red-800 space-y-1 list-decimal list-inside">
                  <li>Upload your Excel file with columns: INC#, Story/INC Name, Date Identified, Comments, etc.</li>
                  <li>The preview will show whether dates and notes were captured</li>
                  <li>Click Import to save to database</li>
                </ol>
              </div>

              {debugInfo && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-xs text-blue-900 font-mono">{debugInfo}</p>
                </div>
              )}

              <label className="flex items-center justify-center space-x-2 px-6 py-4 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors cursor-pointer shadow-md">
                <Upload className="w-5 h-5" />
                <span className="font-medium">Upload Incident Excel File</span>
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
                        Preview ({previewData.length} incidents)
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
                            <th className="px-3 py-2 text-left font-medium text-slate-700">Incident #</th>
                            <th className="px-3 py-2 text-left font-medium text-slate-700">Title</th>
                            <th className="px-3 py-2 text-left font-medium text-slate-700">Date</th>
                            <th className="px-3 py-2 text-left font-medium text-slate-700">Notes</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {previewData.slice(0, 10).map((row, idx) => (
                            <tr key={idx} className={!row.incident_number ? 'bg-red-50' : ''}>
                              <td className="px-3 py-2 font-mono text-xs">{row.incident_number || <span className="text-red-600">Missing</span>}</td>
                              <td className="px-3 py-2 text-xs">{row.title || '-'}</td>
                              <td className="px-3 py-2 text-xs">
                                {row.date_identified ? (
                                  <span className="text-green-700 font-semibold">{new Date(row.date_identified).toLocaleDateString()}</span>
                                ) : (
                                  <span className="text-red-600 font-bold">MISSING DATE</span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-xs">
                                {row.activity_log?.length > 0 ? (
                                  <span className="text-green-700 font-semibold">YES ({row.activity_log[0].note.length} chars)</span>
                                ) : (
                                  <span className="text-red-600 font-bold">NO NOTES</span>
                                )}
                              </td>
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
                      className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                    >
                      {importing ? 'Importing...' : `Import ${previewData.length} Incidents`}
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
                  className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
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
