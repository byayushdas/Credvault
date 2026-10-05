import { mockDocuments } from '../../data/mockData';
import { getData } from '../../services/localStorageService';
import type { AuditLogEntry, Document } from '../../types';
import { Clock, CheckCircle2, XCircle, Building2, ShieldAlert } from 'lucide-react';

export default function AuditLog() {
  const logs = getData<AuditLogEntry[]>('audit_logs', []);
  const documents = getData<Document[]>('documents', mockDocuments);
  const getDecisionBadge = (decision: string) => {
    switch (decision) {
      case 'Approved':
      case 'Auto-Approved':
        return <span className="badge-success px-2 py-1 rounded text-xs font-bold flex items-center w-fit"><CheckCircle2 className="w-3 h-3 mr-1" /> {decision}</span>;
      case 'Denied':
        return <span className="badge-error px-2 py-1 rounded text-xs font-bold flex items-center w-fit"><XCircle className="w-3 h-3 mr-1" /> Denied</span>;
      default:
        return <span className="px-2 py-1 bg-slate-100 text-slate-700 rounded text-xs font-bold">{decision}</span>;
    }
  };

  return (
    <div className="max-w-6xl mx-auto pb-12">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Audit Log</h1>
        <p className="text-slate-500 text-sm mt-1">See exactly when your credentials were accessed and what information was shared.</p>
      </div>

      <div className="bg-primary-50 border border-primary-100 rounded-lg p-5 mb-8 flex items-start">
        <ShieldAlert className="w-5 h-5 text-primary-600 shrink-0 mt-0.5 mr-3" />
        <div>
          <p className="text-primary-900 text-sm font-medium leading-relaxed">
            Every verification request and data share is cryptographically logged. This immutable audit trail guarantees you always know who accessed your data, when, and exactly what fields were disclosed.
          </p>
        </div>
      </div>

      <div className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-5 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Date & Time</th>
                <th className="px-5 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Verifier</th>
                <th className="px-5 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Document</th>
                <th className="px-5 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Fields Requested</th>
                <th className="px-5 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Fields Shared</th>
                <th className="px-5 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Decision</th>
                <th className="px-5 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Method</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {logs.map((log) => {
                const doc = documents.find(d => d.id === log.documentId);
                const formatFields = (fields: string[]) => fields.length > 0 
                  ? fields.map(f => f.replace(/([A-Z])/g, ' $1').trim().replace(/^\w/, c => c.toUpperCase())).join(', ') 
                  : '—';

                return (
                  <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-4 whitespace-nowrap">
                      <div className="flex items-center text-sm font-medium text-slate-900">
                        <Clock className="w-4 h-4 text-slate-400 mr-2" />
                        {new Date(log.timestamp).toLocaleString('en-US', { 
                          month: 'short', day: 'numeric', year: 'numeric', 
                          hour: 'numeric', minute: '2-digit' 
                        })}
                      </div>
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-6 h-6 bg-slate-100 rounded flex items-center justify-center text-slate-500 mr-2 shrink-0">
                          <Building2 className="w-3 h-3" />
                        </div>
                        <span className="text-sm font-bold text-slate-900">{log.verifier}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap">
                      <span className="text-sm font-semibold text-slate-700">{doc?.name || 'Unknown Document'}</span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-sm text-slate-600 line-clamp-1" title={formatFields(log.fieldsRequested || [])}>
                        {formatFields(log.fieldsRequested || [])}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`text-sm ${(log.fieldsShared || []).length > 0 ? 'text-primary-600 font-medium' : 'text-slate-400 font-bold'}`} title={formatFields(log.fieldsShared || [])}>
                        {formatFields(log.fieldsShared || [])}
                      </span>
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap">
                      {getDecisionBadge(log.decision || 'Unknown')}
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap">
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{log.method}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
