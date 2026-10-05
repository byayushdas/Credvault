import { Link } from 'react-router-dom';
import { 
  CheckSquare, 
  CheckCircle2, 
  Clock, 
  X,
  FileCheck,
  ChevronRight,
  ShieldCheck
} from 'lucide-react';

export default function VerifierDashboard() {
  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Verifier Portal</h1>
          <p className="text-slate-500 text-sm mt-1">Request and verify user credentials securely.</p>
        </div>
        <Link 
          to="/verifier/new" 
          className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors shadow-sm flex items-center shrink-0"
        >
          <CheckSquare className="w-4 h-4 mr-2" />
          New Verification Request
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="panel p-5 border-primary-200 ring-1 ring-primary-50">
          <p className="text-xs font-semibold text-primary-700 uppercase tracking-wider mb-2">Total Requests</p>
          <div className="flex items-end justify-between">
            <span className="text-3xl font-bold text-primary-900">45</span>
            <CheckSquare className="w-5 h-5 text-primary-500 mb-1" />
          </div>
        </div>
        <div className="panel p-5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Approved</p>
          <div className="flex items-end justify-between">
            <span className="text-3xl font-bold text-slate-900">38</span>
            <CheckCircle2 className="w-5 h-5 text-emerald-500 mb-1" />
          </div>
        </div>
        <div className="panel p-5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Pending</p>
          <div className="flex items-end justify-between">
            <span className="text-3xl font-bold text-slate-900">5</span>
            <Clock className="w-5 h-5 text-amber-500 mb-1" />
          </div>
        </div>
        <div className="panel p-5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Denied</p>
          <div className="flex items-end justify-between">
            <span className="text-3xl font-bold text-slate-900">2</span>
            <X className="w-5 h-5 text-rose-500 mb-1" />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-slate-900">Recent Verifications</h2>
        <Link to="/audit" className="text-sm font-semibold text-primary-600 hover:text-primary-700 flex items-center">
          View History <ChevronRight className="w-4 h-4 ml-1" />
        </Link>
      </div>
      
      <div className="panel overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">User</th>
              <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Document</th>
              <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Date</th>
              <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            <tr className="hover:bg-slate-50">
              <td className="px-5 py-3 text-sm font-bold text-slate-900">Ayush Das</td>
              <td className="px-5 py-3 text-sm text-slate-600 flex items-center"><FileCheck className="w-3 h-3 mr-1.5" /> B.Tech Degree</td>
              <td className="px-5 py-3 text-sm text-slate-500">Just now</td>
              <td className="px-5 py-3"><span className="badge-success px-2 py-1 rounded text-xs font-bold flex items-center w-fit"><ShieldCheck className="w-3 h-3 mr-1" /> Approved</span></td>
            </tr>
            <tr className="hover:bg-slate-50">
              <td className="px-5 py-3 text-sm font-bold text-slate-900">Ravi Kumar</td>
              <td className="px-5 py-3 text-sm text-slate-600 flex items-center"><FileCheck className="w-3 h-3 mr-1.5" /> Driving Licence</td>
              <td className="px-5 py-3 text-sm text-slate-500">2 hours ago</td>
              <td className="px-5 py-3"><span className="badge-pending px-2 py-1 rounded text-xs font-bold flex items-center w-fit"><Clock className="w-3 h-3 mr-1" /> Pending</span></td>
            </tr>
            <tr className="hover:bg-slate-50">
              <td className="px-5 py-3 text-sm font-bold text-slate-900">Priya Singh</td>
              <td className="px-5 py-3 text-sm text-slate-600 flex items-center"><FileCheck className="w-3 h-3 mr-1.5" /> Passport</td>
              <td className="px-5 py-3 text-sm text-slate-500">Yesterday</td>
              <td className="px-5 py-3"><span className="badge-error px-2 py-1 rounded text-xs font-bold flex items-center w-fit"><X className="w-3 h-3 mr-1" /> Denied</span></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
