
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { KeyRound, Loader2 } from 'lucide-react';

const MIN_LEN = 6;

interface Props {
   onNotify: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export const ChangePasswordCard: React.FC<Props> = ({ onNotify }) => {
   const { updatePassword } = useAuth();
   const [password, setPassword] = useState('');
   const [confirm, setConfirm] = useState('');
   const [loading, setLoading] = useState(false);

   const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();

      if (password.length < MIN_LEN) {
         onNotify(`La contraseña debe tener al menos ${MIN_LEN} caracteres.`, 'error');
         return;
      }
      if (password !== confirm) {
         onNotify('Las contraseñas no coinciden.', 'error');
         return;
      }

      setLoading(true);
      try {
         const { error } = await updatePassword(password);
         if (error) throw error;
         onNotify('Contraseña actualizada correctamente.', 'success');
         setPassword('');
         setConfirm('');
      } catch (err: any) {
         const m = (err?.message || '').toLowerCase();
         if (m.includes('same') || m.includes('different from the old')) {
            onNotify('La nueva contraseña debe ser distinta a la anterior.', 'error');
         } else {
            onNotify('No se pudo actualizar la contraseña. Intenta de nuevo.', 'error');
         }
      } finally {
         setLoading(false);
      }
   };

   return (
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
         <h4 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
            <KeyRound size={16} className="text-amber-500" /> Cambiar Contraseña
         </h4>
         <form onSubmit={handleSubmit} className="space-y-4">
            <div>
               <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Nueva contraseña</label>
               <input
                  type="password"
                  autoComplete="new-password"
                  placeholder="••••••••"
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-amber-500 transition-all text-slate-900 text-sm"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
               />
            </div>
            <div>
               <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Confirmar contraseña</label>
               <input
                  type="password"
                  autoComplete="new-password"
                  placeholder="••••••••"
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-amber-500 transition-all text-slate-900 text-sm"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
               />
            </div>
            <button
               type="submit"
               disabled={loading || !password || !confirm}
               className="w-full py-2.5 rounded-lg font-bold text-white text-sm shadow-sm transition-all flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-60 disabled:cursor-not-allowed"
            >
               {loading ? <Loader2 size={16} className="animate-spin" /> : <><KeyRound size={16} /> Actualizar contraseña</>}
            </button>
            <p className="text-[10px] text-slate-400 text-center">Mínimo {MIN_LEN} caracteres. No necesitas correo para cambiarla.</p>
         </form>
      </div>
   );
};
