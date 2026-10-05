import { useState } from 'react';
import { mockDocuments } from '../../data/mockData';
import { ShieldCheck, FileCheck, Search, Filter, ShieldAlert, Clock, Eye } from 'lucide-react';
import { Link } from 'react-router-dom';
import EmptyState from '../../components/common/EmptyState';
import { FileSearch } from 'lucide-react';

export default function MyDocuments() {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');

  const filteredDocs = mockDocuments.filter(doc => {
    const matchesSearch = doc.name.toLowerCase().includes(search.toLowerCase()) || doc.issuer.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = categoryFilter === 'All' || doc.category === categoryFilter;
    const matchesStatus = statusFilter === 'All' || doc.status === statusFilter || (statusFilter === 'Verified' && doc.verified);
    return matchesSearch && matchesCategory && matchesStatus;
  });

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My Documents</h1>
          <p className="text-slate-500 text-sm mt-1">Manage your digitally verified credentials.</p>
        </div>
        <button className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors shadow-sm shrink-0">
          Import Document
        </button>
      </div>

      <div className="panel p-5 mb-6 bg-white flex flex-col md:flex-row gap-4 items-center border-b border-slate-200">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input 
            type="text" 
            placeholder="Search documents..." 
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        
        <div className="flex gap-4 w-full md:w-auto">
          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-slate-500" />
            <select 
              className="text-sm border border-slate-300 rounded-md py-2 pl-3 pr-8 focus:outline-none focus:border-primary-500"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="All">All Categories</option>
              <option value="Government">Government</option>
              <option value="Education">Education</option>
            </select>
          </div>

          <select 
            className="text-sm border border-slate-300 rounded-md py-2 pl-3 pr-8 focus:outline-none focus:border-primary-500"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="All">All Statuses</option>
            <option value="Verified">Verified</option>
            <option value="Pending">Pending</option>
            <option value="Action Required">Action Required</option>
          </select>
        </div>
      </div>

      <div className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-5 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Document</th>
                <th className="px-5 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Category</th>
                <th className="px-5 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Issuer</th>
                <th className="px-5 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Issued</th>
                <th className="px-5 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-5 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredDocs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8">
                    <EmptyState 
                      icon={FileSearch}
                      title="No documents found"
                      description="Try adjusting your search or category filters to find what you're looking for."
                    />
                  </td>
                </tr>
              ) : filteredDocs.map((doc) => (
                <tr key={doc.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-4 whitespace-nowrap">
                    <span className="text-sm font-bold text-slate-900">{doc.name}</span>
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
                  <td className="px-5 py-4 whitespace-nowrap text-sm text-slate-500 font-medium">
                    {new Date(doc.issuedDate).toLocaleDateString()}
                  </td>
                  <td className="px-5 py-4 whitespace-nowrap">
                    {doc.verified ? (
                      <span className="badge-success px-2 py-1 rounded text-xs font-bold flex items-center w-fit">
                        <ShieldCheck className="w-3 h-3 mr-1" />
                        Verified
                      </span>
                    ) : doc.status === 'Pending' ? (
                      <span className="badge-pending px-2 py-1 rounded text-xs font-bold flex items-center w-fit">
                        <Clock className="w-3 h-3 mr-1" />
                        Pending
                      </span>
                    ) : (
                      <span className="badge-error px-2 py-1 rounded text-xs font-bold flex items-center w-fit">
                        <ShieldAlert className="w-3 h-3 mr-1" />
                        Action Required
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-4 whitespace-nowrap text-right">
                    <Link to={`/owner/documents/${doc.id}`} className="inline-flex items-center text-xs font-bold bg-white border border-slate-200 px-3 py-1.5 rounded hover:bg-slate-50 hover:border-slate-300 text-slate-700 transition-all">
                      <Eye className="w-3.5 h-3.5 mr-1" />
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
  );
}
