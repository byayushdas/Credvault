import { useState } from 'react';
import { User, FileText, CheckSquare, Send, Check, Search, ShieldCheck, CheckCircle2, Clock } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { getData, setData } from '../../services/localStorageService';
import type { ConsentRule, VerificationRequest, AuditLogEntry } from '../../types';
import { mockDocuments } from '../../data/mockData';

const DOC_TEMPLATES: Record<string, string[]> = {
  'Degree Certificate': ['Student Name', 'Degree', 'Graduation Year', 'CGPA', 'University Id', 'Roll Number'],
  'Passport': ['Name', 'Nationality', 'Dob', 'Passport Number', 'Expiry Date'],
  'PAN': ['Name', 'Account Number', 'Dob'],
  'Driving Licence': ['Name', 'Licence Number', 'Vehicle Class', 'Validity'],
};

export default function NewVerification() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [isSuccess, setIsSuccess] = useState(false);
  const [resultId, setResultId] = useState<string | null>(null);
  const [resultStatus, setResultStatus] = useState<'Approved' | 'Pending'>('Pending');

  // Form State
  const [ownerSearch, setOwnerSearch] = useState('');
  const [selectedOwner, setSelectedOwner] = useState<string | null>(null);
  const [selectedDoc, setSelectedDoc] = useState('');
  const [selectedFields, setSelectedFields] = useState<string[]>([]);

  const handleNext = () => setStep(s => Math.min(s + 1, 4));
  const handleBack = () => setStep(s => Math.max(s - 1, 1));
  
  const handleSend = () => {
    // Determine the document ID for the selected doc name
    const docObj = mockDocuments.find((d: any) => d.name.includes(selectedDoc) || d.type.includes(selectedDoc));
    const docId = docObj ? docObj.id : `DOC-${Math.floor(Math.random() * 100)}`;

    // Load rules
    const rules = getData<ConsentRule[]>('consent_rules', []);
    
    // Evaluate
    let hasAsk = false;
    let hasDeny = false;
    
    selectedFields.forEach(field => {
      // Create camelCase version of field for matching mock data logic
      const camelField = field.charAt(0).toLowerCase() + field.slice(1).replace(/ ([a-z])/g, (m) => m[1].toUpperCase());
      const rule = rules.find((r: any) => r.verifier === 'ABC Technologies' && r.documentId === docId && (r.field.toLowerCase() === field.toLowerCase() || r.field === camelField));
      
      if (rule) {
        if (rule.rule === 'Ask Me' || rule.action === 'ASK') hasAsk = true;
        if (rule.rule === 'Deny' || rule.action === 'DENY') hasDeny = true;
      } else {
        hasAsk = true; // Default behavior
      }
    });

    const status = hasDeny ? 'Denied' : (hasAsk ? 'Pending' : 'Approved');
    const newReqId = `req-${Date.now()}`;
    
    const newRequest: VerificationRequest = {
      id: newReqId,
      verifierName: 'ABC Technologies',
      documentId: docId,
      requestedFields: selectedFields,
      purpose: 'Verification Request',
      status: status,
      createdAt: new Date().toISOString(),
      requestDate: new Date().toISOString()
    };

    const requests = getData<VerificationRequest[]>('requests', []);
    setData('requests', [newRequest, ...requests]);

    const logs = getData<AuditLogEntry[]>('audit_logs', []);
    const newLog: AuditLogEntry = {
      id: `log-${Date.now()}`,
      action: hasDeny ? 'Denied' : (hasAsk ? 'Viewed' : 'Shared'),
      documentId: docId,
      verifier: 'ABC Technologies',
      fieldsRequested: selectedFields,
      fieldsShared: hasAsk || hasDeny ? [] : selectedFields,
      decision: hasDeny ? 'Denied' : (hasAsk ? 'Pending' : 'Approved'),
      method: hasDeny || hasAsk ? 'User Denied' : 'Rule-Based',
      timestamp: new Date().toISOString()
    };
    setData('audit_logs', [newLog, ...logs]);

    setResultId(newReqId);
    setResultStatus(status as 'Approved' | 'Pending');
    setIsSuccess(true);
  };

  const toggleField = (field: string) => {
    setSelectedFields(prev => 
      prev.includes(field) ? prev.filter(f => f !== field) : [...prev, field]
    );
  };

  if (isSuccess) {
    if (resultStatus === 'Approved') {
      return (
        <div className="max-w-2xl mx-auto py-12">
          <div className="panel p-12 text-center animate-in fade-in zoom-in-95 duration-300">
            <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-10 h-10 ml-1" />
            </div>
            <h2 className="text-3xl font-bold text-slate-900 mb-2">VERIFICATION SUCCESSFUL</h2>
            <p className="text-slate-500 mb-8">Owner consent rules automatically approved this request.</p>
            <div className="flex gap-4 justify-center">
              <button onClick={() => navigate(`/verifier/results/${resultId}`)} className="px-6 py-2.5 rounded-md bg-primary-600 text-white font-semibold hover:bg-primary-700 transition-colors">
                View Verification Result
              </button>
            </div>
          </div>
        </div>
      );
    }
    
    return (
      <div className="max-w-2xl mx-auto py-12">
        <div className="panel p-12 text-center animate-in fade-in zoom-in-95 duration-300">
          <div className="w-20 h-20 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-6 border border-amber-200">
            <Clock className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2 uppercase tracking-wide">PENDING — OWNER APPROVAL REQUIRED</h2>
          <p className="text-slate-500 mb-8">This request contains fields that require manual consent from the user. You will be notified when they respond.</p>

          <div className="flex gap-4 justify-center">
            <Link to="/verifier/dashboard" className="px-6 py-2.5 rounded-md border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50 transition-colors">
              Return to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto pb-12">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">New Verification Request</h1>
        <p className="text-slate-500 text-sm mt-1">Request selective disclosure from a user's credential vault.</p>
      </div>

      {/* Stepper */}
      <div className="flex items-center justify-between mb-8 relative">
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-0.5 bg-slate-200 -z-10"></div>
        <div className="absolute left-0 top-1/2 -translate-y-1/2 h-0.5 bg-primary-600 -z-10 transition-all duration-300" style={{ width: `${((step - 1) / 3) * 100}%` }}></div>
        
        {[
          { num: 1, label: 'Select User', icon: User },
          { num: 2, label: 'Select Document', icon: FileText },
          { num: 3, label: 'Select Fields', icon: CheckSquare },
          { num: 4, label: 'Review', icon: ShieldCheck },
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
            <div className="animate-in fade-in slide-in-from-right-4 duration-300 max-w-md mx-auto">
              <h2 className="text-xl font-bold text-slate-900 mb-6 text-center">Select Document Owner</h2>
              
              <div className="relative mb-6">
                <Search className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input 
                  type="text" 
                  placeholder="Search user..." 
                  className="w-full pl-10 pr-4 py-3 rounded-md border border-slate-300 focus:border-primary-500 focus:ring focus:ring-primary-500/20 outline-none transition-all text-sm"
                  value={ownerSearch}
                  onChange={e => setOwnerSearch(e.target.value)}
                />
              </div>

              <div className="space-y-3">
                <button 
                  onClick={() => { setSelectedOwner('Ayush Das'); handleNext(); }}
                  className={`w-full flex items-center p-4 rounded-lg border-2 transition-all text-left ${
                    selectedOwner === 'Ayush Das' ? 'border-primary-600 bg-primary-50' : 'border-slate-200 hover:border-primary-300 hover:bg-slate-50'
                  }`}
                >
                  <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold mr-4 shrink-0">
                    AD
                  </div>
                  <div>
                    <div className="font-bold text-slate-900">Ayush Das</div>
                    <div className="text-xs text-slate-500 font-mono mt-0.5">did:credvault:owner:0x1a2b...</div>
                  </div>
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-300 max-w-2xl mx-auto">
              <h2 className="text-xl font-bold text-slate-900 mb-6 text-center">Select Document Type</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {Object.keys(DOC_TEMPLATES).map(doc => (
                  <button 
                    key={doc}
                    onClick={() => { 
                      setSelectedDoc(doc); 
                      setSelectedFields([]); // Reset fields on document change
                      handleNext(); 
                    }}
                    className={`p-5 rounded-lg border-2 text-left transition-all ${
                      selectedDoc === doc ? 'border-primary-600 bg-primary-50' : 'border-slate-200 hover:border-primary-300 hover:bg-slate-50'
                    }`}
                  >
                    <span className="font-bold text-slate-900 block mb-1">{doc}</span>
                    <span className="text-xs text-slate-500">{DOC_TEMPLATES[doc].length} verifiable data fields</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 3 && selectedDoc && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-300 max-w-md mx-auto">
              <h2 className="text-xl font-bold text-slate-900 mb-2 text-center">Select Required Fields</h2>
              <p className="text-sm text-slate-500 mb-6 text-center">Choose only the specific data points needed from the {selectedDoc}.</p>
              
              <div className="bg-slate-50 border border-slate-200 rounded-lg overflow-hidden">
                {DOC_TEMPLATES[selectedDoc].map((field, idx) => (
                  <label key={field} className={`flex items-center p-4 cursor-pointer hover:bg-slate-100 transition-colors ${idx !== DOC_TEMPLATES[selectedDoc].length - 1 ? 'border-b border-slate-200' : ''}`}>
                    <div className="relative flex items-center">
                      <input 
                        type="checkbox" 
                        className="peer sr-only"
                        checked={selectedFields.includes(field)}
                        onChange={() => toggleField(field)}
                      />
                      <div className="w-5 h-5 border-2 border-slate-300 rounded peer-checked:bg-primary-600 peer-checked:border-primary-600 flex items-center justify-center transition-all">
                        {selectedFields.includes(field) && <Check className="w-3.5 h-3.5 text-white" />}
                      </div>
                    </div>
                    <span className="ml-3 text-sm font-semibold text-slate-700">{field}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-300 max-w-md mx-auto">
              <h2 className="text-xl font-bold text-slate-900 mb-6 text-center">Review Request</h2>
              
              <div className="bg-primary-50 border border-primary-100 rounded-lg p-4 text-center mb-6">
                <p className="text-primary-800 text-sm font-medium">You're requesting only the selected information.</p>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-lg p-5 space-y-4">
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Target User</p>
                  <p className="font-medium text-slate-900">{selectedOwner}</p>
                </div>
                <div className="w-full h-px bg-slate-200"></div>
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Document</p>
                  <p className="font-medium text-slate-900">{selectedDoc}</p>
                </div>
                <div className="w-full h-px bg-slate-200"></div>
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Fields to Request</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedFields.length > 0 ? selectedFields.map(f => (
                      <span key={f} className="bg-white border border-slate-300 text-slate-700 text-xs font-bold px-2 py-1 rounded">
                        {f}
                      </span>
                    )) : (
                      <span className="text-sm text-rose-500 font-medium">No fields selected</span>
                    )}
                  </div>
                </div>
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
          
          {step < 4 ? (
            <button 
              onClick={handleNext}
              disabled={(step === 1 && !selectedOwner) || (step === 2 && !selectedDoc) || (step === 3 && selectedFields.length === 0)}
              className="px-6 py-2 bg-primary-600 text-white text-sm font-semibold rounded-md shadow-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary-700 transition-colors flex items-center"
            >
              Next Step
            </button>
          ) : (
            <button 
              onClick={handleSend}
              disabled={selectedFields.length === 0}
              className="px-6 py-2.5 bg-slate-900 text-white text-sm font-semibold rounded-md shadow-sm hover:bg-slate-800 transition-colors flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4 mr-2" /> Send Verification Request
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
