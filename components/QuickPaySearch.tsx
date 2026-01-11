
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Search, Zap, X, ChevronRight } from 'lucide-react';
import { Client, Transaction } from '../types';

interface QuickPaySearchProps {
    isOpen: boolean;
    onClose: () => void;
    clients: Client[];
    clientMetrics: Record<string, { balance: number }>;
    onSelectClient: (client: Client) => void;
    formatCurrency: (val: number) => string;
}

export const QuickPaySearch: React.FC<QuickPaySearchProps> = ({
    isOpen, onClose, clients, clientMetrics, onSelectClient, formatCurrency
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    // Auto-focus search input when opened
    useEffect(() => {
        if (isOpen) {
            setSearchTerm('');
            setTimeout(() => inputRef.current?.focus(), 150);
        }
    }, [isOpen]);

    // Handle Escape key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    const results = useMemo(() => {
        if (!searchTerm.trim()) return [];
        const q = searchTerm.toLowerCase();
        return clients
            .filter(c =>
                c.status === 'ACTIVE' &&
                (c.name.toLowerCase().includes(q) || c.cardCode.includes(q) || c.cedula.includes(q))
            )
            .slice(0, 6);
    }, [clients, searchTerm]);

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-end md:items-start justify-center pt-0 md:pt-20 px-0 md:px-4 animate-in fade-in duration-200"
            onClick={onClose}
        >
            <div
                className="w-full max-w-xl bg-white rounded-t-[32px] md:rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[85vh] md:h-auto animate-in slide-in-from-bottom md:slide-in-from-top-4 duration-300"
                style={{ paddingBottom: 'var(--safe-area-bottom)' }}
                onClick={e => e.stopPropagation()}
            >
                {/* MOBILE DRAG HANDLE */}
                <div className="md:hidden flex justify-center py-3 bg-white shrink-0">
                    <div className="w-12 h-1.5 bg-slate-200 rounded-full"></div>
                </div>
                {/* Header */}
                <div className="p-4 border-b border-slate-100 flex items-center gap-4 bg-white relative">
                    <Search className="text-slate-400" size={20} />
                    <input
                        ref={inputRef}
                        type="text"
                        className="flex-1 text-lg font-medium outline-none text-slate-900 bg-white placeholder:text-slate-300"
                        placeholder="Buscar cliente para cobro rápido..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                    <button
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
                    >
                        <X size={20} />
                    </button>
                    <div className="absolute top-full left-0 right-0 h-1 bg-gradient-to-r from-blue-600 via-purple-600 to-emerald-600 opacity-20"></div>
                </div>

                {/* Body */}
                <div className="max-h-[60vh] overflow-y-auto bg-slate-50/50 p-3">
                    {searchTerm.trim() === '' ? (
                        <div className="p-10 text-center text-slate-400 flex flex-col items-center gap-3">
                            <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center text-blue-500 mb-2">
                                <Zap size={32} />
                            </div>
                            <span className="text-sm font-medium">Inicia un "Cobro Rápido" buscando por nombre o tarjeta.</span>
                            <div className="flex gap-2 mt-2">
                                <kbd className="px-2 py-1 bg-white border border-slate-200 rounded text-[10px] shadow-sm font-bold text-slate-500 uppercase">Esc</kbd>
                                <span className="text-[10px] text-slate-300 self-center">para cancelar</span>
                            </div>
                        </div>
                    ) : results.length === 0 ? (
                        <div className="p-10 text-center text-slate-400">
                            No se encontraron clientes activos con "{searchTerm}"
                        </div>
                    ) : (
                        <div className="grid gap-2">
                            {results.map(client => {
                                const metrics = clientMetrics[client.id] || { balance: 0 };
                                const balance = metrics.balance;
                                return (
                                    <button
                                        key={client.id}
                                        onClick={() => {
                                            onSelectClient(client);
                                            onClose();
                                        }}
                                        className="w-full bg-white p-4 rounded-xl shadow-sm border border-slate-200 hover:border-blue-500 hover:ring-1 hover:ring-blue-500 transition-all flex justify-between items-center group text-left"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center font-mono font-bold text-slate-500 border border-slate-200 group-hover:bg-blue-50 group-hover:text-blue-600 group-hover:border-blue-200 transition-colors">
                                                {client.cardCode}
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-slate-800 group-hover:text-blue-700 transition-colors">
                                                    {client.name}
                                                </h4>
                                                <div className="text-[10px] text-slate-400 uppercase font-bold tracking-tight">{client.cedula}</div>
                                            </div>
                                        </div>

                                        <div className="text-right">
                                            <div className="text-[10px] text-slate-400 uppercase font-black tracking-widest opacity-60">Deuda</div>
                                            <div className="text-md font-black text-slate-900 group-hover:text-emerald-600 transition-colors">
                                                {formatCurrency(balance)}
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="bg-white p-3 border-t border-slate-100 flex justify-between items-center px-5">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Acceso Directo a Cobros</span>
                    <div className="flex items-center gap-1 text-[10px] font-bold text-slate-300">
                        <ChevronRight size={12} /> Seleccione un cliente para continuar
                    </div>
                </div>
            </div>
        </div>
    );
};
