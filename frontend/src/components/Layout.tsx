import { useState, useRef, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { 
  Shield, 
  LayoutDashboard, 
  FileText, 
  CheckSquare, 
  History, 
  Settings, 
  HelpCircle,
  Bell,
  Search,
  Building,
  RefreshCw
} from 'lucide-react';
import { mockConsentRequests } from '../data/mockData';
import { resetDemoData } from '../services/localStorageService';

type Role = 'Owner' | 'Issuer' | 'Verifier';

export default function Layout() {
  const navigate = useNavigate();
  const [role, setRoleState] = useState<Role>(
    (localStorage.getItem('credvault_role') as Role) || 'Owner'
  );
  
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  const pendingRequests = mockConsentRequests.filter(r => r.status === 'Pending');

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setIsNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const setRole = (newRole: Role) => {
    setRoleState(newRole);
    localStorage.setItem('credvault_role', newRole);
    // Navigate to appropriate dashboard
    switch (newRole) {
      case 'Owner': navigate('/owner/dashboard'); break;
      case 'Issuer': navigate('/issuer/dashboard'); break;
      case 'Verifier': navigate('/verifier/dashboard'); break;
    }
  };

  const navItems = {
    Owner: [
      { to: '/owner/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
      { to: '/owner/documents', icon: FileText, label: 'My Documents' },
      { to: '/owner/requests', icon: CheckSquare, label: 'Verification Requests', badge: pendingRequests.length },
      { to: '/owner/consent', icon: Shield, label: 'Consent Rules' },
      { to: '/audit', icon: History, label: 'Audit Log' },
    ],
    Issuer: [
      { to: '/issuer/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
      { to: '/issuer/issue', icon: FileText, label: 'Issue Credential' },
      { to: '/issuer/registry', icon: Shield, label: 'Issuer Registry' },
      { to: '/audit', icon: History, label: 'Audit Log' },
    ],
    Verifier: [
      { to: '/verifier/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
      { to: '/verifier/new', icon: CheckSquare, label: 'New Verification' },
      { to: '/verifier/history', icon: History, label: 'Verification History' },
    ]
  };

  const currentNavItems = navItems[role];

  return (
    <div className="flex flex-col h-screen bg-slate-50 text-slate-900 font-sans selection:bg-primary-100 selection:text-primary-900">
      
      {/* Top Bar */}
      <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0 z-30">
        <div className="flex items-center space-x-8 flex-1">
          {/* Left: Branding */}
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-primary-700 rounded-md flex items-center justify-center text-white shadow-sm">
              <Shield className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-lg leading-tight text-slate-900 tracking-tight">CredVault</span>
              <span className="text-[10px] uppercase font-semibold text-slate-500 tracking-wider">
                Decentralized Credential Vault
              </span>
            </div>
          </div>

          {/* Search */}
          <div className="hidden md:flex relative max-w-md w-full ml-8">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text" 
              placeholder="Search documents, requests, users..." 
              className="w-full pl-9 pr-4 py-2 border border-slate-200 bg-slate-50 focus:bg-white rounded-md text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-all"
            />
          </div>
        </div>

        {/* Right: Actions & Profile */}
        <div className="flex items-center space-x-5 ml-4">
          
          <div className="px-2.5 py-1 text-[10px] font-bold tracking-wider text-rose-700 bg-rose-50 border border-rose-200 rounded uppercase flex items-center">
            LOCAL DEMO
          </div>

          <div className="flex items-center text-sm font-semibold border border-slate-200 rounded-md overflow-hidden shadow-sm">
            <span className="bg-slate-50 text-slate-500 px-3 py-1.5 border-r border-slate-200 text-xs uppercase tracking-wider">Role</span>
            <select 
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
              className="bg-white text-primary-700 font-bold px-2 py-1.5 focus:outline-none cursor-pointer appearance-none outline-none pr-8 relative"
              style={{ background: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'%230f172a\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'2\' d=\'M19 9l-7 7-7-7\'%3E%3C/path%3E%3C/svg%3E") no-repeat right 0.5rem center / 1rem 1rem, #fff' }}
            >
              <option value="Owner">Owner</option>
              <option value="Issuer">Issuer</option>
              <option value="Verifier">Verifier</option>
            </select>
          </div>
          
          {/* Notifications Dropdown */}
          <div className="relative" ref={notifRef}>
            <button 
              onClick={() => setIsNotifOpen(!isNotifOpen)}
              className="relative text-slate-500 hover:text-slate-700 transition-colors p-1"
            >
              <Bell className="w-5 h-5" />
              {pendingRequests.length > 0 && (
                <span className="absolute top-0 right-0 w-2 h-2 bg-rose-500 rounded-full ring-2 ring-white"></span>
              )}
            </button>

            {isNotifOpen && (
              <div className="absolute right-0 mt-3 w-80 bg-white rounded-lg shadow-xl border border-slate-200 overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-200">
                <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex justify-between items-center">
                  <h3 className="font-bold text-slate-900 text-sm">Notifications</h3>
                  {pendingRequests.length > 0 && (
                    <span className="bg-primary-100 text-primary-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                      {pendingRequests.length} new
                    </span>
                  )}
                </div>
                
                <div className="max-h-80 overflow-y-auto">
                  {pendingRequests.length === 0 ? (
                    <div className="p-6 text-center text-sm text-slate-500">
                      No new notifications
                    </div>
                  ) : (
                    pendingRequests.map(req => (
                      <div key={req.id} 
                        onClick={() => { setIsNotifOpen(false); navigate('/owner/requests'); }}
                        className="p-4 border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors"
                      >
                        <p className="text-sm font-semibold text-slate-900 flex items-center mb-1">
                          <Building className="w-3.5 h-3.5 mr-1.5 text-primary-600" />
                          {req.verifierName} requested:
                        </p>
                        <p className="text-xs text-slate-500 truncate">
                          {req.requestedFields.map(f => f.replace(/([A-Z])/g, ' $1').trim()).join(', ')}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        <aside className="w-64 bg-white border-r border-slate-200 flex flex-col shrink-0 relative z-20">
          <div className="flex-1 overflow-y-auto py-5">
            <nav className="space-y-1 px-3">
              {currentNavItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center justify-between px-3 py-2.5 rounded-md transition-colors text-sm font-medium ${
                      isActive 
                        ? 'bg-primary-50 text-primary-700' 
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`
                  }
                >
                  <div className="flex items-center">
                    <item.icon className={`w-4 h-4 mr-3 ${!location.pathname.includes(item.to) ? 'opacity-70' : ''}`} />
                    {item.label}
                  </div>
                  {('badge' in item && Boolean(item.badge)) && (
                    <span className="bg-rose-100 text-rose-700 py-0.5 px-2 rounded-full font-bold text-[10px]">
                      {item.badge}
                    </span>
                  )}
                </NavLink>
              ))}
            </nav>
          </div>
          
          <div className="p-3 border-t border-slate-200 space-y-1 bg-slate-50/50">
            <button className="w-full flex items-center px-3 py-2 rounded-md transition-colors text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900">
              <Settings className="w-4 h-4 mr-3 opacity-70" />
              Settings
            </button>
            <button className="w-full flex items-center px-3 py-2 rounded-md transition-colors text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900">
              <HelpCircle className="w-4 h-4 mr-3 opacity-70" />
              Help
            </button>
            <button 
              onClick={resetDemoData}
              className="w-full flex items-center px-3 py-2 rounded-md transition-colors text-xs font-bold text-rose-600 hover:bg-rose-50 mt-4 border border-rose-100"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-3" />
              Reset Demo Data
            </button>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 overflow-auto bg-slate-50 p-8 relative z-10">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
