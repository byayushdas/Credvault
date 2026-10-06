import { Shield, CheckCircle2, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const navigate = useNavigate();

  const handleDemoLogin = (role: string) => {
    localStorage.setItem('credvault_role', role);
    if (role === 'Owner') {
      navigate('/owner/dashboard');
    } else {
      navigate('/');
    }
  };

  return (
    <div className="min-h-screen flex bg-slate-50 font-sans selection:bg-primary-100 selection:text-primary-900">
      
      {/* Left side: Branding */}
      <div className="hidden lg:flex lg:w-5/12 bg-primary-900 text-white flex-col justify-between p-12 relative overflow-hidden">
        {/* Decorative background elements */}
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-primary-800/50 via-primary-900 to-primary-950"></div>
        <div className="absolute -left-20 top-20 w-96 h-96 bg-primary-600/20 rounded-full blur-3xl"></div>
        
        <div className="relative z-10 flex items-center space-x-3">
          <div className="w-10 h-10 bg-white rounded-md flex items-center justify-center text-primary-700 shadow-lg">
            <Shield className="w-6 h-6" />
          </div>
          <span className="font-bold text-2xl tracking-tight">CredVault</span>
        </div>

        <div className="relative z-10 max-w-md my-auto">
          <h1 className="text-5xl font-bold leading-tight mb-6 tracking-tight">
            Your documents.<br />Your control.
          </h1>
          <p className="text-primary-200 text-lg leading-relaxed mb-10">
            Securely store verified credentials and share only the information you choose.
          </p>
          
          <div className="space-y-4">
            <div className="flex items-center text-primary-100">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 mr-3 shrink-0" />
              <span className="font-medium">Verified Issuers</span>
            </div>
            <div className="flex items-center text-primary-100">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 mr-3 shrink-0" />
              <span className="font-medium">Selective Disclosure</span>
            </div>
            <div className="flex items-center text-primary-100">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 mr-3 shrink-0" />
              <span className="font-medium">Consent-Controlled Sharing</span>
            </div>
          </div>
        </div>
        
        <div className="relative z-10 text-primary-400 text-sm font-medium">
          Enterprise Grade Identity Security
        </div>
      </div>

      {/* Right side: Login Card */}
      <div className="flex-1 flex flex-col justify-center items-center p-6 sm:p-12">
        <div className="w-full max-w-md">
          <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm mb-6">
            <div className="mb-8 text-center">
              <h2 className="text-2xl font-bold text-slate-900">Sign In</h2>
              <p className="text-slate-500 text-sm mt-2">Enter your credentials to access your vault</p>
            </div>

            <form className="space-y-5" onSubmit={(e) => e.preventDefault()}>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Email</label>
                <input 
                  type="email" 
                  className="w-full px-4 py-2.5 rounded-md border border-slate-300 focus:border-primary-500 focus:ring focus:ring-primary-500/20 outline-none transition-all text-sm"
                  placeholder="name@example.com"
                  readOnly
                />
              </div>
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-sm font-semibold text-slate-700">Password</label>
                  <a href="#" className="text-xs font-semibold text-primary-600 hover:text-primary-700">Forgot password?</a>
                </div>
                <input 
                  type="password" 
                  className="w-full px-4 py-2.5 rounded-md border border-slate-300 focus:border-primary-500 focus:ring focus:ring-primary-500/20 outline-none transition-all text-sm"
                  placeholder="••••••••"
                  readOnly
                />
              </div>
              <button 
                type="button"
                className="w-full bg-slate-900 text-white font-semibold py-2.5 rounded-md hover:bg-slate-800 transition-colors shadow-sm mt-2"
              >
                Sign In
              </button>
            </form>
          </div>

          <div className="relative mt-10 mb-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200"></div>
            </div>
            <div className="relative flex justify-center">
              <span className="bg-slate-50 px-4 text-xs font-bold uppercase tracking-wider text-slate-400">
                Demo Mode
              </span>
            </div>
          </div>

          <div className="space-y-3">
            <button 
              onClick={() => handleDemoLogin('Owner')}
              className="w-full flex items-center justify-between bg-white border border-primary-200 p-4 rounded-xl hover:border-primary-400 hover:shadow-sm transition-all group cursor-pointer"
            >
              <div className="flex flex-col text-left">
                <span className="font-bold text-slate-900">Continue as Document Owner</span>
                <span className="text-xs text-slate-500 mt-0.5">Manage and share your credentials</span>
              </div>
              <ArrowRight className="w-5 h-5 text-primary-400 group-hover:text-primary-600 group-hover:translate-x-1 transition-all" />
            </button>
            
            <button 
              onClick={() => handleDemoLogin('Issuer')}
              className="w-full flex items-center justify-between bg-white border border-slate-200 p-4 rounded-xl hover:border-slate-300 hover:shadow-sm transition-all group cursor-pointer"
            >
              <div className="flex flex-col text-left">
                <span className="font-bold text-slate-700">Continue as Issuer</span>
                <span className="text-xs text-slate-500 mt-0.5">Issue and verify new credentials</span>
              </div>
              <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-slate-600 group-hover:translate-x-1 transition-all" />
            </button>

            <button 
              onClick={() => handleDemoLogin('Verifier')}
              className="w-full flex items-center justify-between bg-white border border-slate-200 p-4 rounded-xl hover:border-slate-300 hover:shadow-sm transition-all group cursor-pointer"
            >
              <div className="flex flex-col text-left">
                <span className="font-bold text-slate-700">Continue as Verifier</span>
                <span className="text-xs text-slate-500 mt-0.5">Request and verify user credentials</span>
              </div>
              <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-slate-600 group-hover:translate-x-1 transition-all" />
            </button>
          </div>

          <p className="text-center text-xs text-slate-400 mt-8 font-medium">
            Local prototype — authentication is simulated.
          </p>
        </div>
      </div>
    </div>
  );
}
