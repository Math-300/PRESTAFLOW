
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Loader2, KeyRound, AlertTriangle, CheckCircle, ShieldCheck } from 'lucide-react';

const MIN_LEN = 6;

export const UpdatePasswordScreen: React.FC = () => {
   const { updatePassword, signOut } = useAuth();
   const [password, setPassword] = useState('');
   const [confirm, setConfirm] = useState('');
   const [loading, setLoading] = useState(false);
   const [error, setError] = useState<string | null>(null);
   const [done, setDone] = useState(false);

   const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);

      if (password.length < MIN_LEN) {
         setError(`La contraseña debe tener al menos ${MIN_LEN} caracteres.`);
         return;
      }
      if (password !== confirm) {
         setError('Las contraseñas no coinciden.');
         return;
      }

      setLoading(true);
      try {
         const { error } = await updatePassword(password);
         if (error) throw error;
         setDone(true);
         // updatePassword ya desactiva isRecovery; la app entrará sola en 1.5s.
      } catch (err: any) {
         const m = (err?.message || '').toLowerCase();
         if (m.includes('same') || m.includes('different from the old')) {
            setError('La nueva contraseña debe ser distinta a la anterior.');
         } else if (m.includes('expired') || m.includes('invalid')) {
            setError('El enlace expiró. Solicita uno nuevo desde "¿Olvidaste tu contraseña?".');
         } else {
            setError('No se pudo actualizar. Intenta de nuevo.');
         }
         setLoading(false);
      }
   };

   return (
      <div
         className="min-h-screen bg-slate-900 flex flex-col justify-center items-center p-4 relative overflow-hidden font-sans"
         style={{ minHeight: '100dvh', backgroundColor: '#0f172a' }}
      >
         <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
            <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] bg-amber-900/20 rounded-full blur-[100px]"></div>
         </div>

         <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden relative z-10 animate-in fade-in zoom-in-95 duration-300 border border-slate-800">
            <div className="bg-slate-50 p-8 text-center border-b border-slate-100 flex flex-col items-center">
               <span className="text-5xl mb-1" role="img" aria-label="Tigre">🐯</span>
               <h1 className="text-xl font-extrabold tracking-tight text-slate-800">Nueva contraseña</h1>
               <p className="text-slate-400 text-xs mt-1">Préstamos El Tigre</p>
            </div>

            <div className="p-8 pt-6">
               {done ? (
                  <div className="text-center py-4">
                     <CheckCircle size={48} className="text-emerald-500 mx-auto mb-3" />
                     <p className="text-slate-700 font-bold">¡Contraseña actualizada!</p>
                     <p className="text-slate-400 text-sm mt-1">Entrando…</p>
                     <Loader2 size={20} className="animate-spin text-blue-500 mx-auto mt-3" />
                  </div>
               ) : (
                  <>
                     {error && (
                        <div role="alert" className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3 text-sm text-red-600">
                           <AlertTriangle size={18} className="shrink-0 mt-0.5" />
                           <span>{error}</span>
                        </div>
                     )}

                     <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                           <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nueva contraseña</label>
                           <input
                              type="password"
                              required
                              autoFocus
                              placeholder="••••••••"
                              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-amber-500 transition-all text-slate-900"
                              value={password}
                              onChange={e => setPassword(e.target.value)}
                           />
                        </div>
                        <div>
                           <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Confirmar contraseña</label>
                           <input
                              type="password"
                              required
                              placeholder="••••••••"
                              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-amber-500 transition-all text-slate-900"
                              value={confirm}
                              onChange={e => setConfirm(e.target.value)}
                           />
                        </div>

                        <button
                           type="submit"
                           disabled={loading}
                           className="w-full py-3 rounded-lg font-bold text-white shadow-lg transition-all flex items-center justify-center gap-2 mt-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                           {loading ? <Loader2 size={20} className="animate-spin" /> : <><KeyRound size={20} /> Guardar contraseña</>}
                        </button>

                        <button
                           type="button"
                           onClick={() => signOut()}
                           className="w-full text-center text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors pt-1"
                        >
                           Cancelar
                        </button>
                     </form>
                  </>
               )}
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
