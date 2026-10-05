import { useState, useEffect } from 'react';
import { Shield, Plus, Edit2, Trash2, X, AlertCircle } from 'lucide-react';
import { mockDocuments } from '../../data/mockData';
import { getData, setData } from '../../services/localStorageService';

export interface ConsentRule {
  id: string;
  verifier: string;
  documentId: string;
  documentName: string;
  field: string;
  rule: 'Auto-Approve' | 'Ask Me' | 'Deny';
  lastUpdated: string;
}

const DEFAULT_RULES: ConsentRule[] = [
  { id: '1', verifier: 'ABC Technologies', documentId: 'DOC-005', documentName: 'B.Tech Degree Certificate', field: 'degree', rule: 'Auto-Approve', lastUpdated: '2026-10-01T10:00:00Z' },
  { id: '2', verifier: 'ABC Technologies', documentId: 'DOC-005', documentName: 'B.Tech Degree Certificate', field: 'cgpa', rule: 'Ask Me', lastUpdated: '2026-10-01T10:05:00Z' },
  { id: '3', verifier: 'ABC Technologies', documentId: 'DOC-003', documentName: 'Passport', field: 'dob', rule: 'Deny', lastUpdated: '2026-10-02T14:30:00Z' },
  { id: '4', verifier: 'Bank Demo', documentId: 'DOC-002', documentName: 'PAN-style Document', field: 'accountNumber', rule: 'Ask Me', lastUpdated: '2026-10-03T09:15:00Z' }
];

export default function ConsentRules() {
  const [rules, setRules] = useState<ConsentRule[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    verifier: '',
    documentId: '',
    field: '',
    rule: 'Ask Me' as 'Auto-Approve' | 'Ask Me' | 'Deny'
  });

  useEffect(() => {
    const saved = getData('consent_rules', null);
    if (saved) {
      setRules(saved);
    } else {
      setRules(DEFAULT_RULES);
      setData('consent_rules', DEFAULT_RULES);
    }
  }, []);

  const saveRulesToLocal = (newRules: ConsentRule[]) => {
    setRules(newRules);
    setData('consent_rules', newRules);
  };

  const getRuleBadge = (ruleType: string) => {
    switch (ruleType) {
      case 'Auto-Approve':
        return <span className="badge-success px-2 py-1 rounded text-xs font-bold uppercase tracking-wider">Auto-Approve</span>;
      case 'Ask Me':
        return <span className="badge-pending px-2 py-1 rounded text-xs font-bold uppercase tracking-wider">Ask</span>;
      case 'Deny':
        return <span className="badge-error px-2 py-1 rounded text-xs font-bold uppercase tracking-wider">Deny</span>;
      default:
        return null;
    }
  };

  const openModalForNew = () => {
    setEditingRuleId(null);
    setFormData({ verifier: '', documentId: '', field: '', rule: 'Ask Me' });
    setIsModalOpen(true);
  };

  const openModalForEdit = (rule: ConsentRule) => {
    setEditingRuleId(rule.id);
    setFormData({
      verifier: rule.verifier,
      documentId: rule.documentId,
      field: rule.field,
      rule: rule.rule
    });
    setIsModalOpen(true);
  };

  const deleteRule = (id: string) => {
    saveRulesToLocal(rules.filter(r => r.id !== id));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.verifier || !formData.documentId || !formData.field) return;

    const docName = mockDocuments.find(d => d.id === formData.documentId)?.name || 'Unknown Document';

    if (editingRuleId) {
      saveRulesToLocal(rules.map(r => r.id === editingRuleId ? {
        ...r,
        verifier: formData.verifier,
        documentId: formData.documentId,
        documentName: docName,
        field: formData.field,
        rule: formData.rule,
        lastUpdated: new Date().toISOString()
      } : r));
    } else {
      saveRulesToLocal([...rules, {
        id: Math.random().toString(36).substring(7),
        verifier: formData.verifier,
        documentId: formData.documentId,
        documentName: docName,
        field: formData.field,
        rule: formData.rule,
        lastUpdated: new Date().toISOString()
      }]);
    }
    setIsModalOpen(false);
  };

  const selectedDocument = mockDocuments.find(d => d.id === formData.documentId);
  const availableFields = selectedDocument ? Object.keys(selectedDocument.fields) : [];

  return (
    <div className="max-w-6xl mx-auto pb-12">
      <div className="mb-8 flex flex-col sm:flex-row justify-between sm:items-end gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Consent Rules</h1>
          <p className="text-slate-500 text-sm mt-1">Control exactly what each verifier can access.</p>
        </div>
        <button 
          onClick={openModalForNew}
          className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors shadow-sm flex items-center shrink-0"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Add Consent Rule
        </button>
      </div>
      
      <div className="bg-primary-50 border border-primary-100 rounded-lg p-5 mb-8 flex items-start">
        <AlertCircle className="w-5 h-5 text-primary-600 shrink-0 mt-0.5 mr-3" />
        <div>
          <p className="text-primary-900 text-sm font-medium leading-relaxed">
            CredVault lets you define how verification requests should be handled automatically. By setting up rules, you can auto-approve frequent KYC requests for trusted banks or automatically deny sensitive data requests.
          </p>
        </div>
      </div>

      <div className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-5 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Verifier</th>
                <th className="px-5 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Document</th>
                <th className="px-5 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Requested Field</th>
                <th className="px-5 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Rule</th>
                <th className="px-5 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Last Updated</th>
                <th className="px-5 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {rules.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-slate-500 text-sm">
                    No consent rules configured. Click "Add Consent Rule" to create one.
                  </td>
                </tr>
              ) : rules.map((rule) => (
                <tr key={rule.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-4 whitespace-nowrap">
                    <span className="text-sm font-bold text-slate-900">{rule.verifier}</span>
                  </td>
                  <td className="px-5 py-4 whitespace-nowrap">
                    <span className="text-sm font-medium text-slate-700">{rule.documentName}</span>
                  </td>
                  <td className="px-5 py-4 whitespace-nowrap">
                    <span className="text-sm font-mono text-slate-600 bg-white px-2 py-1 rounded border border-slate-200 capitalize">
                      {rule.field.replace(/([A-Z])/g, ' $1').trim()}
                    </span>
                  </td>
                  <td className="px-5 py-4 whitespace-nowrap">
                    {getRuleBadge(rule.rule)}
                  </td>
                  <td className="px-5 py-4 whitespace-nowrap text-sm text-slate-500 font-medium">
                    {new Date(rule.lastUpdated).toLocaleDateString()}
                  </td>
                  <td className="px-5 py-4 whitespace-nowrap text-right">
                    <button 
                      onClick={() => openModalForEdit(rule)}
                      className="inline-flex items-center text-slate-400 hover:text-primary-600 p-1.5 transition-colors"
                      title="Edit Rule"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => deleteRule(rule.id)}
                      className="inline-flex items-center text-slate-400 hover:text-red-600 p-1.5 ml-2 transition-colors"
                      title="Delete Rule"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-slate-900 flex items-center">
                <Shield className="w-4 h-4 mr-2 text-primary-600" />
                {editingRuleId ? 'Edit Consent Rule' : 'Add Consent Rule'}
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSave} className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Verifier</label>
                  <input 
                    type="text" 
                    required
                    className="w-full px-3 py-2 rounded-md border border-slate-300 focus:border-primary-500 focus:ring focus:ring-primary-500/20 outline-none transition-all text-sm"
                    placeholder="e.g. ABC Technologies"
                    value={formData.verifier}
                    onChange={(e) => setFormData({...formData, verifier: e.target.value})}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Document</label>
                  <select 
                    required
                    className="w-full px-3 py-2 rounded-md border border-slate-300 focus:border-primary-500 focus:ring focus:ring-primary-500/20 outline-none transition-all text-sm bg-white"
                    value={formData.documentId}
                    onChange={(e) => {
                      setFormData({...formData, documentId: e.target.value, field: ''});
                    }}
                  >
                    <option value="" disabled>Select a document</option>
                    {mockDocuments.map(doc => (
                      <option key={doc.id} value={doc.id}>{doc.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Field</label>
                  <select 
                    required
                    disabled={!formData.documentId}
                    className="w-full px-3 py-2 rounded-md border border-slate-300 focus:border-primary-500 focus:ring focus:ring-primary-500/20 outline-none transition-all text-sm bg-white disabled:bg-slate-50 disabled:text-slate-400"
                    value={formData.field}
                    onChange={(e) => setFormData({...formData, field: e.target.value})}
                  >
                    <option value="" disabled>Select a field</option>
                    {availableFields.map(field => (
                      <option key={field} value={field}>{field.replace(/([A-Z])/g, ' $1').trim().replace(/^\w/, c => c.toUpperCase())}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Rule</label>
                  <select 
                    required
                    className="w-full px-3 py-2 rounded-md border border-slate-300 focus:border-primary-500 focus:ring focus:ring-primary-500/20 outline-none transition-all text-sm bg-white"
                    value={formData.rule}
                    onChange={(e) => setFormData({...formData, rule: e.target.value as any})}
                  >
                    <option value="Auto-Approve">Auto-Approve</option>
                    <option value="Ask Me">Ask Me</option>
                    <option value="Deny">Deny</option>
                  </select>
                </div>
              </div>
              
              <div className="mt-8 flex justify-end gap-3">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-md border border-slate-300 text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="px-4 py-2 rounded-md bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 transition-colors shadow-sm"
                >
                  Save Rule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
