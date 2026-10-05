import { Link } from 'react-router-dom';
import { CheckCircle2, Clock, X, FileCheck, Eye, ShieldAlert } from 'lucide-react';
import { getData } from '../../services/localStorageService';
import type { VerificationRequest, Document } from '../../types';

export default function VerifierHistory() {
  const requests = getData<VerificationRequest[]>('requests', []);
  const documents = getData<Document[]>('documents', []);

  // Map requests to history table format
  const HISTORY = requests.map(req => {
    const doc = documents.find(d => d.id === req.documentId);
    return {
      id: req.id,
      user: 'Ayush Das', // Mock target user
      document: doc?.name || 'Unknown Document',
      fields: req.requestedFields.join(', '),
      date: new Date(req.createdAt || req.requestDate || new Date()).toLocaleString(),
      status: req.status
    };
  });
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Approved':
        return <span className="badge-success px-2 py-1 rounded text-xs font-bold flex items-center w-fit"><CheckCircle2 className="w-3 h-3 mr-1" /> Approved</span>;
      case 'Pending':
        return <span className="badge-pending px-2 py-1 rounded text-xs font-bold flex items-center w-fit"><Clock className="w-3 h-3 mr-1" /> Pending</span>;
      case 'Denied':
        return <span className="badge-error px-2 py-1 rounded text-xs font-bold flex items-center w-fit"><X className="w-3 h-3 mr-1" /> Denied</span>;
      default:
        return null;
    }
  };

  return (
    <div className="max-w-6xl mx-auto pb-12">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Verification History</h1>
        <p className="text-slate-500 text-sm mt-1">Review past verification requests and access approved data.</p>
      </div>

      <div className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-5 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Request ID</th>
                <th className="px-5 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">User</th>
                <th className="px-5 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Document</th>
                <th className="px-5 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Fields Requested</th>
                <th className="px-5 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Date</th>
                <th className="px-5 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-5 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {HISTORY.map((req) => (
                <tr key={req.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-4 whitespace-nowrap">
                    <span className="text-sm font-mono text-slate-500 font-medium">{req.id}</span>
                  </td>
                  <td className="px-5 py-4 whitespace-nowrap">
                    <span className="text-sm font-bold text-slate-900">{req.user}</span>
                  </td>
                  <td className="px-5 py-4 whitespace-nowrap">
                    <span className="text-sm text-slate-600 flex items-center">
                      <FileCheck className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
                      {req.document}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <span className="text-sm font-medium text-slate-600 bg-slate-100 px-2 py-1 rounded border border-slate-200 line-clamp-1" title={req.fields}>
                      {req.fields}
                    </span>
                  </td>
                  <td className="px-5 py-4 whitespace-nowrap">
                    <span className="text-sm text-slate-500 font-medium">{req.date}</span>
                  </td>
                  <td className="px-5 py-4 whitespace-nowrap">
                    {getStatusBadge(req.status)}
                  </td>
                  <td className="px-5 py-4 whitespace-nowrap text-right">
                    {req.status === 'Approved' ? (
                      <Link to={`/verifier/results/${req.id}`} className="inline-flex items-center text-xs font-bold bg-primary-50 border border-primary-200 px-3 py-1.5 rounded text-primary-700 hover:bg-primary-100 transition-colors">
                        <Eye className="w-3.5 h-3.5 mr-1" /> View Result
                      </Link>
                    ) : (
                      <button disabled className="inline-flex items-center text-xs font-bold bg-slate-50 border border-slate-200 px-3 py-1.5 rounded text-slate-400 opacity-50 cursor-not-allowed">
                        <ShieldAlert className="w-3.5 h-3.5 mr-1" /> Unavailable
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
