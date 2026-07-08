
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Loader2, LogIn, AlertTriangle, ShieldCheck, Lock } from 'lucide-react';

const mapAuthError = (raw: string): string => {
   const m = (raw || '').toLowerCase();
   if (m.includes('failed to fetch') || m.includes('network')) return 'Sin conexión. Verifica tu internet.';
   if (m.includes('email not confirmed')) return 'Confirma tu correo antes de acceder.';
   if (m.includes('too many') || m.includes('rate')) return 'Demasiados intentos. Espera unos minutos.';
   if (m.includes('invalid login') || m.includes('credentials')) return 'Correo o contraseña incorrectos.';
   return 'Ocurrió un error. Intenta de nuevo.';
};

export const AuthPage: React.FC = () => {
   const [email, setEmail] = useState('');
   const [password, setPassword] = useState('');
   const [loading, setLoading] = useState(false);
   const [error, setError] = useState<string | null>(null);

   const { signIn } = useAuth();

   const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      setLoading(true);

      try {
         const { error } = await signIn(email, password);
         if (error) throw error;
      } catch (err: any) {
         setError(mapAuthError(err?.message));
      } finally {
         setLoading(false);
      }
   };

   return (
      <div
         className="min-h-screen bg-slate-900 flex flex-col justify-center items-center p-4 relative overflow-hidden font-sans"
         style={{
            minHeight: '100dvh',
            backgroundColor: '#0f172a',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '1rem',
            position: 'relative',
            overflow: 'hidden'
         }}
      >

         {/* Background Decor */}
         <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
            <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] bg-blue-900/20 rounded-full blur-[100px]"></div>
            <div className="absolute bottom-[0%] right-[0%] w-[40%] h-[40%] bg-amber-900/10 rounded-full blur-[100px]"></div>
         </div>

         <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden relative z-10 animate-in fade-in zoom-in-95 duration-300 border border-slate-800">

            {/* Header / Brand */}
            <div className="bg-slate-50 p-10 text-center border-b border-slate-100 flex flex-col items-center">
               <span className="text-5xl mb-1 animate-in fade-in slide-in-from-top-4 duration-700" role="img" aria-label="Tigre">🐯</span>
               <h1 className="text-2xl font-extrabold tracking-tight text-slate-800">
                  Préstamos <span className="text-amber-500">El Tigre</span>
               </h1>
               <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-1.5 mt-3 bg-slate-100 px-3 py-1 rounded-full border border-slate-200">
                  <Lock size={10} className="text-emerald-500" /> Acceso Seguro y Encriptado
               </p>
            </div>


            {/* Form */}
            <div className="p-8 pt-6">
               <h2 className="text-center text-sm font-bold text-slate-500 uppercase tracking-wider mb-6">Iniciar Sesión</h2>

               {error && (
                  <div role="alert" className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3 text-sm text-red-600 animate-in slide-in-from-top-2">
                     <AlertTriangle size={18} className="shrink-0 mt-0.5" />
                     <span>{error}</span>
                  </div>
               )}

               <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                     <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Correo</label>
                     <input
                        type="email"
                        required
                        autoFocus
                        placeholder="nombre@empresa.com"
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 transition-all text-slate-900"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                     />
                  </div>

                  <div>
                     <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Contraseña</label>
                     <input
                        type="password"
                        required
                        placeholder="••••••••"
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 transition-all text-slate-900"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                     />
                  </div>

                  <button
                     type="submit"
                     disabled={loading}
                     className="w-full py-3 rounded-lg font-bold text-white shadow-lg transition-all flex items-center justify-center gap-2 mt-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                     {loading ? <Loader2 size={20} className="animate-spin" /> : <><LogIn size={20} /> Acceder</>}
                  </button>
               </form>
            </div>

            <div className="bg-slate-50 px-8 py-4 text-center border-t border-slate-100">
               <p className="text-xs text-slate-400 flex items-center justify-center gap-1">
                  <ShieldCheck size={12} /> Encriptación de extremo a extremo en tránsito.
               </p>
            </div>
         </div>
      </div>
   );
};
