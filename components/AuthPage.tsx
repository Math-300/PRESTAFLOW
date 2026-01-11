
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Loader2, LogIn, UserPlus, AlertTriangle, CheckCircle, ShieldCheck, Lock } from 'lucide-react';

export const AuthPage: React.FC = () => {
   const [isLogin, setIsLogin] = useState(true);
   const [email, setEmail] = useState('');
   const [password, setPassword] = useState('');
   const [loading, setLoading] = useState(false);
   const [error, setError] = useState<string | null>(null);
   const [message, setMessage] = useState<string | null>(null);

   const { signIn, signUp } = useAuth();

   // Check for Invite Token in URL
   useEffect(() => {
      const params = new URLSearchParams(window.location.search);
      const inviteToken = params.get('invite');
      const inviteEmail = params.get('email');
      if (inviteToken) {
         setIsLogin(false); // Switch to Register
         if (inviteEmail) setEmail(inviteEmail); // Pre-fill email
         setMessage("Has recibido una invitación segura. Regístrate para unirte.");
      }
   }, []);

   const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      setMessage(null);
      setLoading(true);

      try {
         if (isLogin) {
            const { error } = await signIn(email, password);
            if (error) throw error;
         } else {
            const { error, data } = await signUp(email, password);
            if (error) throw error;
            if (data?.user && !data?.session) {
               setMessage('Registro exitoso. Revisa tu correo para confirmar.');
               setIsLogin(true); // Volver al login
            }
         }
      } catch (err: any) {
         // Security: Do not reveal exactly if email exists or password is wrong in generic messages if possible, 
         // though Supabase error messages are usually safe.
         setError('Credenciales inválidas o error de conexión.');
      } finally {
         setLoading(false);
      }
   };

   return (
      <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center p-4 relative overflow-hidden font-sans">

         {/* Background Decor */}
         <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
            <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] bg-blue-900/20 rounded-full blur-[100px]"></div>
            <div className="absolute bottom-[0%] right-[0%] w-[40%] h-[40%] bg-emerald-900/10 rounded-full blur-[100px]"></div>
         </div>

         <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden relative z-10 animate-in fade-in zoom-in-95 duration-300 border border-slate-800">

            {/* Header */}
            <div className="bg-slate-50 p-10 text-center border-b border-slate-100 flex flex-col items-center">
               <img src="/logo-light.png" alt="PrestaFlow Logo" className="h-16 w-auto object-contain mb-2 animate-in fade-in slide-in-from-top-4 duration-700" />
               <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-1.5 mt-2 bg-slate-100 px-3 py-1 rounded-full border border-slate-200">
                  <Lock size={10} className="text-emerald-500" /> Acceso Seguro y Encriptado
               </p>
            </div>


            {/* Form */}
            <div className="p-8 pt-6">
               <div className="flex gap-4 mb-6 bg-slate-100 p-1 rounded-lg">
                  <button
                     onClick={() => { setIsLogin(true); setError(null); setMessage(null); }}
                     className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${isLogin ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                     Iniciar Sesión
                  </button>
                  <button
                     onClick={() => { setIsLogin(false); setError(null); setMessage(null); }}
                     className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${!isLogin ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                     Registrarse
                  </button>
               </div>

               {error && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3 text-sm text-red-600 animate-in slide-in-from-top-2">
                     <AlertTriangle size={18} className="shrink-0 mt-0.5" />
                     <span>{error}</span>
                  </div>
               )}

               {message && (
                  <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3 text-sm text-green-700 animate-in slide-in-from-top-2">
                     <CheckCircle size={18} className="shrink-0 mt-0.5" />
                     <span>{message}</span>
                  </div>
               )}

               <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                     <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Correo Corporativo</label>
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
                     className={`w-full py-3 rounded-lg font-bold text-white shadow-lg transition-all flex items-center justify-center gap-2 mt-2
                    ${isLogin ? 'bg-blue-600 hover:bg-blue-700' : 'bg-emerald-600 hover:bg-emerald-700'}
                    disabled:opacity-70 disabled:cursor-not-allowed
                 `}
                  >
                     {loading ? <Loader2 size={20} className="animate-spin" /> : (
                        isLogin ? <><LogIn size={20} /> Acceder</> : <><UserPlus size={20} /> Crear Cuenta</>
                     )}
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
