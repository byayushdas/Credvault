import { Link } from 'react-router-dom';
import { 
  ShieldCheck, 
  FileKey, 
  Eye, 
  ShieldAlert, 
  CheckCircle2, 
  Building2, 
  GraduationCap, 
  CarFront, 
  Shield, 
  ChevronRight,
  FileCheck
} from 'lucide-react';
import { mockDocuments, mockConsentRequests } from '../../data/mockData';
import StatCard from '../../components/common/StatCard';
import StatusBadge from '../../components/common/StatusBadge';

export default function OwnerDashboard() {
  const pendingRequests = mockConsentRequests.filter(r => r.status === 'Pending').length;
  
  const getIcon = (name: string) => {
    if (name.includes('Identity') || name.includes('PAN') || name.includes('Passport')) return <Building2 className="w-5 h-5" />;
    if (name.includes('Driving')) return <CarFront className="w-5 h-5" />;
    if (name.includes('Degree') || name.includes('Marksheet')) return <GraduationCap className="w-5 h-5" />;
    return <Shield className="w-5 h-5" />;
  };

  const govtDocs = mockDocuments.filter(d => d.category === 'Government');
  const eduDocs = mockDocuments.filter(d => d.category === 'Education');

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Good morning, Ayush</h1>
        <p className="text-slate-500 text-sm mt-1">Manage your verified documents and control what others can access.</p>
      </div>

      {/* Top statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Documents" value={mockDocuments.length} icon={FileKey} />
        <StatCard label="Verified" value={mockDocuments.length} icon={ShieldCheck} variant="success" />
        <Link to="/owner/requests" className="block hover:opacity-80 transition-opacity">
          <StatCard label="Pending Requests" value={pendingRequests} icon={ShieldAlert} variant="primary" />
        </Link>
        <StatCard label="Data Shares" value={14} icon={Eye} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        {/* Security Status Card */}
        <div className="panel p-6 bg-slate-900 text-white relative overflow-hidden lg:col-span-1 shadow-lg">
          <div className="absolute top-0 right-0 p-6 opacity-10">
            <ShieldCheck className="w-32 h-32 text-emerald-400" />
          </div>
          <div className="relative z-10 h-full flex flex-col">
            <h2 className="text-xl font-bold mb-2 flex items-center">
              Share claims, not documents.
            </h2>
            <p className="text-slate-400 text-sm mb-6 leading-relaxed">
              Your credentials remain yours.<br/>
              CredVault only reveals what you authorize.
            </p>
            
            <div className="space-y-4 mb-8 flex-1">
              <div className="flex items-center text-sm">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 mr-3 shrink-0" />
                <span className="text-slate-300">Encryption: Prototype Simulation</span>
              </div>
              <div className="flex items-center text-sm">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 mr-3 shrink-0" />
                <span className="text-slate-300">Digital Signature: Demo Valid</span>
              </div>
              <div className="flex items-center text-sm">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 mr-3 shrink-0" />
                <span className="text-slate-300">Issuer Verification: Mock Registry</span>
              </div>
              <div className="flex items-center text-sm">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 mr-3 shrink-0" />
                <span className="text-slate-300">Authentication: Demo Mode</span>
              </div>
            </div>

            <div className="bg-emerald-900/40 border border-emerald-800/50 rounded-lg p-3 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4 text-emerald-400 mr-2" />
              <span className="text-emerald-400 text-sm font-bold tracking-wide uppercase">Vault Protected</span>
            </div>
          </div>
        </div>

        {/* Categories */}
        <div className="lg:col-span-2 flex flex-col space-y-4">
          <h2 className="text-lg font-bold text-slate-900 mb-1">Document Categories</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1">
            <div className="panel p-6 flex flex-col justify-center hover:border-primary-300 transition-colors cursor-pointer group">
              <div className="w-12 h-12 bg-primary-50 rounded-lg flex items-center justify-center text-primary-600 mb-4 group-hover:scale-110 transition-transform">
                <Building2 className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-slate-900 text-lg">Government</h3>
              <p className="text-slate-500 text-sm mt-1">{govtDocs.length} Documents</p>
            </div>
            
            <div className="panel p-6 flex flex-col justify-center hover:border-primary-300 transition-colors cursor-pointer group">
              <div className="w-12 h-12 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-600 mb-4 group-hover:scale-110 transition-transform">
                <GraduationCap className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-slate-900 text-lg">Education</h3>
              <p className="text-slate-500 text-sm mt-1">{eduDocs.length} Documents</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Documents List */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-900">Recent Documents</h2>
          <Link to="/owner/documents" className="text-sm font-semibold text-primary-600 hover:text-primary-700 flex items-center">
            View All <ChevronRight className="w-4 h-4 ml-1" />
          </Link>
        </div>
        
        <div className="panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Document Name</th>
                  <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Category</th>
                  <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Issuer</th>
                  <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Issue Date</th>
                  <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {mockDocuments.map((doc) => (
                  <tr key={doc.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-8 h-8 rounded bg-white border border-slate-200 flex items-center justify-center text-primary-600 mr-3">
                          {getIcon(doc.name)}
                        </div>
                        <span className="text-sm font-bold text-slate-900">{doc.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap">
                      <span className="text-sm text-slate-600 flex items-center">
                        <FileCheck className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
                        {doc.category}
                      </span>
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap">
                      <span className="text-sm text-slate-600">{doc.issuer}</span>
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap">
                      <StatusBadge status={doc.status} />
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap text-sm text-slate-500 font-medium">
                      {new Date(doc.issuedDate).getFullYear()}
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap text-right">
                      <Link to={`/owner/documents/${doc.id}`} className="inline-flex items-center text-xs font-bold bg-white border border-slate-200 px-3 py-1.5 rounded hover:bg-slate-50 hover:border-slate-300 text-slate-700 transition-all">
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
