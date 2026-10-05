import { Link } from 'react-router-dom';
import { 
  Building2, 
  FileKey, 
  ShieldCheck, 
  Clock, 
  ShieldAlert,
  ChevronRight
} from 'lucide-react';

export default function IssuerDashboard() {
  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Issuer Portal</h1>
          <p className="text-slate-500 text-sm mt-1">Manage and issue verifiable credentials to users.</p>
        </div>
        <Link 
          to="/issuer/issue" 
          className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors shadow-sm flex items-center shrink-0"
        >
          <FileKey className="w-4 h-4 mr-2" />
          Issue New Credential
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="panel p-5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Documents Issued</p>
          <div className="flex items-end justify-between">
            <span className="text-3xl font-bold text-slate-900">128</span>
            <FileKey className="w-5 h-5 text-slate-400 mb-1" />
          </div>
        </div>
        <div className="panel p-5 border-emerald-200 ring-1 ring-emerald-50 bg-emerald-50/30">
          <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wider mb-2">Verified Credentials</p>
          <div className="flex items-end justify-between">
            <span className="text-3xl font-bold text-emerald-700">126</span>
            <ShieldCheck className="w-5 h-5 text-emerald-500 mb-1" />
          </div>
        </div>
        <div className="panel p-5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Pending</p>
          <div className="flex items-end justify-between">
            <span className="text-3xl font-bold text-slate-900">2</span>
            <Clock className="w-5 h-5 text-amber-500 mb-1" />
          </div>
        </div>
        <div className="panel p-5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Revoked</p>
          <div className="flex items-end justify-between">
            <span className="text-3xl font-bold text-slate-900">0</span>
            <ShieldAlert className="w-5 h-5 text-slate-400 mb-1" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-900">Recent Issuances</h2>
            <button className="text-sm font-semibold text-primary-600 hover:text-primary-700 flex items-center">
              View All <ChevronRight className="w-4 h-4 ml-1" />
            </button>
          </div>
          <div className="panel overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Recipient</th>
                  <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Credential</th>
                  <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Date</th>
                  <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr className="hover:bg-slate-50">
                  <td className="px-5 py-3 text-sm font-bold text-slate-900">Ayush Das</td>
                  <td className="px-5 py-3 text-sm text-slate-600">B.Tech Degree Certificate</td>
                  <td className="px-5 py-3 text-sm text-slate-500">Oct 05, 2026</td>
                  <td className="px-5 py-3"><span className="badge-success px-2 py-1 rounded text-xs font-bold">Active</span></td>
                </tr>
                <tr className="hover:bg-slate-50">
                  <td className="px-5 py-3 text-sm font-bold text-slate-900">Ravi Kumar</td>
                  <td className="px-5 py-3 text-sm text-slate-600">Marksheet</td>
                  <td className="px-5 py-3 text-sm text-slate-500">Oct 01, 2026</td>
                  <td className="px-5 py-3"><span className="badge-success px-2 py-1 rounded text-xs font-bold">Active</span></td>
                </tr>
                <tr className="hover:bg-slate-50">
                  <td className="px-5 py-3 text-sm font-bold text-slate-900">Priya Singh</td>
                  <td className="px-5 py-3 text-sm text-slate-600">B.Tech Degree Certificate</td>
                  <td className="px-5 py-3 text-sm text-slate-500">Sep 28, 2026</td>
                  <td className="px-5 py-3"><span className="badge-pending px-2 py-1 rounded text-xs font-bold">Pending</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-6">
          <div className="panel p-6 bg-slate-900 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 p-6 opacity-10">
              <Building2 className="w-32 h-32" />
            </div>
            <div className="relative z-10 h-full flex flex-col">
              <h2 className="text-lg font-bold mb-2">Issuer Identity</h2>
              <p className="text-slate-400 text-sm mb-6">Your cryptographic identity is verified and active on the network.</p>
              
              <div className="bg-slate-800/50 border border-slate-700 p-4 rounded-lg">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">DID (Decentralized ID)</p>
                <p className="font-mono text-sm text-primary-300 break-all">did:credvault:issuer:0x8f3c...9a21</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
