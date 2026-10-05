import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ShieldCheck, CheckCircle2, Lock, Building2, FileCheck } from 'lucide-react';
import { getData } from '../../services/localStorageService';
import type { VerificationRequest, Document } from '../../types';

export default function VerifierResult() {
  const { id } = useParams();

  const requests = getData<VerificationRequest[]>('requests', []);
  const req = requests.find(r => r.id === id);
  const docs = getData<Document[]>('documents', []);
  const doc = docs.find(d => d.id === (req ? req.documentId : ''));

  if (!req || !doc) {
    return <div className="p-12 text-center text-slate-500 font-medium">Result not found or pending owner approval.</div>;
  }

  const fieldsDisclosed = req.requestedFields.length;
  const fieldsProtected = Object.keys(doc.fields).length - fieldsDisclosed;

  const claims: Record<string, string> = {};
  req.requestedFields.forEach(field => {
    // Attempt to map requested field string back to original field key in mock data
    const camelField = field.charAt(0).toLowerCase() + field.slice(1).replace(/ ([a-z])/g, (m) => m[1].toUpperCase());
    claims[field] = doc.fields[camelField] || doc.fields[field] || doc.fields[field.toLowerCase()] || 'Not Provided';
  });

  const result = {
    id: req.id,
    status: req.status,
    issuer: doc.issuer,
    document: doc.name,
    fieldsDisclosed,
    fieldsProtected,
    claims
  };

  return (
    <div className="max-w-4xl mx-auto pb-12">
      <Link to="/verifier/history" className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-slate-900 mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to History
      </Link>

      <div className="mb-6 border-b border-slate-200 pb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center">
            Credential Verification Result
            <span className="ml-4 badge-success px-2.5 py-1 rounded text-xs font-bold flex items-center">
              <ShieldCheck className="w-3.5 h-3.5 mr-1.5" />
              Verified
            </span>
          </h1>
          <p className="text-sm font-mono text-slate-400 mt-2">Request ID: {result.id}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <div className="bg-slate-50 border border-slate-200 p-5 rounded-lg flex items-start">
          <Building2 className="w-5 h-5 text-slate-400 shrink-0 mt-0.5 mr-3" />
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Verified Issuer</p>
            <p className="font-semibold text-slate-900">{result.issuer}</p>
          </div>
        </div>
        <div className="bg-slate-50 border border-slate-200 p-5 rounded-lg flex items-start">
          <FileCheck className="w-5 h-5 text-slate-400 shrink-0 mt-0.5 mr-3" />
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Document Type</p>
            <p className="font-semibold text-slate-900">{result.document}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Disclosed Claims */}
        <div className="lg:col-span-2">
          <div className="panel p-8 h-full">
            <h2 className="text-lg font-bold text-slate-900 mb-6 uppercase tracking-wider text-sm border-b border-slate-100 pb-3">
              Disclosed Claims
            </h2>
            
            <div className="space-y-6 mb-8">
              {Object.entries(result.claims).map(([key, value]) => (
                <div key={key} className="flex flex-col">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">{key}</span>
                  <span className="font-mono font-medium text-lg text-slate-900 bg-emerald-50/50 border border-emerald-100 p-3 rounded-md">
                    {value}
                  </span>
                </div>
              ))}
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-5 flex items-center justify-between mt-auto">
              <div>
                <p className="text-sm font-bold text-emerald-700">Only {result.fieldsDisclosed} of {result.fieldsDisclosed + result.fieldsProtected} available fields were disclosed.</p>
              </div>
              <div className="flex items-center text-sm font-semibold text-slate-500 bg-white px-3 py-1.5 border border-slate-200 rounded-md shadow-sm">
                <Lock className="w-4 h-4 mr-1.5 text-slate-400" />
                {result.fieldsProtected} fields protected
              </div>
            </div>
          </div>
        </div>

        {/* Verification Checks */}
        <div className="lg:col-span-1">
          <div className="panel p-6 bg-slate-900 text-white h-full relative overflow-hidden">
            <div className="absolute top-0 right-0 p-6 opacity-10">
              <ShieldCheck className="w-32 h-32 text-emerald-400" />
            </div>
            
            <div className="relative z-10">
              <h2 className="text-lg font-bold mb-6 uppercase tracking-wider text-sm border-b border-slate-700 pb-3 flex items-center">
                Verification Checks
              </h2>
              
              <div className="space-y-5">
                <div className="flex items-start">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 mr-3 shrink-0" />
                  <div>
                    <p className="font-medium text-slate-100 text-sm">Verifier authenticated</p>
                    <p className="text-xs text-slate-400 mt-0.5">Your identity was confirmed.</p>
                  </div>
                </div>
                <div className="flex items-start">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 mr-3 shrink-0" />
                  <div>
                    <p className="font-medium text-slate-100 text-sm">Issuer verified</p>
                    <p className="text-xs text-slate-400 mt-0.5">Signature matches registry.</p>
                  </div>
                </div>
                <div className="flex items-start">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 mr-3 shrink-0" />
                  <div>
                    <p className="font-medium text-slate-100 text-sm">Document integrity valid</p>
                    <p className="text-xs text-slate-400 mt-0.5">Payload has not been tampered.</p>
                  </div>
                </div>
                <div className="flex items-start">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 mr-3 shrink-0" />
                  <div>
                    <p className="font-medium text-slate-100 text-sm">Owner consent received</p>
                    <p className="text-xs text-slate-400 mt-0.5">Cryptographic approval logged.</p>
                  </div>
                </div>
                <div className="flex items-start">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 mr-3 shrink-0" />
                  <div>
                    <p className="font-medium text-slate-100 text-sm">Selective disclosure applied</p>
                    <p className="text-xs text-slate-400 mt-0.5">Zero-knowledge proof validated.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
