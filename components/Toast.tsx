import React, { useEffect } from 'react';
import { CheckCircle, AlertTriangle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastMessage {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContainerProps {
  toasts: ToastMessage[];
  removeToast: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, removeToast }) => {
  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-3 w-full max-w-sm pointer-events-none">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={removeToast} />
      ))}
    </div>
  );
};

const ToastItem: React.FC<{ toast: ToastMessage; onRemove: (id: string) => void }> = ({ toast, onRemove }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onRemove(toast.id);
    }, 5000); // 5 Seconds duration

    return () => clearTimeout(timer);
  }, [toast.id, onRemove]);

  const styles = {
    success: { bg: 'bg-white', border: 'border-l-4 border-green-500', icon: <CheckCircle className="text-green-500" size={20} />, text: 'text-slate-800' },
    error: { bg: 'bg-white', border: 'border-l-4 border-red-500', icon: <AlertTriangle className="text-red-500" size={20} />, text: 'text-slate-800' },
    info: { bg: 'bg-white', border: 'border-l-4 border-blue-500', icon: <Info className="text-blue-500" size={20} />, text: 'text-slate-800' },
  };

  const style = styles[toast.type];

  return (
    <div className={`pointer-events-auto ${style.bg} ${style.border} p-4 rounded-lg shadow-2xl flex items-start gap-3 transform transition-all duration-300 animate-in slide-in-from-right-full fade-in`}>
      <div className="shrink-0 mt-0.5">{style.icon}</div>
      <div className={`flex-1 text-sm font-medium ${style.text}`}>
        {toast.message}
      </div>
      <button onClick={() => onRemove(toast.id)} className="text-slate-400 hover:text-slate-600 transition-colors">
        <X size={16} />
      </button>
    </div>
  );
};
