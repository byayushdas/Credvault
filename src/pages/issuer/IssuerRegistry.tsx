import { ShieldCheck, CheckCircle2, Shield, Search } from 'lucide-react';

const REGISTRY = [
  { id: 1, name: 'Government Identity Authority — Demo', category: 'Government', status: 'Active', pubKey: '0x8f3c...9a21' },
  { id: 2, name: 'Ministry of External Affairs — Demo', category: 'Government', status: 'Active', pubKey: '0x1e9b...4c11' },
  { id: 3, name: 'XYZ University', category: 'Education', status: 'Active', pubKey: '0x5a2f...8b00' },
  { id: 4, name: 'ABC Training Institute', category: 'Education', status: 'Active', pubKey: '0x9c4e...1f22' }
];

export default function IssuerRegistry() {
  return (
    <div className="max-w-6xl mx-auto pb-12">
      <div className="mb-8 flex flex-col sm:flex-row justify-between sm:items-end gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Registered Issuers</h1>
          <p className="text-slate-500 text-sm mt-1">Directory of cryptographically verified credential issuers on the network.</p>
        </div>
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input 
            type="text" 
            placeholder="Search registry..." 
            className="pl-9 pr-4 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:border-primary-500 w-full sm:w-64"
          />
        </div>
      </div>

      <div className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-5 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Issuer Name</th>
                <th className="px-5 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Category</th>
                <th className="px-5 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-5 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Verification</th>
                <th className="px-5 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Public Key Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {REGISTRY.map((issuer) => (
                <tr key={issuer.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="w-8 h-8 rounded bg-white border border-slate-200 flex items-center justify-center text-primary-600 mr-3">
                        <Shield className="w-4 h-4" />
                      </div>
                      <span className="text-sm font-bold text-slate-900">{issuer.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-4 whitespace-nowrap">
                    <span className="text-sm text-slate-600 font-medium">{issuer.category}</span>
                  </td>
                  <td className="px-5 py-4 whitespace-nowrap">
                    <span className="px-2 py-1 bg-slate-100 text-slate-700 rounded text-xs font-bold">{issuer.status}</span>
                  </td>
                  <td className="px-5 py-4 whitespace-nowrap">
                    <span className="badge-success px-2 py-1 rounded text-xs font-bold flex items-center w-fit">
                      <ShieldCheck className="w-3 h-3 mr-1" />
                      Verified
                    </span>
                  </td>
                  <td className="px-5 py-4 whitespace-nowrap">
                    <span className="text-sm font-mono text-slate-500 flex items-center">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 mr-1.5" />
                      {issuer.pubKey}
                    </span>
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
