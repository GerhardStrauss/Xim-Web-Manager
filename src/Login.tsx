import { signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from './lib/firebase';
import { Cpu, Smartphone, ShieldCheck } from 'lucide-react';
import { useState } from 'react';

interface LoginProps {
  onContinueOffline?: () => void;
}

export default function Login({ onContinueOffline }: LoginProps) {
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSignIn = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      console.error(error);
      if (
        error?.code === 'auth/unauthorized-domain' ||
        error?.code === 'auth/operation-not-supported-in-this-environment' ||
        error?.code === 'auth/popup-blocked'
      ) {
        setErrorMessage(
          `Native Android APK / WebView blocks Google OAuth browser popups (${error?.code}). Tap "Enter Standalone Hardware Mode" below to use the app and flash your XIM4!`
        );
      } else if (error?.code !== 'auth/popup-closed-by-user') {
        setErrorMessage(error?.message || 'Failed to sign in. You can continue in Standalone Hardware Mode below.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen w-full items-center justify-center bg-[#08090a] relative overflow-hidden">
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>
      <div className="bg-[#0c0d10] border border-cyan-500/20 p-8 rounded-2xl shadow-[0_0_50px_rgba(6,182,212,0.1)] flex flex-col items-center max-w-sm w-full mx-4 relative z-10">
        <div className="w-16 h-16 bg-cyan-500 rounded-lg flex items-center justify-center shadow-[0_0_20px_rgba(6,182,212,0.5)] mb-6">
          <Cpu className="text-black" size={32} strokeWidth={2.5} />
        </div>
        <h1 className="font-mono tracking-tighter text-3xl uppercase text-white m-0 leading-none mb-2">XIM <span className="text-cyan-400">WEB</span></h1>
        <p className="text-slate-500 uppercase tracking-widest text-xs font-semibold mb-8 text-center">Profile Manager</p>

        {errorMessage && (
          <div className="w-full mb-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-mono text-center leading-relaxed">
            {errorMessage}
          </div>
        )}
        
        <button 
          onClick={handleSignIn}
          disabled={loading}
          className="w-full bg-black/40 hover:bg-black/60 border border-white/10 hover:border-cyan-500/50 text-white font-mono tracking-widest text-xs uppercase py-3.5 px-4 rounded-lg flex items-center justify-center gap-3 transition-all duration-300 disabled:opacity-50 group hover:shadow-[0_0_15px_rgba(6,182,212,0.15)]"
        >
          <div className="bg-white p-1 rounded-sm w-6 h-6 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-full h-full" />
          </div>
          <span className="group-hover:text-cyan-400 transition-colors">{loading ? 'Authenticating...' : 'Sign in with Google'}</span>
        </button>

        {onContinueOffline && (
          <div className="w-full mt-4 pt-4 border-t border-white/10 flex flex-col gap-2">
            <button
              onClick={onContinueOffline}
              className="w-full bg-cyan-500 hover:bg-cyan-400 text-black font-mono font-bold tracking-widest text-xs uppercase py-3.5 px-4 rounded-lg flex items-center justify-center gap-2.5 transition-all shadow-[0_0_20px_rgba(6,182,212,0.3)]"
            >
              <Smartphone size={16} />
              <span>Enter Standalone Hardware Mode</span>
            </button>
            <p className="text-[10px] text-slate-400 text-center font-mono flex items-center justify-center gap-1">
              <ShieldCheck size={12} className="text-emerald-400 shrink-0" />
              <span>Recommended for Android APK &amp; Direct XIM4 Flashing</span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
