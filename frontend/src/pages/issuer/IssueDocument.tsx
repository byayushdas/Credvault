import { useState } from 'react';
import { Shield, FileKey, CheckCircle2, User, FileText, FileCheck, ArrowRight, Check } from 'lucide-react';
import { Link } from 'react-router-dom';

const DOCUMENT_TYPES = [
  'Government Identity',
  'PAN',
  'Passport',
  'Driving Licence',
  'Degree Certificate',
  'Marksheet'
];

export default function IssueDocument() {
  const [step, setStep] = useState(1);
  const [isSuccess, setIsSuccess] = useState(false);

  // Form State
  const [docType, setDocType] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [ownerDid, setOwnerDid] = useState('');
  
  // Just dummy state for step 3
  const [fields, setFields] = useState(''); 

  const handleNext = () => setStep(s => Math.min(s + 1, 5));
  const handleBack = () => setStep(s => Math.max(s - 1, 1));
  
  const handleIssue = () => {
    setIsSuccess(true);
  };

  if (isSuccess) {
    return (
      <div className="max-w-2xl mx-auto py-12">
        <div className="panel p-12 text-center animate-in fade-in zoom-in-95 duration-300">
          <div className="w-20 h-20 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-12 h-12" />
          </div>
          <h2 className="text-3xl font-bold text-slate-900 mb-2">Credential Issued Successfully</h2>
          <p className="text-slate-500 mb-8">The document has been cryptographically signed and sent to the user's vault.</p>

          <div className="max-w-xs mx-auto bg-slate-50 border border-slate-200 rounded-lg p-5 text-left mb-8 space-y-3">
            <div className="flex items-center text-sm font-medium text-slate-700">
              <Check className="w-5 h-5 text-emerald-500 mr-3" /> Digitally Signed
            </div>
            <div className="flex items-center text-sm font-medium text-slate-700">
              <Check className="w-5 h-5 text-emerald-500 mr-3" /> Issuer Verified
            </div>
            <div className="flex items-center text-sm font-medium text-slate-700">
              <Check className="w-5 h-5 text-emerald-500 mr-3" /> Ready for Vault
            </div>
          </div>

          <div className="flex gap-4 justify-center">
            <Link to="/issuer/dashboard" className="px-6 py-2.5 rounded-md border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50 transition-colors">
              Go to Dashboard
            </Link>
            <button 
              onClick={() => { setIsSuccess(false); setStep(1); setDocType(''); setOwnerName(''); }}
              className="px-6 py-2.5 rounded-md bg-primary-600 text-white font-semibold hover:bg-primary-700 transition-colors"
            >
              Issue Another
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto pb-12">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Issue New Credential</h1>
        <p className="text-slate-500 text-sm mt-1">Create and securely sign a verifiable credential.</p>
      </div>

      {/* Stepper */}
      <div className="flex items-center justify-between mb-8 relative">
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-0.5 bg-slate-200 -z-10"></div>
        <div className="absolute left-0 top-1/2 -translate-y-1/2 h-0.5 bg-primary-600 -z-10 transition-all duration-300" style={{ width: `${((step - 1) / 4) * 100}%` }}></div>
        
        {[
          { num: 1, label: 'Document Type', icon: FileText },
          { num: 2, label: 'Owner Details', icon: User },
          { num: 3, label: 'Document Fields', icon: FileCheck },
          { num: 4, label: 'Review', icon: FileKey },
          { num: 5, label: 'Sign & Issue', icon: Shield },
        ].map((s) => (
          <div key={s.num} className="flex flex-col items-center">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm border-2 transition-colors ${
              step > s.num ? 'bg-primary-600 border-primary-600 text-white' : 
              step === s.num ? 'bg-white border-primary-600 text-primary-600 ring-4 ring-primary-50' : 
              'bg-white border-slate-300 text-slate-400'
            }`}>
              {step > s.num ? <Check className="w-5 h-5" /> : s.num}
            </div>
            <span className={`text-xs font-bold mt-2 hidden sm:block ${step >= s.num ? 'text-slate-900' : 'text-slate-400'}`}>
              {s.label}
            </span>
          </div>
        ))}
      </div>

      <div className="panel p-8 min-h-[400px] flex flex-col">
        <div className="flex-1">
          {step === 1 && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-300">
              <h2 className="text-xl font-bold text-slate-900 mb-6">Select Document Type</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {DOCUMENT_TYPES.map(type => (
                  <button 
                    key={type}
                    onClick={() => { setDocType(type); handleNext(); }}
                    className={`p-4 rounded-lg border-2 text-left transition-all ${
                      docType === type ? 'border-primary-600 bg-primary-50' : 'border-slate-200 hover:border-primary-300 hover:bg-slate-50'
                    }`}
                  >
                    <span className="font-semibold text-slate-900">{type}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-300 max-w-md mx-auto">
              <h2 className="text-xl font-bold text-slate-900 mb-6 text-center">Enter Owner Details</h2>
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Owner Full Name</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-2.5 rounded-md border border-slate-300 focus:border-primary-500 focus:ring focus:ring-primary-500/20 outline-none transition-all text-sm"
                    placeholder="e.g. John Doe"
                    value={ownerName}
                    onChange={e => setOwnerName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Owner Vault DID (Optional)</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-2.5 rounded-md border border-slate-300 focus:border-primary-500 focus:ring focus:ring-primary-500/20 outline-none transition-all text-sm font-mono"
                    placeholder="did:credvault:owner:..."
                    value={ownerDid}
                    onChange={e => setOwnerDid(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-300 max-w-md mx-auto">
              <h2 className="text-xl font-bold text-slate-900 mb-6 text-center">Enter Document Fields</h2>
              <p className="text-sm text-slate-500 mb-4 text-center">Entering standard fields for {docType}.</p>
              
              <div className="space-y-4">
                {/* Generic Mock Fields based on type */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Primary Identifier</label>
                  <input type="text" className="w-full px-4 py-2.5 rounded-md border border-slate-300 focus:border-primary-500 outline-none text-sm" placeholder="e.g. ID Number or Roll Number" onChange={e => setFields(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Date of Issue</label>
                  <input type="date" className="w-full px-4 py-2.5 rounded-md border border-slate-300 focus:border-primary-500 outline-none text-sm" defaultValue={new Date().toISOString().split('T')[0]} />
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-300 max-w-md mx-auto">
              <h2 className="text-xl font-bold text-slate-900 mb-6 text-center">Review Details</h2>
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-5 space-y-4">
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Document Type</p>
                  <p className="font-medium text-slate-900">{docType}</p>
                </div>
                <div className="w-full h-px bg-slate-200"></div>
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Recipient</p>
                  <p className="font-medium text-slate-900">{ownerName || 'Not specified'}</p>
                  {ownerDid && <p className="text-xs font-mono text-slate-500 mt-1">{ownerDid}</p>}
                </div>
                <div className="w-full h-px bg-slate-200"></div>
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Data Fields</p>
                  <p className="font-medium text-slate-900">Primary Identifier: {fields || 'Not specified'}</p>
                  <p className="font-medium text-slate-900">Issue Date: {new Date().toLocaleDateString()}</p>
                </div>
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-300 max-w-md mx-auto text-center">
              <div className="w-16 h-16 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <Shield className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 mb-2">Sign & Issue</h2>
              <p className="text-sm text-slate-500 mb-8">You are about to cryptographically sign this credential and issue it to the user's vault.</p>
              
              <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-4 mb-8">
                <p className="text-emerald-800 font-semibold flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 mr-2 text-emerald-600" />
                  Digital Signature: Valid
                </p>
                <p className="text-xs text-emerald-600 mt-1">Ready for cryptographic seal</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="mt-8 pt-6 border-t border-slate-100 flex justify-between items-center">
          <button 
            onClick={handleBack}
            disabled={step === 1}
            className="px-4 py-2 text-sm font-semibold text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-50 rounded-md transition-colors"
          >
            Back
          </button>
          
          {step < 5 ? (
            <button 
              onClick={handleNext}
              disabled={(step === 1 && !docType) || (step === 2 && !ownerName)}
              className="px-6 py-2 bg-primary-600 text-white text-sm font-semibold rounded-md shadow-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary-700 transition-colors flex items-center"
            >
              Next Step <ArrowRight className="w-4 h-4 ml-1.5" />
            </button>
          ) : (
            <button 
              onClick={handleIssue}
              className="px-6 py-2.5 bg-slate-900 text-white text-sm font-semibold rounded-md shadow-sm hover:bg-slate-800 transition-colors flex items-center animate-pulse"
            >
              <Shield className="w-4 h-4 mr-1.5" /> Confirm & Issue
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
