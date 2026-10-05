import { useParams, Link } from 'react-router-dom';
import { mockDocuments } from '../../data/mockData';
import { ArrowLeft, ShieldCheck, CheckCircle2, Share2, Settings2 } from 'lucide-react';

export default function DocumentDetails() {
  const { id } = useParams();
  const document = mockDocuments.find(d => d.id === id);

  if (!document) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh]">
        <h2 className="text-xl font-bold text-slate-700">Document not found</h2>
        <Link to="/owner/documents" className="text-primary-600 mt-4">Back to Documents</Link>
      </div>
    );
  }

  // Fictional visual representation
  const renderDocumentPreview = () => {
    return (
      <div className="relative w-full max-w-sm mx-auto bg-amber-50/50 border-2 border-slate-200 rounded-xl p-6 shadow-sm overflow-hidden isolate">
        {/* Watermark */}
        <div className="absolute inset-0 flex items-center justify-center -z-10 pointer-events-none overflow-hidden">
          <div className="text-4xl md:text-5xl font-bold tracking-widest text-slate-300 opacity-20 -rotate-12 whitespace-nowrap select-none">
            DEMO DOCUMENT — NOT VALID
          </div>
        </div>
        
        <div className="text-center mb-6 border-b border-slate-200 pb-4">
          <h4 className="font-bold text-slate-800 tracking-widest text-sm uppercase">{document.issuer.toUpperCase()}</h4>
          <h3 className="font-bold text-primary-900 text-lg mt-1 tracking-widest uppercase">{document.name}</h3>
        </div>

        <div className="space-y-4 mb-8">
          {Object.keys(document.fields).slice(0, 4).map((key, idx) => (
            <div key={idx} className="flex flex-col">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
              <span className="font-mono font-medium text-sm text-slate-900">
                {/* Mask sensitive visual fields in the visual preview card only */}
                {key.toLowerCase().includes('name') || key.toLowerCase().includes('nationality') 
                  ? document.fields[key] 
                  : '••••••••'}
              </span>
            </div>
          ))}
        </div>

        <div className="text-center border-t border-slate-200 pt-4 mt-auto">
          <span className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">
            Demo Document — Not Valid
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto pb-12">
      <Link to="/owner/documents" className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-slate-900 mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Documents
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Details & Fields */}
        <div className="lg:col-span-2 space-y-6">
          {/* Header Card */}
          <div className="panel p-8">
            <div className="flex items-center space-x-2 mb-4">
              <span className="badge-success px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center">
                <ShieldCheck className="w-3 h-3 mr-1.5" />
                Verified Credential
              </span>
            </div>
            
            <h1 className="text-3xl font-bold text-slate-900 mb-6">{document.name}</h1>
            
            <div className="grid grid-cols-2 md:grid-cols-3 gap-6 pt-6 border-t border-slate-100">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Issuer</p>
                <p className="font-medium text-slate-900">{document.issuer} — Demo</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Issued</p>
                <p className="font-medium text-slate-900">{new Date(document.issuedDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Verification Status</p>
                <p className="font-medium text-emerald-600 flex items-center">
                  Verified <CheckCircle2 className="w-4 h-4 ml-1.5" />
                </p>
              </div>
            </div>
          </div>

          {/* Verification Information */}
          <div className="panel p-8">
            <h3 className="text-lg font-bold text-slate-900 mb-6">Verification Information</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Issuer Status</p>
                <p className="font-medium text-slate-900 flex items-center">
                  <ShieldCheck className="w-4 h-4 text-emerald-500 mr-2" /> Verified
                </p>
              </div>
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Digital Signature</p>
                <p className="font-medium text-slate-900 flex items-center">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 mr-2" /> Valid
                </p>
              </div>
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Document Integrity</p>
                <p className="font-medium text-slate-900 flex items-center">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 mr-2" /> Valid
                </p>
              </div>
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Credential Status</p>
                <p className="font-medium text-slate-900 flex items-center">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 mr-2"></span> Active
                </p>
              </div>
            </div>
          </div>

          {/* Document Fields */}
          <div className="panel p-8">
            <h3 className="text-lg font-bold text-slate-900 mb-6">Document Fields</h3>
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-left">
                <tbody className="divide-y divide-slate-200">
                  {Object.keys(document.fields).map((key) => (
                    <tr key={key} className="hover:bg-slate-50">
                      <td className="px-6 py-4 w-1/3 bg-slate-50/50">
                        <span className="text-sm font-semibold text-slate-700 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-mono text-slate-900">{document.fields[key]}</span>
                      </td>
                    </tr>
                  ))}
                  {/* Hardcoding extra fields to match the user's specific example table density if needed, 
                      but dynamic rendering from mockData is better. */}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column: Preview & Sharing */}
        <div className="space-y-6">
          <div className="panel p-6 flex flex-col items-center">
            <h3 className="text-sm font-bold text-slate-900 mb-6 self-start w-full border-b border-slate-100 pb-2">Document Preview</h3>
            {renderDocumentPreview()}
          </div>

          <div className="panel p-6">
            <h3 className="text-sm font-bold text-slate-900 mb-4 border-b border-slate-100 pb-2 flex items-center">
              <Share2 className="w-4 h-4 mr-2 text-slate-500" />
              Sharing Information
            </h3>
            <div className="bg-primary-50 border border-primary-100 rounded-lg p-4 mb-6">
              <p className="text-sm text-primary-900 font-medium text-center">
                This document has been shared 4 times.
              </p>
            </div>
            <button className="w-full flex items-center justify-center bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold py-2.5 rounded-md transition-colors shadow-sm">
              <Settings2 className="w-4 h-4 mr-2 text-slate-500" />
              Manage Sharing
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
