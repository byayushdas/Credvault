import { useState } from 'react';
import { mockConsentRequests, mockDocuments } from '../../data/mockData';
import type { ConsentRequest } from '../../data/mockData';
import { getData, setData } from '../../services/localStorageService';
import { Check, X, Building, Lock, CheckCircle2, ShieldAlert, Clock } from 'lucide-react';

export default function ConsentRequests() {
  const [requests, setRequests] = useState<ConsentRequest[]>(() => getData('requests', mockConsentRequests));
  const [selectedRequest, setSelectedRequest] = useState<ConsentRequest | null>(null);
  const [modalMode, setModalMode] = useState<'prompt' | 'success'>('prompt');

  const pendingCount = requests.filter(r => r.status === 'Pending').length;
  const approvedCount = requests.filter(r => r.status === 'Approved').length;
  const deniedCount = requests.filter(r => r.status === 'Denied').length;

  const handleAction = (id: string, action: 'Approved' | 'Denied') => {
    const newRequests = requests.map(req => req.id === id ? { ...req, status: action } : req);
    setRequests(newRequests);
    setData('requests', newRequests);
    
    if (action === 'Approved') {
      setModalMode('success');
    } else {
      setSelectedRequest(null);
    }
  };

  const closeSuccess = () => {
    setSelectedRequest(null);
    setModalMode('prompt');
  };

  return (
    <div className="max-w-6xl mx-auto pb-12">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Verification Requests</h1>
        <p className="text-slate-500 text-sm mt-1">Manage incoming requests from verifiers requiring your consent.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="panel p-6 border-primary-200 ring-1 ring-primary-50">
          <p className="text-xs font-semibold text-primary-700 uppercase tracking-wider mb-2">Pending</p>
          <div className="flex items-end justify-between">
            <span className="text-3xl font-bold text-primary-900">{pendingCount}</span>
            <Clock className="w-5 h-5 text-primary-500 mb-1" />
          </div>
        </div>
        <div className="panel p-6">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Approved</p>
          <div className="flex items-end justify-between">
            <span className="text-3xl font-bold text-slate-900">{approvedCount}</span>
            <CheckCircle2 className="w-5 h-5 text-emerald-500 mb-1" />
          </div>
        </div>
        <div className="panel p-6">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Denied</p>
          <div className="flex items-end justify-between">
            <span className="text-3xl font-bold text-slate-900">{deniedCount}</span>
            <X className="w-5 h-5 text-rose-500 mb-1" />
          </div>
        </div>
      </div>

      {/* Pending Requests List */}
      <h2 className="text-lg font-bold text-slate-900 mb-4">Action Required</h2>
      
      {pendingCount === 0 ? (
        <div className="panel p-12 flex flex-col items-center justify-center">
          <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
            <ShieldAlert className="w-8 h-8 text-slate-300" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">No Pending Requests</h3>
          <p className="text-slate-500 text-sm mt-1">You have responded to all data access requests.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {requests.filter(r => r.status === 'Pending').map(request => {
            const doc = mockDocuments.find(d => d.id === request.documentId);
            if (!doc) return null;

            return (
              <div 
                key={request.id} 
                className="panel p-6 hover:border-primary-300 cursor-pointer transition-colors group flex flex-col"
                onClick={() => { setSelectedRequest(request); setModalMode('prompt'); }}
              >
                <div className="flex justify-between items-start mb-5">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-slate-50 border border-slate-200 rounded flex items-center justify-center text-primary-600">
                      <Building className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900">{request.verifierName}</h3>
                      <p className="text-xs text-slate-500">{new Date(request.requestDate).toLocaleString()}</p>
                    </div>
                  </div>
                  <span className="badge-pending px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider">
                    Manual Approval Required
                  </span>
                </div>

                <div className="mb-5 flex-1">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Requested Document</p>
                  <p className="text-sm font-semibold text-slate-900 bg-slate-50 border border-slate-100 px-3 py-2 rounded-md mb-4">
                    {doc.name}
                  </p>
                  
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Requested Fields</p>
                  <div className="space-y-1.5">
                    {request.requestedFields.map(key => (
                      <div key={key} className="flex items-center text-sm font-medium text-slate-700">
                        <Check className="w-4 h-4 mr-2 text-emerald-500" />
                        <span className="capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mt-auto">
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleAction(request.id, 'Denied'); }}
                    className="w-full px-4 py-2 rounded-md border border-slate-300 text-slate-700 text-sm font-medium hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition-colors"
                  >
                    Deny
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleAction(request.id, 'Approved'); }}
                    className="w-full px-4 py-2 rounded-md bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 transition-colors shadow-sm"
                  >
                    Approve & Share
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detailed Modal */}
      {selectedRequest && (() => {
        const doc = mockDocuments.find(d => d.id === selectedRequest.documentId);
        if (!doc) return null;

        const allFieldKeys = Object.keys(doc.fields);
        const requestedKeys = selectedRequest.requestedFields;
        const notRequestedKeys = allFieldKeys.filter(k => !requestedKeys.includes(k));

        if (modalMode === 'success') {
          return (
            <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="bg-emerald-600 text-white p-8 text-center relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-8 opacity-10">
                    <ShieldAlert className="w-32 h-32" />
                  </div>
                  <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-sm shadow-inner relative z-10">
                    <CheckCircle2 className="w-10 h-10 text-white" />
                  </div>
                  <h2 className="text-2xl font-bold relative z-10">Verification Completed</h2>
                </div>
                
                <div className="p-6">
                  <div className="space-y-3 mb-8 bg-slate-50 border border-slate-100 rounded-lg p-5">
                    <div className="flex items-center text-sm font-medium text-slate-700">
                      <CheckCircle2 className="w-5 h-5 text-emerald-500 mr-3" /> Request Authenticated
                    </div>
                    <div className="flex items-center text-sm font-medium text-slate-700">
                      <CheckCircle2 className="w-5 h-5 text-emerald-500 mr-3" /> Owner Consent Received
                    </div>
                    <div className="flex items-center text-sm font-medium text-slate-700">
                      <CheckCircle2 className="w-5 h-5 text-emerald-500 mr-3" /> Issuer Verified
                    </div>
                    <div className="flex items-center text-sm font-medium text-slate-700">
                      <CheckCircle2 className="w-5 h-5 text-emerald-500 mr-3" /> Selective Disclosure Completed
                    </div>
                  </div>

                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 border-b border-slate-100 pb-2">Disclosed Information</h3>
                  
                  <div className="space-y-3 mb-8">
                    {requestedKeys.map(key => (
                      <div key={key} className="flex flex-col">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                        <span className="font-mono font-medium text-sm text-slate-900">{doc.fields[key]}</span>
                      </div>
                    ))}
                  </div>

                  <div className="bg-primary-50 rounded-lg border border-primary-100 p-4 flex justify-between items-center text-sm font-medium">
                    <span className="text-emerald-700 font-bold">{requestedKeys.length} fields disclosed</span>
                    <span className="text-slate-500 flex items-center"><Lock className="w-3.5 h-3.5 mr-1" /> {notRequestedKeys.length} fields remained private</span>
                  </div>
                </div>

                <div className="p-6 border-t border-slate-200 bg-slate-50 flex">
                  <button 
                    onClick={closeSuccess}
                    className="w-full px-4 py-2.5 rounded-md bg-slate-900 text-white font-semibold hover:bg-slate-800 transition-colors shadow-sm"
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>
          );
        }

        return (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
              
              <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0">
                <h3 className="font-bold text-slate-900 flex items-center">
                  Verification Request
                </h3>
                <button 
                  onClick={() => setSelectedRequest(null)}
                  className="text-slate-400 hover:text-slate-600 p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-6 overflow-y-auto flex-1">
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Verifier</p>
                    <p className="font-semibold text-slate-900 flex items-center">
                      <Building className="w-4 h-4 mr-1.5 text-primary-600" />
                      {selectedRequest.verifierName}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Document</p>
                    <p className="font-semibold text-slate-900">{doc.name}</p>
                  </div>
                </div>

                <div className="mb-6">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Requested Information</p>
                  <div className="bg-emerald-50 border border-emerald-100 rounded-md p-4 space-y-2">
                    {requestedKeys.map(key => (
                      <div key={key} className="flex items-center text-sm font-medium text-emerald-800">
                        <Check className="w-4 h-4 mr-2 text-emerald-600 shrink-0" />
                        <span className="capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {notRequestedKeys.length > 0 && (
                  <div className="mb-6">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center">
                      <Lock className="w-3.5 h-3.5 mr-1.5" />
                      Not Requested (Kept Private)
                    </p>
                    <div className="bg-slate-50 border border-slate-100 rounded-md p-4 space-y-2">
                      {notRequestedKeys.map(key => (
                        <div key={key} className="flex items-center text-sm font-medium text-slate-500">
                          <Lock className="w-3.5 h-3.5 mr-2 text-slate-400 shrink-0" />
                          <span className="capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="bg-primary-50 text-primary-800 text-sm font-medium p-3 rounded-md text-center border border-primary-100">
                  Only the selected fields will be disclosed.
                </div>
              </div>
              
              <div className="p-6 border-t border-slate-200 bg-slate-50 flex gap-3 shrink-0">
                <button 
                  onClick={() => handleAction(selectedRequest.id, 'Denied')}
                  className="flex-1 px-4 py-2.5 rounded-md border border-slate-300 text-slate-700 font-semibold hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition-colors"
                >
                  Deny
                </button>
                <button 
                  onClick={() => handleAction(selectedRequest.id, 'Approved')}
                  className="flex-1 px-4 py-2.5 rounded-md bg-primary-600 text-white font-semibold hover:bg-primary-700 transition-colors shadow-sm"
                >
                  Approve & Share
                </button>
              </div>
            </div>
          </div>
        );
      })()}

    </div>
  );
}
