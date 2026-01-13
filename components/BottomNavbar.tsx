
import React from 'react';
import { Folder, Landmark, Settings, Zap } from 'lucide-react';

interface BottomNavbarProps {
    currentView: string;
    onChangeView: (view: any) => void;
    onQuickPay?: () => void;
}

export const BottomNavbar: React.FC<BottomNavbarProps> = ({ currentView, onChangeView, onQuickPay }) => {
    return (
        <div
            className="md:hidden fixed bottom-0 left-0 right-0 glass-effect z-40 flex items-stretch justify-around px-2 shadow-[0_-4px_30px_rgba(0,0,0,0.04)]"
            style={{
                paddingBottom: 'max(12px, var(--safe-area-bottom))',
                height: 'calc(60px + max(12px, var(--safe-area-bottom)))'
            }}
        >
            <button
                onClick={() => onChangeView('CLIENTS_LIST')}
                className={`flex-1 flex flex-col items-center justify-center gap-1 transition-colors ${currentView === 'CLIENTS_LIST' || currentView === 'SINGLE_CLIENT' ? 'text-blue-600' : 'text-slate-400'}`}
            >
                <Folder size={20} className={currentView === 'CLIENTS_LIST' || currentView === 'SINGLE_CLIENT' ? 'fill-blue-50' : ''} />
                <span className="text-[10px] font-bold uppercase tracking-tighter">Resumen</span>
            </button>

            <button
                onClick={() => onChangeView('BANKS')}
                className={`flex-1 flex flex-col items-center justify-center gap-1 transition-colors ${currentView === 'BANKS' ? 'text-blue-600' : 'text-slate-400'}`}
            >
                <Landmark size={20} className={currentView === 'BANKS' ? 'fill-blue-50' : ''} />
                <span className="text-[10px] font-bold uppercase tracking-tighter">Bancos</span>
            </button>

            {/* CENTER ACTION: QUICK PAY OR NEW CLIENT */}
            <div className="flex-1 flex flex-col items-center justify-center relative -top-3">
                <button
                    onClick={onQuickPay}
                    className="w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg shadow-blue-200 flex items-center justify-center ring-4 ring-white active:scale-95 transition-transform"
                >
                    <Zap size={24} fill="white" />
                </button>
            </div>

            <button
                onClick={() => onChangeView('SETTINGS')}
                className={`flex-1 flex flex-col items-center justify-center gap-1 transition-colors ${currentView === 'SETTINGS' ? 'text-blue-600' : 'text-slate-400'}`}
            >
                <Settings size={20} className={currentView === 'SETTINGS' ? 'fill-blue-50' : ''} />
                <span className="text-[10px] font-bold uppercase tracking-tighter">Ajustes</span>
            </button>

            <div className="flex-1 flex flex-col items-center justify-center gap-1 text-slate-300 pointer-events-none opacity-20">
                <div className="w-5 h-5 border-2 border-current rounded-md"></div>
                <span className="text-[10px] font-bold uppercase tracking-tighter italic">Pro</span>
            </div>
        </div>
    );
};
